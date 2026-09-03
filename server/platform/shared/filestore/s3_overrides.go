package filestore

import (
	"context"
	"net/http"
)

// customTransport is used to point the request to a different server.
// This is helpful in situations where a different service is handling AWS S3 requests
// from multiple Mattermost applications, and the Mattermost service itself does not
// have any S3 credentials.
type customTransport struct {
	host   string
	scheme string
	client http.Client
}

// RoundTrip implements the http.RoundTripper interface. The AWS SDK v2 signs
// the request before it reaches the transport, so — unlike the previous
// minio-go based implementation — no custom credentials provider is needed
// here; the transport only re-routes the signed request to the upstream host.
func (t *customTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Roundtrippers should not modify the original request.
	newReq := req.Clone(context.Background())
	*newReq.URL = *req.URL
	newReq.URL.Scheme = t.scheme
	newReq.URL.Host = t.host
	return t.client.Do(newReq)
}
