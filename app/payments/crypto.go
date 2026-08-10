package payments

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"strings"
)

func normalizedPEM(value, kind string) string {
	value = strings.TrimSpace(strings.ReplaceAll(value, `\n`, "\n"))
	if value == "" || strings.Contains(value, "-----BEGIN ") {
		return value
	}
	compact := strings.Join(strings.Fields(value), "")
	var builder strings.Builder
	builder.WriteString("-----BEGIN " + kind + "-----\n")
	for len(compact) > 64 {
		builder.WriteString(compact[:64] + "\n")
		compact = compact[64:]
	}
	builder.WriteString(compact + "\n-----END " + kind + "-----")
	return builder.String()
}

func parseRSAPrivateKey(value string) (*rsa.PrivateKey, error) {
	value = normalizedPEM(value, "PRIVATE KEY")
	block, _ := pem.Decode([]byte(value))
	if block == nil {
		return nil, errors.New("私钥格式无效")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("仅支持 RSA PKCS#1 或 PKCS#8 私钥")
}

func parseRSAPublicKey(value string) (*rsa.PublicKey, error) {
	value = normalizedPEM(value, "PUBLIC KEY")
	block, _ := pem.Decode([]byte(value))
	if block == nil {
		return nil, errors.New("公钥格式无效")
	}
	if key, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return key, nil
	}
	if certificate, err := x509.ParseCertificate(block.Bytes); err == nil {
		if rsaKey, ok := certificate.PublicKey.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	return nil, errors.New("仅支持 RSA 公钥或证书")
}

func rsaSHA256Sign(privateKey *rsa.PrivateKey, message string) (string, error) {
	hash := sha256.Sum256([]byte(message))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func rsaSHA256Verify(publicKey *rsa.PublicKey, message, signature string) error {
	decoded, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return err
	}
	hash := sha256.Sum256([]byte(message))
	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hash[:], decoded)
}
