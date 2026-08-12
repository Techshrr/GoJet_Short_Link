package links

import "encoding/json"

func analyticsDimensions(items []Dimension) []Dimension {
	if items == nil {
		return []Dimension{}
	}
	return items
}

func analyticsRecent(items []map[string]any) []map[string]any {
	if items == nil {
		return []map[string]any{}
	}
	return items
}

// MarshalJSON keeps the public analytics contract independent from Go field
// names and guarantees collection fields are always arrays. Product clients
// must never need separate null-vs-array handling for a zero-data period.
func (a Analytics) MarshalJSON() ([]byte, error) {
	type analyticsPayload struct {
		Clicks           int64            `json:"clicks"`
		UniqueVisitors   int64            `json:"unique_visitors"`
		BotVisits        int64            `json:"bot_visits"`
		Sources          []Dimension      `json:"sources"`
		Countries        []Dimension      `json:"countries"`
		Regions          []Dimension      `json:"regions"`
		Cities           []Dimension      `json:"cities"`
		Devices          []Dimension      `json:"devices"`
		Browsers         []Dimension      `json:"browsers"`
		OperatingSystems []Dimension      `json:"operating_systems"`
		Languages        []Dimension      `json:"languages"`
		UTMSources       []Dimension      `json:"utm_sources"`
		Destinations     []Dimension      `json:"destinations"`
		Recent           []map[string]any `json:"recent"`
	}
	return json.Marshal(analyticsPayload{
		Clicks:           a.Clicks,
		UniqueVisitors:   a.UniqueVisitors,
		BotVisits:        a.BotVisits,
		Sources:          analyticsDimensions(a.Sources),
		Countries:        analyticsDimensions(a.Countries),
		Regions:          analyticsDimensions(a.Regions),
		Cities:           analyticsDimensions(a.Cities),
		Devices:          analyticsDimensions(a.Devices),
		Browsers:         analyticsDimensions(a.Browsers),
		OperatingSystems: analyticsDimensions(a.OperatingSystems),
		Languages:        analyticsDimensions(a.Languages),
		UTMSources:       analyticsDimensions(a.UTMSources),
		Destinations:     analyticsDimensions(a.Destinations),
		Recent:           analyticsRecent(a.Recent),
	})
}
