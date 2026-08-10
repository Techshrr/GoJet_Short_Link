package main

import "testing"

func TestNormalizeReportedURLAcceptsSingleShortCodeAndStripsTracking(t *testing.T) {
	got, host, code, ok := normalizeReportedURL(" https://GOJET.cc/AbC12?utm_source=test#fragment ")
	if !ok {
		t.Fatal("expected valid GoJet URL")
	}
	if got != "https://GOJET.cc/AbC12" {
		t.Fatalf("normalized URL = %q", got)
	}
	if host != "gojet.cc" || code != "AbC12" {
		t.Fatalf("host/code = %q/%q", host, code)
	}
}

func TestNormalizeReportedURLRejectsUnsafeOrAmbiguousForms(t *testing.T) {
	cases := []string{
		"",
		"javascript:alert(1)",
		"ftp://gojet.cc/a",
		"https://user:pass@gojet.cc/a",
		"https://gojet.cc/",
		"https://gojet.cc/a/b",
		"https://gojet.cc/a%2Fb",
		"https://gojet.cc/%2Fadmin",
	}
	for _, input := range cases {
		if _, _, _, ok := normalizeReportedURL(input); ok {
			t.Fatalf("unsafe URL unexpectedly accepted: %q", input)
		}
	}
}

func TestValidAbuseReasonIsClosedSet(t *testing.T) {
	for _, value := range []string{"malware", "phishing", "spam", "copyright", "other"} {
		if !validAbuseReason(value) {
			t.Fatalf("expected reason %q to be accepted", value)
		}
	}
	for _, value := range []string{"", "fraud", "MALWARE", " phishing "} {
		if validAbuseReason(value) {
			t.Fatalf("unexpected reason accepted: %q", value)
		}
	}
}
