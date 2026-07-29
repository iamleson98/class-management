package model

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
)

type SitenameFeature string

const (
	PaidFeatureGuestAccounts                = SitenameFeature("sitename.feature.guest_accounts")
	PaidFeatureCustomUsergroups             = SitenameFeature("sitename.feature.custom_user_groups")
	PaidFeatureCreateMultipleTeams          = SitenameFeature("sitename.feature.create_multiple_teams")
	PaidFeatureStartcall                    = SitenameFeature("sitename.feature.start_call")
	PaidFeaturePlaybooksRetrospective       = SitenameFeature("sitename.feature.playbooks_retro")
	PaidFeatureUnlimitedMessages            = SitenameFeature("sitename.feature.unlimited_messages")
	PaidFeatureUnlimitedFileStorage         = SitenameFeature("sitename.feature.unlimited_file_storage")
	PaidFeatureAllProfessionalfeatures      = SitenameFeature("sitename.feature.all_professional")
	PaidFeatureAllEnterprisefeatures        = SitenameFeature("sitename.feature.all_enterprise")
	UpgradeDowngradedWorkspace              = SitenameFeature("sitename.feature.upgrade_downgraded_workspace")
	PluginFeature                           = SitenameFeature("sitename.feature.plugin")
	PaidFeatureHighlightWithoutNotification = SitenameFeature("sitename.feature.highlight_without_notification")
)

// These are the features a non admin would typically ping an admin about
var paidFeatures = map[SitenameFeature]struct{}{
	PaidFeatureGuestAccounts:                {},
	PaidFeatureCustomUsergroups:             {},
	PaidFeatureCreateMultipleTeams:          {},
	PaidFeatureStartcall:                    {},
	PaidFeaturePlaybooksRetrospective:       {},
	PaidFeatureUnlimitedMessages:            {},
	PaidFeatureUnlimitedFileStorage:         {},
	PaidFeatureAllProfessionalfeatures:      {},
	PaidFeatureAllEnterprisefeatures:        {},
	UpgradeDowngradedWorkspace:              {},
	PaidFeatureHighlightWithoutNotification: {},
}

type NotifyAdminToUpgradeRequest struct {
	TrialNotification bool            `json:"trial_notification"`
	RequiredPlan      string          `json:"required_plan"`
	RequiredFeature   SitenameFeature `json:"required_feature"`
}

type NotifyAdminData struct {
	CreateAt        int64           `json:"create_at,omitempty"`
	UserId          string          `json:"user_id"`
	RequiredPlan    string          `json:"required_plan"`
	RequiredFeature SitenameFeature `json:"required_feature"`
	Trial           bool            `json:"trial"`
	SentAt          sql.NullInt64   `json:"sent_at"`
}

func (nad *NotifyAdminData) IsValid() *AppError {
	if strings.HasPrefix(string(nad.RequiredFeature), string(PluginFeature)) {
		return nil
	}

	if _, featureOk := paidFeatures[nad.RequiredFeature]; !featureOk {
		return NewAppError("NotifyAdmin.IsValid", fmt.Sprintf("Invalid feature, %s provided", nad.RequiredFeature), nil, "", http.StatusBadRequest)
	}

	return nil
}

func (nad *NotifyAdminData) PreSave() {
	nad.CreateAt = GetMillis()
}
