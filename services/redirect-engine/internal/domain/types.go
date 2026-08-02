package domain

import "time"

type Link struct {
	ID           string            `json:"id"`
	Code         string            `json:"code"`
	Domain       string            `json:"domain,omitempty"`
	Destination  string            `json:"destination"`
	StatusCode   int               `json:"status_code"`
	Active       bool              `json:"active"`
	ExpiresAt    *time.Time        `json:"expires_at,omitempty"`
	MaxClicks    int64             `json:"max_clicks,omitempty"`
	OneTime      bool              `json:"one_time,omitempty"`
	PasswordHash string            `json:"password_hash,omitempty"`
	UTM          map[string]string `json:"utm,omitempty"`
	RoutingRules []RoutingRule     `json:"routing_rules,omitempty"`
	Destinations []Destination     `json:"ab_destinations,omitempty"`
}

type RoutingRule struct {
	Dimension   string `json:"dimension"`
	Value       string `json:"value"`
	Destination string `json:"destination"`
}

type Destination struct {
	ID          string `json:"id"`
	Destination string `json:"destination"`
	Weight      int    `json:"weight"`
}

type Visit struct {
	LinkID, DestinationID, VisitorHash, RefererURL, RefererHost string
	SourceType, Country, Region, City, Device, Browser, OS      string
	Language, UTMSource, UTMMedium, UTMCampaign, UTMContent     string
	UTMTerm, VisitType                                          string
	Timestamp                                                   time.Time
	IsBot                                                       bool
	MaxClicks                                                   int64
	OneTime                                                     bool
}

type Stats struct {
	Clicks         int64            `json:"clicks"`
	TodayClicks    int64            `json:"today_clicks"`
	UniqueVisitors int64            `json:"unique_visitors"`
	BotVisits      int64            `json:"bot_visits"`
	Sources        map[string]int64 `json:"sources"`
	Devices        map[string]int64 `json:"devices"`
	Browsers       map[string]int64 `json:"browsers"`
}
