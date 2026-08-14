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
		evidence := Evidence{URL: raw}
		if _, err := s.validateTarget(ctx, raw); err != nil {
			var targetErr *targetError
			if errors.As(err, &targetErr) {
				evidence.Error = targetErr.message
				evidence.Signals = []string{"network_target_rejected"}
				out.Evidence = append(out.Evidence, evidence)
				if !seenCategories[targetErr.category] {
					seenCategories[targetErr.category] = true
					out.Categories = append(out.Categories, targetErr.category)
				}
				if rank(targetErr.decision) > rank(out.Decision) {
					out.Decision = targetErr.decision
					out.ScannedURL = raw
				}
				if targetErr.decision == Block && out.Score < 100 {
					out.Score = 100
				} else if out.Score < 45 {
					out.Score = 45
				}
				continue
			}
			evidence.Error = err.Error()
			out.Evidence = append(out.Evidence, evidence)
			if rank(Review) > rank(out.Decision) {
				out.Decision = Review
				out.ScannedURL = raw
			}
			if out.Score < 45 {
				out.Score = 45
			}
			continue
		}

		snapshot, err := s.fetch(ctx, raw)
		if err != nil {
			evidence.Error = err.Error()
			out.Evidence = append(out.Evidence, evidence)
			if rank(Review) > rank(out.Decision) {
				out.Decision = Review
				out.ScannedURL = raw
			}
			if out.Score < 45 {
				out.Score = 45
			}
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
				categories = append(categories, providerResult.Categories...)
				evidence.Signals = append(evidence.Signals, providerResult.Signals...)
			}
		}

		out.Evidence = append(out.Evidence, evidence)
		for _, category := range categories {
			if !seenCategories[category] {
				seenCategories[category] = true
				out.Categories = append(out.Categories, category)
			}
		}
		if score > out.Score {
			out.Score = score
		}
		if rank(localDecision) > rank(out.Decision) {
			out.Decision = localDecision
			out.ScannedURL = raw
			out.FinalURL = snapshot.FinalURL
		} else if out.FinalURL == "" {
			out.FinalURL = snapshot.FinalURL
		}
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
				return nil, err
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
	req.Header.Set("User-Agent", "GoJet-Destination-Risk/1.0")
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
	start = strings.Index(lower[start:], ">") + start
	if start < 0 {
		return ""
	}
	end := strings.Index(lower[start+1:], "</title>")
	if end < 0 {
		return ""
	}
	value := body[start+1 : start+1+end]
	value = strings.NewReplacer("\n", " ", "\r", " ", "\t", " ").Replace(value)
	return strings.TrimSpace(value)
}

func classify(snapshot Snapshot) (int, []Category, []string) {
	text := strings.ToLower(snapshot.FinalURL + "\n" + snapshot.Title + "\n" + snapshot.Body)
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

	if containsAny("porn", "xxx video", "adult cam", "成人视频", "色情直播", "成人视频") {
		add(CategoryAdult, 55, "adult_content_signal")
	}
	if containsAny("online casino", "sports betting", "casino bonus", "博彩", "赌场", "下注送彩金") {
		add(CategoryGambling, 60, "gambling_signal")
	}
	credentialSignal := containsAny("verify your account", "confirm your password", "seed phrase", "recovery phrase", "验证码", "验证您的账户", "输入密码")
	lureSignal := containsAny("wallet", "bank", "payment", "urgent", "security alert", "账户异常", "钱包", "立即验证", "领取奖励")
	if credentialSignal && lureSignal {
		add(CategoryFraud, 80, "credential_lure_combination")
	}
	malwareLanguage := containsAny("ransomware", "trojan download", "keylogger", "botnet", "spyware download", "木马下载", "勒索软件", "盗号木马")
	suspiciousPayload := containsAny(".scr", ".ps1", ".bat", ".cmd", "payload.exe", "dropper.exe") || strings.Contains(strings.ToLower(snapshot.Headers["content-disposition"]), ".exe")
	if malwareLanguage {
		add(CategoryMalware, 80, "malware_language")
	}
	if malwareLanguage && suspiciousPayload {
		add(CategoryMalware, 20, "malware_payload_combination")
	}
	if containsAny("terrorist propaganda", "join the caliphate", "extremist manifesto", "恐怖主义宣传", "极端主义宣言") {
		add(CategoryExtremism, 65, "extremism_signal")
	}
	if containsAny("kill all ", "racial extermination", "hate group recruitment", "恐怖袭击教程", "种族灭绝", "仇恨组织招募") {
		add(CategoryViolenceHate, 75, "violence_hate_signal")
	}
	if containsAny("pirated download", "cracked software", "warez", "盗版下载", "破解软件", "未经授权转载") {
		add(CategoryCopyright, 55, "copyright_redistribution_signal")
	}
	if containsAny("pyramid scheme", "recruit downline", "guaranteed returns by recruiting", "传销", "发展下线", "拉人头返利") {
		add(CategoryPyramidMarketing, 65, "pyramid_marketing_signal")
	}
	if containsAny("verified account for sale", "sell accounts", "rent verified account", "账号出售", "实名账号出租", "平台账户转售") {
		add(CategoryAccountResale, 55, "account_resale_signal")
	}
	ddos := containsAny("ddos", "layer 7 attack", "http flood", "cc attack", "拒绝服务攻击")
	booter := containsAny("booter", "stresser", "attack panel", "压力攻击平台", "代打流量")
	if ddos || booter {
		add(CategoryHarmfulAutomation, 55, "harmful_automation_signal")
	}
	if ddos && booter {
		add(CategoryPlatformSecurity, 45, "ddos_service_combination")
	}
	bulk := containsAny("bulk sms", "mass dm", "email blaster", "bulk email sender", "群发短信", "批量私信", "邮件群发器")
	unsolicited := containsAny("scraped leads", "no opt-in", "without consent", "无需授权", "免同意群发", "采集号码")
	if bulk {
		add(CategorySpam, 55, "bulk_messaging_signal")
	}
	if bulk && unsolicited {
		add(CategorySpam, 20, "unsolicited_bulk_combination")
	}

	if score > 100 {
		score = 100
	}
	return score, categories, signals
}
