package lmsapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// InitPayments registers payment routes on the LMS router.
func (a *LMSAPI) InitPayments() {
	a.routes.Method(http.MethodGet, "/payments", a.api.APISessionRequired(getPayments))
}

func getPayments(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.PaymentFilterOpts{
		FromDate: q.Get("from_date"),
		ToDate:   q.Get("to_date"),
	}
	if v := q.Get("page"); v != "" {
		opts.Page, _ = strconv.Atoi(v)
	}
	if v := q.Get("per_page"); v != "" {
		opts.PerPage, _ = strconv.Atoi(v)
	}
	if q.Get("count_total") == "true" {
		opts.CountTotal = true
	}

	payments, err := c.App.LMS().GetPayments(opts)
	if err != nil {
		c.Err = err
		return
	}

	if payments == nil {
		payments = []*lms_models.Payment{}
	}

	res := utils.ResponseList{Items: payments}
	data, _ := json.Marshal(res)
	w.Write(data)
}
