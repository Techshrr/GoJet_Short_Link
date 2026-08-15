package httpapi

import (
	"encoding/csv"
	"io"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
)

type requestGeographyValue struct {
	Country string
	Region  string
	City    string
}

type countryRange struct {
	Start   netip.Addr
	End     netip.Addr
	Country string
}

type countryDatabase struct {
	IPv4 []countryRange
	IPv6 []countryRange
}

var countryDatabaseCache = struct {
	sync.Mutex
	Items map[string]*countryDatabase
}{Items: map[string]*countryDatabase{}}

func requestGeography(r *http.Request) requestGeographyValue {
	geo := requestGeographyValue{
		Country: normalizeCountry(firstGeoHeader(r,
			"X-GoJet-Country",
			"CF-IPCountry",
			"CloudFront-Viewer-Country",
			"X-Vercel-IP-Country",
			"Fly-Client-Country",
		)),
		Region: cleanGeoText(firstGeoHeader(r,
			"X-GoJet-Region",
			"CloudFront-Viewer-Country-Region",
			"X-Vercel-IP-Country-Region",
		)),
		City: cleanGeoText(firstGeoHeader(r,
			"X-GoJet-City",
			"CloudFront-Viewer-City",
			"X-Vercel-IP-City",
		)),
	}
	if decoded, err := url.QueryUnescape(geo.City); err == nil {
		geo.City = cleanGeoText(decoded)
	}
	if geo.Country != "" {
		return geo
	}
	path := strings.TrimSpace(os.Getenv("GEOIP_COUNTRY_CSV"))
	if path == "" {
		return geo
	}
	database := cachedCountryDatabase(path)
	if database == nil {
		return geo
	}
	if ip, ok := requestGeoIP(r); ok {
		geo.Country = database.Lookup(ip)
	}
	return geo
}

func firstGeoHeader(r *http.Request, names ...string) string {
	for _, name := range names {
		if value := strings.TrimSpace(r.Header.Get(name)); value != "" {
			return value
		}
	}
	return ""
}

func cleanGeoText(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 120 {
		value = value[:120]
	}
	return value
}

func normalizeCountry(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	if value == "XX" || value == "T1" || len(value) != 2 {
		return ""
	}
	for _, char := range value {
		if char < 'A' || char > 'Z' {
			return ""
		}
	}
	return value
}

func requestGeoIP(r *http.Request) (netip.Addr, bool) {
	// RedirectEngine is loopback-bound in production. CDN visitor IP headers
	// therefore cross the local Nginx boundary before reaching this process.
	// Prefer them for local GeoIP fallback, then Nginx-normalized X-Real-IP.
	for _, value := range []string{
		r.Header.Get("CF-Connecting-IP"),
		r.Header.Get("True-Client-IP"),
		r.Header.Get("X-Real-IP"),
		clientIP(r),
	} {
		if ip, err := netip.ParseAddr(strings.TrimSpace(value)); err == nil {
			return ip.Unmap(), true
		}
	}
	return netip.Addr{}, false
}

func cachedCountryDatabase(path string) *countryDatabase {
	countryDatabaseCache.Lock()
	defer countryDatabaseCache.Unlock()
	if database, exists := countryDatabaseCache.Items[path]; exists {
		return database
	}
	database, err := loadCountryDatabase(path)
	if err != nil {
		countryDatabaseCache.Items[path] = nil
		return nil
	}
	countryDatabaseCache.Items[path] = database
	return database
}

func loadCountryDatabase(path string) (*countryDatabase, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1
	database := &countryDatabase{}
	for {
		fields, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return nil, readErr
		}
		if len(fields) < 2 {
			continue
		}
		for index := range fields {
			fields[index] = strings.TrimSpace(fields[index])
		}
		if strings.Contains(fields[0], "/") {
			prefix, parseErr := netip.ParsePrefix(fields[0])
			if parseErr != nil {
				continue
			}
			country := normalizeCountry(fields[1])
			if country == "" {
				continue
			}
			prefix = prefix.Masked()
			start := prefix.Addr().Unmap()
			end := prefixLastAddress(prefix)
			database.add(countryRange{Start: start, End: end, Country: country})
			continue
		}
		if len(fields) < 3 {
			continue
		}
		start, startErr := netip.ParseAddr(fields[0])
		end, endErr := netip.ParseAddr(fields[1])
		country := normalizeCountry(fields[2])
		if startErr != nil || endErr != nil || country == "" {
			continue
		}
		start, end = start.Unmap(), end.Unmap()
		if start.BitLen() != end.BitLen() || start.Compare(end) > 0 {
			continue
		}
		database.add(countryRange{Start: start, End: end, Country: country})
	}
	database.sort()
	return database, nil
}

func prefixLastAddress(prefix netip.Prefix) netip.Addr {
	prefix = prefix.Masked()
	address := prefix.Addr()
	bits := address.BitLen()
	hostBits := bits - prefix.Bits()
	bytes := append([]byte(nil), address.AsSlice()...)
	for bit := 0; bit < hostBits; bit++ {
		position := bits - 1 - bit
		bytes[position/8] |= 1 << uint(7-position%8)
	}
	last, ok := netip.AddrFromSlice(bytes)
	if !ok {
		return address
	}
	return last.Unmap()
}

func (database *countryDatabase) add(value countryRange) {
	if value.Start.Is4() {
		database.IPv4 = append(database.IPv4, value)
		return
	}
	database.IPv6 = append(database.IPv6, value)
}

func (database *countryDatabase) sort() {
	order := func(values []countryRange) {
		sort.Slice(values, func(i, j int) bool { return values[i].Start.Compare(values[j].Start) < 0 })
	}
	order(database.IPv4)
	order(database.IPv6)
}

func (database *countryDatabase) Lookup(address netip.Addr) string {
	address = address.Unmap()
	values := database.IPv6
	if address.Is4() {
		values = database.IPv4
	}
	index := sort.Search(len(values), func(i int) bool { return values[i].Start.Compare(address) > 0 }) - 1
	if index < 0 || values[index].End.Compare(address) < 0 {
		return ""
	}
	return values[index].Country
}
