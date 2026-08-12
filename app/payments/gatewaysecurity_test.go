package payments

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"net/url"
	"regexp"
	"testing"
)

func TestDecimalToCents(t *testing.T) {
	cases := map[string]int64{"0": 0, "1": 100, "1.2": 120, "69.00": 6900, "199.99": 19999}
	for input, want := range cases {
		got, err := decimalToCents(input)
		if err != nil || got != want { t.Fatalf("decimalToCents(%q)=%d,%v want %d", input, got, err, want) }
	}
	for _, input := range []string{"-1", "1.234", "abc"} {
		if _, err := decimalToCents(input); err == nil { t.Fatalf("decimalToCents(%q) should fail", input) }
	}
}

func TestRSASHA256RoundTrip(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil { t.Fatal(err) }
	message := "GoJet payment signature"
	signature, err := rsaSHA256Sign(key, message)
	if err != nil { t.Fatal(err) }
	if err = rsaSHA256Verify(&key.PublicKey, message, signature); err != nil { t.Fatalf("verify failed: %v", err) }
	if err = rsaSHA256Verify(&key.PublicKey, message+"!", signature); err == nil { t.Fatal("tampered message verified") }
}

func TestEPaySignCanonicalOrder(t *testing.T) {
	values := url.Values{}
	values.Set("money", "69.00")
	values.Set("pid", "1001")
	values.Set("out_trade_no", "GJTEST")
	values.Set("sign_type", "MD5")
	first := epaySign(values, "secret")
	values2 := url.Values{}
	values2.Set("out_trade_no", "GJTEST")
	values2.Set("pid", "1001")
	values2.Set("money", "69.00")
	if second := epaySign(values2, "secret"); first != second { t.Fatalf("signature depends on input order: %s != %s", first, second) }
	values.Set("money", "68.00")
	if changed := epaySign(values, "secret"); changed == first { t.Fatal("changed amount did not change signature") }
}

func TestWeChatResourceDecrypt(t *testing.T) {
	key := []byte("12345678901234567890123456789012")
	nonce := []byte("123456789012")
	aad := []byte("transaction")
	plain := []byte(`{"out_trade_no":"GJTEST","trade_state":"SUCCESS"}`)
	block, err := aes.NewCipher(key); if err != nil { t.Fatal(err) }
	gcm, err := cipher.NewGCM(block); if err != nil { t.Fatal(err) }
	ciphertext := gcm.Seal(nil, nonce, plain, aad)
	got, err := decryptWeChatResource(string(key), string(nonce), string(aad), base64.StdEncoding.EncodeToString(ciphertext))
	if err != nil { t.Fatal(err) }
	if string(got) != string(plain) { t.Fatalf("decrypt mismatch: %q", got) }
}

func TestMerchantOrderNumber(t *testing.T) {
	order, err := merchantOrderNumber(); if err != nil { t.Fatal(err) }
	if !regexp.MustCompile(`^GJ[0-9]{6}[A-F0-9]{20}$`).MatchString(order) { t.Fatalf("unexpected merchant order: %s", order) }
	if len(order) > 32 { t.Fatalf("merchant order too long: %d", len(order)) }
}

func TestStripeSignatureParsing(t *testing.T) {
	ts, sigs, err := parseStripeSignature("t=123,v1=aa,v1=bb")
	if err != nil || ts != 123 || len(sigs) != 2 { t.Fatalf("unexpected parse: %d %#v %v", ts, sigs, err) }
}
