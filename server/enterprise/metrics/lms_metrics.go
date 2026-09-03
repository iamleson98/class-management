package metrics

// LMS-domain and file-storage observability.
//
// The Mattermost-core metrics cover API latency, websockets, caches and
// notifications. The metrics below extend coverage to the parts of this
// fork that are business-critical or historically fragile:
//
//   - file uploads (chat attachments, class media): duration, bytes and
//     failures — the exact flow that produced "image does not render"
//     regressions in the past;
//   - every S3/RustFS request (observed at the HTTP transport layer, so
//     GET/PUT/HEAD/DELETE and multipart calls are all captured);
//   - LMS domain operations: payments (money), homework submissions
//     (coursework), class media and student records.

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/iamleson98/sitename/server/v8/platform/shared/filestore"
)

const (
	MetricsSubsystemLMS       = "lms"
	MetricsSubsystemFile      = "file"
	MetricsSubsystemFilestore = "filestore"
)

// initLMSMetrics registers the LMS-domain and file-storage metrics (see the
// file comment). additionalLabels carries the cloud ConstLabels applied to
// every metric by New().
func (m *MetricsInterfaceImpl) initLMSMetrics(additionalLabels map[string]string) {
	withLabels := func(opts prometheus.HistogramOpts) prometheus.HistogramOpts {
		opts.ConstLabels = additionalLabels
		return opts
	}
	m.FileUploadDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemFile,
			Name:      "upload_duration_seconds",
			Help:      "Time to fully process a file upload (write + metadata).",
		}),
		[]string{"success"},
	)
	m.Registry.MustRegister(m.FileUploadDuration)

	m.FileUploadBytes = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemFile,
			Name:      "upload_bytes_total",
			Help:      "Total number of bytes uploaded to the filestore.",
		},
	)
	m.Registry.MustRegister(m.FileUploadBytes)

	m.FileUploadFailures = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemFile,
			Name:      "upload_failures_total",
			Help:      "Total number of failed file uploads by stage.",
		},
		[]string{"stage"},
	)
	m.Registry.MustRegister(m.FileUploadFailures)

	m.S3RequestDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemFilestore,
			Name:      "s3_request_duration_seconds",
			Help:      "Time for a single S3/RustFS HTTP request, measured at the transport layer.",
		}),
		[]string{"operation", "code"},
	)
	m.Registry.MustRegister(m.S3RequestDuration)

	m.LMSClassMediaCreated = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLMS,
			Name:      "class_media_created_total",
			Help:      "Total number of class media entries created.",
		},
	)
	m.Registry.MustRegister(m.LMSClassMediaCreated)

	m.LMSClassMediaDeleted = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLMS,
			Name:      "class_media_deleted_total",
			Help:      "Total number of class media entries deleted.",
		},
	)
	m.Registry.MustRegister(m.LMSClassMediaDeleted)

	m.LMSPaymentsCreated = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLMS,
			Name:      "payments_created_total",
			Help:      "Total number of tuition payments created, by payment method.",
		},
		[]string{"method"},
	)
	m.Registry.MustRegister(m.LMSPaymentsCreated)

	m.LMSHomeworkSubmissions = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLMS,
			Name:      "homework_submissions_total",
			Help:      "Total number of homework submissions upserted, by whether they were new or updated.",
		},
		[]string{"kind"},
	)
	m.Registry.MustRegister(m.LMSHomeworkSubmissions)

	m.LMSStudentsCreated = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLMS,
			Name:      "students_created_total",
			Help:      "Total number of student records created.",
		},
	)
	m.Registry.MustRegister(m.LMSStudentsCreated)

	filestore.S3MetricsObserver = m.observeS3Request
}

// observeS3Request reports one S3 HTTP round trip. failed requests (no
// response at all) are reported with code "err".
func (m *MetricsInterfaceImpl) observeS3Request(operation string, code int, failed bool, seconds float64) {
	codeLabel := "err"
	if !failed {
		switch {
		case code >= 200 && code < 300:
			codeLabel = "2xx"
		case code >= 300 && code < 400:
			codeLabel = "3xx"
		case code >= 400 && code < 500:
			codeLabel = "4xx"
		case code >= 500:
			codeLabel = "5xx"
		default:
			codeLabel = "other"
		}
	}
	m.S3RequestDuration.With(prometheus.Labels{"operation": operation, "code": codeLabel}).Observe(seconds)
}

func (mi *MetricsInterfaceImpl) ObserveFileUploadDuration(success bool, elapsed float64) {
	successLabel := "false"
	if success {
		successLabel = "true"
	}
	mi.FileUploadDuration.With(prometheus.Labels{"success": successLabel}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) AddFileUploadBytes(count int64) {
	if count > 0 {
		mi.FileUploadBytes.Add(float64(count))
	}
}

func (mi *MetricsInterfaceImpl) IncrementFileUploadFailure(stage string) {
	mi.FileUploadFailures.With(prometheus.Labels{"stage": stage}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementLMSClassMediaCreated() {
	mi.LMSClassMediaCreated.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementLMSClassMediaDeleted() {
	mi.LMSClassMediaDeleted.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementLMSPaymentCreated(method string) {
	if method == "" {
		method = "unknown"
	}
	mi.LMSPaymentsCreated.With(prometheus.Labels{"method": method}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementLMSHomeworkSubmission(kind string) {
	if kind == "" {
		kind = "new"
	}
	mi.LMSHomeworkSubmissions.With(prometheus.Labels{"kind": kind}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementLMSStudentCreated() {
	mi.LMSStudentsCreated.Inc()
}
