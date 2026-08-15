package httpapi

import (
	"net/http/httptest"
	"net/netip"
	"os"
	"path/filepath"
	"testing"
)

func TestRequestGeographyUsesCDNAndNormalizedHeaders(t *testing.T) {
	r := httptest.NewRequest("GET", "http://gojet.test/demo", nil)
	r.Header.Set("CF-IPCountry", "sg")
	r.Header.Set("X-GoJet-Region", "Central Singapore")
	r.Header.Set("X-GoJet-City", "Singapore%20City")
	geo := requestGeography(r)
	if geo.Country != "SG" || geo.Region != "Central Singapore" || geo.City != "Singapore City" {
		t.Fatalf("unexpected geography: %#v", geo)
	}
}

func TestRequestGeographyFallsBackToLocalCountryCSV(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "country.csv")
	if err := os.WriteFile(path, []byte("203.0.113.0,203.0.113.255,SG\n2001:db8::/32,AU\n"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GEOIP_MMDB", "")
	t.Setenv("GEOIP_COUNTRY_CSV", path)
	r := httptest.NewRequest("GET", "http://gojet.test/demo", nil)
	r.RemoteAddr = "127.0.0.1:54321"
	r.Header.Set("X-Real-IP", "203.0.113.42")
	geo := requestGeography(r)
	if geo.Country != "SG" {
		t.Fatalf("expected SG from local CSV, got %#v", geo)
	}
}

func TestRequestGeographyFillsMissingRegionAndCityAfterCountryHeader(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "location.csv")
	if err := os.WriteFile(path, []byte("203.0.113.0,203.0.113.255,SG,Central Singapore,Singapore\n"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GEOIP_MMDB", "")
	t.Setenv("GEOIP_COUNTRY_CSV", path)
	r := httptest.NewRequest("GET", "http://gojet.test/demo", nil)
	r.RemoteAddr = "127.0.0.1:54321"
	r.Header.Set("CF-IPCountry", "sg")
	r.Header.Set("X-Real-IP", "203.0.113.42")
	geo := requestGeography(r)
	if geo.Country != "SG" || geo.Region != "Central Singapore" || geo.City != "Singapore" {
		t.Fatalf("expected header country plus local region/city, got %#v", geo)
	}
}

func TestRequestGeographyUsesCloudflareVisitorIPForLocalFallback(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "cloudflarecountry.csv")
	if err := os.WriteFile(path, []byte("198.51.100.0,198.51.100.255,JP\n"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GEOIP_MMDB", "")
	t.Setenv("GEOIP_COUNTRY_CSV", path)
	r := httptest.NewRequest("GET", "http://gojet.test/demo", nil)
	r.RemoteAddr = "127.0.0.1:54321"
	r.Header.Set("CF-Connecting-IP", "198.51.100.9")
	r.Header.Set("X-Real-IP", "172.64.10.10")
	geo := requestGeography(r)
	if geo.Country != "JP" {
		t.Fatalf("expected JP from visitor IP fallback, got %#v", geo)
	}
}

func TestCountryDatabaseSupportsIPv4AndIPv6Ranges(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "ranges.csv")
	if err := os.WriteFile(path, []byte("1.0.0.0,1.0.0.255,AU,Queensland,Brisbane\n2001:db8:abcd::/48,SG,Central Singapore,Singapore\n"), 0600); err != nil {
		t.Fatal(err)
	}
	database, err := loadCountryDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	for address, want := range map[string]string{"1.0.0.8": "AU", "2001:db8:abcd::1234": "SG", "8.8.8.8": ""} {
		ip, err := netip.ParseAddr(address)
		if err != nil {
			t.Fatal(err)
		}
		if got := database.Lookup(ip); got != want {
			t.Fatalf("lookup %s: got %q want %q", address, got, want)
		}
	}
	ip := netip.MustParseAddr("1.0.0.8")
	geo := database.LookupGeography(ip)
	if geo.Region != "Queensland" || geo.City != "Brisbane" {
		t.Fatalf("expected range location metadata, got %#v", geo)
	}
}

func TestPreferredGeoNameUsesChineseThenEnglish(t *testing.T) {
	if got := preferredGeoName(map[string]string{"en": "Singapore", "zh-CN": "新加坡"}); got != "新加坡" {
		t.Fatalf("unexpected preferred name %q", got)
	}
	if got := preferredGeoName(map[string]string{"en": "Tokyo"}); got != "Tokyo" {
		t.Fatalf("unexpected English fallback %q", got)
	}
}
