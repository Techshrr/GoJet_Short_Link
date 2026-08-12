package main

import (
	"net/http/httptest"
	"testing"
)

func TestLinkFilterParsesOrganizationDimensions(t *testing.T) {
	request := httptest.NewRequest("GET", "/links?search=summer&status=active&domain=go.example&folder=4&campaign=5&tag=6&limit=50&offset=100", nil)
	filter := linkFilter(request)
	if filter.Search != "summer" || filter.Status != "active" || filter.Domain != "go.example" || filter.FolderID != 4 || filter.CampaignID != 5 || filter.TagID != 6 || filter.Limit != 50 || filter.Offset != 100 {
		t.Fatalf("unexpected filter %#v", filter)
	}
}
