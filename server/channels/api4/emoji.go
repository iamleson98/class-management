package api4

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

const (
	EmojiMaxAutocompleteItems = 100
	GetEmojisByNamesMax       = 200
)

func (api *API) InitEmoji() {
	api.BaseRoutes.Emojis.Method(http.MethodPost, "/", api.APISessionRequired(createEmoji, handlerParamFileAPI))
	api.BaseRoutes.Emojis.Method(http.MethodGet, "/", api.APISessionRequired(getEmojiList))
	api.BaseRoutes.Emojis.Method(http.MethodPost, "/names", api.APISessionRequired(getEmojisByNames))
	api.BaseRoutes.Emojis.Method(http.MethodPost, "/search", api.APISessionRequired(searchEmojis))
	api.BaseRoutes.Emojis.Method(http.MethodGet, "/autocomplete", api.APISessionRequired(autocompleteEmojis))
	api.BaseRoutes.Emoji.Method(http.MethodDelete, "/", api.APISessionRequired(deleteEmoji))
	api.BaseRoutes.Emoji.Method(http.MethodGet, "/", api.APISessionRequired(getEmoji))
	api.BaseRoutes.EmojiByName.Method(http.MethodGet, "/", api.APISessionRequired(getEmojiByName))
	api.BaseRoutes.Emoji.Method(http.MethodGet, "/image", api.APISessionRequiredTrustRequester(getEmojiImage))
}

func createEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	defer func() {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			c.Logger.Warn("Error while discarding request body", mlog.Err(err))
		}
	}()

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("createEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > app.MaxEmojiFileSize {
		c.Err = model.NewAppError("createEmoji", "api.emoji.create.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(app.MaxEmojiFileSize); err != nil {
		c.Err = model.NewAppError("createEmoji", "api.emoji.create.parse.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateEmoji, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	// Allow any user with CREATE_EMOJIS permission at Team level to create emojis at system level
	memberships, err := c.App.GetTeamMembersForUser(c.AppContext, c.AppContext.Session().UserId, "", true)

	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateEmojis) {
		hasPermission := false
		for _, membership := range memberships {
			if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), membership.TeamId, model.PermissionCreateEmojis) {
				hasPermission = true
				break
			}
		}
		if !hasPermission {
			c.SetPermissionError(model.PermissionCreateEmojis)
			return
		}
	}

	m := r.MultipartForm
	props := m.Value

	if len(props["emoji"]) == 0 {
		c.SetInvalidParam("emoji")
		return
	}

	var emoji model.Emoji
	if jsonErr := json.Unmarshal([]byte(props["emoji"][0]), &emoji); jsonErr != nil {
		c.SetInvalidParam("emoji")
		return
	}

	auditRec.AddEventResultState(&emoji)
	auditRec.AddEventObjectType("emoji")

	newEmoji, err := c.App.CreateEmoji(c.AppContext, c.AppContext.Session().UserId, &emoji, m)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if err := json.NewEncoder(w).Encode(newEmoji); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getEmojiList(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	sort := c.RequireParam("sort", web.RequireString)
	page := c.RequireParam("page", web.RequireInt)
	perPage := c.RequireParam("per_page", web.RequireInt)
	if c.Err != nil {
		return
	}
	pageInt := page.(int)
	perPageInt := perPage.(int)

	if sort != "" && sort != model.EmojiSortByName {
		c.SetInvalidURLParam("sort")
		return
	}

	listEmoji, err := c.App.GetEmojiList(c.AppContext, pageInt, perPageInt, sort.(string))
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(listEmoji); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	emojiId := c.RequireParam("emoji_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	emojiIdStr := emojiId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteEmoji, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	emoji, err := c.App.GetEmoji(c.AppContext, emojiIdStr)
	if err != nil {
		model.AddEventParameterToAuditRec(auditRec, "emoji_id", emojiIdStr)
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(emoji)
	auditRec.AddEventObjectType("emoji")

	// Allow any user with DELETE_EMOJIS permission at Team level to delete emojis at system level
	memberships, err := c.App.GetTeamMembersForUser(c.AppContext, c.AppContext.Session().UserId, "", true)

	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionDeleteEmojis) {
		hasPermission := false
		for _, membership := range memberships {
			if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), membership.TeamId, model.PermissionDeleteEmojis) {
				hasPermission = true
				break
			}
		}
		if !hasPermission {
			c.SetPermissionError(model.PermissionDeleteEmojis)
			return
		}
	}

	if c.AppContext.Session().UserId != emoji.CreatorId {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionDeleteOthersEmojis) {
			hasPermission := false
			for _, membership := range memberships {
				if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), membership.TeamId, model.PermissionDeleteOthersEmojis) {
					hasPermission = true
					break
				}
			}

			if !hasPermission {
				c.SetPermissionError(model.PermissionDeleteOthersEmojis)
				return
			}
		}
	}

	err = c.App.DeleteEmoji(c.AppContext, emoji)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func getEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	emojiId := c.RequireParam("emoji_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	emojiIdStr := emojiId.(string)

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	emoji, err := c.App.GetEmoji(c.AppContext, emojiIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(emoji); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getEmojiByName(c *Context, w http.ResponseWriter, r *http.Request) {
	emojiName := c.RequireParam("emoji_name", web.RequireEmojiName)
	if c.Err != nil {
		return
	}
	emojiNameStr := emojiName.(string)

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmojiByName", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	emoji, err := c.App.GetEmojiByName(c.AppContext, emojiNameStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(emoji); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getEmojisByNames(c *Context, w http.ResponseWriter, r *http.Request) {
	names, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getEmojisByNames", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(names) == 0 {
		c.SetInvalidParam("names")
		return
	}

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmojisByNames", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if len(names) > GetEmojisByNamesMax {
		c.Err = model.NewAppError("getEmojisByNames", "api.emoji.get_multiple_by_name_too_many.request_error", map[string]any{
			"MaxNames": GetEmojisByNamesMax,
		}, "", http.StatusBadRequest)
		return
	}

	emojis, appErr := c.App.GetMultipleEmojiByName(c.AppContext, names)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(emojis); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getEmojiImage(c *Context, w http.ResponseWriter, r *http.Request) {
	emojiId := c.RequireParam("emoji_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	emojiIdStr := emojiId.(string)

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmojiImage", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	image, imageType, err := c.App.GetEmojiImage(c.AppContext, emojiIdStr)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "image/"+imageType)
	w.Header().Set("Cache-Control", "max-age=2592000, private")
	if _, err := w.Write(image); err != nil {
		c.Logger.Warn("Error while writing image response", mlog.Err(err))
	}
}

func searchEmojis(c *Context, w http.ResponseWriter, r *http.Request) {
	var emojiSearch model.EmojiSearch
	if jsonErr := json.NewDecoder(r.Body).Decode(&emojiSearch); jsonErr != nil {
		c.SetInvalidParamWithErr("term", jsonErr)
		return
	}

	if emojiSearch.Term == "" {
		c.SetInvalidParam("term")
		return
	}

	emojis, err := c.App.SearchEmoji(c.AppContext, emojiSearch.Term, emojiSearch.PrefixOnly, web.PerPageMaximum)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(emojis); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func autocompleteEmojis(c *Context, w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")

	if name == "" {
		c.SetInvalidURLParam("name")
		return
	}

	emojis, err := c.App.SearchEmoji(c.AppContext, name, true, EmojiMaxAutocompleteItems)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(emojis); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
