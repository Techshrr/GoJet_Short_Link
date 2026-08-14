package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func init() {
	settingSections["announcementbar"] = map[string]bool{
		"announcementbar.enabled": true,
		"announcementbar.title": true,
		"announcementbar.message": true,
		"announcementbar.link_text": true,
		"announcementbar.link_url": true,
		"announcementbar.tone": true,
		"announcementbar.dismissible": true,
		"announcementbar.starts_at": true,
		"announcementbar.ends_at": true,
	}
}

type announcementBarPayload struct {
	Enabled     bool   `json:"enabled"`
	Title       string `json:"title,omitempty"`
	Message     string `json:"message,omitempty"`
	LinkText    string `json:"link_text,omitempty"`
	LinkURL     string `json:"link_url,omitempty"`
	Tone        string `json:"tone,omitempty"`
	Dismissible bool   `json:"dismissible"`
	StartsAt    string `json:"starts_at,omitempty"`
	EndsAt      string `json:"ends_at,omitempty"`
}

func (s *server) announcementSetting(ctx context.Context, key string) any {
	stored, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists {
		return nil
	}
	return decodeSetting(stored)
}

func announcementString(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func announcementBool(value any, fallback bool) bool {
	flag, ok := value.(bool)
	if !ok {
		return fallback
	}
	return flag
}

func announcementInWindow(now time.Time, start, end string) bool {
	parse := func(value string) (time.Time, bool) {
		if value == "" {
			return time.Time{}, false
		}
		for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02 15:04:05"} {
			if parsed, err := time.Parse(layout, value); err == nil {
				return parsed, true
			}
		}
		return time.Time{}, false
	}
	if value, ok := parse(start); ok && now.Before(value) {
		return false
	}
	if value, ok := parse(end); ok && !now.Before(value) {
		return false
	}
	return true
}

func (s *server) publicAnnouncementBar(w http.ResponseWriter, r *http.Request) {
	enabled := announcementBool(s.announcementSetting(r.Context(), "announcementbar.enabled"), false)
	start := announcementString(s.announcementSetting(r.Context(), "announcementbar.starts_at"))
	end := announcementString(s.announcementSetting(r.Context(), "announcementbar.ends_at"))
	if !enabled || !announcementInWindow(time.Now(), start, end) {
		jsonResponse(w, http.StatusOK, announcementBarPayload{Enabled: false})
		return
	}
	tone := announcementString(s.announcementSetting(r.Context(), "announcementbar.tone"))
	if tone != "success" && tone != "warning" && tone != "info" {
		tone = "info"
	}
	jsonResponse(w, http.StatusOK, announcementBarPayload{
		Enabled:     true,
		Title:       announcementString(s.announcementSetting(r.Context(), "announcementbar.title")),
		Message:     announcementString(s.announcementSetting(r.Context(), "announcementbar.message")),
		LinkText:    announcementString(s.announcementSetting(r.Context(), "announcementbar.link_text")),
		LinkURL:     announcementString(s.announcementSetting(r.Context(), "announcementbar.link_url")),
		Tone:        tone,
		Dismissible: announcementBool(s.announcementSetting(r.Context(), "announcementbar.dismissible"), true),
		StartsAt:    start,
		EndsAt:      end,
	})
}
