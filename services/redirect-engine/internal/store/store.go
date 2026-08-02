package store

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/domain"
)

var ErrNotFound = errors.New("link not found")
var ErrRateLimited = errors.New("visit rate limited")

type Store interface {
	SaveLink(context.Context, domain.Link) error
	FindLink(context.Context, string) (domain.Link, error)
	RecordVisit(context.Context, domain.Visit) error
	Stats(context.Context, string) (domain.Stats, error)
	Backlog(context.Context) (int64, error)
}

// MemoryStore is deterministic infrastructure for tests and local evaluation.
type MemoryStore struct {
	mu       sync.Mutex
	links    map[string]domain.Link
	clicks   map[string]int64
	visitors map[string]map[string]struct{}
	bots     map[string]int64
	daily    map[string]int64
	dims     map[string]map[string]int64
	rates    map[string][]time.Time
	limit    int
	events   []domain.Visit
}

func NewMemory() *MemoryStore {
	return NewMemoryWithLimit(60)
}
func NewMemoryWithLimit(limit int) *MemoryStore {
	return &MemoryStore{links: map[string]domain.Link{}, clicks: map[string]int64{}, visitors: map[string]map[string]struct{}{}, bots: map[string]int64{}, daily: map[string]int64{}, dims: map[string]map[string]int64{}, rates: map[string][]time.Time{}, limit: limit}
}
func (s *MemoryStore) SaveLink(_ context.Context, l domain.Link) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.links[l.Code] = l
	return nil
}
func (s *MemoryStore) FindLink(_ context.Context, code string) (domain.Link, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	l, ok := s.links[code]
	if !ok {
		return l, ErrNotFound
	}
	return l, nil
}
func (s *MemoryStore) RecordVisit(_ context.Context, v domain.Visit) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	rateKey := v.LinkID + ":" + v.VisitorHash
	cutoff := v.Timestamp.Add(-time.Minute)
	kept := s.rates[rateKey][:0]
	for _, at := range s.rates[rateKey] {
		if at.After(cutoff) {
			kept = append(kept, at)
		}
	}
	if len(kept) >= s.limit {
		s.rates[rateKey] = kept
		return ErrRateLimited
	}
	s.rates[rateKey] = append(kept, v.Timestamp)
	s.clicks[v.LinkID]++
	s.daily[v.LinkID+":"+v.Timestamp.UTC().Format("2006-01-02")]++
	if s.visitors[v.LinkID] == nil {
		s.visitors[v.LinkID] = map[string]struct{}{}
	}
	if !v.IsBot {
		s.visitors[v.LinkID][v.VisitorHash] = struct{}{}
	} else {
		s.bots[v.LinkID]++
	}
	for dimension, value := range map[string]string{"source": v.SourceType, "device": v.Device, "browser": v.Browser} {
		key := v.LinkID + ":" + dimension
		if s.dims[key] == nil {
			s.dims[key] = map[string]int64{}
		}
		s.dims[key][value]++
	}
	s.events = append(s.events, v)
	return nil
}
func (s *MemoryStore) Stats(_ context.Context, id string) (domain.Stats, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	copyMap := func(in map[string]int64) map[string]int64 {
		out := map[string]int64{}
		for k, v := range in {
			out[k] = v
		}
		return out
	}
	return domain.Stats{Clicks: s.clicks[id], TodayClicks: s.daily[id+":"+time.Now().UTC().Format("2006-01-02")], UniqueVisitors: int64(len(s.visitors[id])), BotVisits: s.bots[id], Sources: copyMap(s.dims[id+":source"]), Devices: copyMap(s.dims[id+":device"]), Browsers: copyMap(s.dims[id+":browser"])}, nil
}
func (s *MemoryStore) Backlog(_ context.Context) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return int64(len(s.events)), nil
}
