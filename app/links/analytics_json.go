package links

import "encoding/json"

// MarshalJSON keeps the public analytics contract independent from Go field
// names. Product clients should receive stable snake_case keys even if the
// internal model is renamed later.
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
		Sources:          a.Sources,
		Countries:        a.Countries,
		Regions:          a.Regions,
		Cities:           a.Cities,
		Devices:          a.Devices,
		Browsers:         a.Browsers,
		OperatingSystems: a.OperatingSystems,
		Languages:        a.Languages,
		UTMSources:       a.UTMSources,
		Destinations:     a.Destinations,
		Recent:           a.Recent,
	})
}
