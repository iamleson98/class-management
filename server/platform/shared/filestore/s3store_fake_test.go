package filestore

// Fake in-memory S3 server used to integration-test the AWS SDK v2 backend
// without external infrastructure (no MinIO/RustFS container needed).
//
// It implements the small S3 API surface the filestore uses — PutObject,
// GetObject (plain + ranged), HeadObject, DeleteObject, CreateBucket,
// HeadBucket, ListObjectsV2 (delimiter + common prefixes) and the multipart
// upload/append endpoints — and deliberately ignores request signatures.

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
)

// fakeS3Server is an in-memory S3-compatible object store.
type fakeS3Server struct {
	mu       sync.Mutex
	objects  map[string][]byte            // "bucket/key" -> content
	buckets  map[string]bool              // bucket -> exists
	mpus     map[string]map[string]string // "bucket/key#uploadId" -> partNumber -> etag
	partData map[string][]byte            // etag -> part bytes (for assembly)
	nextID   int
	srv      *httptest.Server
}

func newFakeS3Server(t *testing.T) *fakeS3Server {
	t.Helper()
	f := &fakeS3Server{
		objects:  map[string][]byte{},
		buckets:  map[string]bool{},
		mpus:     map[string]map[string]string{},
		partData: map[string][]byte{},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", f.handler)
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

// endpoint returns the host:port endpoint for the client configuration.
func (f *fakeS3Server) endpoint() string {
	return strings.TrimPrefix(f.srv.URL, "http://")
}

func (f *fakeS3Server) etag(b []byte) string {
	sum := md5.Sum(b)
	return hex.EncodeToString(sum[:])
}

// bare normalizes an etag by stripping optional quotes.
func bare(etag string) string {
	return strings.Trim(etag, `"`)
}

func (f *fakeS3Server) handler(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	path := strings.TrimPrefix(r.URL.Path, "/")
	var bucket, key string
	if i := strings.Index(path, "/"); i >= 0 {
		bucket, key = path[:i], path[i+1:]
	} else {
		bucket = path
	}

	f.nextID++
	w.Header().Set("x-amz-request-id", fmt.Sprintf("req%d", f.nextID))

	switch {
	// ── Bucket-level operations (no key) ──
	case key == "" && r.Method == http.MethodPut:
		f.buckets[bucket] = true
		w.Header().Set("Location", "/"+bucket)
		w.WriteHeader(http.StatusOK)
	case key == "" && r.Method == http.MethodHead:
		if f.buckets[bucket] {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	case key == "" && r.Method == http.MethodGet:
		// ListObjectsV2 (keys are bucket-relative)
		if !f.buckets[bucket] {
			writeS3Error(w, http.StatusNotFound, "NoSuchBucket")
			return
		}
		prefix := r.URL.Query().Get("prefix")
		delimiter := r.URL.Query().Get("delimiter")
		var contents []listObject
		var commonPrefixes []commonPrefix
		seen := map[string]bool{}
		for fullKey, content := range f.objects {
			if !strings.HasPrefix(fullKey, bucket+"/") {
				continue
			}
			objKey := fullKey[len(bucket)+1:]
			if !strings.HasPrefix(objKey, prefix) {
				continue
			}
			rest := objKey[len(prefix):]
			if delimiter != "" {
				if i := strings.Index(rest, delimiter); i >= 0 {
					// Delimited: emit a common prefix instead of the key.
					cp := prefix + rest[:i+1]
					if !seen[cp] {
						seen[cp] = true
						commonPrefixes = append(commonPrefixes, commonPrefix{Prefix: cp})
					}
					continue
				}
			}
			contents = append(contents, listObject{
				Key:          objKey,
				LastModified: time.Now().UTC().Format(time.RFC3339),
				ETag:         f.etag(content),
				Size:         int64(len(content)),
			})
		}
		writeXML(w, http.StatusOK, listBucketResult{
			Name:           bucket,
			Prefix:         prefix,
			KeyCount:       len(contents) + len(commonPrefixes),
			Contents:       contents,
			CommonPrefixes: commonPrefixes,
		})

	// ── Multipart upload endpoints ──
	case r.URL.Query().Has("uploads"):
		// CreateMultipartUpload (S3 semantics: POST /{bucket}/{key}?uploads)
		uploadID := fmt.Sprintf("mpu-%d", f.nextID)
		f.mpus[bucket+"/"+key+"#"+uploadID] = map[string]string{}
		writeXML(w, http.StatusOK, initiateMultipartUploadResult{
			Bucket:   bucket,
			Key:      key,
			UploadID: uploadID,
		})
	case (r.Method == http.MethodPut || r.Method == http.MethodPost) && r.URL.Query().Has("uploadId"):
		if r.Method == http.MethodPost {
			f.completeMultipart(w, r, bucket, key)
			return
		}
		// UploadPart / UploadPartCopy
		uploadID := r.URL.Query().Get("uploadId")
		partNumber := r.URL.Query().Get("partNumber")
		mpuKey := bucket + "/" + key + "#" + uploadID
		if _, ok := f.mpus[mpuKey]; !ok {
			writeS3Error(w, http.StatusNotFound, "NoSuchUpload")
			return
		}
		var etag string
		if copySource := r.Header.Get("x-amz-copy-source"); copySource != "" {
			// UploadPartCopy: serve the requested range of the source object.
			srcPath := strings.SplitN(strings.TrimPrefix(copySource, "/"), "/", 2)
			var src []byte
			if len(srcPath) == 2 {
				src = f.objects[srcPath[0]+"/"+srcPath[1]]
			}
			start, end := int64(0), int64(len(src))-1
			if cr := r.Header.Get("x-amz-copy-source-range"); cr != "" {
				var s, e int64
				if n, _ := fmt.Sscanf(cr, "bytes=%d-%d", &s, &e); n == 2 {
					start, end = s, e
				}
			}
			if src == nil || start > end || end >= int64(len(src)) {
				writeS3Error(w, http.StatusNotFound, "NoSuchKey")
				return
			}
			part := src[start : end+1]
			etag = f.etag(part)
			f.partData[etag] = part
			f.mpus[mpuKey][partNumber] = etag
			writeXML(w, http.StatusOK, copyPartResult{
				ETag:         `"` + etag + `"`,
				LastModified: time.Now().UTC().Format(time.RFC3339),
			})
			return
		}
		body, _ := io.ReadAll(r.Body)
		etag = f.etag(body)
		f.partData[etag] = body
		f.mpus[mpuKey][partNumber] = etag
		w.Header().Set("ETag", `"`+etag+`"`)
		w.WriteHeader(http.StatusOK)
	case r.Method == http.MethodDelete && r.URL.Query().Has("uploadId"):
		// AbortMultipartUpload
		uploadID := r.URL.Query().Get("uploadId")
		delete(f.mpus, bucket+"/"+key+"#"+uploadID)
		w.WriteHeader(http.StatusNoContent)

	// ── Object-level operations ──
	case r.Method == http.MethodPut:
		if !f.buckets[bucket] {
			writeS3Error(w, http.StatusNotFound, "NoSuchBucket")
			return
		}
		if copySource := r.Header.Get("x-amz-copy-source"); copySource != "" {
			// CopyObject: server-side copy of the source object.
			srcPath := strings.SplitN(strings.TrimPrefix(copySource, "/"), "/", 2)
			src, ok := f.objects[srcPath[0]+"/"+srcPath[1]]
			if len(srcPath) != 2 || !ok {
				writeS3Error(w, http.StatusNotFound, "NoSuchKey")
				return
			}
			f.objects[bucket+"/"+key] = src
			writeXML(w, http.StatusOK, copyObjectResult{
				ETag:         `"` + f.etag(src) + `"`,
				LastModified: time.Now().UTC().Format(time.RFC3339),
			})
			return
		}
		// PutObject
		body, _ := io.ReadAll(r.Body)
		f.objects[bucket+"/"+key] = body
		etag := f.etag(body)
		f.partData[etag] = body
		w.Header().Set("ETag", `"`+etag+`"`)
		w.WriteHeader(http.StatusOK)
	case r.Method == http.MethodGet:
		obj, ok := f.objects[bucket+"/"+key]
		if !ok {
			writeS3Error(w, http.StatusNotFound, "NoSuchKey")
			return
		}
		// Serve ranged GETs (used by s3WithCancel).
		data := obj
		if cr := r.Header.Get("Range"); cr != "" {
			var start int64
			if n, _ := fmt.Sscanf(cr, "bytes=%d-", &start); n == 1 {
				if start >= int64(len(obj)) {
					writeS3Error(w, http.StatusRequestedRangeNotSatisfiable, "InvalidRange")
					return
				}
				data = obj[start:]
			}
		}
		w.Header().Set("ETag", `"`+f.etag(obj)+`"`)
		w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		w.Header().Set("Accept-Ranges", "bytes")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	case r.Method == http.MethodHead:
		obj, ok := f.objects[bucket+"/"+key]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("ETag", `"`+f.etag(obj)+`"`)
		w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
		w.Header().Set("Content-Length", strconv.Itoa(len(obj)))
		w.WriteHeader(http.StatusOK)
	case r.Method == http.MethodDelete:
		delete(f.objects, bucket+"/"+key)
		w.WriteHeader(http.StatusNoContent)
	default:
		writeS3Error(w, http.StatusMethodNotAllowed, "MethodNotAllowed")
	}
}

// completeMultipart assembles the stored parts and finishes the upload.
func (f *fakeS3Server) completeMultipart(w http.ResponseWriter, r *http.Request, bucket, key string) {
	uploadID := r.URL.Query().Get("uploadId")
	mpuKey := bucket + "/" + key + "#" + uploadID
	parts, ok := f.mpus[mpuKey]
	if !ok {
		writeS3Error(w, http.StatusNotFound, "NoSuchUpload")
		return
	}
	var req completeMultipartUpload
	body, _ := io.ReadAll(r.Body)
	if err := xml.Unmarshal(body, &req); err != nil {
		writeS3Error(w, http.StatusBadRequest, "MalformedXML")
		return
	}
	var assembled []byte
	for _, p := range req.Parts {
		etag := bare(p.ETag)
		if parts[strconv.Itoa(p.PartNumber)] != etag {
			writeS3Error(w, http.StatusBadRequest, "InvalidPart")
			return
		}
		assembled = append(assembled, f.partData[etag]...)
	}
	f.objects[bucket+"/"+key] = assembled
	delete(f.mpus, mpuKey)
	writeXML(w, http.StatusOK, completeMultipartUploadResult{
		Location: "/" + bucket + "/" + key,
		ETag:     `"` + f.etag(assembled) + `"`,
	})
}

func writeXML(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(xml.Header))
	_ = xml.NewEncoder(w).Encode(v)
}

func writeS3Error(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(status)
	_ = xml.NewEncoder(w).Encode(s3Error{Code: code})
}

// ── S3 XML wire shapes ──

type s3Error struct {
	XMLName xml.Name `xml:"Error"`
	Code    string   `xml:"Code"`
	Message string   `xml:"Message"`
}

type listObject struct {
	Key          string `xml:"Key"`
	LastModified string `xml:"LastModified"`
	ETag         string `xml:"ETag"`
	Size         int64  `xml:"Size"`
}

type commonPrefix struct {
	Prefix string `xml:"Prefix"`
}

type listBucketResult struct {
	XMLName        xml.Name       `xml:"ListBucketResult"`
	Name           string         `xml:"Name"`
	Prefix         string         `xml:"Prefix"`
	KeyCount       int            `xml:"KeyCount"`
	IsTruncated    bool           `xml:"IsTruncated"`
	Contents       []listObject   `xml:"Contents"`
	CommonPrefixes []commonPrefix `xml:"CommonPrefixes"`
}

type initiateMultipartUploadResult struct {
	XMLName  xml.Name `xml:"InitiateMultipartUploadResult"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	UploadID string   `xml:"UploadId"`
}

type copyPartResult struct {
	XMLName      xml.Name `xml:"CopyPartResult"`
	ETag         string   `xml:"ETag"`
	LastModified string   `xml:"LastModified"`
}

type copyObjectResult struct {
	XMLName      xml.Name `xml:"CopyObjectResult"`
	ETag         string   `xml:"ETag"`
	LastModified string   `xml:"LastModified"`
}

type completePart struct {
	PartNumber int    `xml:"PartNumber"`
	ETag       string `xml:"ETag"`
}

type completeMultipartUpload struct {
	XMLName xml.Name       `xml:"CompleteMultipartUpload"`
	Parts   []completePart `xml:"Part"`
}

type completeMultipartUploadResult struct {
	XMLName  xml.Name `xml:"CompleteMultipartUploadResult"`
	Location string   `xml:"Location"`
	ETag     string   `xml:"ETag"`
}

// ── The actual tests ──

func newFakeBackend(t *testing.T) (*S3FileBackend, *fakeS3Server) {
	t.Helper()
	fake := newFakeS3Server(t)
	backend, err := NewS3FileBackend(FileBackendSettings{
		DriverName:                         model.ImageDriverS3,
		AmazonS3AccessKeyId:                "test-access",
		AmazonS3SecretAccessKey:            "test-secret",
		AmazonS3Bucket:                     "test-bucket",
		AmazonS3Endpoint:                   fake.endpoint(),
		AmazonS3Region:                     "",
		AmazonS3PathPrefix:                 "",
		AmazonS3SSL:                        false,
		SkipVerify:                         false,
		AmazonS3SSE:                        false,
		AmazonS3RequestTimeoutMilliseconds: 5000,
	})
	require.NoError(t, err)
	return backend, fake
}

func TestS3BackendAgainstFakeServer(t *testing.T) {
	backend, _ := newFakeBackend(t)

	t.Run("bucket lifecycle", func(t *testing.T) {
		require.NoError(t, backend.MakeBucket())
		require.NoError(t, backend.TestConnection())
	})

	t.Run("write and read", func(t *testing.T) {
		content := []byte("hello fake s3")
		n, err := backend.WriteFile(bytes.NewReader(content), "dir/hello.txt")
		require.NoError(t, err)
		require.Equal(t, int64(len(content)), n)

		got, err := backend.ReadFile("dir/hello.txt")
		require.NoError(t, err)
		require.Equal(t, content, got)
	})

	t.Run("exists, size, modtime", func(t *testing.T) {
		exists, err := backend.FileExists("dir/hello.txt")
		require.NoError(t, err)
		require.True(t, exists)

		exists, err = backend.FileExists("dir/missing.txt")
		require.NoError(t, err)
		require.False(t, exists)

		size, err := backend.FileSize("dir/hello.txt")
		require.NoError(t, err)
		require.Equal(t, int64(len("hello fake s3")), size)

		_, err = backend.FileModTime("dir/hello.txt")
		require.NoError(t, err)
	})

	t.Run("copy and move", func(t *testing.T) {
		require.NoError(t, backend.CopyFile("dir/hello.txt", "dir/hello-copy.txt"))
		got, err := backend.ReadFile("dir/hello-copy.txt")
		require.NoError(t, err)
		require.Equal(t, []byte("hello fake s3"), got)

		require.NoError(t, backend.MoveFile("dir/hello-copy.txt", "dir/hello-moved.txt"))
		exists, err := backend.FileExists("dir/hello-copy.txt")
		require.NoError(t, err)
		require.False(t, exists)
		exists, err = backend.FileExists("dir/hello-moved.txt")
		require.NoError(t, err)
		require.True(t, exists)
	})

	t.Run("reader", func(t *testing.T) {
		r, err := backend.Reader("dir/hello.txt")
		require.NoError(t, err)
		defer r.Close()
		got, err := io.ReadAll(r)
		require.NoError(t, err)
		require.Equal(t, []byte("hello fake s3"), got)
		// Seek back to start and read again (ranged re-open path).
		_, err = r.Seek(0, io.SeekStart)
		require.NoError(t, err)
		got, err = io.ReadAll(r)
		require.NoError(t, err)
		require.Equal(t, []byte("hello fake s3"), got)
	})

	t.Run("list directory", func(t *testing.T) {
		paths, err := backend.ListDirectory("dir")
		require.NoError(t, err)
		// Keys are returned relative to the (empty) path prefix.
		assert.Contains(t, paths, "dir/hello.txt")
		assert.Contains(t, paths, "dir/hello-moved.txt")
	})

	t.Run("append to existing object", func(t *testing.T) {
		// Small objects take the buffered-rewrite path.
		n, err := backend.AppendFile(strings.NewReader(" + appended"), "dir/hello.txt")
		require.NoError(t, err)
		require.Equal(t, int64(len(" + appended")), n)

		got, err := backend.ReadFile("dir/hello.txt")
		require.NoError(t, err)
		require.Equal(t, []byte("hello fake s3 + appended"), got)
	})

	t.Run("append via multipart UploadPartCopy", func(t *testing.T) {
		// Objects >= 5MB take the server-side concatenation path.
		big := bytes.Repeat([]byte("x"), 6*1024*1024)
		n, err := backend.WriteFile(bytes.NewReader(big), "dir/big.bin")
		require.NoError(t, err)
		require.Equal(t, int64(len(big)), n)

		extra := []byte(" + tail")
		n, err = backend.AppendFile(bytes.NewReader(extra), "dir/big.bin")
		require.NoError(t, err)
		require.Equal(t, int64(len(extra)), n)

		got, err := backend.ReadFile("dir/big.bin")
		require.NoError(t, err)
		require.Len(t, got, len(big)+len(extra))
		require.Equal(t, big, got[:len(big)])
		require.Equal(t, extra, got[len(big):])
	})

	t.Run("remove file", func(t *testing.T) {
		require.NoError(t, backend.RemoveFile("dir/hello-moved.txt"))
		exists, err := backend.FileExists("dir/hello-moved.txt")
		require.NoError(t, err)
		require.False(t, exists)
	})

	t.Run("remove directory", func(t *testing.T) {
		require.NoError(t, backend.RemoveDirectory("dir"))
		exists, err := backend.FileExists("dir/hello.txt")
		require.NoError(t, err)
		require.False(t, exists)
	})
}

// TestS3BackendListDirectoryPathError replicates the historical
// TestListDirectory assertion: listing a "directory" whose only entry is a
// common prefix equal to the listed path yields fs.ErrNotExist.
func TestS3BackendListDirectoryPathError(t *testing.T) {
	backend, _ := newFakeBackend(t)
	require.NoError(t, backend.MakeBucket())

	// Mirrors the legacy test setup: a path prefix that nests once more.
	backend.pathPrefix = "19700101/"
	_, err := backend.WriteFile(bytes.NewReader([]byte("x")), "19700101/abc.txt")
	require.NoError(t, err)

	_, err = backend.ListDirectory("")
	var pErr *fs.PathError
	assert.True(t, errors.As(err, &pErr), "error is not of type fs.PathError, got: %v", err)
}

// TestS3ReaderSeekEndProbing reproduces the production file-serving failure:
// http.ServeContent sizes its content by calling Seek(0, io.SeekEnd) followed
// by Seek(0, io.SeekStart) before streaming. The ranged GET a naive
// implementation issues for the EOF position is rejected by S3-compatible
// stores (416 InvalidRange — even offset == size is out of range, the last
// valid byte is size-1), which used to surface as "seeker can't seek" 500s
// for every GET /api/v4/files/{id}. Seeking to EOF must succeed and reads
// from there must return io.EOF.
func TestS3ReaderSeekEndProbing(t *testing.T) {
	backend, _ := newFakeBackend(t)
	require.NoError(t, backend.MakeBucket())

	content := []byte("probe me")
	_, err := backend.WriteFile(bytes.NewReader(content), "dir/probe.txt")
	require.NoError(t, err)

	r, err := backend.Reader("dir/probe.txt")
	require.NoError(t, err)
	defer r.Close()

	// ServeContent's seekSize sequence.
	size, err := r.Seek(0, io.SeekEnd)
	require.NoError(t, err)
	require.Equal(t, int64(len(content)), size)

	// Reading at EOF returns io.EOF (not an error).
	n, err := r.Read(make([]byte, 8))
	require.Equal(t, 0, n)
	require.Equal(t, io.EOF, err)

	// Restore to start and stream the full body.
	off, err := r.Seek(0, io.SeekStart)
	require.NoError(t, err)
	require.Equal(t, int64(0), off)
	got, err := io.ReadAll(r)
	require.NoError(t, err)
	require.Equal(t, content, got)
}

// TestS3ReaderServeContent runs the real net/http.ServeContent (the exact
// helper WriteFileResponse delegates to) over an S3FileBackend reader — the
// end-to-end guarantee that file GETs no longer fail with "seeker can't seek".
func TestS3ReaderServeContent(t *testing.T) {
	backend, _ := newFakeBackend(t)
	require.NoError(t, backend.MakeBucket())

	content := []byte("serve me via ServeContent")
	_, err := backend.WriteFile(bytes.NewReader(content), "dir/serve.txt")
	require.NoError(t, err)

	r, err := backend.Reader("dir/serve.txt")
	require.NoError(t, err)
	defer r.Close()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v4/files/xxx", nil)
	http.ServeContent(rec, req, "serve.txt", time.Now(), r)
	require.Equal(t, http.StatusOK, rec.Code, "body: %q", rec.Body.String())
	require.Equal(t, content, rec.Body.Bytes())
}
