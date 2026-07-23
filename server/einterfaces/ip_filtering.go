package einterfaces

import "github.com/iamleson98/sitename/server/public/model"

type IPFilteringInterface interface {
	ApplyIPFilters(allowedIPRanges *model.AllowedIPRanges) (*model.AllowedIPRanges, error)
	GetIPFilters() (*model.AllowedIPRanges, error)
}
