package destinationrisk

import (
	"context"
	"html"
	"regexp"
	"strings"
	"unicode"
)

type semanticProvider struct {
	external Provider
}

func newSemanticProvider(external Provider) Provider {
	return &semanticProvider{external: external}
}

func (p *semanticProvider) Name() string {
	if p != nil && p.external != nil {
		return "semantic+" + p.external.Name()
	}
	return "semantic"
}

var htmlTagPattern = regexp.MustCompile(`(?is)<(script|style|noscript)[^>]*>.*?</\1>|<[^>]+>`)
var whitespacePattern = regexp.MustCompile(`\s+`)

func readablePageText(snapshot Snapshot) string {
	raw := snapshot.Title + "\n" + snapshot.Body
	raw = htmlTagPattern.ReplaceAllString(raw, " ")
	raw = html.UnescapeString(raw)
	raw = strings.ToLower(whitespacePattern.ReplaceAllString(raw, " "))
	return strings.TrimSpace(raw)
}

func containsSemantic(text string, values ...string) bool {
	for _, value := range values {
		if value != "" && strings.Contains(text, strings.ToLower(value)) {
			return true
		}
	}
	return false
}

func semanticGroups(text string, groups ...[]string) int {
	count := 0
	for _, group := range groups {
		if containsSemantic(text, group...) {
			count++
		}
	}
	return count
}

func visibleRuneCount(text string) int {
	count := 0
	for _, r := range text {
		if !unicode.IsSpace(r) && !unicode.IsPunct(r) && !unicode.IsSymbol(r) {
			count++
		}
	}
	return count
}

func mergeProviderResults(left, right ProviderResult) ProviderResult {
	out := left
	if right.Score > out.Score {
		out.Score = right.Score
	}
	if rank(right.Decision) > rank(out.Decision) {
		out.Decision = right.Decision
	}
	for _, category := range right.Categories {
		out.Categories = appendCategory(out.Categories, category)
	}
	seen := map[string]bool{}
	for _, signal := range out.Signals {
		seen[signal] = true
	}
	for _, signal := range right.Signals {
		if signal != "" && !seen[signal] {
			seen[signal] = true
			out.Signals = append(out.Signals, signal)
		}
	}
	return out
}

func (p *semanticProvider) Assess(ctx context.Context, snapshot Snapshot) (ProviderResult, error) {
	text := readablePageText(snapshot)
	full := strings.ToLower(snapshot.Title + "\n" + snapshot.Body + "\n" + snapshot.FinalURL)
	result := ProviderResult{Decision: Allow}
	add := func(decision Decision, score int, category Category, signal string) {
		if score > result.Score {
			result.Score = score
		}
		if rank(decision) > rank(result.Decision) {
			result.Decision = decision
		}
		result.Categories = appendCategory(result.Categories, category)
		result.Signals = append(result.Signals, signal)
	}

	// Adult-content detection intentionally uses generic semantics only. No
	// hostname or vendor list is involved. Multiple independent groups are
	// required for ambiguous words; strongly explicit phrases can block alone.
	adultExplicit := containsSemantic(full,
		"adult pornography", "porn videos", "free porn", "xxx videos", "hardcore porn", "live sex cam",
		"成人视频", "成人影片", "成人视频", "色情影片", "色情视频", "无码av", "无码av", "有码av", "成人直播", "色情直播", "裸聊",
	)
	adultGroups := semanticGroups(full,
		[]string{"porn", "pornography", "xxx", "成人视频", "成人影片", "色情", "无码AV", "无码", "有码"},
		[]string{"sex video", "sex videos", "hardcore", "hentai", "jav", "av电影", "av电影", "无码av", "情色", "成人视频"},
		[]string{"live cam", "webcam sex", "nude", "nudity", "裸聊", "裸照", "成人直播", "成人视频直播"},
		[]string{"18+", "adults only", "age verification", "未满18", "成人入口", "未成年人禁止"},
	)
	adultContext := containsSemantic(text, "新闻报道", "学术研究", "内容审核", "性健康教育", "research paper", "news report", "content moderation", "sexual health education")
	if adultExplicit && !adultContext {
		add(Block, 100, CategoryAdult, "semantic_explicit_adult_content")
	} else if adultGroups >= 3 && !adultContext {
		add(Block, 96, CategoryAdult, "semantic_adult_content_combination")
	} else if adultGroups >= 2 {
		add(Review, 70, CategoryAdult, "semantic_adult_content_signals")
	}

	// Gambling sites commonly use random domains, so content must carry the
	// decision. Chinese casino sites often combine game terms, money movement,
	// promotions and agent/rebate language; these groups are intentionally
	// independent to reduce false positives on ordinary sports or finance pages.
	gamblingExplicit := containsSemantic(full,
		"online casino", "live casino", "sports betting", "betting site", "gambling site", "place your bets",
		"在线博彩", "在线赌博", "网络赌博", "博彩平台", "博彩网站", "赌场", "娱乐城", "真人娱乐城", "投注平台", "在线下注",
	)
	gamblingGroups := semanticGroups(full,
		[]string{"博彩", "赌博", "赌场", "下注", "投注", "betting", "casino", "wager"},
		[]string{"百家乐", "龙虎", "轮盘", "老虎机", "捕鱼", "彩票", "棋牌", "真人娱乐", "真人视讯", "baccarat", "roulette", "slots", "sportsbook"},
		[]string{"赔率", "盘口", "投注记录", "betting odds", "odds", "bet slip", "cash out"},
		[]string{"充值", "提现", "存款", "提款", "入款", "出款", "deposit", "withdraw", "cashout"},
		[]string{"彩金", "首充", "首存", "返水", "洗码", "返佣", "代理加盟", "推广佣金", "bonus", "free spins", "rebate", "affiliate commission"},
	)
	if gamblingExplicit {
		add(Block, 100, CategoryGambling, "semantic_explicit_gambling_content")
	} else if gamblingGroups >= 3 {
		add(Block, 96, CategoryGambling, "semantic_gambling_content_combination")
	} else if gamblingGroups >= 2 {
		add(Review, 72, CategoryGambling, "semantic_gambling_content_signals")
	}

	fraudGroups := semanticGroups(full,
		[]string{"账户冻结", "账号冻结", "异常登录", "security alert", "account suspended", "account locked", "unusual activity"},
		[]string{"立即验证", "点击验证", "verify now", "verify your account", "restore access"},
		[]string{"输入密码", "短信验证码", "验证码", "助记词", "私钥", "enter password", "verification code", "seed phrase", "private key"},
		[]string{"官方客服", "安全中心", "账户验证中心", "official support", "security department", "verification center"},
	)
	if containsSemantic(full, "seed phrase", "private key", "助记词", "钱包私钥") && fraudGroups >= 2 {
		add(Block, 100, CategoryFraud, "semantic_credential_theft_content")
	} else if fraudGroups >= 3 {
		add(Block, 96, CategoryFraud, "semantic_phishing_content_combination")
	} else if fraudGroups >= 2 {
		add(Review, 75, CategoryFraud, "semantic_phishing_content_signals")
	}

	malwareGroups := semanticGroups(full,
		[]string{"ransomware", "trojan", "keylogger", "stealer", "勒索软件", "木马", "盗号木马"},
		[]string{"disable antivirus", "bypass antivirus", "关闭杀毒", "绕过杀毒", "免杀"},
		[]string{"powershell -enc", "download payload", "execute payload", "payload.exe", "dropper.exe", "下载载荷", "执行载荷"},
		[]string{"steal cookies", "browser cookies", "token stealer", "窃取cookie", "盗取token"},
	)
	if malwareGroups >= 2 {
		add(Block, 98, CategoryMalware, "semantic_malware_content_combination")
	} else if malwareGroups == 1 {
		add(Review, 72, CategoryMalware, "semantic_malware_content_signal")
	}

	// A challenge/error shell with no meaningful readable content is not a clean
	// destination. This closes the old ALLOW-0 gap for sites that return only a
	// CDN challenge or client-side bootstrap to the scanner.
	challenge := snapshot.StatusCode == 403 || snapshot.StatusCode == 429 || snapshot.StatusCode >= 500 || containsSemantic(full,
		"just a moment", "checking your browser", "verify you are human", "enable javascript and cookies", "access denied", "cf-chl-", "cloudflare ray id",
	)
	if challenge && rank(result.Decision) < rank(Review) {
		add(Review, 50, CategoryPlatformSecurity, "destination_challenge_or_access_denied")
	}
	contentType := strings.ToLower(snapshot.ContentType)
	if strings.Contains(contentType, "text/html") && snapshot.StatusCode >= 200 && snapshot.StatusCode < 400 && visibleRuneCount(text) < 28 && rank(result.Decision) < rank(Review) {
		add(Review, 45, CategoryPlatformSecurity, "destination_content_not_verifiable")
	}

	if p != nil && p.external != nil {
		external, err := p.external.Assess(ctx, snapshot)
		if err != nil {
			if rank(result.Decision) < rank(Review) {
				add(Review, 45, CategoryPlatformSecurity, "external_reputation_unavailable")
			}
			return result, nil
		}
		result = mergeProviderResults(result, external)
	}
	return result, nil
}
