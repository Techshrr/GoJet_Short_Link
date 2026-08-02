package store

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/domain"
)

// RedisStore uses the small stable RESP2 protocol directly, keeping the
// redirect data plane dependency-free and cheap to audit.
type RedisStore struct {
	address, password string
	db                int
	limit             int
}

func NewRedis(address, password string, db, limit int) *RedisStore {
	return &RedisStore{address: address, password: password, db: db, limit: limit}
}

func (s *RedisStore) command(ctx context.Context, args ...string) (any, error) {
	d := net.Dialer{Timeout: 2 * time.Second}
	conn, err := d.DialContext(ctx, "tcp", s.address)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	rw := bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))
	if s.password != "" {
		if err = writeCommand(rw, "AUTH", s.password); err != nil {
			return nil, err
		}
		if _, err = readRESP(rw.Reader); err != nil {
			return nil, err
		}
	}
	if s.db != 0 {
		if err = writeCommand(rw, "SELECT", strconv.Itoa(s.db)); err != nil {
			return nil, err
		}
		if _, err = readRESP(rw.Reader); err != nil {
			return nil, err
		}
	}
	if err = writeCommand(rw, args...); err != nil {
		return nil, err
	}
	return readRESP(rw.Reader)
}
func writeCommand(w *bufio.ReadWriter, args ...string) error {
	if _, e := fmt.Fprintf(w, "*%d\r\n", len(args)); e != nil {
		return e
	}
	for _, a := range args {
		if _, e := fmt.Fprintf(w, "$%d\r\n%s\r\n", len(a), a); e != nil {
			return e
		}
	}
	return w.Flush()
}
func readRESP(r *bufio.Reader) (any, error) {
	line, e := r.ReadString('\n')
	if e != nil {
		return nil, e
	}
	line = strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r")
	if len(line) == 0 {
		return nil, io.ErrUnexpectedEOF
	}
	switch line[0] {
	case '+':
		return line[1:], nil
	case '-':
		return nil, fmt.Errorf("redis: %s", line[1:])
	case ':':
		return strconv.ParseInt(line[1:], 10, 64)
	case '$':
		n, e := strconv.Atoi(line[1:])
		if e != nil || n < 0 {
			return nil, e
		}
		b := make([]byte, n+2)
		_, e = io.ReadFull(r, b)
		return string(b[:n]), e
	default:
		return nil, fmt.Errorf("redis: unsupported response %q", line)
	}
}

func (s *RedisStore) SaveLink(ctx context.Context, l domain.Link) error {
	b, _ := json.Marshal(l)
	_, e := s.command(ctx, "SET", "gojet:link:"+l.Code, string(b))
	return e
}
func (s *RedisStore) FindLink(ctx context.Context, code string) (domain.Link, error) {
	var l domain.Link
	v, e := s.command(ctx, "GET", "gojet:link:"+code)
	if e != nil {
		return l, e
	}
	if v == nil {
		return l, ErrNotFound
	}
	e = json.Unmarshal([]byte(v.(string)), &l)
	return l, e
}

const recordScript = `
local current = tonumber(redis.call('GET',KEYS[1]) or '0')
if (ARGV[24] == 'true' and current >= 1) or (tonumber(ARGV[23]) > 0 and current >= tonumber(ARGV[23])) then return redis.error_reply('LINK_EXHAUSTED') end
local rate = redis.call('INCR', KEYS[4])
if rate == 1 then redis.call('EXPIRE', KEYS[4], 60) end
if rate > tonumber(ARGV[22]) then return redis.error_reply('RATE_LIMITED') end
redis.call('INCR', KEYS[1])
redis.call('INCR', KEYS[5])
if ARGV[21] == 'true' then redis.call('INCR', KEYS[6]) else redis.call('PFADD', KEYS[2], ARGV[3]) end
redis.call('INCR', KEYS[7]); redis.call('INCR', KEYS[8]); redis.call('INCR', KEYS[9])
return redis.call('XADD',KEYS[3],'*','link_id',ARGV[1],'destination_id',ARGV[2],'timestamp',ARGV[4],'visitor_hash',ARGV[3],'referer_url',ARGV[5],'referer_host',ARGV[6],'source_type',ARGV[7],'country',ARGV[8],'region',ARGV[9],'city',ARGV[10],'device',ARGV[11],'browser',ARGV[12],'operating_system',ARGV[13],'language',ARGV[14],'utm_source',ARGV[15],'utm_medium',ARGV[16],'utm_campaign',ARGV[17],'utm_content',ARGV[18],'utm_term',ARGV[19],'visit_type',ARGV[20],'is_bot',ARGV[21])`

func (s *RedisStore) RecordVisit(ctx context.Context, v domain.Visit) error {
	day := v.Timestamp.UTC().Format("2006-01-02")
	args := []string{"EVAL", recordScript, "9", "gojet:clicks:" + v.LinkID, "gojet:visitors:" + v.LinkID, "gojet:analytics:events", "gojet:rate:" + v.LinkID + ":" + v.VisitorHash, "gojet:daily:" + v.LinkID + ":" + day, "gojet:bots:" + v.LinkID, "gojet:source:" + v.LinkID + ":" + v.SourceType, "gojet:device:" + v.LinkID + ":" + v.Device, "gojet:browser:" + v.LinkID + ":" + v.Browser, v.LinkID, v.DestinationID, v.VisitorHash, v.Timestamp.UTC().Format(time.RFC3339Nano), v.RefererURL, v.RefererHost, v.SourceType, v.Country, v.Region, v.City, v.Device, v.Browser, v.OS, v.Language, v.UTMSource, v.UTMMedium, v.UTMCampaign, v.UTMContent, v.UTMTerm, v.VisitType, strconv.FormatBool(v.IsBot), strconv.Itoa(s.limit), strconv.FormatInt(v.MaxClicks, 10), strconv.FormatBool(v.OneTime)}
	_, e := s.command(ctx, args...)
	if e != nil && strings.Contains(e.Error(), "RATE_LIMITED") {
		return ErrRateLimited
	}
	if e != nil && strings.Contains(e.Error(), "LINK_EXHAUSTED") {
		return ErrExhausted
	}
	return e
}
func (s *RedisStore) Stats(ctx context.Context, id string) (domain.Stats, error) {
	get := func(key string) (int64, error) {
		v, e := s.command(ctx, "GET", key)
		if e != nil {
			return 0, e
		}
		if v == nil {
			return 0, nil
		}
		return strconv.ParseInt(v.(string), 10, 64)
	}
	clicks, e := get("gojet:clicks:" + id)
	if e != nil {
		return domain.Stats{}, e
	}
	today, e := get("gojet:daily:" + id + ":" + time.Now().UTC().Format("2006-01-02"))
	if e != nil {
		return domain.Stats{}, e
	}
	bots, e := get("gojet:bots:" + id)
	if e != nil {
		return domain.Stats{}, e
	}
	uv, e := s.command(ctx, "PFCOUNT", "gojet:visitors:"+id)
	if e != nil {
		return domain.Stats{}, e
	}
	readDims := func(prefix string, values []string) (map[string]int64, error) {
		out := map[string]int64{}
		for _, value := range values {
			n, e := get("gojet:" + prefix + ":" + id + ":" + value)
			if e != nil {
				return nil, e
			}
			if n > 0 {
				out[value] = n
			}
		}
		return out, nil
	}
	sources, e := readDims("source", []string{"direct", "referer", "unknown"})
	if e != nil {
		return domain.Stats{}, e
	}
	devices, e := readDims("device", []string{"desktop", "mobile", "tablet"})
	if e != nil {
		return domain.Stats{}, e
	}
	browsers, e := readDims("browser", []string{"chrome", "edge", "firefox", "safari", "other"})
	if e != nil {
		return domain.Stats{}, e
	}
	return domain.Stats{Clicks: clicks, TodayClicks: today, UniqueVisitors: uv.(int64), BotVisits: bots, Sources: sources, Devices: devices, Browsers: browsers}, nil
}
func (s *RedisStore) Backlog(ctx context.Context) (int64, error) {
	v, e := s.command(ctx, "XLEN", "gojet:analytics:events")
	if e != nil {
		return 0, e
	}
	return v.(int64), nil
}
