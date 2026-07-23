package web

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/iamleson98/sitename/server/public/model"
)

const (
	PageDefault        = 0
	PerPageDefault     = 60
	PerPageMaximum     = 200
	LogsPerPageDefault = 10000
	LogsPerPageMaximum = 10000
	LimitDefault       = 60
	LimitMaximum       = 200
)

type Params map[string]any

var getChannelMembersForUserRegex = regexp.MustCompile("/api/v4/users/[A-Za-z0-9]{26}/channel_members")

func (c *Context) ParamsFromRequest(r *http.Request) Params {
	query := r.URL.Query()
	params := Params{}
	chiContext := chi.RouteContext(r.Context())

	for idx, key := range chiContext.URLParams.Keys {
		value := chiContext.URLParams.Values[idx]
		if value != "" && key != "" && key != "*" {

			switch key {
			case "team_name", "channel_name":
				params[key] = strings.ToLower(value)
				continue
			case "syncable_type":
				switch value {
				case "teams":
					params[key] = model.GroupSyncableTypeTeam
				case "channels":
					params[key] = model.GroupSyncableTypeChannel
				}
				continue
			case "timestamp":
				if val, err := strconv.ParseInt(value, 10, 64); err != nil || val < 0 {
					params["timestamp"] = 0
				} else {
					params["timestamp"] = int(val)
				}
				continue
			}

			params[key] = value
		}
	}

	for key, values := range query {
		if key != "" && len(values) > 0 && values[0] != "" {
			params[key] = values[0]
		}
	}

	// params["filename"] = query.Get("filename")
	// params["in_channel"] = query.Get("in_channel")
	// params["not_in_channel"] = query.Get("not_in_channel")
	// params["topic"] = query.Get("topic")
	// params["creator_id"] = query.Get("creator_id")
	// params["scope"] = query.Get("scope")
	// params["group_ids"] = query.Get("group_ids")
	// params["filter_has_member"] = query.Get("filter_has_member")
	// params["not_associated_to_group"] = query.Get("not_associated_to_group")
	// params["not_associated_to_team"] = query.Get("not_associated_to_team")
	// params["not_associated_to_channel"] = query.Get("not_associated_to_channel")
	// params["include_channel_member_count"] = query.Get("include_channel_member_count")
	// params["q"] = query.Get("q")
	// params["time_range"] = query.Get("time_range")
	// params["scope"] = query.Get("scope")

	params["only_confirmed"], _ = strconv.ParseBool(query.Get("only_confirmed"))
	params["only_plugins"], _ = strconv.ParseBool(query.Get("only_plugins"))
	params["include_unconfirmed"], _ = strconv.ParseBool(query.Get("include_unconfirmed"))
	params["exclude_confirmed"], _ = strconv.ParseBool(query.Get("exclude_confirmed"))
	params["exclude_plugins"], _ = strconv.ParseBool(query.Get("exclude_plugins"))
	params["exclude_home"], _ = strconv.ParseBool(query.Get("exclude_home"))
	params["exclude_remote"], _ = strconv.ParseBool(query.Get("exclude_remote"))
	params["exclude_offline"], _ = strconv.ParseBool(query.Get("exclude_offline"))
	params["exclude_policy_constrained"], _ = strconv.ParseBool(query.Get("exclude_policy_constrained"))
	params["access_control_policy_enforced"], _ = strconv.ParseBool(query.Get("access_control_policy_enforced"))
	params["exclude_access_control_policy_enforced"], _ = strconv.ParseBool(query.Get("exclude_access_control_policy_enforced"))
	params["include_member_count"], _ = strconv.ParseBool(query.Get("include_member_count"))
	params["include_member_ids"], _ = strconv.ParseBool(query.Get("include_member_ids"))
	params["exclude_default_channels"], _ = strconv.ParseBool(query.Get("exclude_default_channels"))
	params["include_total_count"], _ = strconv.ParseBool(query.Get("include_total_count"))
	params["include_deleted"], _ = strconv.ParseBool(query.Get("include_deleted"))
	params["filter_allow_reference"], _ = strconv.ParseBool(query.Get("filter_allow_reference"))
	params["filter_archived"], _ = strconv.ParseBool(query.Get("filter_archived"))
	params["filter_parent_team_permitted"], _ = strconv.ParseBool(query.Get("filter_parent_team_permitted"))
	params["permanent"], _ = strconv.ParseBool(query.Get("permanent"))
	params["custom_only"], _ = strconv.ParseBool(query.Get("custom_only"))
	params["exclude_deprecated"], _ = strconv.ParseBool(query.Get("exclude_deprecated"))

	if val, err := strconv.ParseBool(query.Get("is_configured")); err == nil {
		params["is_configured"] = val
	}
	if val, err := strconv.ParseBool(query.Get("is_linked")); err == nil {
		params["is_linked"] = val
	}

	if val, err := strconv.ParseBool(query.Get("paginate")); err == nil {
		params["paginate"] = val
	}

	if val, err := strconv.ParseInt(query.Get("bookmarks_since"), 10, 64); err != nil || val < 0 {
		params["bookmarks_since"] = 0
	} else {
		params["bookmarks_since"] = int(val)
	}
	if val := query.Get("group_source"); val != "" {
		switch val {
		case "custom":
			params["group_source"] = model.GroupSourceCustom
		default:
			params["group_source"] = model.GroupSourceLdap
		}
	}

	if val, err := strconv.Atoi(query.Get("limit_before")); err != nil || val < 0 {
		params["limit_before"] = LimitDefault
	} else if val > LimitMaximum {
		params["limit_before"] = LimitMaximum
	} else {
		params["limit_before"] = val
	}

	if val, err := strconv.Atoi(query.Get("limit_after")); err != nil || val < 0 {
		params["limit_after"] = LimitDefault
	} else if val > LimitMaximum {
		params["limit_after"] = LimitMaximum
	} else {
		params["limit_after"] = val
	}

	if val, err := strconv.Atoi(query.Get("logs_per_page")); err != nil || val < 0 {
		params["logs_per_page"] = LogsPerPageDefault
	} else if val > LogsPerPageMaximum {
		params["logs_per_page"] = LogsPerPageMaximum
	} else {
		params["logs_per_page"] = val
	}

	val, err := strconv.Atoi(query.Get("per_page"))
	if err != nil || val < 0 {
		params["per_page"] = PerPageDefault
	} else if val > PerPageMaximum {
		params["per_page"] = PerPageMaximum
	} else {
		params["per_page"] = val
	}

	if val, err := strconv.Atoi(query.Get("page")); err != nil || (val < 0 && (params["user_id"] == "" || params["user_id"] == nil) && !getChannelMembersForUserRegex.MatchString(r.URL.Path)) {
		// We don't want to apply this logic for the getChannelMembersForUser API handler
		// because that API allows page=-1 to switch to streaming mode.
		params["page"] = PageDefault
	} else {
		params["page"] = val
	}

	if value, ok := params["channel_id"]; !ok || value == "" || value == nil {
		params["channel_id"] = query.Get("channel_id")
	}
	if value, ok := params["plugin_id"]; !ok || value == "" || value == nil {
		params["plugin_id"] = query.Get("plugin_id")
	}

	return params
}
