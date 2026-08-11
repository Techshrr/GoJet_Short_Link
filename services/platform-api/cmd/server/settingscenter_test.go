package main

import (
	"mime/multipart"
	"os"
	"path/filepath"
	"testing"
)

func TestValidateImageUsesMagicBytes(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "image-*.png")
	if err != nil { t.Fatal(err) }
	defer file.Close()
	png := []byte{0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,0,0,0,0}
	if _, err = file.Write(png); err != nil { t.Fatal(err) }
	if _, err = file.Seek(0, 0); err != nil { t.Fatal(err) }
	mime, ext, err := validateImage(file, &multipart.FileHeader{Filename:"malicious.svg", Size:int64(len(png))})
	if err != nil || mime != "image/png" || ext != ".png" { t.Fatalf("mime=%s ext=%s err=%v", mime, ext, err) }
}

func TestValidateImageRejectsSVG(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "image-*.svg")
	if err != nil { t.Fatal(err) }
	defer file.Close()
	content := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	_, _ = file.Write(content); _, _ = file.Seek(0,0)
	if _, _, err = validateImage(file, &multipart.FileHeader{Filename:"logo.svg", Size:int64(len(content))}); err == nil { t.Fatal("executable SVG must be rejected") }
}

func TestRemoveOldBrandAssetCannotEscapeStorage(t *testing.T) {
	brandStorage := t.TempDir(); legacyUploads := t.TempDir(); outsideDir := t.TempDir()
	outside, err := os.CreateTemp(outsideDir, "outside"); if err != nil { t.Fatal(err) }; outside.Close()
	removeOldBrandAsset(brandStorage, legacyUploads, "/assets/images/../../"+filepath.Base(outside.Name()), "")
	removeOldBrandAsset(brandStorage, legacyUploads, "/uploads/../../"+filepath.Base(outside.Name()), "")
	if _, err = os.Stat(outside.Name()); err != nil { t.Fatal("outside file was removed") }
}

func TestRemoveOldBrandAssetUsesCorrectNamespace(t *testing.T) {
	brandStorage := t.TempDir(); legacyUploads := t.TempDir()
	brandLogo := filepath.Join(brandStorage,"logo.png"); legacyLogo := filepath.Join(legacyUploads,"legacy.png")
	if err := os.WriteFile(brandLogo, []byte("brand"), 0644); err != nil { t.Fatal(err) }
	if err := os.WriteFile(legacyLogo, []byte("legacy"), 0644); err != nil { t.Fatal(err) }
	removeOldBrandAsset(brandStorage, legacyUploads, "/assets/images/logo.png", "")
	if _, err := os.Stat(brandLogo); !os.IsNotExist(err) { t.Fatalf("brand asset was not deleted: %v", err) }
	if _, err := os.Stat(legacyLogo); err != nil { t.Fatal("brand cleanup touched legacy user upload namespace") }
	removeOldBrandAsset(brandStorage, legacyUploads, "/uploads/legacy.png", "")
	if _, err := os.Stat(legacyLogo); !os.IsNotExist(err) { t.Fatalf("legacy brand asset was not cleaned: %v", err) }
}

func TestRemoveOldBrandAssetIgnoresRetiredSystemNamespace(t *testing.T) {
	brandStorage := t.TempDir(); legacyUploads := t.TempDir(); brandLogo := filepath.Join(brandStorage,"logo.png")
	if err := os.WriteFile(brandLogo, []byte("brand"), 0644); err != nil { t.Fatal(err) }
	removeOldBrandAsset(brandStorage, legacyUploads, "/system-images/logo.png", "")
	if _, err := os.Stat(brandLogo); err != nil { t.Fatalf("retired system-images namespace must not map to brand storage: %v", err) }
}

func TestCanonicalSettingRegistryIncludesUISettings(t *testing.T) {
	for _, tc := range []struct{key,section string}{
		{"seo.sitemap","seo"},{"site.name","basic"},{"links.force_https","links"},{"analytics.retention_days","privacy"},{"cache.default_ttl_seconds","runtime"},{"turnstile.secret","registration"},
	} {
		section, ok := canonicalSettingSection(tc.key)
		if !ok || section != tc.section { t.Fatalf("setting %s registry mismatch: section=%s ok=%v", tc.key, section, ok) }
	}
	if _, ok := canonicalSettingSection("seo.this_key_must_never_exist"); ok { t.Fatal("unregistered setting key was accepted") }
}

func TestValidateLinkSettings(t *testing.T) {
	valid := map[string]any{"links.default_redirect_status":float64(307),"links.code_length":float64(9),"links.default_expiry_days":float64(30),"links.default_click_limit":float64(500),"links.allowed_characters":"abcdef23456789"}
	if err := validateLinkSettings(valid); err != nil { t.Fatal(err) }
	for name, values := range map[string]map[string]any{"status":{"links.default_redirect_status":float64(303)},"length":{"links.code_length":float64(2)},"alphabet":{"links.allowed_characters":"a b"}} {
		t.Run(name, func(t *testing.T){ if err := validateLinkSettings(values); err == nil { t.Fatal("invalid link setting was accepted") } })
	}
}
