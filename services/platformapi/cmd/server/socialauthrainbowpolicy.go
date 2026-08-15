package main

import (
	"context"
	"strings"
)

func (s *server) rainbowLoginTypeExposed(ctx context.Context, value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if !validRainbowLoginType(value) {
		return false
	}
	for _, item := range s.rainbowSelectedLoginTypes(ctx) {
		if item["id"] == value {
			return true
		}
	}
	return false
}
