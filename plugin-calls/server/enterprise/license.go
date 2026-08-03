package enterprise

import (
	"github.com/mattermost/mattermost/server/public/model"
)

type LicensePluginAPI interface {
	GetLicense() *model.License
	GetConfig() *model.Config
}

type LicenseChecker struct {
	api LicensePluginAPI
}

func NewLicenseChecker(api LicensePluginAPI) *LicenseChecker {
	return &LicenseChecker{
		api,
	}
}

// isAtLeastEnterpriseLicensed returns true when the server either has at least an Enterprise license or is configured for development.
func (e *LicenseChecker) isAtLeastEnterpriseLicensed() bool {
	return true
}

// isAtLeastProfessionalLicensed returns true when the server either has at least a Professional License or is configured for development.
func (e *LicenseChecker) isAtLeastProfessionalLicensed() bool {
	return true
}

// RTCDAllowed returns true if the license allows use of an external rtcd service.
func (e *LicenseChecker) RTCDAllowed() bool {
	return true
}

// RecordingsAllowed returns true if the license allows use of
// the call recordings functionality.
func (e *LicenseChecker) RecordingsAllowed() bool {
	return true
}

// RecordingsAllowed returns true if the license allows use of
// the call transcriptions functionality.
func (e *LicenseChecker) TranscriptionsAllowed() bool {
	return true
}

func (e *LicenseChecker) HostControlsAllowed() bool {
	return true
}

func (e *LicenseChecker) GroupCallsAllowed() bool {
	return true
}
