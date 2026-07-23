package properties

import (
	"github.com/iamleson98/sitename/server/public/model"
)

func (ps *PropertyService) RegisterPropertyGroup(name string) (*model.PropertyGroup, error) {
	return ps.groupStore.Register(name)
}

func (ps *PropertyService) GetPropertyGroup(name string) (*model.PropertyGroup, error) {
	return ps.groupStore.Get(name)
}
