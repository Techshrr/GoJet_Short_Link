package destinationrisk

import (
	"testing"
	"time"
)

func reviewAssessment(raw string, category Category, signal string) Assessment {
	now := time.Date(2026, 8, 16, 3, 0, 0, 0, time.UTC)
	return Assessment{
		Decision:   Review,
		Score:      50,
		Categories: []Category{category},
		ScannedAt:  now,
		NextScanAt: now.Add(time.Hour),
		Evidence: []Evidence{{
			URL: raw, Error: "destination network connection failed",
			Signals: []string{signal, "network_fetch_failed"},
		}},
	}
}

func TestPromoteUnverifiableExplicitAdultURL(t *testing.T) {
	assessment := PromoteUnverifiableSemanticRisk(reviewAssessment(
		"https://random-pornstream.example/view/123", CategoryAdult, "adult_url_semantic_signal",
	))
	if assessment.Decision != Block || assessment.Score < 90 {
		t.Fatalf("strong adult URL with unverifiable content must block: %+v", assessment)
	}
	if assessment.NextScanAt.Sub(assessment.ScannedAt) != 6*time.Hour {
		t.Fatalf("promoted block must use block rescan cadence: %s", assessment.NextScanAt.Sub(assessment.ScannedAt))
	}
	if !signalPresent(assessment.Evidence[0].Signals, "high_confidence_url_semantic_with_unverifiable_content") {
		t.Fatalf("promotion evidence signal missing: %v", assessment.Evidence[0].Signals)
	}
}

func TestPromoteUnverifiableExplicitGamblingURL(t *testing.T) {
	assessment := PromoteUnverifiableSemanticRisk(reviewAssessment(
		"https://random-casinoportal.example/play", CategoryGambling, "gambling_url_semantic_signal",
	))
	if assessment.Decision != Block || assessment.Score < 90 {
		t.Fatalf("strong gambling URL with unverifiable content must block: %+v", assessment)
	}
}

func TestUnverifiableContextualReferenceRemainsReview(t *testing.T) {
	assessment := PromoteUnverifiableSemanticRisk(reviewAssessment(
		"https://pornography-research.example/content-moderation-policy", CategoryAdult, "adult_url_semantic_signal",
	))
	if assessment.Decision != Review || assessment.Score != 50 {
		t.Fatalf("research/moderation context must stay review: %+v", assessment)
	}
}

func TestUnverifiableAmbiguousAdultWordRemainsReview(t *testing.T) {
	assessment := PromoteUnverifiableSemanticRisk(reviewAssessment(
		"https://adult-community.example/", CategoryAdult, "adult_url_semantic_signal",
	))
	if assessment.Decision != Review {
		t.Fatalf("ambiguous adult lexeme alone must not auto-block: %+v", assessment)
	}
}

func TestPromotionRequiresMatchingClassifierCategory(t *testing.T) {
	assessment := PromoteUnverifiableSemanticRisk(reviewAssessment(
		"https://random-pornstream.example/view", CategoryPlatformSecurity, "network_validation_failed",
	))
	if assessment.Decision != Review {
		t.Fatalf("URL semantics must corroborate the base classifier category: %+v", assessment)
	}
}

func signalPresent(signals []string, wanted string) bool {
	for _, signal := range signals {
		if signal == wanted {
			return true
		}
	}
	return false
}
