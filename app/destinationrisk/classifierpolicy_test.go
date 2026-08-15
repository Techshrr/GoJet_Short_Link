package destinationrisk

import "testing"

func hasPolicyCategory(categories []Category, want Category) bool {
	for _, category := range categories {
		if category == want {
			return true
		}
	}
	return false
}

func assertPolicyBlock(t *testing.T, snapshot Snapshot, category Category) {
	t.Helper()
	score, categories, signals := classify(snapshot)
	if score < 90 || !hasPolicyCategory(categories, category) {
		t.Fatalf("expected block for %s: score=%d categories=%v signals=%v", category, score, categories, signals)
	}
}

func TestClassifierDoesNotTreatNormalPaymentAuthenticationAsPhishing(t *testing.T) {
	score, categories, signals := classify(Snapshot{
		FinalURL: "https://payments.example.com/login",
		Title:    "Payment Operations",
		Body:     "Use your password and 验证码 to sign in to the payment operations console.",
		Headers:  map[string]string{},
	})
	if score >= 45 || hasPolicyCategory(categories, CategoryFraud) {
		t.Fatalf("normal payment authentication must remain allow: score=%d categories=%v signals=%v", score, categories, signals)
	}
}

func TestClassifierBlocksCriticalCredentialTheft(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://wallet-security.example/restore",
		Title:    "Wallet recovery",
		Body:     "Enter your seed phrase now to restore access to your wallet.",
		Headers:  map[string]string{},
	}, CategoryFraud)
}

func TestClassifierBlocksCredentialDeceptionCombination(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://account-check.example/verify",
		Title:    "Security alert - account suspended",
		Body:     "Official customer service: verify your account and enter your password to claim your reward.",
		Headers:  map[string]string{},
	}, CategoryFraud)
}

func TestClassifierBlocksGenericAdultContentWithoutKnownHost(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://media-archive.example/watch/8291",
		Title:    "Uncensored adult videos",
		Body:     "成人视频，色情视频，18+ only. Watch uncensored porn videos and live adult cam content.",
		Headers:  map[string]string{},
	}, CategoryAdult)
}

func TestClassifierBlocksGenericAdultURLSemanticsBeforeFetch(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://uncensored-adult-videos.example/library",
		Headers:  map[string]string{},
	}, CategoryAdult)
}

func TestClassifierBlocksGenericGamblingContentWithoutKnownHost(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://lucky-room.example/play",
		Title:    "Live casino bonus",
		Body:     "Online casino and sports betting. Deposit now, receive a casino bonus and withdraw winnings anytime.",
		Headers:  map[string]string{},
	}, CategoryGambling)
}

func TestClassifierBlocksGenericGamblingURLSemanticsBeforeFetch(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://vip-casino-betting.example/slots",
		Headers:  map[string]string{},
	}, CategoryGambling)
}

func TestClassifierBlocksMalwareDistribution(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://download-center.example/tool",
		Title:    "Remote access tool",
		Body:     "Download the trojan dropper.exe. Disable antivirus, execute PowerShell and steal browser cookies.",
		Headers:  map[string]string{"content-disposition": "attachment; filename=dropper.exe"},
	}, CategoryMalware)
}

func TestClassifierBlocksCopyrightRedistributionCombination(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://media-download.example/latest",
		Title:    "Free premium movies",
		Body:     "Pirated download catalogue with torrent piracy links and cracked software keygen downloads.",
		Headers:  map[string]string{},
	}, CategoryCopyright)
}

func TestClassifierBlocksPyramidMarketingCombination(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://wealth-team.example/join",
		Title:    "Guaranteed team income",
		Body:     "Recruit downline members for guaranteed returns. Multi-level commission and tier commission paid from every new recruit.",
		Headers:  map[string]string{},
	}, CategoryPyramidMarketing)
}

func TestClassifierBlocksUnauthorizedAccountResaleCombination(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://digital-market.example/accounts",
		Title:    "Account marketplace",
		Body:     "Verified account for sale. Bulk aged accounts and real-name account rental available.",
		Headers:  map[string]string{},
	}, CategoryAccountResale)
}

func TestClassifierBlocksBulkSpamCombination(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://growth-tool.example/sender",
		Title:    "Bulk sender",
		Body:     "Bulk email sender for scraped leads without consent. Rotate sender accounts to bypass spam filter.",
		Headers:  map[string]string{},
	}, CategorySpam)
}

func TestClassifierBlocksPlatformAttackServiceCombination(t *testing.T) {
	assertPolicyBlock(t, Snapshot{
		FinalURL: "https://traffic-panel.example/service",
		Title:    "Stress any website",
		Body:     "DDoS layer 7 attack panel and booter service. Take any website offline with attack for hire.",
		Headers:  map[string]string{},
	}, CategoryHarmfulAutomation)
}

func TestClassifierDoesNotTreatJavascriptAsAdultContent(t *testing.T) {
	score, categories, signals := classify(Snapshot{
		FinalURL: "https://developer.example/javascript-guide",
		Title:    "JavaScript guide",
		Body:     "Learn JavaScript for web applications.",
		Headers:  map[string]string{},
	})
	if score != 0 || hasPolicyCategory(categories, CategoryAdult) {
		t.Fatalf("javascript documentation must not be classified as adult: score=%d categories=%v signals=%v", score, categories, signals)
	}
}

func TestClassifierKeepsModerationResearchOutOfAutomaticAdultBlock(t *testing.T) {
	score, categories, signals := classify(Snapshot{
		FinalURL: "https://research.example/content-moderation",
		Title:    "Academic research on adult content moderation",
		Body:     "This research paper discusses pornography and adult video classification for content moderation policy.",
		Headers:  map[string]string{},
	})
	if score >= 90 {
		t.Fatalf("contextual research reference must not automatically block: score=%d categories=%v signals=%v", score, categories, signals)
	}
}
