package app

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/app/platform"
)

// PopulateWebConnConfig checks if the connection id already exists in the hub,
// and if so, accordingly populates the other fields of the webconn.
func (a *App) PopulateWebConnConfig(s *model.Session, cfg *platform.WebConnConfig, seqVal string) (*platform.WebConnConfig, error) {
	return a.Srv().Platform().PopulateWebConnConfig(s, cfg, seqVal)
}
