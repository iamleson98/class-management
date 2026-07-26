package lms

import (
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// DashboardStats holds aggregated statistics for the LMS dashboard.
type DashboardStats struct {
	TotalStudents int64  `json:"total_students"`
	TotalTeachers int64  `json:"total_teachers"`
	TotalClasses  int64  `json:"total_classes"`
	TotalCourses  int64  `json:"total_courses"`
	TotalLeads    int64  `json:"total_leads"`
	TotalRevenue  string `json:"total_revenue"`
}

func (a *LMSApp) GetDashboardStats() (*DashboardStats, *model.AppError) {
	stats := &DashboardStats{}

	_, totalCount, err := a.store.Class().Search(modelhelper.ClassFilterOpts{SearchOpts: utils.SearchOpts[utils.ClassColumn]{CountTotal: true}})
	if err != nil {
		return nil, model.NewAppError("GetDashboardStats", "app.lms.dashboard.get_classes.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	stats.TotalClasses = totalCount

	courses, err := a.store.Course().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetDashboardStats", "app.lms.dashboard.get_courses.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	stats.TotalCourses = int64(len(courses))

	_, leadCount, err := a.store.Lead().Search(modelhelper.LeadFilterOpts{SearchOpts: utils.SearchOpts[utils.LeadColumn]{CountTotal: true}})
	if err != nil {
		return nil, model.NewAppError("GetDashboardStats", "app.lms.dashboard.get_leads.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	stats.TotalLeads = leadCount

	return stats, nil
}

// GetDashboard returns role-based dashboard statistics for the given user.
func (a *LMSApp) GetDashboard(role string, userID string) (map[string]any, *model.AppError) {
	data := make(map[string]any)

	switch role {
	case "ADMIN", "SUPER_ADMIN":
		if err := a.getAdminDashboard(data); err != nil {
			return nil, err
		}
	case "TEACHER":
		if err := a.getTeacherDashboard(userID, data); err != nil {
			return nil, err
		}
	case "PARENT":
		if err := a.getParentDashboard(userID, data); err != nil {
			return nil, err
		}
	case "STUDENT":
		if err := a.getStudentDashboard(userID, data); err != nil {
			return nil, err
		}
	default:
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.invalid_role.app_error", map[string]any{"Role": role}, "", http.StatusBadRequest)
	}

	return data, nil
}

func (a *LMSApp) getAdminDashboard(data map[string]any) *model.AppError {
	totalStudents, err := a.store.Dashboard().CountStudents()
	if err != nil {
		return model.NewAppError("GetDashboard", "app.lms.dashboard.total_students.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	data["totalStudents"] = totalStudents

	_, activeClasses, err := a.store.Class().Search(
		modelhelper.ClassFilterOpts{
			SearchOpts: utils.SearchOpts[utils.ClassColumn]{
				CountTotal: true,
				WhereAnds: utils.WhereAnds[utils.ClassColumn]{
					{Column: utils.ClassStatus, Operator: utils.OperatorEq, Value: modelhelper.ClassStatusOpen},
				},
			},
		})
	if err != nil {
		return model.NewAppError("GetDashboard", "app.lms.dashboard.active_classes.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	data["activeClasses"] = activeClasses

	newLeads, err := a.store.Lead().CountNewThisMonth()
	if err != nil {
		return model.NewAppError("GetDashboard", "app.lms.dashboard.new_leads.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	data["newLeadsThisMonth"] = newLeads

	return nil
}

func (a *LMSApp) getTeacherDashboard(userID string, data map[string]any) *model.AppError {
	_, myClasses, err := a.store.Class().Search(
		modelhelper.ClassFilterOpts{
			SearchOpts: utils.SearchOpts[utils.ClassColumn]{
				CountTotal: true,
				WhereAnds: utils.WhereAnds[utils.ClassColumn]{
					{Column: utils.ClassTeacherID, Operator: utils.OperatorEq, Value: userID},
				},
			},
		},
	)
	if err != nil {
		return model.NewAppError("GetDashboard", "app.lms.dashboard.my_classes.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	data["myClasses"] = myClasses

	return nil
}

func (a *LMSApp) getParentDashboard(userID string, data map[string]any) *model.AppError {
	children, err := a.store.Dashboard().GetChildrenByParentID(userID)
	if err != nil {
		return model.NewAppError("GetDashboard", "app.lms.dashboard.child_info.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	data["children"] = children

	return nil
}

func (a *LMSApp) getStudentDashboard(userID string, data map[string]any) *model.AppError {
	myClasses, err := a.store.StudentClass().CountByStudent(userID, "ACTIVE")
	if err != nil {
		return model.NewAppError("GetDashboard", "app.lms.dashboard.student_classes.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	data["myClasses"] = myClasses

	upcomingSessions, err := a.store.LMSSession().CountUpcomingByStudent(userID)
	if err != nil {
		return model.NewAppError("GetDashboard", "app.lms.dashboard.upcoming_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	data["upcomingSessions"] = upcomingSessions

	return nil
}

// Ensure store.ErrNotFound is used for error matching.
var _ error = (*store.ErrNotFound)(nil)
