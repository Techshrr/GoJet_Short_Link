package main

import (
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

func TestLiteralServeMuxPatternsAreValidAndConflictFree(t *testing.T) {
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	literal := regexp.MustCompile(`HandleFunc\("([^"]+)"`)
	testFile := regexp.MustCompile(`_test\.go$`)
	checked := 0
	mux := http.NewServeMux()

	for _, file := range files {
		if testFile.MatchString(file) {
			continue
		}
		source, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		for _, match := range literal.FindAllSubmatch(source, -1) {
			pattern := string(match[1])
			checked++
			func() {
				defer func() {
					if recovered := recover(); recovered != nil {
						t.Errorf("invalid or conflicting ServeMux pattern %q in %s: %v", pattern, file, recovered)
					}
				}()
				mux.HandleFunc(pattern, func(http.ResponseWriter, *http.Request) {})
			}()
		}
	}

	if checked == 0 {
		t.Fatal("no literal HandleFunc patterns were checked")
	}
}
