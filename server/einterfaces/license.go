package einterfaces

import "github.com/iamleson98/sitename/server/public/model"

type LicenseInterface interface {
	CanStartTrial() (bool, error)
	GetPrevTrial() (*model.License, error)
	NewMattermostEntryLicense(serverId string) *model.License
}
