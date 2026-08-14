package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

func init() {
	settingSections["announcementbar"] = map[string]bool{
		"announcementbar.enabled":          true,
		"announcementbar.rotation_seconds": true,
		"announcementbar.items":            true,
		// Legacy single-item keys stay writable/readable for backward compatibility.
		"announcementbar.title":       true,
		"announcementbar.message":     true,
		"announcementbar.link_text":   true,
		"announcementbar.link_url":    true,
		"announcementbar.tone":        true,
		"announcementbar.dismissible": true,
		"announcementbar.starts_at":   true,
		"announcementbar.ends_at":     true,
	}
}

type announcementBarItem struct {
	ID          string `json:"id"`
	Enabled     bool   `json:"enabled"`
	Title       string `json:"title,omitempty"`
	Message     string `json:"message,omitempty"`
	LinkText    string `json:"link_text,omitempty"`
	LinkURL     string `json:"link_url,omitempty"`
	Tone        string `json:"tone,omitempty"`
	Dismissible bool   `json:"dismissible"`
	StartsAt    string `json:"starts_at,omitempty"`
	EndsAt      string `json:"ends_at,omitempty"`
	SortOrder   int    `json:"sort_order"`
}

type announcementBarPayload struct {
	Enabled         bool                  `json:"enabled"`
	RotationSeconds int                   `json:"rotation_seconds"`
	Items           []announcementBarItem `json:"items"`
	// The first active item is mirrored to the old top-level shape so older clients
	// continue to display one announcement during rolling upgrades.
	ID          string `json:"id,omitempty"`
	Title       string `json:"title,omitempty"`
	Message     string `json:"message,omitempty"`
	LinkText    string `json:"link_text,omitempty"`
	LinkURL     string `json:"link_url,omitempty"`
	Tone        string `json:"tone,omitempty"`
	Dismissible bool   `json:"dismissible,omitempty"`
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

func announcementInt(value any, fallback int) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case json.Number:
		parsed, err := typed.Int64()
		if err == nil {
			return int(parsed)
		}
	}
	return fallback
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

func normalizeAnnouncementTone(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "success":
		return "success"
	case "warning":
		return "warning"
	case "danger":
		return "danger"
	default:
		return "info"
	}
}

func announcementID() string {
	var raw [8]byte
	if _, err := rand.Read(raw[:]); err == nil {
		return "ann-" + hex.EncodeToString(raw[:])
	}
	return fmt.Sprintf("ann-%d", time.Now().UnixNano())
}

func announcementLinkValid(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	if strings.HasPrefix(value, "/") && !strings.HasPrefix(value, "//") {
		return true
	}
	parsed, err := url.Parse(value)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

func validateAnnouncementItem(item *announcementBarItem, index int) error {
	item.ID = strings.TrimSpace(item.ID)
	if item.ID == "" {
		item.ID = announcementID()
	}
	if len(item.ID) > 80 {
		return fmt.Errorf("第 %d 条公告 ID 过长", index+1)
	}
	item.Title = strings.TrimSpace(item.Title)
	item.Message = strings.TrimSpace(item.Message)
	item.LinkText = strings.TrimSpace(item.LinkText)
	item.LinkURL = strings.TrimSpace(item.LinkURL)
	item.Tone = normalizeAnnouncementTone(item.Tone)
	item.StartsAt = strings.TrimSpace(item.StartsAt)
	item.EndsAt = strings.TrimSpace(item.EndsAt)
	if len(item.Title) > 80 || len(item.Message) > 500 || len(item.LinkText) > 40 || len(item.LinkURL) > 2048 {
		return fmt.Errorf("第 %d 条公告内容超过长度限制", index+1)
	}
	if item.Enabled && (item.Title == "" || item.Message == "") {
		return fmt.Errorf("第 %d 条已启用公告必须填写标题和正文", index+1)
	}
	if !announcementLinkValid(item.LinkURL) {
		return fmt.Errorf("第 %d 条公告链接必须是站内路径或 HTTP/HTTPS 地址", index+1)
	}
	parse := func(value string) (time.Time, bool) {
		if value == "" {
			return time.Time{}, false
		}
		parsed, err := time.Parse(time.RFC3339, value)
		return parsed, err == nil
	}
	start, hasStart := parse(item.StartsAt)
	end, hasEnd := parse(item.EndsAt)
	if item.StartsAt != "" && !hasStart {
		return fmt.Errorf("第 %d 条公告开始时间无效", index+1)
	}
	if item.EndsAt != "" && !hasEnd {
		return fmt.Errorf("第 %d 条公告结束时间无效", index+1)
	}
	if hasStart && hasEnd && !end.After(start) {
		return fmt.Errorf("第 %d 条公告结束时间必须晚于开始时间", index+1)
	}
	return nil
}

func announcementItemsFromSetting(value any) []announcementBarItem {
	if value == nil {
		return nil
	}
	data, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var items []announcementBarItem
	if json.Unmarshal(data, &items) != nil {
		return nil
	}
	for index := range items {
		_ = validateAnnouncementItem(&items[index], index)
	}
	return items
}

func (s *server) legacyAnnouncementItem(ctx context.Context) (announcementBarItem, bool) {
	title := announcementString(s.announcementSetting(ctx, "announcementbar.title"))
	message := announcementString(s.announcementSetting(ctx, "announcementbar.message"))
	if title == "" && message == "" {
		return announcementBarItem{}, false
	}
	return announcementBarItem{
		ID:          "legacy-default",
		Enabled:     true,
		Title:       title,
		Message:     message,
		LinkText:    announcementString(s.announcementSetting(ctx, "announcementbar.link_text")),
		LinkURL:     announcementString(s.announcementSetting(ctx, "announcementbar.link_url")),
		Tone:        normalizeAnnouncementTone(announcementString(s.announcementSetting(ctx, "announcementbar.tone"))),
		Dismissible: announcementBool(s.announcementSetting(ctx, "announcementbar.dismissible"), true),
		StartsAt:    announcementString(s.announcementSetting(ctx, "announcementbar.starts_at")),
		EndsAt:      announcementString(s.announcementSetting(ctx, "announcementbar.ends_at")),
		SortOrder:   0,
	}, true
}

func (s *server) allAnnouncementItems(ctx context.Context) []announcementBarItem {
	items := announcementItemsFromSetting(s.announcementSetting(ctx, "announcementbar.items"))
	if len(items) == 0 {
		if legacy, ok := s.legacyAnnouncementItem(ctx); ok {
			items = []announcementBarItem{legacy}
		}
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].SortOrder == items[j].SortOrder {
			return items[i].ID < items[j].ID
		}
		return items[i].SortOrder < items[j].SortOrder
	})
	return items
}

func (s *server) publicAnnouncementBar(w http.ResponseWriter, r *http.Request) {
	enabled := announcementBool(s.announcementSetting(r.Context(), "announcementbar.enabled"), false)
	rotation := announcementInt(s.announcementSetting(r.Context(), "announcementbar.rotation_seconds"), 8)
	if rotation < 4 {
		rotation = 4
	}
	if rotation > 60 {
		rotation = 60
	}
	payload := announcementBarPayload{Enabled: false, RotationSeconds: rotation, Items: []announcementBarItem{}}
	if !enabled {
		jsonResponse(w, http.StatusOK, payload)
		return
	}
	now := time.Now().UTC()
	for _, item := range s.allAnnouncementItems(r.Context()) {
		if !item.Enabled || item.Title == "" || item.Message == "" || !announcementInWindow(now, item.StartsAt, item.EndsAt) {
			continue
		}
		payload.Items = append(payload.Items, item)
	}
	if len(payload.Items) == 0 {
		jsonResponse(w, http.StatusOK, payload)
		return
	}
	payload.Enabled = true
	first := payload.Items[0]
	payload.ID = first.ID
	payload.Title = first.Title
	payload.Message = first.Message
	payload.LinkText = first.LinkText
	payload.LinkURL = first.LinkURL
	payload.Tone = first.Tone
	payload.Dismissible = first.Dismissible
	payload.StartsAt = first.StartsAt
	payload.EndsAt = first.EndsAt
	jsonResponse(w, http.StatusOK, payload)
}
