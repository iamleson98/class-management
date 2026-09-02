package lmsapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
	sharedweb "github.com/iamleson98/sitename/server/v8/platform/shared/web"
)

func (a *LMSAPI) InitClassMedia() {
	a.routes.Method(http.MethodPost, "/class-media", a.api.APISessionRequired(createClassMedia))
	a.routes.Method(http.MethodPost, "/class-media/search", a.api.APISessionRequired(getClassMedia))
	a.routes.Method(http.MethodDelete, "/class-media/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteClassMedia))
	// LMS media file serving (class media bytes). TrustRequester so <img>/<video>
	// tags can load it with the session cookie alone (same as /api/v4/files).
	a.routes.Method(http.MethodGet, "/media/{file_id:[A-Za-z0-9]+}", a.api.APISessionRequiredTrustRequester(getLmsMediaFile))
	a.routes.Method(http.MethodHead, "/media/{file_id:[A-Za-z0-9]+}", a.api.APISessionRequiredTrustRequester(getLmsMediaFile))
}

// getLmsMediaFile serves the raw bytes of a class-media file.
//
// Mattermost's GET /api/v4/files/{file_id} gates access on the file's CHANNEL
// (creator or channel-read permission). LMS uploads land in the uploader's
// private self-DM channel, and LMS roles span two teams (team-employee /
// team-user), so no channel-based rule can ever work for shared media.
// Instead this endpoint gates on PermissionLmsManageClassMedia — the same
// permission that guards reading the class_media rows themselves — and only
// serves file ids actually referenced by a class_media row (scoping: an
// arbitrary chat file id gains nothing here).
func getLmsMediaFile(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	fileIDStr := c.RequireParam("file_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	forceDownload, _ := strconv.ParseBool(r.URL.Query().Get("download"))

	// Scope: the file must back an existing class media row.
	if _, err := c.App.LMS().GetClassMediaByFileID(fileIDStr); err != nil {
		c.Err = err
		return
	}

	info, err := c.App.GetFileInfo(c.AppContext, fileIDStr)
	if err != nil {
		c.Err = err
		return
	}
	if info.DeleteAt != 0 {
		c.Err = model.NewAppError("getLmsMediaFile", "app.file_info.get.app_error", nil, "", http.StatusNotFound)
		return
	}

	fileReader, err := c.App.FileReader(info.Path)
	if err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
		return
	}
	defer fileReader.Close()

	sharedweb.WriteFileResponse(info.Name, info.MimeType, info.Size, time.Unix(0, info.UpdateAt*int64(1000*1000)), *c.App.Config().ServiceSettings.WebserverMode, fileReader, forceDownload, w, r)
}

func getClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	var opts modelhelper.ClassMediaFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getClassMedia", "api.lms.get_class_media.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	media, totalCount, err := c.App.LMS().GetClassMedia(opts)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(utils.ResponseList{
		Items:      media,
		TotalCount: totalCount,
	}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	var classMedia *lms_models.ClassMedium
	if err := json.NewDecoder(r.Body).Decode(&classMedia); err != nil {
		c.Err = model.NewAppError("createClassMedia", "api.lms.create_class_media.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateClassMedia(classMedia)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteClassMedia(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
