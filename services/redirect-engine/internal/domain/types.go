package domain

import "time"

type Link struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Destination string `json:"destination"`
	StatusCode  int    `json:"status_code"`
	Active      bool   `json:"active"`
}

type Visit struct {
	LinkID, DestinationID, VisitorHash, RefererURL, RefererHost string
	SourceType, Country, Region, City, Device, Browser, OS      string
	Language, UTMSource, UTMMedium, UTMCampaign, UTMContent     string
	UTMTerm, VisitType                                          string
	Timestamp                                                   time.Time
	IsBot                                                       bool
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
