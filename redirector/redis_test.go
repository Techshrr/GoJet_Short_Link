package main

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"testing"
	"time"
)

func TestRedisCacheAvoidsControlPlane(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	payload, _ := json.Marshal(linkPayload{ID: 42, TargetURL: "https://example.com", Status: "active"})
	go func() {
		conn, e := listener.Accept()
		if e != nil {
			return
		}
		defer conn.Close()
		reader := bufio.NewReader(conn)
		for i := 0; i < 5; i++ {
			_, _ = reader.ReadString('\n')
		}
		_, _ = conn.Write([]byte("$" + strconv.Itoa(len(payload)) + "\r\n" + string(payload) + "\r\n"))
	}()
	r := cachedResolver{cache: &redisClient{addr: listener.Addr().String(), timeout: time.Second}, control: controlResolver{base: "http://127.0.0.1:1", client: &http.Client{Timeout: time.Millisecond}}, ttl: time.Minute}
	p, err := r.resolve(context.Background(), "gojet.cc", "abc")
	if err != nil || p.ID != 42 {
		t.Fatalf("payload=%+v err=%v", p, err)
	}
}
