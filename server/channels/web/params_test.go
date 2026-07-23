package web

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
)

func TestParamsFromRequest(t *testing.T) {
	testCases := []struct {
		Description string
		URL         *url.URL
		Vars        map[string]string
		Params      Params
	}{
		{
			"empty params",
			mustURL("/"),
			nil,
			Params{
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"query params",
			mustURL("/page?" +
				"channel_id=abc123&" +
				"filename=file.ext&" +
				"page=42&" +
				"time_range=then-till-now&" +
				"permanent=1&" +
				"logs_per_page=5&" +
				"limit_after=6&" +
				"limit_before=7&" +
				"q=picard&" +
				"is_linked=t&" +
				"is_configured=TRUE&" +
				"not_associated_to_team=this_team&" +
				"not_associated_to_channel=this_channel&" +
				"filter_allow_reference=true&" +
				"filter_parent_team_permitted=True&" +
				"paginate=T&" +
				"include_member_count=1&" +
				"not_associated_to_group=test&" +
				"exclude_default_channels=1&" +
				"group_ids=hello,world&" +
				"include_total_count=T&" +
				"include_deleted=True&" +
				"exclude_policy_constrained=TRUE&" +
				"filter_has_member=xyz"),
			nil,
			Params{
				"channel_id":                   "abc123",
				"filename":                     "file.ext",
				"page":                         42,
				"time_range":                   "then-till-now",
				"per_page":                     PerPageDefault,
				"permanent":                    true,
				"logs_per_page":                5,
				"limit_after":                  6,
				"limit_before":                 7,
				"q":                            "picard",
				"is_linked":                    boolPtr(true),
				"is_configured":                boolPtr(true),
				"not_associated_to_team":       "this_team",
				"not_associated_to_channel":    "this_channel",
				"filter_allow_reference":       true,
				"filter_parent_team_permitted": true,
				"paginate":                     boolPtr(true),
				"include_member_count":         true,
				"not_associated_to_group":      "test",
				"exclude_default_channels":     true,
				"group_ids":                    "hello,world",
				"include_total_count":          true,
				"include_deleted":              true,
				"exclude_policy_constrained":   true,
				"filter_has_member":            "xyz",
			},
		},
		{
			"page invalid",
			mustURL("?page=hello"),
			nil,
			Params{
				"page":          PageDefault,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"page negative",
			mustURL("?page=-1"),
			nil,
			Params{
				"page":          PageDefault,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"per page valid",
			mustURL("?per_page=123"),
			nil,
			Params{
				"per_page":      123,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"per page too small",
			mustURL("?per_page=-100"),
			nil,
			Params{
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"per page too big",
			mustURL("?per_page=100000"),
			nil,
			Params{
				"per_page":      PerPageMaximum,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"logs per page valid",
			mustURL("?logs_per_page=512"),
			nil,
			Params{
				"logs_per_page": 512,
				"per_page":      PerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"logs per page invalid",
			mustURL("?logs_per_page=logs"),
			nil,
			Params{
				"logs_per_page": LogsPerPageDefault,
				"per_page":      PerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"logs per page too small",
			mustURL("?logs_per_page=-512"),
			nil,
			Params{
				"logs_per_page": LogsPerPageDefault,
				"per_page":      PerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"logs per page too big",
			mustURL("?logs_per_page=99999999"),
			nil,
			Params{
				"logs_per_page": LogsPerPageMaximum,
				"per_page":      PerPageDefault,
				"limit_after":   LimitDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"limit before valid",
			mustURL("?limit_before=100"),
			nil,
			Params{
				"limit_before":  100,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"limit before invalid",
			mustURL("?limit_before=limit"),
			nil,
			Params{
				"limit_before":  LimitDefault,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"limit before too small",
			mustURL("?limit_before=-100"),
			nil,
			Params{
				"limit_before":  LimitDefault,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"limit before too big",
			mustURL("?limit_before=99999"),
			nil,
			Params{
				"limit_before":  LimitMaximum,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"limit after valid",
			mustURL("?limit_after=100"),
			nil,
			Params{
				"limit_after":   100,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"limit after invalid",
			mustURL("?limit_after=limit"),
			nil,
			Params{
				"limit_after":   LimitDefault,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"limit after too small",
			mustURL("?limit_aftere=-100"),
			nil,
			Params{
				"limit_after":   LimitDefault,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"limit after too big",
			mustURL("?limit_after=99999"),
			nil,
			Params{
				"limit_after":   LimitMaximum,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
			},
		},
		{
			"group source custom",
			mustURL("?group_source=custom"),
			nil,
			Params{
				"group_source":  model.GroupSourceCustom,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"group source LDAP",
			mustURL("?group_source=ldap"),
			nil,
			Params{
				"group_source":  model.GroupSourceLdap,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"group source other",
			mustURL("?group_source=aabbcc"),
			nil,
			Params{
				"group_source":  model.GroupSourceLdap,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"group source empty",
			mustURL("?group_souce="),
			nil,
			Params{
				"group_source":  "",
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"timestamp valid",
			mustURL("/"),
			map[string]string{
				"timestamp": "1234567",
			},
			Params{
				"timestamp":     int64(1234567),
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"timestamp valid",
			mustURL("/"),
			map[string]string{
				"timestamp": "yes",
			},
			Params{
				"timestamp":     int64(0),
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"timestamp too small",
			mustURL("/"),
			map[string]string{
				"timestamp": "-1234567",
			},
			Params{
				"timestamp":     int64(0),
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"syncable type teams",
			mustURL("/"),
			map[string]string{
				"syncable_type": "teams",
			},
			Params{
				"syncable_type": model.GroupSyncableTypeTeam,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"syncable type channels",
			mustURL("/"),
			map[string]string{
				"syncable_type": "channels",
			},
			Params{
				"syncable_type": model.GroupSyncableTypeChannel,
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"syncable type other",
			mustURL("/"),
			map[string]string{
				"syncable_type": "unknownvalue",
			},
			Params{
				"syncable_type": "",
				"per_page":      PerPageDefault,
				"logs_per_page": LogsPerPageDefault,
				"limit_before":  LimitDefault,
				"limit_after":   LimitDefault,
			},
		},
		{
			"include channel bookmarks",
			mustURL("/?include_bookmarks=true"),
			nil,
			Params{
				"bookmarks_since": int64(0),
				"limit_after":     LimitDefault,
				"per_page":        PerPageDefault,
				"logs_per_page":   LogsPerPageDefault,
				"limit_before":    LimitDefault,
			},
		},
		{
			"include channel bookmarks with negative bookmark since",
			mustURL("/?include_bookmarks=true&bookmarks_since=-1"),
			nil,
			Params{
				"bookmarks_since": int64(0),
				"limit_after":     LimitDefault,
				"per_page":        PerPageDefault,
				"logs_per_page":   LogsPerPageDefault,
				"limit_before":    LimitDefault,
			},
		},
		{
			"include channel bookmarks with bookmark since",
			mustURL("/?include_bookmarks=true&bookmarks_since=123456789"),
			nil,
			Params{
				"bookmarks_since": int64(123456789),
				"limit_after":     LimitDefault,
				"per_page":        PerPageDefault,
				"logs_per_page":   LogsPerPageDefault,
				"limit_before":    LimitDefault,
			},
		},
	}

	var c Context

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()

			r := &http.Request{URL: testCase.URL}
			r = mux.SetURLVars(r, testCase.Vars)
			params := c.ParamsFromRequest(r)
			require.Equal(t, testCase.Params, params)
		})
	}
}

func mustURL(u string) *url.URL {
	parsed, err := url.Parse(u)
	if err != nil {
		panic(err)
	}
	return parsed
}

func boolPtr(b bool) *bool {
	return &b
}
