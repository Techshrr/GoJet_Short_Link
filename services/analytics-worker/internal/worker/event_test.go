package worker

import (
	"github.com/redis/go-redis/v9"
	"testing"
)

func TestParseEvent(t *testing.T) {
	event, err := ParseEvent(redis.XMessage{ID: "1-0", Values: map[string]any{"link_id": "link-1", "destination_id": "dest-1", "timestamp": "2026-08-02T12:00:00.123Z", "visitor_hash": "abc", "referer_url": "https://source.example/a", "referer_host": "source.example", "source_type": "referer", "country": "CN", "region": "Shanghai", "city": "Shanghai", "device": "desktop", "browser": "chrome", "operating_system": "linux", "language": "zh-CN", "utm_source": "newsletter", "utm_medium": "email", "utm_campaign": "launch", "utm_content": "hero", "utm_term": "short-link", "visit_type": "redirect", "is_bot": "false"}})
	if err != nil {
		t.Fatal(err)
	}
	if event.StreamID != "1-0" || event.LinkID != "link-1" || event.RefererHost != "source.example" || event.IsBot {
		t.Fatalf("unexpected event: %+v", event)
	}
}
func TestParseEventRejectsIncompleteMessage(t *testing.T) {
	_, err := ParseEvent(redis.XMessage{ID: "2-0", Values: map[string]any{"link_id": "link-1"}})
	if err == nil {
		t.Fatal("expected incomplete event error")
	}
}
