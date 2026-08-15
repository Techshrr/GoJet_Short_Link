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
	score, categories, signals := classify(Snapshot{
		FinalURL: "https://wallet-security.example/restore",
		Title:    "Wallet recovery",
		Body:     "Enter your seed phrase now to restore access to your wallet.",
		Headers:  map[string]string{},
	})
	if score < 90 || !hasPolicyCategory(categories, CategoryFraud) {
		t.Fatalf("seed phrase collection must block: score=%d categories=%v signals=%v", score, categories, signals)
	}
}

func TestClassifierBlocksCredentialDeceptionCombination(t *testing.T) {
	score, categories, signals := classify(Snapshot{
		FinalURL: "https://account-check.example/verify",
		Title:    "Security alert - account suspended",
		Body:     "Official customer service: verify your account and enter your password to claim your reward.",
		Headers:  map[string]string{},
	})
	if score < 90 || !hasPolicyCategory(categories, CategoryFraud) {
		t.Fatalf("credential + deception combination must block: score=%d categories=%v signals=%v", score, categories, signals)
	}
}

func TestClassifierRecognisesAdultHostAndContent(t *testing.T) {
	score, categories, signals := classify(Snapshot{
		FinalURL: "https://missav.ws/dm84/jul-343",
		Title:    "Uncensored porn video",
		Body:     "成人视频 成人影片",
		Headers:  map[string]string{},
	})
	if score < 90 || !hasPolicyCategory(categories, CategoryAdult) {
		t.Fatalf("explicit adult destination must block: score=%d categories=%v signals=%v", score, categories, signals)
	}
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
