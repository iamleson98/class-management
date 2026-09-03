package filestore

import (
	"net/http"
	"time"
)

// S3MetricsObserver is an optional hook installed by the metrics service at
// startup. When non-nil, every S3/RustFS HTTP request made by any S3
// filestore backend is reported to it: operation is the HTTP method
// (GET/PUT/HEAD/DELETE/POST — listing and multipart calls included), code is
// the HTTP status (0 when the request failed before a response arrived) and
// failed marks transport-level failures. The hook is set once at startup and
// only read afterwards, so no locking is needed.
var S3MetricsObserver func(operation string, code int, failed bool, seconds float64)

// metricsTransport wraps an http.RoundTripper and reports each round trip
// to S3MetricsObserver. It is installed by S3FileBackend.httpClient for all
// non-bifrost clients, so metrics cover every S3 API call (objects,
// multipart uploads, listings) without instrumenting each method by hand.
type metricsTransport struct {
	base http.RoundTripper
}

func (t *metricsTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if S3MetricsObserver == nil {
		return t.base.RoundTrip(req)
	}
	start := time.Now()
	resp, err := t.base.RoundTrip(req)
	code := 0
	if resp != nil {
		code = resp.StatusCode
	}
	S3MetricsObserver(req.Method, code, err != nil, time.Since(start).Seconds())
	return resp, err
}
