package billing

import (
	"math/big"
	"testing"
)

func TestRoundRatToIntHalfUp(t *testing.T) {
	cases:=[]struct{value string;want int64}{{"7249/100",72},{"7250/100",73},{"7251/100",73},{"1/2",1},{"149/100",1},{"150/100",2}}
	for _,tc:=range cases{
		value,ok:=new(big.Rat).SetString(tc.value);if !ok{t.Fatalf("bad fixture %s",tc.value)}
		got,err:=roundRatToInt(value);if err!=nil{t.Fatalf("%s: %v",tc.value,err)}
		if got!=tc.want{t.Fatalf("round %s = %d want %d",tc.value,got,tc.want)}
	}
}

func TestRoundRatRejectsNegative(t *testing.T){if _,err:=roundRatToInt(big.NewRat(-1,2));err==nil{t.Fatal("negative amount must be rejected")}}

func TestTwoDecimalCurrencyGuard(t *testing.T){
	for _,code:=range []string{"CNY","USD","EUR","HKD","SGD","GBP"}{if !twoDecimalCurrency[code]{t.Fatalf("%s should be supported",code)}}
	for _,code:=range []string{"JPY","KRW"}{if twoDecimalCurrency[code]{t.Fatalf("%s must not be treated as a two-decimal currency",code)}}
}
