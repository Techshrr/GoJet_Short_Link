package main

import "testing"

func TestMailTemplateIsFragment(t *testing.T) {
	valid := []string{
		"<h1>你好</h1><p>内容</p>",
		"<table><tr><td>允许内容区表格</td></tr></table>",
		"<a class=\"button\" href=\"{{url}}\">继续</a>",
	}
	for _, body := range valid {
		if !mailTemplateIsFragment(body) {
			t.Fatalf("expected fragment to be accepted: %q", body)
		}
	}
	invalid := []string{
		"<!doctype html><html><body><p>x</p></body></html>",
		"<HTML><BODY>x</BODY></HTML>",
		"<head><style>p{}</style></head><p>x</p>",
		"<body><p>x</p></body>",
	}
	for _, body := range invalid {
		if mailTemplateIsFragment(body) {
			t.Fatalf("expected full document to be rejected: %q", body)
		}
	}
}
