package main

import "testing"

func TestPercentEncodeFilenamePreventsHeaderInjection(t *testing.T) {
	value := percentEncodeFilename("报告\r\nX-Evil: yes.pdf")
	if value != "%E6%8A%A5%E5%91%8A%0D%0AX-Evil%3A%20yes.pdf" {
		t.Fatalf("unexpected encoded filename %q", value)
	}
}
