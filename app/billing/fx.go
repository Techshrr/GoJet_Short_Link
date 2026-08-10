package billing

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/settings"
)

type FXService struct {
	db       *sql.DB
	settings *settings.Store
	client   *http.Client
}

type FXSnapshot struct {
	SourceAmount   int64
	SourceCurrency string
	Amount         int64
	Currency       string
	Rate           string
	Provider       string
	MarkupBPS      int
	QuotedAt       time.Time
}

var currencyCode = regexp.MustCompile(`^[A-Z]{3}$`)

var twoDecimalCurrency = map[string]bool{
	"AUD":true,"BGN":true,"BRL":true,"CAD":true,"CHF":true,"CNY":true,"CZK":true,"DKK":true,"EUR":true,"GBP":true,
	"HKD":true,"HUF":true,"IDR":true,"ILS":true,"INR":true,"MXN":true,"MYR":true,"NOK":true,"NZD":true,"PHP":true,
	"PLN":true,"RON":true,"SEK":true,"SGD":true,"THB":true,"TRY":true,"USD":true,"ZAR":true,
}

func NewFXService(db *sql.DB, store *settings.Store) *FXService {
	return &FXService{db:db,settings:store,client:&http.Client{Timeout:10*time.Second}}
}

func (f *FXService) setting(ctx context.Context, key, fallback string) string {
	if f == nil || f.settings == nil { return fallback }
	value,exists,err:=f.settings.Get(ctx,key)
	if err!=nil || !exists || strings.TrimSpace(value)=="" { return fallback }
	var decoded string
	if json.Unmarshal([]byte(value),&decoded)==nil { return strings.TrimSpace(decoded) }
	return strings.TrimSpace(value)
}

func (f *FXService) settingInt(ctx context.Context,key string,fallback,min,max int) int {
	value:=f.setting(ctx,key,"")
	parsed,err:=strconv.Atoi(strings.Trim(value,`"`))
	if err!=nil || parsed<min || parsed>max { return fallback }
	return parsed
}

func (f *FXService) QuoteSettlement(ctx context.Context, sourceCurrency string, sourceAmount int64) (FXSnapshot,error) {
	source:=strings.ToUpper(strings.TrimSpace(sourceCurrency))
	if sourceAmount<0 || !currencyCode.MatchString(source) || !twoDecimalCurrency[source] {
		return FXSnapshot{},errors.New("套餐计价币种暂不支持自动结算换算")
	}
	target:=strings.ToUpper(strings.TrimSpace(f.setting(ctx,"billing.settlement_currency","")))
	if target=="" || target=="PLAN" { target=source }
	if !currencyCode.MatchString(target) || !twoDecimalCurrency[target] {
		return FXSnapshot{},errors.New("结算币种暂不支持自动换算")
	}
	now:=time.Now().UTC()
	if source==target {
		return FXSnapshot{SourceAmount:sourceAmount,SourceCurrency:source,Amount:sourceAmount,Currency:target,Rate:"1.000000000000",Provider:"identity",QuotedAt:now},nil
	}
	provider:=strings.ToLower(f.setting(ctx,"billing.fx.provider","ecb"))
	markup:=f.settingInt(ctx,"billing.fx.markup_bps",0,-1000,5000)
	rawRate,observed,err:=f.referenceRate(ctx,provider,source,target)
	if err!=nil { return FXSnapshot{},err }
	factor:=big.NewRat(int64(10000+markup),10000)
	finalRate:=new(big.Rat).Mul(rawRate,factor)
	amount,err:=roundRatToInt(new(big.Rat).Mul(big.NewRat(sourceAmount,1),finalRate))
	if err!=nil || amount<0 { return FXSnapshot{},errors.New("结算金额换算失败") }
	return FXSnapshot{SourceAmount:sourceAmount,SourceCurrency:source,Amount:amount,Currency:target,Rate:finalRate.FloatString(12),Provider:provider,MarkupBPS:markup,QuotedAt:observed},nil
}

func roundRatToInt(value *big.Rat) (int64,error) {
	if value==nil || value.Sign()<0 { return 0,errors.New("金额无效") }
	n:=new(big.Int).Set(value.Num());d:=new(big.Int).Set(value.Denom())
	q:=new(big.Int);r:=new(big.Int);q.QuoRem(n,d,r)
	twice:=new(big.Int).Lsh(r,1)
	if twice.Cmp(d)>=0 { q.Add(q,big.NewInt(1)) }
	if !q.IsInt64() { return 0,errors.New("金额超出支持范围") }
	return q.Int64(),nil
}

func (f *FXService) referenceRate(ctx context.Context, provider, source, target string) (*big.Rat,time.Time,error) {
	if cached,observed,ok:=f.cachedRate(ctx,source,target,provider);ok { return cached,observed,nil }
	var rate *big.Rat;var observed time.Time;var err error
	switch provider {
	case "manual":
		rate,err=f.manualRate(ctx,source,target);observed=time.Now().UTC()
	case "ecb":
		rate,observed,err=f.ecbCrossRate(ctx,source,target)
	default:
		return nil,time.Time{},errors.New("汇率来源配置无效")
	}
	if err!=nil { return nil,time.Time{},err }
	if rate==nil || rate.Sign()<=0 { return nil,time.Time{},errors.New("汇率结果无效") }
	if err=f.storeRate(ctx,source,target,provider,rate,observed);err!=nil { return nil,time.Time{},err }
	return rate,observed,nil
}

func (f *FXService) cachedRate(ctx context.Context,source,target,provider string)(*big.Rat,time.Time,bool){
	var rateText string;var observed time.Time
	err:=f.db.QueryRowContext(ctx,`SELECT CAST(rate AS CHAR),observed_at FROM fx_rate_cache WHERE base_currency=? AND quote_currency=? AND provider=? AND expires_at>UTC_TIMESTAMP()`,source,target,provider).Scan(&rateText,&observed)
	if err!=nil{return nil,time.Time{},false};rate,ok:=new(big.Rat).SetString(rateText);return rate,observed,ok
}

func (f *FXService) storeRate(ctx context.Context,source,target,provider string,rate *big.Rat,observed time.Time) error {
	hours:=f.settingInt(ctx,"billing.fx.cache_hours",24,1,168)
	_,err:=f.db.ExecContext(ctx,`INSERT INTO fx_rate_cache(base_currency,quote_currency,provider,rate,observed_at,expires_at) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE rate=VALUES(rate),observed_at=VALUES(observed_at),expires_at=VALUES(expires_at)`,source,target,provider,rate.FloatString(12),observed, time.Now().UTC().Add(time.Duration(hours)*time.Hour))
	return err
}

func (f *FXService) manualRate(ctx context.Context,source,target string)(*big.Rat,error){
	raw:=f.setting(ctx,"billing.fx.manual_rates","{}")
	var rates map[string]string
	if json.Unmarshal([]byte(raw),&rates)!=nil { return nil,errors.New("手动汇率配置格式无效") }
	pair:=source+"/"+target
	if text:=strings.TrimSpace(rates[pair]);text!="" { if rate,ok:=new(big.Rat).SetString(text);ok && rate.Sign()>0{return rate,nil} }
	reverse:=target+"/"+source
	if text:=strings.TrimSpace(rates[reverse]);text!="" { if rate,ok:=new(big.Rat).SetString(text);ok && rate.Sign()>0{return new(big.Rat).Inv(rate),nil} }
	return nil,fmt.Errorf("未配置 %s 到 %s 的手动汇率",source,target)
}

func (f *FXService) ecbCrossRate(ctx context.Context,source,target string)(*big.Rat,time.Time,error){
	sourceRate:=big.NewRat(1,1);targetRate:=big.NewRat(1,1);var sourceTime,targetTime time.Time;var err error
	if source!="EUR"{sourceRate,sourceTime,err=f.ecbRateAgainstEUR(ctx,source);if err!=nil{return nil,time.Time{},err}}
	if target!="EUR"{targetRate,targetTime,err=f.ecbRateAgainstEUR(ctx,target);if err!=nil{return nil,time.Time{},err}}
	observed:=sourceTime;if targetTime.After(observed){observed=targetTime};if observed.IsZero(){observed=time.Now().UTC()}
	return new(big.Rat).Quo(targetRate,sourceRate),observed,nil
}

func (f *FXService) ecbRateAgainstEUR(ctx context.Context,currency string)(*big.Rat,time.Time,error){
	if !currencyCode.MatchString(currency){return nil,time.Time{},errors.New("汇率币种无效")}
	endpoint:="https://data-api.ecb.europa.eu/service/data/EXR/D."+currency+".EUR.SP00.A?lastNObservations=1&format=csvdata"
	req,err:=http.NewRequestWithContext(ctx,http.MethodGet,endpoint,nil);if err!=nil{return nil,time.Time{},err}
	req.Header.Set("Accept","text/csv")
	resp,err:=f.client.Do(req);if err!=nil{return nil,time.Time{},errors.New("暂时无法连接汇率服务")};defer resp.Body.Close()
	if resp.StatusCode<200||resp.StatusCode>=300{return nil,time.Time{},fmt.Errorf("汇率服务暂时不可用 (%d)",resp.StatusCode)}
	reader:=csv.NewReader(io.LimitReader(resp.Body,2<<20));header,err:=reader.Read();if err!=nil{return nil,time.Time{},errors.New("汇率服务返回格式无效")}
	valueIndex,timeIndex:=-1,-1
	for i,name:=range header{switch strings.ToUpper(strings.TrimSpace(name)){case "OBS_VALUE":valueIndex=i;case "TIME_PERIOD":timeIndex=i}}
	if valueIndex<0{return nil,time.Time{},errors.New("汇率服务缺少汇率值")}
	var rate *big.Rat;var observed time.Time
	for{row,readErr:=reader.Read();if readErr==io.EOF{break};if readErr!=nil{return nil,time.Time{},errors.New("汇率服务返回内容无效")};if valueIndex>=len(row){continue};candidate,ok:=new(big.Rat).SetString(strings.TrimSpace(row[valueIndex]));if !ok||candidate.Sign()<=0{continue};rate=candidate;if timeIndex>=0&&timeIndex<len(row){if parsed,e:=time.Parse("2006-01-02",strings.TrimSpace(row[timeIndex]));e==nil{observed=parsed.UTC()}}}
	if rate==nil{return nil,time.Time{},errors.New("汇率服务没有返回可用报价")};if observed.IsZero(){observed=time.Now().UTC()};return rate,observed,nil
}
