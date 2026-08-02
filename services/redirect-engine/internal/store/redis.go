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
}

func NewRedis(address, password string, db int) *RedisStore {
	return &RedisStore{address: address, password: password, db: db}
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

const recordScript = `redis.call('INCR',KEYS[1]); redis.call('PFADD',KEYS[2],ARGV[3]); return redis.call('XADD',KEYS[3],'*','link_id',ARGV[1],'destination_id',ARGV[2],'timestamp',ARGV[4],'visitor_hash',ARGV[3],'referer_url',ARGV[5],'referer_host',ARGV[6],'source_type',ARGV[7],'country',ARGV[8],'region',ARGV[9],'city',ARGV[10],'device',ARGV[11],'browser',ARGV[12],'operating_system',ARGV[13],'language',ARGV[14],'utm_source',ARGV[15],'utm_medium',ARGV[16],'utm_campaign',ARGV[17],'utm_content',ARGV[18],'utm_term',ARGV[19],'visit_type',ARGV[20],'is_bot',ARGV[21])`

func (s *RedisStore) RecordVisit(ctx context.Context, v domain.Visit) error {
	args := []string{"EVAL", recordScript, "3", "gojet:clicks:" + v.LinkID, "gojet:visitors:" + v.LinkID, "gojet:analytics:events", v.LinkID, v.DestinationID, v.VisitorHash, v.Timestamp.UTC().Format(time.RFC3339Nano), v.RefererURL, v.RefererHost, v.SourceType, v.Country, v.Region, v.City, v.Device, v.Browser, v.OS, v.Language, v.UTMSource, v.UTMMedium, v.UTMCampaign, v.UTMContent, v.UTMTerm, v.VisitType, strconv.FormatBool(v.IsBot)}
	_, e := s.command(ctx, args...)
	return e
}
func (s *RedisStore) Stats(ctx context.Context, id string) (domain.Stats, error) {
	cv, e := s.command(ctx, "GET", "gojet:clicks:"+id)
	if e != nil {
		return domain.Stats{}, e
	}
	uv, e := s.command(ctx, "PFCOUNT", "gojet:visitors:"+id)
	if e != nil {
		return domain.Stats{}, e
	}
	var c int64
	if cv != nil {
		c, _ = strconv.ParseInt(cv.(string), 10, 64)
	}
	return domain.Stats{Clicks: c, UniqueVisitors: uv.(int64)}, nil
}
func (s *RedisStore) Backlog(ctx context.Context) (int64, error) {
	v, e := s.command(ctx, "XLEN", "gojet:analytics:events")
	if e != nil {
		return 0, e
	}
	return v.(int64), nil
}
