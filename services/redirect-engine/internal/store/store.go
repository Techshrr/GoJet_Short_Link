package store

import (
	"context"
	"errors"
	"sync"

	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/domain"
)

var ErrNotFound = errors.New("link not found")

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
	events   []domain.Visit
}

func NewMemory() *MemoryStore {
	return &MemoryStore{links: map[string]domain.Link{}, clicks: map[string]int64{}, visitors: map[string]map[string]struct{}{}}
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
	s.clicks[v.LinkID]++
	if s.visitors[v.LinkID] == nil {
		s.visitors[v.LinkID] = map[string]struct{}{}
	}
	s.visitors[v.LinkID][v.VisitorHash] = struct{}{}
	s.events = append(s.events, v)
	return nil
}
func (s *MemoryStore) Stats(_ context.Context, id string) (domain.Stats, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return domain.Stats{Clicks: s.clicks[id], UniqueVisitors: int64(len(s.visitors[id]))}, nil
}
func (s *MemoryStore) Backlog(_ context.Context) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return int64(len(s.events)), nil
}
