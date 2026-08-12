package main

import "testing"

func TestManualSettlementNote(t *testing.T) {
	tests := []struct {
		name   string
		status string
		note   string
		want   string
	}{
		{name: "paid default", status: "paid", want: "管理员手动确认支付"},
		{name: "void default", status: "void", want: "管理员手动作废"},
		{name: "blank whitespace", status: "paid", note: "   ", want: "管理员手动确认支付"},
		{name: "explicit note", status: "paid", note: "  银行流水已核验  ", want: "银行流水已核验"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := manualSettlementNote(tt.status, tt.note); got != tt.want {
				t.Fatalf("manualSettlementNote(%q, %q) = %q, want %q", tt.status, tt.note, got, tt.want)
			}
		})
	}
}
