package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitDataRetention() {
	api.BaseRoutes.DataRetention.Method(http.MethodGet, "/policy", api.APISessionRequired(getGlobalPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodGet, "/policies", api.APISessionRequired(getPolicies))
	api.BaseRoutes.DataRetention.Method(http.MethodGet, "/policies_count", api.APISessionRequired(getPoliciesCount))
	api.BaseRoutes.DataRetention.Method(http.MethodPost, "/policies", api.APISessionRequired(createPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodGet, "/policies/{policy_id:[A-Za-z0-9]+}", api.APISessionRequired(getPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodPatch, "/policies/{policy_id:[A-Za-z0-9]+}", api.APISessionRequired(patchPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodDelete, "/policies/{policy_id:[A-Za-z0-9]+}", api.APISessionRequired(deletePolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodGet, "/policies/{policy_id:[A-Za-z0-9]+}/teams", api.APISessionRequired(getTeamsForPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodPost, "/policies/{policy_id:[A-Za-z0-9]+}/teams", api.APISessionRequired(addTeamsToPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodDelete, "/policies/{policy_id:[A-Za-z0-9]+}/teams", api.APISessionRequired(removeTeamsFromPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodPost, "/policies/{policy_id:[A-Za-z0-9]+}/teams/search", api.APISessionRequired(searchTeamsInPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodGet, "/policies/{policy_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(getChannelsForPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodPost, "/policies/{policy_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(addChannelsToPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodDelete, "/policies/{policy_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(removeChannelsFromPolicy))
	api.BaseRoutes.DataRetention.Method(http.MethodPost, "/policies/{policy_id:[A-Za-z0-9]+}/channels/search", api.APISessionRequired(searchChannelsInPolicy))
	api.BaseRoutes.User.Method(http.MethodGet, "/data_retention/team_policies", api.APISessionRequired(getTeamPoliciesForUser))
	api.BaseRoutes.User.Method(http.MethodGet, "/data_retention/channel_policies", api.APISessionRequired(getChannelPoliciesForUser))
}

func getGlobalPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	// No permission check required.
	policy, appErr := c.App.GetGlobalRetentionPolicy()
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(policy)
	if err != nil {
		c.Err = model.NewAppError("getGlobalPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	page := c.RequireParam("page", web.RequireInt)
	limit := c.RequireParam("per_page", web.RequireInt)
	if c.Err != nil {
		return
	}

	policies, appErr := c.App.GetRetentionPolicies(page.(int)*limit.(int), limit.(int))
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(policies)
	if err != nil {
		c.Err = model.NewAppError("getPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPoliciesCount(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	count, appErr := c.App.GetRetentionPoliciesCount()
	if appErr != nil {
		c.Err = appErr
		return
	}

	body := struct {
		TotalCount int64 `json:"total_count"`
	}{count}
	err := json.NewEncoder(w).Encode(body)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func getPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	policy, appErr := c.App.GetRetentionPolicy(policyId.(string))
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(policy)
	if err != nil {
		c.Err = model.NewAppError("getPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var policy model.RetentionPolicyWithTeamAndChannelIDs
	if jsonErr := json.NewDecoder(r.Body).Decode(&policy); jsonErr != nil {
		c.SetInvalidParamWithErr("policy", jsonErr)
		return
	}
	auditRec := c.MakeAuditRecord(model.AuditEventCreatePolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "policy", &policy)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	newPolicy, appErr := c.App.CreateRetentionPolicy(&policy)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(newPolicy)
	auditRec.AddEventObjectType("policy")
	js, err := json.Marshal(newPolicy)
	if err != nil {
		c.Err = model.NewAppError("createPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var patch model.RetentionPolicyWithTeamAndChannelIDs
	if jsonErr := json.NewDecoder(r.Body).Decode(&patch); jsonErr != nil {
		c.SetInvalidParamWithErr("policy", jsonErr)
		return
	}

	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	patch.ID = policyId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "patch", &patch)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	policy, appErr := c.App.PatchRetentionPolicy(&patch)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(policy)
	auditRec.AddEventObjectType("retention_policy")

	js, err := json.Marshal(policy)
	if err != nil {
		c.Err = model.NewAppError("patchPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "policy_id", policyIdStr)
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	err := c.App.DeleteRetentionPolicy(policyIdStr)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	ReturnStatusOK(w)
}

func getTeamsForPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)

	offset := c.Params["page"].(int) * c.Params["limit"].(int)

	teams, appErr := c.App.GetTeamsForRetentionPolicy(policyIdStr, offset, c.Params["limit"].(int))
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(teams)
	if err != nil {
		c.Err = model.NewAppError("Api4.getTeamsForPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchTeamsInPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	var props model.TeamSearch
	if err := json.NewDecoder(r.Body).Decode(&props); err != nil {
		c.SetInvalidParamWithErr("team_search", err)
		return
	}

	props.PolicyID = model.NewPointer(policyIdStr)
	props.IncludePolicyID = model.NewPointer(true)

	teams, _, appErr := c.App.SearchAllTeams(&props)
	if appErr != nil {
		c.Err = appErr
		return
	}
	c.App.SanitizeTeams(*c.AppContext.Session(), teams)

	js, err := json.Marshal(teams)
	if err != nil {
		c.Err = model.NewAppError("searchTeamsInPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addTeamsToPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)
	teamIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("addTeamsToPolicy", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	auditRec := c.MakeAuditRecord(model.AuditEventAddTeamsToPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "policy_id", policyIdStr)
	model.AddEventParameterToAuditRec(auditRec, "team_ids", teamIDs)
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	appErr := c.App.AddTeamsToRetentionPolicy(policyIdStr, teamIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeTeamsFromPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)
	teamIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("removeTeamsFromPolicy", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	auditRec := c.MakeAuditRecord(model.AuditEventRemoveTeamsFromPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "policy_id", policyIdStr)
	model.AddEventParameterToAuditRec(auditRec, "team_ids", teamIDs)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	appErr := c.App.RemoveTeamsFromRetentionPolicy(policyIdStr, teamIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getChannelsForPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)
	limit := c.Params["per_page"].(int)
	offset := c.Params["page"].(int) * limit

	channels, appErr := c.App.GetChannelsForRetentionPolicy(policyIdStr, offset, limit)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(channels)
	if err != nil {
		c.Err = model.NewAppError("Api4.getChannelsForPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchChannelsInPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)
	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil || props == nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	opts := model.ChannelSearchOpts{
		PolicyID:        policyIdStr,
		IncludePolicyID: true,
		Deleted:         props.Deleted,
		IncludeDeleted:  props.IncludeDeleted,
		Public:          props.Public,
		Private:         props.Private,
		TeamIds:         props.TeamIds,
	}

	channels, _, appErr := c.App.SearchAllChannels(c.AppContext, props.Term, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channelsJSON, jsonErr := json.Marshal(channels)
	if jsonErr != nil {
		c.Err = model.NewAppError("searchChannelsInPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}

	if _, err := w.Write(channelsJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addChannelsToPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)
	channelIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("addChannelsToPolicy", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	auditRec := c.MakeAuditRecord(model.AuditEventAddChannelsToPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "policy_id", policyIdStr)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", channelIDs)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	appErr := c.App.AddChannelsToRetentionPolicy(policyIdStr, channelIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeChannelsFromPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := c.RequireParam("policy_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	policyIdStr := policyId.(string)
	channelIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("removeChannelsFromPolicy", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	auditRec := c.MakeAuditRecord(model.AuditEventRemoveChannelsFromPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "policy_id", policyIdStr)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", channelIDs)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	appErr := c.App.RemoveChannelsFromRetentionPolicy(policyIdStr, channelIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getTeamPoliciesForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)
	limit := c.Params["per_page"].(int)
	offset := c.Params["page"].(int) * limit

	if userIdStr != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	policies, err := c.App.GetTeamPoliciesForUser(userIdStr, offset, limit)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(policies)
	if jsonErr != nil {
		c.Err = model.NewAppError("getTeamPoliciesForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelPoliciesForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)
	limit := c.Params["per_page"].(int)
	offset := c.Params["page"].(int) * limit

	if userIdStr != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	policies, err := c.App.GetChannelPoliciesForUser(userIdStr, offset, limit)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(policies)
	if jsonErr != nil {
		c.Err = model.NewAppError("getChannelPoliciesForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
