package main

func init() {
	settingSections["payments"] = map[string]bool{
		"payments.enabled": true,
		"payments.default_provider": true,
		"payments.alipay.enabled": true,
		"payments.alipay.display_name": true,
		"payments.alipay.app_id": true,
		"payments.alipay.gateway": true,
		"payments.alipay.private_key": true,
		"payments.alipay.public_key": true,
		"payments.wechat.enabled": true,
		"payments.wechat.display_name": true,
		"payments.wechat.app_id": true,
		"payments.wechat.mch_id": true,
		"payments.wechat.mch_serial_no": true,
		"payments.wechat.private_key": true,
		"payments.wechat.api_v3_key": true,
		"payments.wechat.platform_serial_no": true,
		"payments.wechat.platform_public_key": true,
		"payments.epay.enabled": true,
		"payments.epay.display_name": true,
		"payments.epay.gateway": true,
		"payments.epay.pid": true,
		"payments.epay.key": true,
		"payments.epay.default_type": true,
		"payments.paypal.enabled": true,
		"payments.paypal.display_name": true,
		"payments.paypal.environment": true,
		"payments.paypal.client_id": true,
		"payments.paypal.client_secret": true,
		"payments.paypal.webhook_id": true,
		"payments.stripe.enabled": true,
		"payments.stripe.display_name": true,
		"payments.stripe.secret_key": true,
		"payments.stripe.webhook_secret": true,
	}
	for _, key := range []string{
		"payments.alipay.private_key", "payments.alipay.public_key",
		"payments.wechat.private_key", "payments.wechat.api_v3_key", "payments.wechat.platform_public_key",
		"payments.epay.key", "payments.paypal.client_secret", "payments.paypal.webhook_id",
		"payments.stripe.secret_key", "payments.stripe.webhook_secret",
	} {
		sensitiveSettings[key] = true
	}
}