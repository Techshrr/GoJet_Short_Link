package main

import (
	"testing"
	"time"
)

func TestAnnouncementToneNormalization(t *testing.T) {
	cases := map[string]string{
		"success": "success",
		"warning": "warning",
		"danger":  "danger",
		"INFO":    "info",
		"unknown": "info",
		"":        "info",
	}
	for input, want := range cases {
		if got := normalizeAnnouncementTone(input); got != want {
			t.Fatalf("normalizeAnnouncementTone(%q)=%q want %q", input, got, want)
		}
	}
}

func TestAnnouncementLinkValidation(t *testing.T) {
	valid := []string{"", "/pricing", "/docs?from=bar", "https://example.com/offer", "http://example.com"}
	for _, value := range valid {
		if !announcementLinkValid(value) {
			t.Fatalf("expected valid link %q", value)
		}
	}
	invalid := []string{"//evil.example/path", "javascript:alert(1)", "data:text/html,test", "ftp://example.com/file"}
	for _, value := range invalid {
		if announcementLinkValid(value) {
			t.Fatalf("expected invalid link %q", value)
		}
	}
}

func TestAnnouncementWindow(t *testing.T) {
	now := time.Date(2026, 8, 14, 12, 0, 0, 0, time.UTC)
	if !announcementInWindow(now, "", "") {
		t.Fatal("open-ended announcement should be active")
	}
	if announcementInWindow(now, "2026-08-14T13:00:00Z", "") {
		t.Fatal("future announcement should not be active")
	}
	if announcementInWindow(now, "", "2026-08-14T11:59:59Z") {
		t.Fatal("expired announcement should not be active")
	}
	if !announcementInWindow(now, "2026-08-14T11:00:00Z", "2026-08-14T13:00:00Z") {
		t.Fatal("announcement within its window should be active")
	}
	if announcementInWindow(now, "2026-08-14T11:00:00Z", "2026-08-14T12:00:00Z") {
		t.Fatal("end time is exclusive")
	}
}

func TestValidateAnnouncementItem(t *testing.T) {
	item := announcementBarItem{Enabled: true, Title: " 优惠提醒 ", Message: " 正文 ", LinkURL: "/pricing", Tone: "SUCCESS", Dismissible: true}
	if err := validateAnnouncementItem(&item, 0); err != nil {
		t.Fatal(err)
	}
	if item.ID == "" || item.Title != "优惠提醒" || item.Message != "正文" || item.Tone != "success" {
		t.Fatalf("item was not normalized: %+v", item)
	}
	bad := announcementBarItem{Enabled: true, Title: "测试", Message: "正文", LinkURL: "javascript:alert(1)"}
	if err := validateAnnouncementItem(&bad, 0); err == nil {
		t.Fatal("dangerous link should be rejected")
	}
	badWindow := announcementBarItem{Enabled: true, Title: "测试", Message: "正文", StartsAt: "2026-08-15T00:00:00Z", EndsAt: "2026-08-14T00:00:00Z"}
	if err := validateAnnouncementItem(&badWindow, 0); err == nil {
		t.Fatal("invalid time window should be rejected")
	}
}

func TestValidateAnnouncementSettings(t *testing.T) {
	values := map[string]any{
		"announcementbar.enabled":          true,
		"announcementbar.rotation_seconds": float64(8),
		"announcementbar.items": []map[string]any{
			{"id": " first ", "enabled": true, "title": " 优惠 ", "message": " 正文 ", "tone": "SUCCESS", "link_url": "/pricing", "dismissible": true, "sort_order": 1},
			{"id": "second", "enabled": false, "title": "", "message": "", "tone": "unknown", "dismissible": true, "sort_order": 2},
		},
	}
	if err := validateAnnouncementSettings(values); err != nil {
		t.Fatal(err)
	}
	items, ok := values["announcementbar.items"].([]announcementBarItem)
	if !ok || len(items) != 2 {
		t.Fatalf("validator must replace raw input with normalized items: %#v", values["announcementbar.items"])
	}
	if items[0].ID != "first" || items[0].Title != "优惠" || items[0].Tone != "success" {
		t.Fatalf("first item not normalized: %+v", items[0])
	}
	if items[1].Tone != "info" {
		t.Fatalf("unknown tone must normalize to info: %+v", items[1])
	}
	if rotation, ok := values["announcementbar.rotation_seconds"].(int); !ok || rotation != 8 {
		t.Fatalf("rotation must normalize to int: %#v", values["announcementbar.rotation_seconds"])
	}
}

func TestValidateAnnouncementSettingsRejectsUnsafeInput(t *testing.T) {
	cases := []map[string]any{
		{"announcementbar.rotation_seconds": float64(3)},
		{"announcementbar.rotation_seconds": "8"},
		{"announcementbar.enabled": "true"},
		{"announcementbar.items": map[string]any{"id": "not-an-array"}},
		{"announcementbar.items": []map[string]any{{"id": "dup", "enabled": true, "title": "A", "message": "A"}, {"id": "dup", "enabled": true, "title": "B", "message": "B"}}},
		{"announcementbar.items": []map[string]any{{"id": "bad-link", "enabled": true, "title": "A", "message": "A", "link_url": "javascript:alert(1)"}}},
		{"announcementbar.items": []map[string]any{{"id": "bad-window", "enabled": true, "title": "A", "message": "A", "starts_at": "2026-08-15T00:00:00Z", "ends_at": "2026-08-14T00:00:00Z"}}},
	}
	for index, values := range cases {
		if err := validateAnnouncementSettings(values); err == nil {
			t.Fatalf("case %d should be rejected: %#v", index, values)
		}
	}
}

func TestAnnouncementItemsFromSetting(t *testing.T) {
	value := []map[string]any{
		{"id": "b", "enabled": true, "title": "第二条", "message": "B", "tone": "warning", "dismissible": true, "sort_order": 2},
		{"id": "a", "enabled": true, "title": "第一条", "message": "A", "tone": "success", "dismissible": false, "sort_order": 1},
	}
	items := announcementItemsFromSetting(value)
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if items[0].ID != "b" || items[1].ID != "a" {
		t.Fatalf("parser must preserve stored order before allAnnouncementItems sorting: %+v", items)
	}
	if items[1].Dismissible {
		t.Fatal("dismissible=false must survive JSON normalization")
	}
}

func TestAnnouncementItemsFromSettingFailsClosed(t *testing.T) {
	value := []map[string]any{
		{"id": "good", "enabled": true, "title": "正常", "message": "正常正文", "link_url": "/pricing"},
		{"id": "unsafe", "enabled": true, "title": "危险", "message": "危险正文", "link_url": "javascript:alert(1)"},
		{"id": "", "enabled": true, "title": "无稳定 ID", "message": "不应显示"},
		{"id": "dup", "enabled": true, "title": "第一条", "message": "正文"},
		{"id": "dup", "enabled": true, "title": "重复", "message": "不应显示"},
	}
	items := announcementItemsFromSetting(value)
	if len(items) != 2 {
		t.Fatalf("expected only good + first dup, got %+v", items)
	}
	if items[0].ID != "good" || items[1].ID != "dup" {
		t.Fatalf("malformed stored items must fail closed: %+v", items)
	}
}
