package filestore

// S3-compatible object-storage backend built on the AWS SDK for Go v2.
//
// The backend talks plain S3 protocol, so it works against any S3-compatible
// endpoint. In this project the storage engine is RustFS (S3-compatible
// object storage, Apache-2.0) — see the docker-compose / Swarm stack files,
// where the `rustfs` service provides the S3 API the settings below point at.
//
// This file previously used the MinIO Go SDK (minio-go); it was migrated to
// the AWS SDK v2 so the codebase carries no MinIO dependencies at all.
// Notable behaviors preserved from the previous S3 client:
//   - path-style addressing for non-AWS endpoints (virtual-host for AWS),
//   - uploads of unknown length (buffered multipart, 5MB minimum parts),
//   - SSE-S3 (AES256) encryption when FileSettings.AmazonS3SSE is enabled,
//   - server-side append via multipart UploadPartCopy,
//   - seekable readers backed by ranged GETs,
//   - read timeouts driven by contexts and a per-reader timer.

import (
        "archive/zip"
        "context"
        "crypto/tls"
        "fmt"
        "io"
        "io/fs"
        "mime"
        "net/http"
        "net/url"
        "os"
        "path/filepath"
        "strings"
        "time"

        "github.com/aws/aws-sdk-go-v2/aws"
        awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
        awsconfig "github.com/aws/aws-sdk-go-v2/config"
        "github.com/aws/aws-sdk-go-v2/credentials"
        "github.com/aws/aws-sdk-go-v2/feature/s3/manager"
        "github.com/aws/aws-sdk-go-v2/service/s3"
        "github.com/aws/aws-sdk-go-v2/service/s3/types"
        "github.com/aws/smithy-go"
        "github.com/aws/smithy-go/logging"
        "github.com/pkg/errors"

        "github.com/iamleson98/sitename/server/public/shared/mlog"
)

// S3FileBackend contains all necessary information to communicate with
// an AWS S3 compatible API backend.
type S3FileBackend struct {
        endpoint       string
        accessKey      string
        secretKey      string
        secure         bool
        signV2         bool
        region         string
        bucket         string
        pathPrefix     string
        encrypt        bool
        trace          bool
        client         *s3.Client
        uploader       *manager.Uploader
        presignClient  *s3.PresignClient
        skipVerify     bool
        timeout        time.Duration
        presignExpires time.Duration
        isCloud        bool // field to indicate whether this is running under Mattermost cloud or not.
        uploadPartSize int64
        storageClass   string
}

type S3FileBackendAuthError struct {
        DetailedError string
}

// S3FileBackendNoBucketError is returned when testing a connection and no S3 bucket is found
type S3FileBackendNoBucketError struct{}

var (
        // Ensure that the ReaderAt interface is implemented.
        _ io.ReaderAt                  = (*s3WithCancel)(nil)
        _ FileBackendWithLinkGenerator = (*S3FileBackend)(nil)
)

func getContentType(ext string) string {
        mimeType := mime.TypeByExtension(strings.ToLower(ext))
        if mimeType == "" {
                mimeType = "application/octet-stream"
        }
        return mimeType
}

func (s *S3FileBackendAuthError) Error() string {
        return s.DetailedError
}

func (s *S3FileBackendNoBucketError) Error() string {
        return "no such bucket"
}

// NewS3FileBackend returns an instance of an S3FileBackend and determine if we are in Mattermost cloud or not.
func NewS3FileBackend(settings FileBackendSettings) (*S3FileBackend, error) {
        return newS3FileBackend(settings, os.Getenv("MM_CLOUD_FILESTORE_BIFROST") != "")
}

// NewS3FileBackendWithoutBifrost returns an instance of an S3FileBackend that will not use bifrost.
func NewS3FileBackendWithoutBifrost(settings FileBackendSettings) (*S3FileBackend, error) {
        return newS3FileBackend(settings, false)
}

func newS3FileBackend(settings FileBackendSettings, isCloud bool) (*S3FileBackend, error) {
        timeout := time.Duration(settings.AmazonS3RequestTimeoutMilliseconds) * time.Millisecond
        backend := &S3FileBackend{
                endpoint:       settings.AmazonS3Endpoint,
                accessKey:      settings.AmazonS3AccessKeyId,
                secretKey:      settings.AmazonS3SecretAccessKey,
                secure:         settings.AmazonS3SSL,
                signV2:         settings.AmazonS3SignV2,
                region:         settings.AmazonS3Region,
                bucket:         settings.AmazonS3Bucket,
                pathPrefix:     settings.AmazonS3PathPrefix,
                encrypt:        settings.AmazonS3SSE,
                trace:          settings.AmazonS3Trace,
                client:         nil,
                skipVerify:     settings.SkipVerify,
                timeout:        timeout,
                presignExpires: time.Duration(settings.AmazonS3PresignExpiresSeconds) * time.Second,
                uploadPartSize: settings.AmazonS3UploadPartSizeBytes,
                storageClass:   settings.AmazonS3StorageClass,
        }
        cli, err := backend.s3New(isCloud)
        if err != nil {
                return nil, err
        }
        backend.client = cli
        backend.uploader = manager.NewUploader(cli, func(u *manager.Uploader) {
                // S3 (and S3-compatible stores such as RustFS) require multipart
                // parts of at least 5MB; smaller configured values fall back to the
                // SDK default (also 5MB).
                if backend.uploadPartSize >= manager.MinUploadPartSize {
                        u.PartSize = backend.uploadPartSize
                }
        })
        backend.presignClient = s3.NewPresignClient(cli)
        backend.isCloud = isCloud
        return backend, nil
}

// s3Trace implements smithy-go's logging.Logger, forwarding AWS SDK
// request/response logs to the Mattermost debug log.
type s3Trace struct{}

func (*s3Trace) Logf(_ logging.Classification, format string, v ...any) {
        mlog.Debug(fmt.Sprintf(format, v...))
}

// s3New builds the S3 API client. It supports static credentials, the
// environment/default credential chain (which includes EC2 instance
// metadata), and anonymous credentials for the bifrost (cloud) transport.
func (b *S3FileBackend) s3New(isCloud bool) (*s3.Client, error) {
        region := b.region
        if region == "" {
                // SigV4 always requires a region; us-east-1 is the S3 universal
                // default and is accepted by S3-compatible stores such as RustFS.
                region = "us-east-1"
        }

        var credOpts []func(*awsconfig.LoadOptions) error
        switch {
        case isCloud:
                // Bifrost routes requests through a custom transport and does not
                // authenticate with S3 credentials.
                credOpts = append(credOpts, awsconfig.WithCredentialsProvider(aws.AnonymousCredentials{}))
        case b.accessKey == "" && b.secretKey == "":
                // No credentials configured: fall back to the default chain
                // (env vars, shared config, EC2 IMDS).
        default:
                credOpts = append(credOpts, awsconfig.WithCredentialsProvider(
                        credentials.NewStaticCredentialsProvider(b.accessKey, b.secretKey, ""),
                ))
        }

        opts := []func(*awsconfig.LoadOptions) error{
                awsconfig.WithRegion(region),
                awsconfig.WithHTTPClient(b.httpClient(isCloud)),
        }
        opts = append(opts, credOpts...)

        if b.trace {
                opts = append(opts, awsconfig.WithClientLogMode(
                        aws.LogRequestWithBody|aws.LogResponseWithBody,
                ), awsconfig.WithLogger(&s3Trace{}))
        }

        cfg, err := awsconfig.LoadDefaultConfig(context.Background(), opts...)
        if err != nil {
                return nil, err
        }

        return s3.NewFromConfig(cfg, func(o *s3.Options) {
                if isCloud {
                        // Bifrost: requests keep AWS-shaped URLs and are re-routed (and
                        // signed upstream) by the custom transport.
                        return
                }
                if baseURL := resolveEndpoint(b.endpoint, b.secure); baseURL != "" {
                        // Custom endpoint (RustFS and other private S3 gateways):
                        // use the endpoint with path-style addressing, matching the
                        // behavior of the previous S3 client.
                        o.BaseEndpoint = aws.String(baseURL)
                        o.UsePathStyle = true
                }
                // Plain AWS: let the SDK resolve regional endpoints (virtual-host
                // style). Third-party S3-compatible stores have varying checksum
                // support, so only calculate/validate checksums when the operation
                // requires it — this keeps wire behavior identical to the previous
                // client for both AWS and RustFS.
                o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
                o.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
        }), nil
}

// httpClient builds the HTTP client used by the S3 client, honoring the
// skipVerify setting and requiring TLS 1.2 or better.
func (b *S3FileBackend) httpClient(isCloud bool) *http.Client {
        var transport http.RoundTripper
        if isCloud {
                scheme := "http"
                if b.secure {
                        scheme = "https"
                }
                base := http.DefaultTransport.(*http.Transport).Clone()
                base.TLSClientConfig = &tls.Config{InsecureSkipVerify: b.skipVerify}
                transport = &customTransport{
                        host:   b.endpoint,
                        scheme: scheme,
                        client: http.Client{Transport: base},
                }
        } else {
                tr := http.DefaultTransport.(*http.Transport).Clone()
                if tr.TLSClientConfig == nil {
                        tr.TLSClientConfig = &tls.Config{}
                }
                if b.skipVerify {
                        tr.TLSClientConfig.InsecureSkipVerify = true
                }
                tr.TLSClientConfig.MinVersion = tls.VersionTLS12
                // Report every S3/RustFS round trip to the metrics observer
                // (installed by the metrics service; no-op when metrics are
                // disabled).
                transport = &metricsTransport{base: tr}
        }
        return &http.Client{Transport: transport}
}

// resolveEndpoint converts the configured endpoint into a base URL.
// An empty endpoint (or the legacy global AWS endpoint) yields "" so the
// SDK resolves AWS regional endpoints itself; everything else is treated as
// a custom S3-compatible endpoint (scheme inferred from the secure flag when
// the endpoint carries none).
func resolveEndpoint(endpoint string, secure bool) string {
        e := strings.TrimSpace(endpoint)
        if e == "" || strings.EqualFold(e, "s3.amazonaws.com") {
                return ""
        }
        if i := strings.Index(e, "://"); i >= 0 {
                return e[:i] + "://" + strings.TrimSuffix(e[i+3:], "/")
        }
        scheme := "http"
        if secure {
                scheme = "https"
        }
        return scheme + "://" + strings.TrimSuffix(e, "/")
}

// encodePath encodes an object key for use in an URL path, keeping "/" as a
// separator. It is equivalent to the path-encoding helper previously
// provided by the S3 SDK.
func encodePath(path string) string {
        segments := strings.Split(path, "/")
        for i, seg := range segments {
                segments[i] = url.PathEscape(seg)
        }
        return strings.Join(segments, "/")
}

// encodeCopySource builds the URL-encoded CopySource value ("bucket/key")
// expected by the S3 CopyObject / UploadPartCopy APIs.
func encodeCopySource(bucket, key string) string {
        return bucket + "/" + encodePath(key)
}

// s3ErrorCode returns the S3 error code (e.g. NoSuchBucket, NoSuchKey) and
// whether the error carries an HTTP status (with that status).
func s3ErrorCode(err error) (string, bool) {
        var apiErr smithy.APIError
        if errors.As(err, &apiErr) {
                return apiErr.ErrorCode(), true
        }
        var respErr *awshttp.ResponseError
        if errors.As(err, &respErr) {
                return fmt.Sprintf("HTTP %d", respErr.HTTPStatusCode()), true
        }
        return "", false
}

// isBucketMissingError reports whether err indicates a missing or invalid
// bucket.
func isBucketMissingError(err error) bool {
        code, ok := s3ErrorCode(err)
        if !ok {
                return false
        }
        switch code {
        case "NoSuchBucket", "InvalidBucketName", "NotFound", "HTTP 404":
                return true
        }
        return false
}

// isKeyMissingError reports whether err indicates a missing object.
func isKeyMissingError(err error) bool {
        code, ok := s3ErrorCode(err)
        if !ok {
                return false
        }
        switch code {
        case "NoSuchKey", "NotFound", "HTTP 404":
                return true
        }
        return false
}

func (b *S3FileBackend) DriverName() string {
        return driverS3
}

func (b *S3FileBackend) TestConnection() error {
        exists := true
        var err error
        // If a path prefix is present, we attempt to test the bucket by listing objects under the path
        // and just checking the first response. This is because the HeadBucket call is only at a bucket level
        // and sometimes the user might only be allowed access to the specified path prefix.
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        if b.pathPrefix != "" {
                paginator := s3.NewListObjectsV2Paginator(b.client, &s3.ListObjectsV2Input{
                        Bucket: aws.String(b.bucket),
                        Prefix: aws.String(b.pathPrefix),
                })
                // A paginator without pages means the request failed immediately
                // (e.g. auth error); surface it via the code below by forcing a
                // page fetch.
                if _, err = paginator.NextPage(ctx); err != nil {
                        if !isBucketMissingError(err) {
                                return &S3FileBackendAuthError{DetailedError: fmt.Sprintf("unable to list objects in the S3 bucket: %v", err)}
                        }
                        exists = false
                }
        } else {
                _, err = b.client.HeadBucket(ctx, &s3.HeadBucketInput{
                        Bucket: aws.String(b.bucket),
                })
                if err != nil {
                        if !isBucketMissingError(err) {
                                return &S3FileBackendAuthError{DetailedError: fmt.Sprintf("unable to check if the S3 bucket exists: %v", err)}
                        }
                        exists = false
                }
        }

        if !exists {
                return &S3FileBackendNoBucketError{}
        }
        mlog.Debug("Connection to S3 or RustFS is good. Bucket exists.")
        return nil
}

func (b *S3FileBackend) MakeBucket() error {
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        input := &s3.CreateBucketInput{
                Bucket: aws.String(b.bucket),
        }
        // us-east-1 (and empty) must not send a location constraint.
        if b.region != "" && b.region != "us-east-1" {
                input.CreateBucketConfiguration = &types.CreateBucketConfiguration{
                        LocationConstraint: types.BucketLocationConstraint(b.region),
                }
        }
        _, err := b.client.CreateBucket(ctx, input)
        if err != nil {
                return errors.Wrap(err, "unable to create the s3 bucket")
        }
        return nil
}

// s3WithCancel is a seekable object reader which cancels its context when
// the object is closed. Seeks are implemented by re-issuing ranged GETs.
type s3WithCancel struct {
        backend *S3FileBackend
        path    string
        body    io.ReadCloser
        offset  int64
        timer   *time.Timer
        cancel  context.CancelFunc
}

// startTimer arms (or re-arms) the read timeout that cancels the context
// and aborts the underlying request.
func (sc *s3WithCancel) startTimer() {
        if sc.backend.timeout > 0 {
                sc.timer.Reset(sc.backend.timeout)
        }
}

func (sc *s3WithCancel) Close() error {
        sc.timer.Stop()
        sc.cancel()
        if sc.body != nil {
                err := sc.body.Close()
                sc.body = nil
                return err
        }
        return nil
}

// CancelTimeout attempts to cancel the timeout for this reader. It allows calling
// code to ignore the timeout in case of longer running operations. The methods returns
// false if the timeout has already fired.
func (sc *s3WithCancel) CancelTimeout() bool {
        return sc.timer.Stop()
}

func (sc *s3WithCancel) Read(p []byte) (int, error) {
        if sc.body == nil {
                return 0, io.EOF
        }
        n, err := sc.body.Read(p)
        sc.offset += int64(n)
        return n, err
}

// Seek repositions the reader. Seeking elsewhere than the current position
// transparently re-opens a ranged GET; seeking to the end stats the object.
func (sc *s3WithCancel) Seek(offset int64, whence int) (int64, error) {
        switch whence {
        case io.SeekStart:
        case io.SeekCurrent:
                offset += sc.offset
        case io.SeekEnd:
                size, err := sc.backend.objectSize(sc.path)
                if err != nil {
                        return 0, errors.Wrapf(err, "unable to seek to end of %s", sc.path)
                }
                offset += size
        default:
                return 0, fmt.Errorf("invalid whence %d", whence)
        }
        if offset < 0 {
                return 0, fmt.Errorf("negative seek offset %d", offset)
        }
        if offset == sc.offset && sc.body != nil {
                return sc.offset, nil
        }
        if err := sc.reopen(offset); err != nil {
                return 0, errors.Wrapf(err, "unable to seek to offset %d of %s", offset, sc.path)
        }
        return sc.offset, nil
}

// ReadAt reads len(p) bytes starting at off without disturbing the current
// read position. It is implemented with an independent ranged GET.
func (sc *s3WithCancel) ReadAt(p []byte, off int64) (int, error) {
        if len(p) == 0 {
                return 0, nil
        }
        ctx, cancel := context.WithCancel(context.Background())
        defer cancel()
        if sc.backend.timeout > 0 {
                timer := time.AfterFunc(sc.backend.timeout, cancel)
                defer timer.Stop()
        }

        out, err := sc.backend.client.GetObject(ctx, &s3.GetObjectInput{
                Bucket: aws.String(sc.backend.bucket),
                Key:    aws.String(sc.path),
                Range:  aws.String(fmt.Sprintf("bytes=%d-%d", off, off+int64(len(p))-1)),
        })
        if err != nil {
                return 0, err
        }
        defer out.Body.Close()
        n, err := io.ReadFull(out.Body, p)
        if err == io.EOF || err == io.ErrUnexpectedEOF {
                err = io.EOF
        }
        return n, err
}

// reopen replaces the current body with a fresh ranged GET at offset.
func (sc *s3WithCancel) reopen(offset int64) error {
        if sc.body != nil {
                sc.body.Close()
                sc.body = nil
        }
        ctx, cancel := context.WithCancel(context.Background())
        out, err := sc.backend.client.GetObject(ctx, &s3.GetObjectInput{
                Bucket: aws.String(sc.backend.bucket),
                Key:    aws.String(sc.path),
                Range:  aws.String(fmt.Sprintf("bytes=%d-", offset)),
        })
        if err != nil {
                cancel()
                return err
        }
        sc.cancel()
        sc.body = out.Body
        sc.offset = offset
        sc.cancel = cancel
        sc.timer.Stop()
        sc.startTimer()
        return nil
}

// openReader opens a seekable reader for path (already prefixed).
func (b *S3FileBackend) openReader(path string) (*s3WithCancel, error) {
        ctx, cancel := context.WithCancel(context.Background())
        out, err := b.client.GetObject(ctx, &s3.GetObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(path),
        })
        if err != nil {
                cancel()
                return nil, err
        }
        sc := &s3WithCancel{
                backend: b,
                path:    path,
                body:    out.Body,
                offset:  0,
                timer:   time.AfterFunc(b.timeout, cancel),
                cancel:  cancel,
        }
        return sc, nil
}

// objectSize stats the object at path (already prefixed) and returns its size.
func (b *S3FileBackend) objectSize(path string) (int64, error) {
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        out, err := b.client.HeadObject(ctx, &s3.HeadObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(path),
        })
        if err != nil {
                return 0, errors.Wrapf(err, "unable to stat file %s", path)
        }
        return aws.ToInt64(out.ContentLength), nil
}

// Caller must close the first return value
func (b *S3FileBackend) Reader(path string) (ReadCloseSeeker, error) {
        path, err := b.prefixedPath(path)
        if err != nil {
                return nil, errors.Wrapf(err, "unable to prefix path %s", path)
        }
        sc, err := b.openReader(path)
        if err != nil {
                return nil, errors.Wrapf(err, "unable to open file %s", path)
        }
        return sc, nil
}

func (b *S3FileBackend) ReadFile(path string) ([]byte, error) {
        encodedPath, err := b.prefixedPath(path)
        if err != nil {
                return nil, errors.Wrapf(err, "unable to prefix path %s", path)
        }
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        out, err := b.client.GetObject(ctx, &s3.GetObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(encodedPath),
        })
        if err != nil {
                return nil, errors.Wrapf(err, "unable to open file %s", encodedPath)
        }
        defer out.Body.Close()
        f, err := io.ReadAll(out.Body)
        if err != nil {
                return nil, errors.Wrapf(err, "unable to read file %s", encodedPath)
        }
        return f, nil
}

func (b *S3FileBackend) FileExists(path string) (bool, error) {
        path, err := b.prefixedPath(path)
        if err != nil {
                return false, errors.Wrapf(err, "unable to prefix path %s", path)
        }

        return b._fileExists(path)
}

func (b *S3FileBackend) _fileExists(path string) (bool, error) {
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        _, err := b.client.HeadObject(ctx, &s3.HeadObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(path),
        })
        if err == nil {
                return true, nil
        }

        if isKeyMissingError(err) {
                return false, nil
        }

        return false, errors.Wrapf(err, "unable to know if file %s exists", path)
}

func (b *S3FileBackend) FileSize(path string) (int64, error) {
        path, err := b.prefixedPath(path)
        if err != nil {
                return 0, errors.Wrapf(err, "unable to prefix path %s", path)
        }

        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        info, err := b.client.HeadObject(ctx, &s3.HeadObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(path),
        })
        if err != nil {
                return 0, errors.Wrapf(err, "unable to get file size for %s", path)
        }

        return aws.ToInt64(info.ContentLength), nil
}

func (b *S3FileBackend) FileModTime(path string) (time.Time, error) {
        path, err := b.prefixedPath(path)
        if err != nil {
                return time.Time{}, errors.Wrapf(err, "unable to prefix path %s", path)
        }

        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        info, err := b.client.HeadObject(ctx, &s3.HeadObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(path),
        })
        if err != nil {
                return time.Time{}, errors.Wrapf(err, "unable to get modification time for file %s", path)
        }

        return aws.ToTime(info.LastModified), nil
}

// copyObject is a small helper shared by CopyFile, MoveFile and
// DecodeFilePathIfNeeded. Paths must already be prefixed.
func (b *S3FileBackend) copyObject(oldPath, newPath string) error {
        input := &s3.CopyObjectInput{
                Bucket:     aws.String(b.bucket),
                Key:        aws.String(newPath),
                CopySource: aws.String(encodeCopySource(b.bucket, oldPath)),
        }
        if b.encrypt {
                // SSE-S3 (AES256) server-side encryption.
                input.ServerSideEncryption = types.ServerSideEncryptionAes256
        }

        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        if _, err := b.client.CopyObject(ctx, input); err != nil {
                return errors.Wrapf(err, "unable to copy file from %s to %s", oldPath, newPath)
        }

        return nil
}

func (b *S3FileBackend) CopyFile(oldPath, newPath string) error {
        oldPath, err := b.prefixedPath(oldPath)
        if err != nil {
                return errors.Wrapf(err, "unable to prefix path %s", oldPath)
        }
        newPath = filepath.Join(b.pathPrefix, newPath)

        return b.copyObject(oldPath, newPath)
}

// DecodeFilePathIfNeeded is a special method to URL decode all older
// file paths. It is only needed for the migration, and will be removed
// as soon as the migration is complete.
func (b *S3FileBackend) DecodeFilePathIfNeeded(path string) error {
        // Encode and check if file path changes.
        // If there is no change, then there is no need to do anything.
        if path == encodePath(path) {
                return nil
        }

        // Check if encoded path exists.
        exists, err := b.lookupOriginalPath(encodePath(path))
        if err != nil {
                return err
        }

        if !exists {
                return nil
        }

        // If yes, then it needs to be migrated.
        // This is basically a copy of MoveFile without the path encoding.
        // We avoid any further refactoring because this method will be removed anyways.
        oldPath := filepath.Join(b.pathPrefix, encodePath(path))
        newPath := filepath.Join(b.pathPrefix, path)

        if err := b.copyObject(oldPath, newPath); err != nil {
                return errors.Wrapf(err, "unable to copy the file to %s to the new destination", newPath)
        }

        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        if _, err := b.client.DeleteObject(ctx, &s3.DeleteObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(oldPath),
        }); err != nil {
                return errors.Wrapf(err, "unable to remove the file old file %s", oldPath)
        }

        return nil
}

func (b *S3FileBackend) MoveFile(oldPath, newPath string) error {
        oldPath, err := b.prefixedPath(oldPath)
        if err != nil {
                return errors.Wrapf(err, "unable to prefix path %s", oldPath)
        }
        newPath = filepath.Join(b.pathPrefix, newPath)

        if err := b.copyObject(oldPath, newPath); err != nil {
                return errors.Wrapf(err, "unable to copy the file to %s to the new destination", newPath)
        }

        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        if _, err := b.client.DeleteObject(ctx, &s3.DeleteObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(oldPath),
        }); err != nil {
                return errors.Wrapf(err, "unable to remove the file old file %s", oldPath)
        }

        return nil
}

// countingReader wraps a reader, counting the bytes that flow through it so
// WriteFile-style methods can report the number of bytes written.
type countingReader struct {
        r io.Reader
        n int64
}

func (cr *countingReader) Read(p []byte) (int, error) {
        n, err := cr.r.Read(p)
        cr.n += int64(n)
        return n, err
}

// putObjectInput builds the upload input shared by WriteFileContext and
// AppendFile.
func (b *S3FileBackend) putObjectInput(key, contentType string, body io.Reader) *s3.PutObjectInput {
        input := &s3.PutObjectInput{
                Bucket:      aws.String(b.bucket),
                Key:         aws.String(key),
                Body:        body,
                ContentType: aws.String(contentType),
        }
        if b.encrypt {
                // SSE-S3 (AES256); the uploader propagates it to multipart
                // CreateMultipartUpload as well.
                input.ServerSideEncryption = types.ServerSideEncryptionAes256
        }
        if b.storageClass != "" {
                input.StorageClass = types.StorageClass(b.storageClass)
        }
        return input
}

func (b *S3FileBackend) WriteFile(fr io.Reader, path string) (int64, error) {
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()

        return b.WriteFileContext(ctx, fr, path)
}

func (b *S3FileBackend) WriteFileContext(ctx context.Context, fr io.Reader, path string) (int64, error) {
        path = filepath.Join(b.pathPrefix, path)
        contentType := getContentType(filepath.Ext(path))

        // The manager.Uploader mirrors the previous client's behavior: it issues
        // a single PUT for small/seekable payloads and transparently buffers
        // unknown-length streams into 5MB (or larger) multipart parts. The
        // cloud/bifrost path keeps unsigned content flowing through the custom
        // transport (checksums are only computed when required, per client
        // configuration).
        cr := &countingReader{r: fr}
        input := b.putObjectInput(path, contentType, cr)

        if _, err := b.uploader.Upload(ctx, input); err != nil {
                return cr.n, errors.Wrapf(err, "unable write the data in the file %s", path)
        }

        return cr.n, nil
}

func (b *S3FileBackend) AppendFile(fr io.Reader, path string) (int64, error) {
        fp, err := b.prefixedPath(path)
        if err != nil {
                return 0, errors.Wrapf(err, "unable to prefix path %s", path)
        }
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        if _, err := b.client.HeadObject(ctx, &s3.HeadObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(fp),
        }); err != nil {
                return 0, errors.Wrapf(err, "unable to find the file %s to append the data", path)
        }

        contentType := getContentType(filepath.Ext(fp))
        partName := fp + ".part"
        ctx2, cancel2 := context.WithTimeout(context.Background(), b.timeout)
        defer cancel2()

        cr := &countingReader{r: fr}
        partInput := b.putObjectInput(partName, contentType, cr)
        if _, err := b.uploader.Upload(ctx2, partInput); err != nil {
                return 0, errors.Wrapf(err, "unable append the data in the file %s", path)
        }
        defer func() {
                ctx4, cancel4 := context.WithTimeout(context.Background(), b.timeout)
                defer cancel4()
                b.client.DeleteObject(ctx4, &s3.DeleteObjectInput{
                        Bucket: aws.String(b.bucket),
                        Key:    aws.String(partName),
                })
        }()

        // Server-side concatenation of the existing object and the new data.
        // The previous client exposed this as a compose operation; plain S3 (and
        // the same primitive through a multipart upload whose parts are copied
        // server-side with UploadPartCopy.
        ctx3, cancel3 := context.WithTimeout(context.Background(), b.timeout)
        defer cancel3()
        createInput := &s3.CreateMultipartUploadInput{
                Bucket:      aws.String(b.bucket),
                Key:         aws.String(fp),
                ContentType: aws.String(contentType),
        }
        if b.encrypt {
                createInput.ServerSideEncryption = types.ServerSideEncryptionAes256
        }
        createOut, err := b.client.CreateMultipartUpload(ctx3, createInput)
        if err != nil {
                return 0, errors.Wrapf(err, "unable append the data in the file %s", path)
        }
        uploadID := aws.ToString(createOut.UploadId)

        completedParts := make([]types.CompletedPart, 0, 2)
        for i, srcKey := range []string{fp, partName} {
                part, err := b.client.UploadPartCopy(ctx3, &s3.UploadPartCopyInput{
                        Bucket:     aws.String(b.bucket),
                        Key:        aws.String(fp),
                        UploadId:   aws.String(uploadID),
                        PartNumber: aws.Int32(int32(i + 1)),
                        CopySource: aws.String(encodeCopySource(b.bucket, srcKey)),
                })
                if err != nil {
                        b.abortMultipartUpload(context.Background(), fp, uploadID)
                        return 0, errors.Wrapf(err, "unable append the data in the file %s", path)
                }
                completedParts = append(completedParts, types.CompletedPart{
                        PartNumber: aws.Int32(int32(i + 1)),
                        ETag:       part.CopyPartResult.ETag,
                })
        }

        if _, err := b.client.CompleteMultipartUpload(ctx3, &s3.CompleteMultipartUploadInput{
                Bucket:          aws.String(b.bucket),
                Key:             aws.String(fp),
                UploadId:        aws.String(uploadID),
                MultipartUpload: &types.CompletedMultipartUpload{Parts: completedParts},
        }); err != nil {
                b.abortMultipartUpload(context.Background(), fp, uploadID)
                return 0, errors.Wrapf(err, "unable append the data in the file %s", path)
        }

        return cr.n, nil
}

// abortMultipartUpload is a best-effort cleanup for failed appends.
func (b *S3FileBackend) abortMultipartUpload(ctx context.Context, key, uploadID string) {
        if b.timeout > 0 {
                var cancel context.CancelFunc
                ctx, cancel = context.WithTimeout(ctx, b.timeout)
                defer cancel()
        }
        b.client.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{
                Bucket:   aws.String(b.bucket),
                Key:      aws.String(key),
                UploadId: aws.String(uploadID),
        })
}

func (b *S3FileBackend) RemoveFile(path string) error {
        path, err := b.prefixedPath(path)
        if err != nil {
                return errors.Wrapf(err, "unable to prefix path %s", path)
        }
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        if _, err := b.client.DeleteObject(ctx, &s3.DeleteObjectInput{
                Bucket: aws.String(b.bucket),
                Key:    aws.String(path),
        }); err != nil {
                return errors.Wrapf(err, "unable to remove the file %s", path)
        }

        return nil
}

func (b *S3FileBackend) listDirectory(path string, recursion bool) ([]string, error) {
        path, err := b.prefixedPath(path)
        if err != nil {
                return nil, errors.Wrapf(err, "unable to prefix path %s", path)
        }
        if !strings.HasSuffix(path, "/") && path != "" {
                // The S3 API returns only the path itself when "/" is not present
                // appending "/" to make it consistent across all filestores
                path = path + "/"
        }

        paginator := s3.NewListObjectsV2Paginator(b.client, &s3.ListObjectsV2Input{
                Bucket: aws.String(b.bucket),
                Prefix: aws.String(path),
                Delimiter: func() *string {
                        if recursion {
                                return nil
                        }
                        return aws.String("/")
                }(),
        })
        var paths []string
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()
        var count int
        for paginator.HasMorePages() {
                page, err := paginator.NextPage(ctx)
                if err != nil {
                        return nil, errors.Wrapf(err, "unable to list the directory %s", path)
                }
                for _, object := range page.Contents {
                        // We strip the path prefix that gets applied,
                        // so that it remains transparent to the application.
                        key := strings.TrimPrefix(aws.ToString(object.Key), b.pathPrefix)
                        trimmed := strings.Trim(key, "/")
                        if trimmed != "" {
                                paths = append(paths, trimmed)
                        }
                        count++
                }
                if !recursion {
                        // Non-recursive listings also surface common prefixes
                        // (directories) as entries, matching the S3 convention of
                        // yielding prefixes as objects with a trailing "/".
                        for _, prefix := range page.CommonPrefixes {
                                key := strings.TrimPrefix(aws.ToString(prefix.Prefix), b.pathPrefix)
                                trimmed := strings.Trim(key, "/")
                                if trimmed != "" {
                                        paths = append(paths, trimmed)
                                }
                                count++
                        }
                }
        }
        // Check if only one item was returned and it matches the path prefix
        if count == 1 && len(paths) > 0 && strings.TrimRight(path, "/") == paths[0] {
                // Return a fs.PathError to maintain consistency
                return nil, &fs.PathError{Op: "readdir", Path: path, Err: fs.ErrNotExist}
        }

        return paths, nil
}

func (b *S3FileBackend) ListDirectory(path string) ([]string, error) {
        return b.listDirectory(path, false)
}

func (b *S3FileBackend) ListDirectoryRecursively(path string) ([]string, error) {
        return b.listDirectory(path, true)
}

func (b *S3FileBackend) RemoveDirectory(path string) error {
        path, err := b.prefixedPath(path)
        if err != nil {
                return errors.Wrapf(err, "unable to prefix path %s", path)
        }
        paginator := s3.NewListObjectsV2Paginator(b.client, &s3.ListObjectsV2Input{
                Bucket: aws.String(b.bucket),
                Prefix: aws.String(path),
        })
        ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
        defer cancel()

        // List all objects in the directory
        for paginator.HasMorePages() {
                page, err := paginator.NextPage(ctx)
                if err != nil {
                        return errors.Wrapf(err, "unable to list the directory %s", path)
                }

                // Remove each object individually
                for _, object := range page.Contents {
                        ctx2, cancel2 := context.WithTimeout(context.Background(), b.timeout)
                        err := func() error {
                                defer cancel2()
                                _, err := b.client.DeleteObject(ctx2, &s3.DeleteObjectInput{
                                        Bucket: aws.String(b.bucket),
                                        Key:    object.Key,
                                })
                                return err
                        }()
                        if err != nil {
                                return errors.Wrapf(err, "unable to remove object %s from directory %s", aws.ToString(object.Key), path)
                        }
                }
        }

        return nil
}

// zipObjectInfo is the object metadata needed when adding S3 objects to a
// zip archive.
type zipObjectInfo struct {
        key          string
        size         int64
        lastModified time.Time
}

// ZipReader will create a zip of path. If path is a single file, it will zip the single file.
// If deflate is true, the contents will be compressed. It will stream the zip to io.ReadCloser.
func (b *S3FileBackend) ZipReader(path string, deflate bool) (io.ReadCloser, error) {
        deflateMethod := zip.Store
        if deflate {
                deflateMethod = zip.Deflate
        }

        path, err := b.prefixedPath(path)
        if err != nil {
                return nil, err
        }

        pr, pw := io.Pipe()

        go func() {
                defer pw.Close()

                zipWriter := zip.NewWriter(pw)
                defer zipWriter.Close()

                ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
                defer cancel()

                // Is path a single file?
                if head, err := b.client.HeadObject(ctx, &s3.HeadObjectInput{
                        Bucket: aws.String(b.bucket),
                        Key:    aws.String(path),
                }); err == nil {
                        // We want the zipped file to be at the root of the zip. E.g., given a path of
                        // "path/to/file.sh" we want the zip to have one file: "file.sh", not "path/to/file.sh".
                        stripPath := filepath.Dir(path)
                        if stripPath != "" {
                                stripPath += "/"
                        }
                        object := zipObjectInfo{
                                key:          path,
                                size:         aws.ToInt64(head.ContentLength),
                                lastModified: aws.ToTime(head.LastModified),
                        }
                        if err = b._copyObjectToZipWriter(zipWriter, object, stripPath, deflateMethod); err != nil {
                                pw.CloseWithError(err)
                        }
                        return
                }

                // Is path a directory?
                path = path + "/"
                paginator := s3.NewListObjectsV2Paginator(b.client, &s3.ListObjectsV2Input{
                        Bucket: aws.String(b.bucket),
                        Prefix: aws.String(path),
                })
                ctx2, cancel2 := context.WithTimeout(context.Background(), b.timeout)
                defer cancel2()

                for paginator.HasMorePages() {
                        page, err := paginator.NextPage(ctx2)
                        if err != nil {
                                pw.CloseWithError(errors.Wrapf(err, "unable to list the directory %s", path))
                                return
                        }

                        for _, obj := range page.Contents {
                                object := zipObjectInfo{
                                        key:          aws.ToString(obj.Key),
                                        size:         aws.ToInt64(obj.Size),
                                        lastModified: aws.ToTime(obj.LastModified),
                                }
                                if err = b._copyObjectToZipWriter(zipWriter, object, path, deflateMethod); err != nil {
                                        pw.CloseWithError(err)
                                        return
                                }
                        }
                }
        }()

        return pr, nil
}

func (b *S3FileBackend) _copyObjectToZipWriter(zipWriter *zip.Writer, object zipObjectInfo, stripPath string, deflateMethod uint16) error {
        // We strip the path prefix that gets applied,
        // so that it remains transparent to the application.
        object.key = strings.TrimPrefix(object.key, b.pathPrefix)

        // We strip the path prefix + path so the zip file is relative to the root of the requested path
        relPath := strings.TrimPrefix(object.key, stripPath)
        header := &zip.FileHeader{
                Name:     relPath,
                Method:   deflateMethod,
                Modified: object.lastModified,
        }
        header.SetMode(0644) // rw-r--r-- permissions

        writer, err := zipWriter.CreateHeader(header)
        if err != nil {
                return errors.Wrapf(err, "unable to create zip entry for %s", object.key)
        }

        reader, err := b.Reader(object.key)
        if err != nil {
                return errors.Wrapf(err, "unable to create reader for %s", object.key)
        }
        defer reader.Close()

        _, err = io.Copy(writer, reader)
        if err != nil {
                return errors.Wrapf(err, "unable to copy content for %s", object.key)
        }

        return nil
}

func (b *S3FileBackend) GeneratePublicLink(path string) (string, time.Duration, error) {
        path, err := b.prefixedPath(path)
        if err != nil {
                return "", 0, errors.Wrapf(err, "unable to prefix path %s", path)
        }

        req, err := b.presignClient.PresignGetObject(context.Background(), &s3.GetObjectInput{
                Bucket:                     aws.String(b.bucket),
                Key:                        aws.String(path),
                ResponseContentDisposition: aws.String("attachment"),
        }, func(opts *s3.PresignOptions) {
                opts.Expires = b.presignExpires
        })
        if err != nil {
                return "", 0, errors.Wrapf(err, "unable to generate public link for %s", path)
        }

        return req.URL, b.presignExpires, nil
}

func (b *S3FileBackend) lookupOriginalPath(s string) (bool, error) {
        exists, err := b._fileExists(filepath.Join(b.pathPrefix, s))
        if err != nil {
                var apiErr smithy.APIError
                // Sometimes S3 will not allow to access other paths.
                // In that case, we consider them as not exists.
                if errors.As(err, &apiErr) && apiErr.ErrorCode() == "AccessDenied" {
                        return false, nil
                }
                return false, errors.Wrapf(err, "unable to check for file path %s", s)
        }
        return exists, nil
}

func (b *S3FileBackend) prefixedPath(s string) (string, error) {
        if b.isCloud {
                // We do a lookup of the original path for compatibility purposes.
                exists, err := b.lookupOriginalPath(s)
                if err != nil {
                        return "", err
                }

                // If it exists, then we don't want to encode it
                // because it's an old path.
                if !exists {
                        // If the request is routed via bifrost, then we need to encode the path
                        // to avoid signature validation errors.
                        // This happens because in bifrost, we are signing the URL outside the SDK
                        // and therefore the signature sent from the bifrost client
                        // will contain the encoded path, whereas the original path is sent
                        // un-encoded.
                        // More info at: https://github.com/aws/aws-sdk-go-v2/blob/1e4148ac334a4ea7abe31bd984a31dc761bb289d/aws/signer/v4/v4.go#L20
                        s = encodePath(s)
                }
        }
        return filepath.Join(b.pathPrefix, s), nil
}
