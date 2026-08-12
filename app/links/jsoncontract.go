package links

import (
	"bytes"
	"encoding/json"
)

// UnmarshalJSON keeps optional advanced link features genuinely optional.
// Empty JSON containers are normalized to nil so [] and {} mean "disabled"
// instead of accidentally enabling validation for A/B routing or UTM data.
func (l *Link) UnmarshalJSON(data []byte) error {
	type rawLink Link
	var decoded rawLink
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*l = Link(decoded)
	l.UTM = normalizeOptionalJSON(l.UTM)
	l.RoutingRules = normalizeOptionalJSON(l.RoutingRules)
	l.ABDestinations = normalizeOptionalJSON(l.ABDestinations)
	if l.MaxClicks != nil && *l.MaxClicks <= 0 {
		l.MaxClicks = nil
	}
	return nil
}

func normalizeOptionalJSON(value json.RawMessage) json.RawMessage {
	value = bytes.TrimSpace(value)
	if len(value) == 0 || bytes.Equal(value, []byte("null")) || bytes.Equal(value, []byte("[]")) || bytes.Equal(value, []byte("{}")) {
		return nil
	}
	return value
}
