package destinationrisk

import (
	"context"
	"testing"
)

func TestSemanticProviderBlocksGenericRandomHostGamblingContent(t *testing.T) {
	provider := newSemanticProvider(nil)
	result, err := provider.Assess(context.Background(), Snapshot{
		URL:         "https://r4nd0m.example/",
		FinalURL:    "https://r4nd0m.example/",
		StatusCode:  200,
		ContentType: "text/html",
		Title:       "真人娱乐中心",
		Body:        `<html><body><h1>真人娱乐城</h1><a>体育投注</a><a>百家乐</a><p>首存送彩金，支持充值提现，查看实时赔率后在线下注。</p></body></html>`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Decision != Block || result.Score < 90 {
		t.Fatalf("expected generic gambling content to block, got %#v", result)
	}
	found := false
	for _, category := range result.Categories {
		if category == CategoryGambling {
			found = true
		}
	}
	if !found {
		t.Fatalf("gambling category missing: %#v", result)
	}
}

func TestSemanticProviderBlocksGenericRandomHostAdultContent(t *testing.T) {
	provider := newSemanticProvider(nil)
	result, err := provider.Assess(context.Background(), Snapshot{
		URL:         "https://another-random.example/",
		FinalURL:    "https://another-random.example/",
		StatusCode:  200,
		ContentType: "text/html",
		Title:       "成人视频",
		Body:        `<html><body><h1>成人视频</h1><p>成人影片与无码专区，仅限18岁以上用户访问。</p></body></html>`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Decision != Block || result.Score < 90 {
		t.Fatalf("expected generic adult content to block, got %#v", result)
	}
}

func TestSemanticProviderReviewsUnverifiableChallenge(t *testing.T) {
	provider := newSemanticProvider(nil)
	result, err := provider.Assess(context.Background(), Snapshot{
		URL:         "https://random.example/",
		FinalURL:    "https://random.example/",
		StatusCode:  403,
		ContentType: "text/html",
		Title:       "Just a moment...",
		Body:        `<html><body>Checking your browser before accessing the site.</body></html>`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Decision != Review || result.Score < 45 {
		t.Fatalf("expected challenge page to require review, got %#v", result)
	}
}

func TestSemanticProviderReviewsClientRenderedShellWithoutEnoughEvidence(t *testing.T) {
	provider := newSemanticProvider(nil)
	result, err := provider.Assess(context.Background(), Snapshot{
		URL:         "https://opaque-random.example/",
		FinalURL:    "https://opaque-random.example/",
		StatusCode:  200,
		ContentType: "text/html; charset=utf-8",
		Title:       "Welcome",
		Body:        `<html><body><div id="app"><h1>Welcome</h1><p>Please open the interactive application to continue with the available account services.</p></div><script src="/assets/runtime.js"></script><script src="/assets/app.js"></script></body></html>`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Decision != Review || result.Score < 50 {
		t.Fatalf("expected unverifiable client-rendered shell to require review, got %#v", result)
	}
	found := false
	for _, signal := range result.Signals {
		if signal == "destination_client_rendered_content_not_verifiable" {
			found = true
		}
	}
	if !found {
		t.Fatalf("client-rendered evidence signal missing: %#v", result)
	}
}

func TestSemanticProviderDoesNotBlockOrdinaryPaymentsOrSports(t *testing.T) {
	provider := newSemanticProvider(nil)
	result, err := provider.Assess(context.Background(), Snapshot{
		URL:         "https://merchant.example/",
		FinalURL:    "https://merchant.example/",
		StatusCode:  200,
		ContentType: "text/html",
		Title:       "在线支付与体育资讯",
		Body:        `<html><body><h1>企业支付服务</h1><p>支持订单退款、银行卡付款，并提供体育新闻和比赛数据。</p></body></html>`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Decision == Block {
		t.Fatalf("ordinary payment/sports content must not be blocked: %#v", result)
	}
}
