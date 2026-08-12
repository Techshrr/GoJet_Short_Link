package reconciler

import "testing"

func TestReconcilerUsesBoundedBatches(t *testing.T) {
	if got := New(nil, nil, 0).batch; got != 500 {
		t.Fatalf("default batch=%d", got)
	}
	if got := New(nil, nil, 5001).batch; got != 500 {
		t.Fatalf("oversized batch=%d", got)
	}
	if got := New(nil, nil, 250).batch; got != 250 {
		t.Fatalf("configured batch=%d", got)
	}
}
