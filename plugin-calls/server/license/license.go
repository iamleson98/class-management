package license

import (
	"github.com/mattermost/mattermost/server/public/model"
)

const (
	professional       = "professional"
	enterprise         = "enterprise"
	enterpriseAdvanced = "advanced"
)

// isValidSkuShortName returns whether the SKU short name is one of the known strings;
// namely: professional, enterprise or enterprise advanced.
func isValidSkuShortName(license *model.License) bool {
	if license == nil {
		return false
	}

	switch license.SkuShortName {
	case professional, enterprise, enterpriseAdvanced:
		return true
	default:
		return false
	}
}

// IsCloud returns true when the server is on cloud, and false otherwise.
func IsCloud(license *model.License) bool {
	if license == nil || license.Features == nil || license.Features.Cloud == nil {
		return false
	}

	return *license.Features.Cloud
}

func IsCloudStarter(license *model.License) bool {
	return license != nil && license.SkuShortName == "starter"
}

func IsEnterprise(license *model.License) bool {
	if license != nil && (license.SkuShortName == enterprise) {
		return true
	}

	return false
}

func IsProfessional(license *model.License) bool {
	if license != nil && (license.SkuShortName == professional) {
		return true
	}

	return false
}

func IsEnterpriseAdvanced(license *model.License) bool {
	if license != nil && (license.SkuShortName == enterpriseAdvanced) {
		return true
	}

	return false
}
