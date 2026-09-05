package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/app/lms"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitClasses registers class routes on the LMS router.
func (a *LMSAPI) InitClasses() {
	a.routes.Method(http.MethodPost, "/classes", a.api.APISessionRequired(getClasses))
	a.routes.Method(http.MethodPost, "/classes/create", a.api.APISessionRequired(createClass))
	a.routes.Method(http.MethodGet, "/classes/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getClass))
	a.routes.Method(http.MethodPut, "/classes/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateClass))
	a.routes.Method(http.MethodDelete, "/classes/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteClass))
	a.routes.Method(http.MethodPost, "/classes/{id:[A-Za-z0-9]+}/enroll", a.api.APISessionRequired(enrollStudents))
	a.routes.Method(http.MethodDelete, "/classes/{id:[A-Za-z0-9]+}/students/{student_id:[A-Za-z0-9]+}", a.api.APISessionRequired(unenrollStudent))
}

func getClasses(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	// if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
	// 	c.SetPermissionError(model.PermissionLmsManageClasses)
	// 	return
	// }

	// requesterId := c.AppContext.Session().UserId
	// requestorRoles := c.AppContext.Session().Roles

	var opts modelhelper.ClassFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getClasses", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetClasses(opts)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(utils.ResponseList{
		Items:      items,
		TotalCount: totalCount,
	}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}
	var class *lms_models.Class
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		c.Err = model.NewAppError("createClass", "api.lms.class.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateClass(class)
	if err != nil {
		c.Err = err
		return
	}

	// Provision a private chat channel for the class (teacher + admins).
	// A chat failure never blocks class creation: the class record is already
	// saved, and the channel can be reprovisioned later by re-saving the class.
	if _, chatErr := c.App.LMS().EnsureClassChannel(c.AppContext, created); chatErr != nil {
		c.Logger.Warn("LMS chat: failed to provision class channel",
			mlog.String("class_id", created.ID), mlog.Err(chatErr))
	}

	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	class, err := c.App.LMS().GetClass(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(class); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var class *lms_models.Class
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		c.Err = model.NewAppError("updateClass", "api.lms.class.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	// Capture the prior status so we can detect a transition into a finished
	// state and tear down the class chat channel (per requirement: when a class
	// finishes, its channel is closed and all messages are deleted).
	prior, _ := c.App.LMS().GetClass(id)
	priorStatus := ""
	if prior != nil {
		priorStatus = prior.Status
	}

	updated, err := c.App.LMS().UpdateClass(id, class)
	if err != nil {
		c.Err = err
		return
	}

	// Chat lifecycle. Two cases:
	//  1. Class finished (status → CLOSED/CANCELLED): permanently delete the
	//     channel and all its messages.
	//  2. Otherwise (e.g. teacher changed, reopened): ensure the channel
	//     exists and reconcile membership.
	nowFinished := lms.ClosedClassStatuses[updated.Status]
	wasFinished := lms.ClosedClassStatuses[priorStatus]
	switch {
	case nowFinished && updated.ChatChannelID != "":
		if chatErr := c.App.LMS().CloseClassChannel(c.AppContext, updated); chatErr != nil {
			c.Logger.Warn("LMS chat: failed to close class channel",
				mlog.String("class_id", updated.ID), mlog.Err(chatErr))
		}
	case !nowFinished && !wasFinished:
		// Reconcile channel + membership with the latest class fields. Student
		// user IDs come from current enrollment; student_id stores the user id.
		if chatErr := c.App.LMS().SyncClassChannelMembership(c.AppContext, updated, classStudentUserIDs(c, updated.ID)); chatErr != nil {
			c.Logger.Warn("LMS chat: failed to sync class channel membership",
				mlog.String("class_id", updated.ID), mlog.Err(chatErr))
		}
	}

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	// Close the class chat channel (deletes the channel and all messages)
	// before removing the class record. Deleting the class first would orphan
	// the channel, since chat_channel_id is read off the class row.
	if cls, _ := c.App.LMS().GetClass(id); cls != nil {
		if chatErr := c.App.LMS().CloseClassChannel(c.AppContext, cls); chatErr != nil {
			c.Logger.Warn("LMS chat: failed to close class channel on delete",
				mlog.String("class_id", id), mlog.Err(chatErr))
		}
	}

	if err := c.App.LMS().DeleteClass(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}

func enrollStudents(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var req struct {
		StudentIDs []string `json:"student_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.Err = model.NewAppError("enrollStudents", "api.lms.class.enroll_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.App.LMS().EnrollStudents(id, req.StudentIDs)
	if err != nil {
		c.Err = err
		return
	}

	// Sync chat channel membership so newly enrolled students are added to the
	// class channel (and removed ones are taken out). student_id in
	// student_classes stores the Mattermost user id, so it maps directly to a
	// channel member. A chat failure never blocks enrollment.
	if cls, _ := c.App.LMS().GetClass(id); cls != nil {
		if chatErr := c.App.LMS().SyncClassChannelMembership(c.AppContext, cls, classStudentUserIDs(c, id)); chatErr != nil {
			c.Logger.Warn("LMS chat: failed to sync class channel membership on enroll",
				mlog.String("class_id", id), mlog.Err(chatErr))
		}
	}

	if err := json.NewEncoder(w).Encode(result); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// unenrollStudent removes a student from a class (and, via the chat sync,
// from the class's chat channel). Requires the manage-classes permission so
// admins control membership on both sides.
func unenrollStudent(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	studentID := c.RequireParam("student_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if _, err := c.App.LMS().UnenrollStudent(id, studentID); err != nil {
		c.Err = err
		return
	}

	// Reconcile the class chat channel: the removed student is taken out of
	// the channel (teacher + admins + remaining students stay). A chat
	// failure never blocks the un-enrollment itself.
	if cls, _ := c.App.LMS().GetClass(id); cls != nil {
		if chatErr := c.App.LMS().SyncClassChannelMembership(c.AppContext, cls, classStudentUserIDs(c, id)); chatErr != nil {
			c.Logger.Warn("LMS chat: failed to sync class channel membership on unenroll",
				mlog.String("class_id", id), mlog.Err(chatErr))
		}
	}

	api4.ReturnStatusOK(w)
}

// classStudentUserIDs returns the Mattermost user IDs of every student
// currently enrolled in the class. The student_classes.student_id column
// stores the users.id, so this maps 1:1 to channel member ids.
func classStudentUserIDs(c *api4.Context, classID string) []string {
	enrolled, appErr := c.App.LMS().GetClassStudents(classID)
	if appErr != nil {
		c.Logger.Warn("LMS chat: failed to load class students for chat sync",
			mlog.String("class_id", classID), mlog.Err(appErr))
		return nil
	}
	ids := make([]string, 0, len(enrolled))
	for _, sc := range enrolled {
		if sc != nil && sc.StudentID != "" {
			ids = append(ids, sc.StudentID)
		}
	}
	return ids
}
