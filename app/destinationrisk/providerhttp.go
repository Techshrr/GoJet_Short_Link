package destinationrisk

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type HTTPProvider struct {
	endpoint string
	token    string
	client   *http.Client
}

func ProviderFromEnvironment() Provider {
	endpoint := strings.TrimSpace(os.Getenv("DESTINATION_RISK_PROVIDER_URL"))
	if endpoint == "" {
		return newSemanticProvider(nil)
	}
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return newSemanticProvider(nil)
	}
	external := &HTTPProvider{
		endpoint: endpoint,
		token:    strings.TrimSpace(os.Getenv("DESTINATION_RISK_PROVIDER_TOKEN")),
		client:   &http.Client{Timeout: 4 * time.Second},
	}
	return newSemanticProvider(external)
}

func (p *HTTPProvider) Name() string { return "external_reputation" }

func (p *HTTPProvider) Assess(ctx context.Context, snapshot Snapshot) (ProviderResult, error) {
	if p == nil || p.client == nil || p.endpoint == "" {
		return ProviderResult{}, errors.New("risk provider is not configured")
	}
	body := snapshot.Body
	if len(body) > 64<<10 {
		body = body[:64<<10]
	}
	payload, err := json.Marshal(map[string]any{
		"url":          snapshot.URL,
		"final_url":    snapshot.FinalURL,
		"status_code":  snapshot.StatusCode,
		"content_type": snapshot.ContentType,
		"title":        snapshot.Title,
		"body_excerpt": body,
	})
	if err != nil {
		return ProviderResult{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(payload))
	if err != nil {
		return ProviderResult{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "GoJet-Destination-Risk-Provider/1.0")
	if p.token != "" {
		request.Header.Set("Authorization", "Bearer "+p.token)
	}
	response, err := p.client.Do(request)
	if err != nil {
		return ProviderResult{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ProviderResult{}, errors.New("risk provider returned a non-success status")
	}
	var raw struct {
		Decision   Decision   `json:"decision"`
		Score      int        `json:"score"`
		Categories []Category `json:"categories"`
		Signals    []string   `json:"signals"`
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 256<<10))
	if err = decoder.Decode(&raw); err != nil {
		return ProviderResult{}, err
	}
	if !validDecision(raw.Decision) {
		return ProviderResult{}, errors.New("risk provider returned an invalid decision")
	}
	if raw.Score < 0 {
		raw.Score = 0
	}
	if raw.Score > 100 {
		raw.Score = 100
	}
	if len(raw.Categories) > 32 {
		raw.Categories = raw.Categories[:32]
	}
	if len(raw.Signals) > 64 {
		raw.Signals = raw.Signals[:64]
	}
	return ProviderResult{Decision: raw.Decision, Score: raw.Score, Categories: raw.Categories, Signals: raw.Signals}, nil
}
