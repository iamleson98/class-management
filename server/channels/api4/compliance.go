package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/LumenResearch/uasurfer"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitCompliance() {
	api.BaseRoutes.Compliance.Method(http.MethodPost, "/reports", api.APISessionRequired(createComplianceReport))
	api.BaseRoutes.Compliance.Method(http.MethodGet, "/reports", api.APISessionRequired(getComplianceReports))
	api.BaseRoutes.Compliance.Method(http.MethodGet, "/reports/{report_id:[A-Za-z0-9]+}", api.APISessionRequired(getComplianceReport))
	api.BaseRoutes.Compliance.Method(http.MethodGet, "/reports/{report_id:[A-Za-z0-9]+}/download", api.APISessionRequiredTrustRequester(downloadComplianceReport))
}

func createComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	var job model.Compliance
	if jsonErr := json.NewDecoder(r.Body).Decode(&job); jsonErr != nil {
		c.SetInvalidParamWithErr("compliance", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateComplianceReport, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "compliance", &job)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateComplianceExportJob) {
		c.SetPermissionError(model.PermissionCreateComplianceExportJob)
		return
	}

	job.UserId = c.AppContext.Session().UserId

	rjob, err := c.App.SaveComplianceReport(c.AppContext, &job)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rjob)
	auditRec.AddEventObjectType("compliance")
	auditRec.AddMeta("compliance_id", rjob.Id)
	auditRec.AddMeta("compliance_desc", rjob.Desc)
	c.LogAudit("")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rjob); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getComplianceReports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadComplianceExportJob) {
		c.SetPermissionError(model.PermissionReadComplianceExportJob)
		return
	}

	page := c.RequireParam("page", web.RequireInt)
	perPage := c.RequireParam("per_page", web.RequireInt)
	if c.Err != nil {
		return
	}
	pageInt := page.(int)
	perPageInt := perPage.(int)

	auditRec := c.MakeAuditRecord(model.AuditEventGetComplianceReports, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	crs, err := c.App.GetComplianceReports(pageInt, perPageInt)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if err := json.NewEncoder(w).Encode(crs); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	reportId := c.RequireParam("report_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	reportIdStr := reportId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventGetComplianceReport, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadComplianceExportJob) {
		c.SetPermissionError(model.PermissionReadComplianceExportJob)
		return
	}

	model.AddEventParameterToAuditRec(auditRec, "report_id", reportIdStr)
	job, err := c.App.GetComplianceReport(reportIdStr)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("compliance_id", job.Id)
	auditRec.AddMeta("compliance_desc", job.Desc)

	if err := json.NewEncoder(w).Encode(job); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func downloadComplianceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	reportId := c.RequireParam("report_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	reportIdStr := reportId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDownloadComplianceReport, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "compliance_id", reportIdStr)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionDownloadComplianceExportResult) {
		c.SetPermissionError(model.PermissionDownloadComplianceExportResult)
		return
	}

	job, err := c.App.GetComplianceReport(reportIdStr)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventResultState(job)
	auditRec.AddEventObjectType("compliance")

	reportBytes, err := c.App.GetComplianceFile(job)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("length", len(reportBytes))

	c.LogAudit("downloaded " + job.Desc)

	w.Header().Set("Cache-Control", "max-age=2592000, private")
	w.Header().Set("Content-Length", strconv.Itoa(len(reportBytes)))
	w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer

	// attach extra headers to trigger a download on IE, Edge, and Safari
	ua := uasurfer.Parse(r.UserAgent())

	w.Header().Set("Content-Disposition", "attachment;filename=\""+job.JobName()+".zip\"")

	if ua.Browser.Name == uasurfer.BrowserIE || ua.Browser.Name == uasurfer.BrowserSafari {
		// trim off anything before the final / so we just get the file's name
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	auditRec.Success()

	if _, err := w.Write(reportBytes); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
