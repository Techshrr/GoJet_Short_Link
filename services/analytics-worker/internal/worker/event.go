package worker

import (
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type Event struct {
	StreamID, LinkID, DestinationID, VisitorHash, RefererURL, RefererHost string
	SourceType, Country, Region, City, Device, Browser, OperatingSystem   string
	Language, UTMSource, UTMMedium, UTMCampaign, UTMContent, UTMTerm      string
	VisitType                                                             string
	OccurredAt                                                            time.Time
	IsBot                                                                 bool
}

func ParseEvent(message redis.XMessage) (Event, error) {
	value := func(key string) string { return fmt.Sprint(message.Values[key]) }
	required := []string{"link_id", "destination_id", "timestamp", "visitor_hash", "source_type", "device", "browser", "operating_system", "visit_type", "is_bot"}
	for _, key := range required {
		if _, ok := message.Values[key]; !ok || value(key) == "" {
			return Event{}, fmt.Errorf("event %s is missing %s", message.ID, key)
		}
	}
	at, err := time.Parse(time.RFC3339Nano, value("timestamp"))
	if err != nil {
		return Event{}, fmt.Errorf("event %s timestamp: %w", message.ID, err)
	}
	bot, err := strconv.ParseBool(value("is_bot"))
	if err != nil {
		return Event{}, fmt.Errorf("event %s is_bot: %w", message.ID, err)
	}
	return Event{StreamID: message.ID, LinkID: value("link_id"), DestinationID: value("destination_id"), OccurredAt: at, VisitorHash: value("visitor_hash"), RefererURL: value("referer_url"), RefererHost: value("referer_host"), SourceType: value("source_type"), Country: value("country"), Region: value("region"), City: value("city"), Device: value("device"), Browser: value("browser"), OperatingSystem: value("operating_system"), Language: value("language"), UTMSource: value("utm_source"), UTMMedium: value("utm_medium"), UTMCampaign: value("utm_campaign"), UTMContent: value("utm_content"), UTMTerm: value("utm_term"), VisitType: value("visit_type"), IsBot: bot}, nil
}
