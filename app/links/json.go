package links

import (
	"bytes"
	"encoding/json"
)

type linkWire struct {
	ID             int64           `json:"id,omitempty"`
	WorkspaceID    int64           `json:"workspace_id,omitempty"`
	CreatedBy      int64           `json:"created_by,omitempty"`
	Code           string          `json:"code,omitempty"`
	Domain         string          `json:"domain,omitempty"`
	Destination    string          `json:"destination,omitempty"`
	Title          string          `json:"title,omitempty"`
	Status         string          `json:"status,omitempty"`
	RedirectStatus int             `json:"redirect_status,omitempty"`
	Password       string          `json:"password,omitempty"`
	ClearPassword  bool            `json:"clear_password,omitempty"`
	ExpiresAt      *string         `json:"expires_at,omitempty"`
	MaxClicks      *int64          `json:"max_clicks,omitempty"`
	OneTime        bool            `json:"one_time"`
	FolderID       *int64          `json:"folder_id,omitempty"`
	CampaignID     *int64          `json:"campaign_id,omitempty"`
	TagIDs         []int64         `json:"tag_ids,omitempty"`
	FolderName     string          `json:"folder_name,omitempty"`
	CampaignName   string          `json:"campaign_name,omitempty"`
	TagNames       []string        `json:"tag_names,omitempty"`
	UTM            json.RawMessage `json:"utm,omitempty"`
	RoutingRules   json.RawMessage `json:"routing_rules,omitempty"`
	ABDestinations json.RawMessage `json:"ab_destinations,omitempty"`
	CreatedAt      string          `json:"created_at,omitempty"`
	Clicks         int64           `json:"clicks,omitempty"`
	Visitors       int64           `json:"visitors,omitempty"`
}

func (l Link) MarshalJSON() ([]byte, error) {
	return json.Marshal(linkWire{
		ID: l.ID, WorkspaceID: l.WorkspaceID, CreatedBy: l.CreatedBy,
		Code: l.Code, Domain: l.Domain, Destination: l.Destination, Title: l.Title, Status: l.Status,
		RedirectStatus: l.RedirectStatus, Password: l.Password, ClearPassword: l.ClearPassword,
		ExpiresAt: l.ExpiresAt, MaxClicks: l.MaxClicks, OneTime: l.OneTime,
		FolderID: l.FolderID, CampaignID: l.CampaignID, TagIDs: l.TagIDs,
		FolderName: l.FolderName, CampaignName: l.CampaignName, TagNames: l.TagNames,
		UTM: l.UTM, RoutingRules: l.RoutingRules, ABDestinations: l.ABDestinations,
		CreatedAt: l.CreatedAt, Clicks: l.Clicks, Visitors: l.Visitors,
	})
}

func normalizeOptionalJSON(value json.RawMessage) json.RawMessage {
	value = bytes.TrimSpace(value)
	if len(value) == 0 || bytes.Equal(value, []byte("null")) || bytes.Equal(value, []byte("[]")) || bytes.Equal(value, []byte("{}")) {
		return nil
	}
	return value
}

func (l *Link) UnmarshalJSON(data []byte) error {
	var wire linkWire
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	// Preserve compatibility with older clients that emitted Go field names
	// while keeping snake_case as the canonical public contract.
	var legacy struct {
		ID, WorkspaceID, CreatedBy                   int64
		Code, Domain, Destination, Title, Status     string
		RedirectStatus                               int
		Clicks, Visitors                             int64
	}
	_ = json.Unmarshal(data, &legacy)
	if wire.ID == 0 { wire.ID = legacy.ID }
	if wire.WorkspaceID == 0 { wire.WorkspaceID = legacy.WorkspaceID }
	if wire.CreatedBy == 0 { wire.CreatedBy = legacy.CreatedBy }
	if wire.Code == "" { wire.Code = legacy.Code }
	if wire.Domain == "" { wire.Domain = legacy.Domain }
	if wire.Destination == "" { wire.Destination = legacy.Destination }
	if wire.Title == "" { wire.Title = legacy.Title }
	if wire.Status == "" { wire.Status = legacy.Status }
	if wire.RedirectStatus == 0 { wire.RedirectStatus = legacy.RedirectStatus }
	if wire.Clicks == 0 { wire.Clicks = legacy.Clicks }
	if wire.Visitors == 0 { wire.Visitors = legacy.Visitors }

	wire.UTM = normalizeOptionalJSON(wire.UTM)
	wire.RoutingRules = normalizeOptionalJSON(wire.RoutingRules)
	wire.ABDestinations = normalizeOptionalJSON(wire.ABDestinations)
	if wire.MaxClicks != nil && *wire.MaxClicks <= 0 {
		wire.MaxClicks = nil
	}

	*l = Link{
		ID: wire.ID, WorkspaceID: wire.WorkspaceID, CreatedBy: wire.CreatedBy,
		Code: wire.Code, Domain: wire.Domain, Destination: wire.Destination, Title: wire.Title, Status: wire.Status,
		RedirectStatus: wire.RedirectStatus, Password: wire.Password, ClearPassword: wire.ClearPassword,
		ExpiresAt: wire.ExpiresAt, MaxClicks: wire.MaxClicks, OneTime: wire.OneTime,
		FolderID: wire.FolderID, CampaignID: wire.CampaignID, TagIDs: wire.TagIDs,
		FolderName: wire.FolderName, CampaignName: wire.CampaignName, TagNames: wire.TagNames,
		UTM: wire.UTM, RoutingRules: wire.RoutingRules, ABDestinations: wire.ABDestinations,
		CreatedAt: wire.CreatedAt, Clicks: wire.Clicks, Visitors: wire.Visitors,
	}
	return nil
}
