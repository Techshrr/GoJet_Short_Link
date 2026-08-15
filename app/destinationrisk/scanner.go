package destinationrisk

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Decision string

const (
	Allow  Decision = "allow"
	Review Decision = "review"
	Block  Decision = "block"
)

type Category string

const (
	CategoryAdult             Category = "adult_content"
	CategoryGambling          Category = "gambling"
	CategoryFraud             Category = "fraud_phishing_impersonation"
	CategoryMalware           Category = "malware"
	CategoryExtremism         Category = "extremism_disinformation"
	CategoryViolenceHate      Category = "violence_hate_terrorism"
	CategoryCopyright         Category = "copyright_redistribution"
	CategoryPyramidMarketing  Category = "pyramid_deceptive_marketing"
	CategoryAccountResale     Category = "unauthorized_account_resale"
	CategoryHarmfulAutomation Category = "harmful_automation"
	CategorySpam              Category = "bulk_spam"
	CategoryPlatformSecurity  Category = "platform_security"
)

type Evidence struct {
	URL         string   `json:"url"`
	FinalURL    string   `json:"final_url,omitempty"`
	StatusCode  int      `json:"status_code,omitempty"`
	ContentType string   `json:"content_type,omitempty"`
	Signals     []string `json:"signals,omitempty"`
	Error       string   `json:"error,omitempty"`
}

type Assessment struct {
	Decision   Decision   `json:"decision"`
	Score      int        `json:"score"`
	Categories []Category `json:"categories"`
	Evidence   []Evidence `json:"evidence"`
	Provider   string     `json:"provider"`
	ScannedURL string     `json:"scanned_url"`
	FinalURL   string     `json:"final_url"`
	ScannedAt  time.Time  `json:"scanned_at"`
	NextScanAt time.Time  `json:"next_scan_at"`
}

type Snapshot struct {
	URL         string
	FinalURL    string
	StatusCode  int
	ContentType string
	Title       string
	Body        string
	Headers     map[string]string
}

type ProviderResult struct {
	Decision   Decision
	Score      int
	Categories []Category
	Signals    []string
}

type Provider interface {
	Assess(context.Context, Snapshot) (ProviderResult, error)
	Name() string
}

type Scanner struct {
	Resolver     *net.Resolver
	Provider     Provider
	Timeout      time.Duration
	MaxRedirects int
	MaxBodyBytes int64
}

func New(provider Provider) *Scanner {
	return &Scanner{
		Resolver:     net.DefaultResolver,
		Provider:     provider,
		Timeout:      5 * time.Second,
		MaxRedirects: 4,
		MaxBodyBytes: 512 << 10,
	}
}

type targetError struct {
	decision Decision
	category Category
	message  string
}

func (e *targetError) Error() string { return e.message }

func rank(value Decision) int {
	switch value {
	case Block:
		return 3
	case Review:
		return 2
	default:
		return 1
	}
}

func decisionForScore(score int) Decision {
	if score >= 90 {
		return Block
	}
	if score >= 45 {
		return Review
	}
	return Allow
}

func maxScore(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func appendCategory(categories []Category, category Category) []Category {
	for _, existing := range categories {
		if existing == category {
			return categories
		}
	}
	return append(categories, category)
}

func applyRisk(out *Assessment, seenCategories map[Category]bool, raw, finalURL string, score int, categories []Category, decision Decision) {
	for _, category := range categories {
		if !seenCategories[category] {
			seenCategories[category] = true
			out.Categories = append(out.Categories, category)
		}
	}
	if score > out.Score {
		out.Score = score
	}
	if rank(decision) > rank(out.Decision) {
		out.Decision = decision
		out.ScannedURL = raw
		if finalURL != "" {
			out.FinalURL = finalURL
		}
	} else if out.FinalURL == "" && finalURL != "" {
		out.FinalURL = finalURL
	}
}

// publicFetchError deliberately converts transport failures into stable public
// messages. net/http errors frequently contain the local socket address and the
// remote peer. Those implementation details must never be persisted as risk
// evidence or shown in the administrator UI.
func publicFetchError(err error) string {
	if err == nil {
		return ""
	}
	var targetErr *targetError
	if errors.As(err, &targetErr) {
		return targetErr.message
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) && urlErr.Err != nil {
		return publicFetchError(urlErr.Err)
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "destination request timed out"
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return "destination request timed out"
		}
		return "destination network connection failed"
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return "destination response ended unexpectedly"
	}
	return "destination request failed"
}

func (s *Scanner) Assess(ctx context.Context, targets []string) Assessment {
	now := time.Now().UTC()
	out := Assessment{Decision: Allow, Provider: "builtin", ScannedAt: now, NextScanAt: now.Add(24 * time.Hour)}
	seenTargets := map[string]bool{}
	seenCategories := map[Category]bool{}

	for _, raw := range targets {
		raw = strings.TrimSpace(raw)
		if raw == "" || seenTargets[raw] {
			continue
		}
		seenTargets[raw] = true
		if out.ScannedURL == "" {
			out.ScannedURL = raw
		}

		// URL semantics are evaluated before DNS and HTTP. This does not rely on
		// a blacklist of named sites: only generic policy terms are considered.
		// It ensures clearly descriptive prohibited destinations cannot evade the
		// policy merely by refusing the scanner connection.
		preScore, preCategories, preSignals := classify(Snapshot{URL: raw, FinalURL: raw, Headers: map[string]string{}})
		preDecision := decisionForScore(preScore)
		evidence := Evidence{URL: raw}

		if _, err := s.validateTarget(ctx, raw); err != nil {
			localScore := preScore
			localCategories := append([]Category(nil), preCategories...)
			localDecision := preDecision
			var targetErr *targetError
			if errors.As(err, &targetErr) {
				evidence.Error = targetErr.message
				evidence.Signals = append(evidence.Signals, preSignals...)
				evidence.Signals = append(evidence.Signals, "network_target_rejected")
				localCategories = appendCategory(localCategories, targetErr.category)
				if rank(targetErr.decision) > rank(localDecision) {
					localDecision = targetErr.decision
				}
				if targetErr.decision == Block {
					localScore = maxScore(localScore, 100)
				} else {
					localScore = maxScore(localScore, 45)
				}
			} else {
				evidence.Error = publicFetchError(err)
				evidence.Signals = append(evidence.Signals, preSignals...)
				evidence.Signals = append(evidence.Signals, "network_validation_failed")
				if rank(Review) > rank(localDecision) {
					localDecision = Review
				}
				localScore = maxScore(localScore, 45)
			}
			out.Evidence = append(out.Evidence, evidence)
			applyRisk(&out, seenCategories, raw, raw, localScore, localCategories, localDecision)
			continue
		}

		snapshot, err := s.fetch(ctx, raw)
		if err != nil {
			localScore := maxScore(preScore, 45)
			localDecision := preDecision
			if rank(Review) > rank(localDecision) {
				localDecision = Review
			}
			evidence.Error = publicFetchError(err)
			evidence.Signals = append(evidence.Signals, preSignals...)
			evidence.Signals = append(evidence.Signals, "network_fetch_failed")
			out.Evidence = append(out.Evidence, evidence)
			applyRisk(&out, seenCategories, raw, raw, localScore, preCategories, localDecision)
			continue
		}

		evidence.FinalURL = snapshot.FinalURL
		evidence.StatusCode = snapshot.StatusCode
		evidence.ContentType = snapshot.ContentType
		score, categories, signals := classify(snapshot)
		evidence.Signals = append(evidence.Signals, signals...)
		localDecision := decisionForScore(score)

		if s.Provider != nil {
			providerResult, providerErr := s.Provider.Assess(ctx, snapshot)
			if providerErr != nil {
				evidence.Signals = append(evidence.Signals, "provider_unavailable")
				if rank(Review) > rank(localDecision) {
					localDecision = Review
				}
				if score < 45 {
					score = 45
				}
			} else {
				out.Provider = "builtin+" + s.Provider.Name()
				if providerResult.Score > score {
					score = providerResult.Score
				}
				if rank(providerResult.Decision) > rank(localDecision) {
					localDecision = providerResult.Decision
				}
				for _, category := range providerResult.Categories {
					categories = appendCategory(categories, category)
				}
				evidence.Signals = append(evidence.Signals, providerResult.Signals...)
			}
		}

		out.Evidence = append(out.Evidence, evidence)
		applyRisk(&out, seenCategories, raw, snapshot.FinalURL, score, categories, localDecision)
	}

	if len(seenTargets) == 0 {
		out.Decision = Block
		out.Score = 100
		out.Categories = []Category{CategoryPlatformSecurity}
		out.Evidence = []Evidence{{Error: "no destination supplied", Signals: []string{"missing_destination"}}}
	}

	switch out.Decision {
	case Review:
		out.NextScanAt = now.Add(time.Hour)
	case Block:
		out.NextScanAt = now.Add(6 * time.Hour)
	default:
		out.NextScanAt = now.Add(24 * time.Hour)
	}
	return out
}

func (s *Scanner) validateTarget(ctx context.Context, raw string) (*url.URL, error) {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, &targetError{Block, CategoryPlatformSecurity, "destination must be an absolute HTTP(S) URL"}
	}
	if parsed.User != nil {
		return nil, &targetError{Block, CategoryPlatformSecurity, "credentials in destination URLs are not allowed"}
	}
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") || host == "metadata.google.internal" {
		return nil, &targetError{Block, CategoryPlatformSecurity, "local or metadata hosts are not allowed"}
	}
	if port := parsed.Port(); port != "" {
		if _, blocked := map[string]bool{"22": true, "25": true, "2375": true, "2376": true, "3306": true, "5432": true, "6379": true, "9200": true, "11211": true, "27017": true}[port]; blocked {
			return nil, &targetError{Block, CategoryPlatformSecurity, "destination uses a protected service port"}
		}
		if _, err = strconv.Atoi(port); err != nil {
			return nil, &targetError{Block, CategoryPlatformSecurity, "invalid destination port"}
		}
	}
	ips, err := s.lookup(ctx, host)
	if err != nil || len(ips) == 0 {
		return nil, &targetError{Review, CategoryPlatformSecurity, "destination DNS could not be verified"}
	}
	for _, ip := range ips {
		if !publicIP(ip) {
			return nil, &targetError{Block, CategoryPlatformSecurity, "destination resolves to a private, local or reserved network"}
		}
	}
	return parsed, nil
}

func (s *Scanner) lookup(ctx context.Context, host string) ([]net.IP, error) {
	if parsed := net.ParseIP(host); parsed != nil {
		return []net.IP{parsed}, nil
	}
	resolver := s.Resolver
	if resolver == nil {
		resolver = net.DefaultResolver
	}
	return resolver.LookupIP(ctx, "ip", host)
}

func publicIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	if addr.IsLoopback() || addr.IsPrivate() || addr.IsUnspecified() || addr.IsMulticast() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() {
		return false
	}
	blocked := []netip.Prefix{
		netip.MustParsePrefix("0.0.0.0/8"),
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("198.18.0.0/15"),
		netip.MustParsePrefix("240.0.0.0/4"),
		netip.MustParsePrefix("::/128"),
	}
	for _, prefix := range blocked {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

func (s *Scanner) fetch(ctx context.Context, raw string) (Snapshot, error) {
	maxRedirects := s.MaxRedirects
	if maxRedirects < 1 {
		maxRedirects = 4
	}
	maxBody := s.MaxBodyBytes
	if maxBody < 64<<10 {
		maxBody = 512 << 10
	}
	timeout := s.Timeout
	if timeout <= 0 || timeout > 15*time.Second {
		timeout = 5 * time.Second
	}

	dialer := &net.Dialer{Timeout: 3 * time.Second, KeepAlive: -1}
	transport := &http.Transport{
		Proxy:             nil,
		DisableKeepAlives: true,
		TLSClientConfig:   &tls.Config{MinVersion: tls.VersionTLS12},
		DialContext: func(dialCtx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, errors.New("destination address is invalid")
			}
			ips, err := s.lookup(dialCtx, host)
			if err != nil || len(ips) == 0 {
				return nil, fmt.Errorf("destination DNS lookup failed")
			}
			for _, ip := range ips {
				if !publicIP(ip) {
					return nil, fmt.Errorf("destination resolved to a protected network")
				}
			}
			return dialer.DialContext(dialCtx, network, net.JoinHostPort(ips[0].String(), port))
		},
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return errors.New("too many destination redirects")
			}
			_, err := s.validateTarget(req.Context(), req.URL.String())
			return err
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
	if err != nil {
		return Snapshot{}, err
	}
	req.Header.Set("User-Agent", "GoJet-Destination-Risk/1.3")
	req.Header.Set("Accept", "text/html,text/plain;q=0.9,*/*;q=0.1")
	response, err := client.Do(req)
	if err != nil {
		return Snapshot{}, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxBody+1))
	if err != nil {
		return Snapshot{}, err
	}
	if int64(len(body)) > maxBody {
		body = body[:maxBody]
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(response.Header.Get("Content-Type"), ";")[0]))
	text := string(body)
	return Snapshot{
		URL:         raw,
		FinalURL:    response.Request.URL.String(),
		StatusCode:  response.StatusCode,
		ContentType: contentType,
		Title:       extractTitle(text),
		Body:        text,
		Headers: map[string]string{
			"content-disposition": response.Header.Get("Content-Disposition"),
			"server":              response.Header.Get("Server"),
		},
	}, nil
}

func extractTitle(body string) string {
	lower := strings.ToLower(body)
	start := strings.Index(lower, "<title")
	if start < 0 {
		return ""
	}
	tagEnd := strings.Index(lower[start:], ">")
	if tagEnd < 0 {
		return ""
	}
	start += tagEnd
	end := strings.Index(lower[start+1:], "</title>")
	if end < 0 {
		return ""
	}
	value := body[start+1 : start+1+end]
	value = strings.NewReplacer("\n", " ", "\r", " ", "\t", " ").Replace(value)
	return strings.TrimSpace(value)
}

func classify(snapshot Snapshot) (int, []Category, []string) {
	finalURL := strings.ToLower(strings.TrimSpace(snapshot.FinalURL))
	if finalURL == "" {
		finalURL = strings.ToLower(strings.TrimSpace(snapshot.URL))
	}
	text := strings.ToLower(finalURL + "\n" + snapshot.Title + "\n" + snapshot.Body)
	urlText := normalizedURLText(finalURL)
	score := 0
	categories := []Category{}
	signals := []string{}
	seen := map[Category]bool{}

	add := func(category Category, points int, signal string) {
		if !seen[category] {
			seen[category] = true
			categories = append(categories, category)
		}
		score += points
		signals = append(signals, signal)
	}
	containsAny := func(values ...string) bool {
		for _, value := range values {
			if strings.Contains(text, strings.ToLower(value)) {
				return true
			}
		}
		return false
	}
	countGroups := func(groups ...[]string) int {
		count := 0
		for _, group := range groups {
			for _, value := range group {
				if strings.Contains(text, strings.ToLower(value)) {
					count++
					break
				}
			}
		}
		return count
	}
	urlGroups := func(groups ...[]string) int {
		count := 0
		for _, group := range groups {
			if containsURLLexeme(urlText, group...) {
				count++
			}
		}
		return count
	}

	// Adult content: use generic URL semantics plus page evidence. Never rely on
	// a list of known adult domains. A single generic URL lexeme is review-level;
	// corroboration from independent URL/content groups elevates to block.
	adultURLGroups := urlGroups(
		[]string{"adult", "porn", "porno", "pornographic", "nsfw", "xxx"},
		[]string{"hentai", "uncensored", "hardcore", "nude", "nudity", "sexcam", "sexvideo"},
		[]string{"jav", "avideo"},
	)
	adultContentGroups := countGroups(
		[]string{"porn video", "porn videos", "pornography", "adult video", "adult videos", "成人视频", "色情视频", "成人影片", "成人内容"},
		[]string{"uncensored", "hardcore sex", "xxx video", "sex video", "nude video", "hentai video", "乱子伦AV片", "无码AV", "无码av", "无码AV", "情色影片"},
		[]string{"adult cam", "live sex cam", "18+ only", "adults only", "色情直播", "成人直播", "裸聊"},
	)
	contextualAdultReference := containsAny("academic research", "research paper", "news report", "content moderation policy", "sexual health education", "学术研究", "新闻报道", "内容审核政策", "性健康教育")
	if adultURLGroups >= 2 {
		add(CategoryAdult, 95, "adult_url_semantic_combination")
	} else if adultURLGroups == 1 {
		add(CategoryAdult, 50, "adult_url_semantic_signal")
	}
	if adultContentGroups >= 2 && !contextualAdultReference {
		add(CategoryAdult, 95, "adult_content_combination")
	} else if adultContentGroups >= 1 {
		add(CategoryAdult, 55, "adult_content_signal")
	}
	if adultURLGroups >= 1 && adultContentGroups >= 1 && !contextualAdultReference {
		add(CategoryAdult, 40, "adult_url_content_corroboration")
	}

	// Gambling uses the same generic multi-signal model.
	gamblingURLGroups := urlGroups(
		[]string{"casino", "betting", "sportsbook", "bookmaker", "wager"},
		[]string{"slots", "baccarat", "roulette", "poker", "lottery"},
		[]string{"jackpot", "odds", "cashout"},
	)
	gamblingContentGroups := countGroups(
		[]string{"online casino", "live casino", "sports betting", "place a bet", "博彩", "赌场", "体育投注", "在线下注"},
		[]string{"casino deposit", "bet deposit", "cashout casino", "withdraw winnings", "赌资充值", "赌场充值", "博彩提现"},
		[]string{"casino bonus", "betting odds", "free spins", "jackpot", "下注送彩金", "赔率", "首存彩金"},
	)
	if gamblingURLGroups >= 2 {
		add(CategoryGambling, 95, "gambling_url_semantic_combination")
	} else if gamblingURLGroups == 1 {
		add(CategoryGambling, 50, "gambling_url_semantic_signal")
	}
	if gamblingContentGroups >= 2 {
		add(CategoryGambling, 95, "gambling_content_combination")
	} else if gamblingContentGroups == 1 {
		add(CategoryGambling, 60, "gambling_content_signal")
	}
	if gamblingURLGroups >= 1 && gamblingContentGroups >= 1 {
		add(CategoryGambling, 40, "gambling_url_content_corroboration")
	}

	criticalCredential := containsAny(
		"seed phrase", "recovery phrase", "wallet recovery words", "private key", "mnemonic phrase",
		"助记词", "恢复短语", "钱包私钥", "输入私钥",
	)
	authCredential := containsAny(
		"confirm your password", "enter your password", "password", "verification code", "one-time password", "otp code",
		"确认密码", "输入密码", "验证码", "短信验证码",
	)
	accountThreat := containsAny(
		"verify your account", "account suspended", "account locked", "security alert", "unusual activity", "urgent verification",
		"验证您的账户", "账户异常", "账号异常", "账户冻结", "账号冻结", "立即验证", "安全提醒",
	)
	deceptiveLure := containsAny(
		"claim your reward", "claim bonus", "airdrop claim", "refund now", "avoid suspension", "restore access",
		"领取奖励", "领取空投", "立即退款", "恢复访问", "避免封禁",
	)
	impersonation := containsAny(
		"official customer service", "official support team", "security department", "account verification center",
		"官方客服", "客服专员", "安全中心", "账户验证中心",
	)
	if criticalCredential {
		add(CategoryFraud, 95, "critical_credential_request")
	} else {
		fraudGroups := countGroups(
			[]string{"verify your account", "account suspended", "account locked", "账户异常", "账号冻结", "立即验证"},
			[]string{"claim your reward", "airdrop claim", "refund now", "领取奖励", "领取空投", "立即退款"},
			[]string{"official customer service", "security department", "官方客服", "安全中心"},
		)
		if authCredential && fraudGroups >= 2 {
			add(CategoryFraud, 95, "credential_deception_combination")
		} else if authCredential && (accountThreat || (impersonation && deceptiveLure)) {
			add(CategoryFraud, 70, "credential_account_threat_combination")
		}
	}

	malwareGroups := countGroups(
		[]string{"ransomware", "trojan", "keylogger", "botnet malware", "spyware", "木马", "勒索软件", "盗号木马", "间谍软件"},
		[]string{"payload.exe", "dropper.exe", "download payload", "execute powershell", "disable antivirus", "绕过杀毒", "下载载荷", "执行木马"},
		[]string{"steal cookies", "token stealer", "browser stealer", "remote access trojan", "窃取 cookie", "盗取 token", "远控木马"},
	)
	suspiciousPayload := containsAny(".scr", ".ps1", ".bat", ".cmd", "payload.exe", "dropper.exe") || strings.Contains(strings.ToLower(snapshot.Headers["content-disposition"]), ".exe")
	if malwareGroups >= 2 {
		add(CategoryMalware, 95, "malware_content_combination")
	} else if malwareGroups == 1 {
		add(CategoryMalware, 70, "malware_content_signal")
	}
	if malwareGroups >= 1 && suspiciousPayload {
		add(CategoryMalware, 30, "malware_payload_corroboration")
	}

	extremismGroups := countGroups(
		[]string{"terrorist propaganda", "extremist propaganda", "extremist manifesto", "恐怖主义宣传", "极端主义宣言"},
		[]string{"join our extremist movement", "join the caliphate", "recruit fighters", "加入极端组织", "招募武装人员"},
		[]string{"coordinated disinformation campaign", "fabricated influence operation", "有组织虚假信息", "操纵舆论行动"},
	)
	if extremismGroups >= 2 {
		add(CategoryExtremism, 95, "extremism_combination")
	} else if extremismGroups == 1 {
		add(CategoryExtremism, 60, "extremism_disinformation_signal")
	}
	violenceGroups := countGroups(
		[]string{"terror attack instructions", "bomb attack instructions", "mass casualty instructions", "恐怖袭击教程", "爆炸袭击教程"},
		[]string{"racial extermination", "kill all ", "genocide advocacy", "种族灭绝", "杀光"},
		[]string{"hate group recruitment", "terror recruitment", "仇恨组织招募", "恐怖组织招募"},
	)
	if violenceGroups >= 2 {
		add(CategoryViolenceHate, 95, "violence_hate_combination")
	} else if violenceGroups == 1 {
		add(CategoryViolenceHate, 75, "violence_hate_signal")
	}

	copyrightGroups := countGroups(
		[]string{"pirated download", "piracy download", "warez", "盗版下载", "未授权影视下载", "盗版影视"},
		[]string{"cracked software", "software crack", "serial key generator", "keygen", "破解软件", "免激活破解"},
		[]string{"torrent piracy", "download full movie free", "watch paid movie free", "电影磁力下载", "会员影视免费下载"},
	)
	if copyrightGroups >= 2 {
		add(CategoryCopyright, 95, "copyright_redistribution_combination")
	} else if copyrightGroups == 1 {
		add(CategoryCopyright, 60, "copyright_redistribution_signal")
	}

	pyramidGroups := countGroups(
		[]string{"pyramid scheme", "recruit downline", "multi level recruitment", "传销", "发展下线", "拉人头"},
		[]string{"guaranteed returns by recruiting", "risk free guaranteed return", "稳赚不赔", "保本高收益", "静态收益"},
		[]string{"tier commission", "multi-level commission", "层级返佣", "团队计酬", "下线返利"},
	)
	if pyramidGroups >= 2 {
		add(CategoryPyramidMarketing, 95, "pyramid_marketing_combination")
	} else if pyramidGroups == 1 {
		add(CategoryPyramidMarketing, 65, "pyramid_marketing_signal")
	}

	resaleGroups := countGroups(
		[]string{"verified account for sale", "sell accounts", "account marketplace", "账号出售", "成品号出售", "平台账户转售"},
		[]string{"rent verified account", "real-name account rental", "实名账号出租", "实名账户出租"},
		[]string{"bulk accounts", "aged accounts", "批发账号", "批量账号", "老号批发"},
	)
	if resaleGroups >= 2 {
		add(CategoryAccountResale, 95, "account_resale_combination")
	} else if resaleGroups == 1 {
		add(CategoryAccountResale, 60, "account_resale_signal")
	}

	ddos := containsAny("ddos", "layer 7 attack", "http flood", "cc attack", "拒绝服务攻击", "洪水攻击")
	booter := containsAny("booter", "stresser", "attack panel", "压力攻击平台", "代打流量", "攻击面板")
	abuseService := containsAny("attack for hire", "stress any website", "take website offline", "代打网站", "网站打死", "攻击租用")
	if (ddos && booter) || (ddos && abuseService) || (booter && abuseService) {
		add(CategoryHarmfulAutomation, 95, "harmful_automation_combination")
		add(CategoryPlatformSecurity, 20, "platform_security_corroboration")
	} else if ddos || booter || abuseService {
		add(CategoryHarmfulAutomation, 60, "harmful_automation_signal")
	}

	bulk := containsAny("bulk sms", "mass dm", "email blaster", "bulk email sender", "群发短信", "批量私信", "邮件群发器", "批量群发")
	unsolicited := containsAny("scraped leads", "no opt-in", "without consent", "无需授权", "免同意群发", "采集号码", "撞库号码")
	evasion := containsAny("bypass spam filter", "rotate sender accounts", "avoid anti-spam", "绕过反垃圾", "轮换发信账号")
	if bulk && (unsolicited || evasion) {
		add(CategorySpam, 95, "unsolicited_bulk_combination")
	} else if bulk {
		add(CategorySpam, 55, "bulk_messaging_signal")
	}

	platformAbuseGroups := countGroups(
		[]string{"credential stuffing", "account checker", "撞库平台", "账号检测器"},
		[]string{"carding panel", "stolen card checker", "盗刷平台", "黑卡检测"},
		[]string{"token grabber", "cookie stealer", "session hijacker", "盗取 token", "会话劫持"},
		[]string{"exploit kit", "zero-day sale", "漏洞利用包", "0day 出售"},
	)
	if platformAbuseGroups >= 2 {
		add(CategoryPlatformSecurity, 95, "platform_abuse_combination")
	} else if platformAbuseGroups == 1 {
		add(CategoryPlatformSecurity, 75, "platform_abuse_signal")
	}

	if score > 100 {
		score = 100
	}
	return score, categories, signals
}

func normalizedURLText(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return strings.ToLower(raw)
	}
	joined := strings.ToLower(parsed.Hostname() + " " + parsed.EscapedPath() + " " + parsed.RawQuery)
	return strings.Map(func(r rune) rune {
		switch r {
		case '.', '-', '_', '/', '\\', '?', '&', '=', '+', ':', '%':
			return ' '
		default:
			return r
		}
	}, joined)
}

// containsURLLexeme recognises policy semantics without embedding any known
// destination brands. Exact tokens are accepted; longer generic terms may also
// appear as a prefix/suffix in a domain label such as "adultvideos" or
// "casino-bonus". Three-character terms remain exact to avoid "jav" matching
// "javascript" and similar false positives.
func containsURLLexeme(normalized string, values ...string) bool {
	fields := strings.Fields(strings.ToLower(normalized))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value == "" {
			continue
		}
		if strings.Contains(value, " ") {
			if strings.Contains(" "+normalized+" ", " "+value+" ") {
				return true
			}
			continue
		}
		for _, field := range fields {
			if field == value {
				return true
			}
			if len(value) >= 4 && (strings.HasPrefix(field, value) || strings.HasSuffix(field, value)) {
				return true
			}
		}
	}
	return false
}
