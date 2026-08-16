package destinationrisk

import (
	"context"
	"strings"
	"time"
)

// AssessPolicy applies the runtime enforcement policy after the network scanner
// has produced its evidence. Scanner.Assess intentionally keeps ambiguous
// transport failures at REVIEW; this wrapper only promotes failures when the
// URL itself carries a high-confidence generic abuse semantic and there is no
// obvious educational, research, news or safety context. No destination brand
// or named site is embedded here.
func (s *Scanner) AssessPolicy(ctx context.Context, targets []string) Assessment {
	return PromoteUnverifiableSemanticRisk(s.Assess(ctx, targets))
}

// PromoteUnverifiableSemanticRisk prevents an abusive destination from staying
// indefinitely in REVIEW merely because it refuses or resets the scanner HTTP
// connection. Promotion is deliberately narrow: the base classifier must have
// already identified the same category, the fetch/validation must be
// unverifiable, and the URL must contain a strong generic semantic.
func PromoteUnverifiableSemanticRisk(assessment Assessment) Assessment {
	if assessment.Decision != Review {
		return assessment
	}
	for index := range assessment.Evidence {
		evidence := &assessment.Evidence[index]
		if !unverifiableRiskEvidence(*evidence) {
			continue
		}
		category, ok := strongUnverifiableURLCategory(evidence.URL)
		if !ok || !assessmentHasCategory(assessment.Categories, category) {
			continue
		}
		assessment.Decision = Block
		if assessment.Score < 92 {
			assessment.Score = 92
		}
		evidence.Signals = appendUniqueSignal(evidence.Signals, "high_confidence_url_semantic_with_unverifiable_content")
		if !assessment.ScannedAt.IsZero() {
			assessment.NextScanAt = assessment.ScannedAt.Add(6 * time.Hour)
		}
		return assessment
	}
	return assessment
}

func unverifiableRiskEvidence(evidence Evidence) bool {
	if strings.TrimSpace(evidence.Error) == "" {
		return false
	}
	for _, signal := range evidence.Signals {
		switch signal {
		case "network_fetch_failed", "network_validation_failed", "network_target_rejected":
			return true
		}
	}
	return false
}

func strongUnverifiableURLCategory(raw string) (Category, bool) {
	normalized := normalizedURLText(raw)
	if containsURLLexeme(normalized,
		"research", "education", "educational", "academic", "health", "medical", "news", "journal",
		"policy", "moderation", "safety", "help", "support", "recovery", "report", "analysis", "archive", "museum",
	) {
		return "", false
	}
	if containsURLLexeme(normalized,
		"porn", "porno", "pornographic", "xxx", "hentai", "uncensored", "hardcore", "sexcam", "sexvideo",
	) {
		return CategoryAdult, true
	}
	if containsURLLexeme(normalized,
		"casino", "betting", "sportsbook", "bookmaker", "wager",
	) {
		return CategoryGambling, true
	}
	return "", false
}

func assessmentHasCategory(categories []Category, wanted Category) bool {
	for _, category := range categories {
		if category == wanted {
			return true
		}
	}
	return false
}

func appendUniqueSignal(signals []string, wanted string) []string {
	for _, signal := range signals {
		if signal == wanted {
			return signals
		}
	}
	return append(signals, wanted)
}
