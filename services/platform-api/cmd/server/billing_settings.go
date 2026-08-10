package main

func init() {
	settingSections["billing"] = map[string]bool{
		"billing.settlement_currency": true,
		"billing.fx.provider": true,
		"billing.fx.markup_bps": true,
		"billing.fx.cache_hours": true,
		"billing.fx.manual_rates": true,
	}
}
