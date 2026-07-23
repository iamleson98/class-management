package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (api *API) InitPermissions() {
	api.BaseRoutes.Permissions.Method(http.MethodPost, "/ancillary", api.APISessionRequired(appendAncillaryPermissionsPost))
}

func appendAncillaryPermissionsPost(c *Context, w http.ResponseWriter, r *http.Request) {
	permissions, err := model.NonSortedArrayFromJSON(r.Body)
	if err != nil || len(permissions) < 1 {
		c.Err = model.NewAppError("appendAncillaryPermissionsPost", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	b, err := json.Marshal(model.AddAncillaryPermissions(permissions))
	if err != nil {
		c.SetJSONEncodingError(err)
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
