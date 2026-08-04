package lms

import (
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
)

// DashboardStats holds aggregated statistics for the LMS dashboard.
type DashboardStats struct {
	TotalStudents          *int    `json:"total_students,omitempty"`
	TotalTeachers          *int    `json:"total_teachers,omitempty"`
	TotalClasses           *int    `json:"total_classes,omitempty"`
	TotalCourses           *int    `json:"total_courses,omitempty"`
	TotalLeads             *int    `json:"total_leads,omitempty"`
	TotalRevenue           *string `json:"total_revenue,omitempty"`
	TotalNewLeadsThisMonth *int    `json:"total_new_leads_this_month,omitempty"`
	TotalChildren          *int    `json:"total_children,omitempty"`
	TotalUpcomingSessions  *int    `json:"total_upcoming_sessions,omitempty"`
}

// GetDashboard returns role-based dashboard statistics for the given user.
func (a *LMSApp) GetDashboard(role string, userID string) (*DashboardStats, *model.AppError) {
	switch role {
	case model.RoleLmsSuperAdminRoleId, model.RoleLmsAdminRoleId:
		return a.getAdminDashboard()
	case model.RoleLmsTeacherRoleId:
		return a.getTeacherDashboard(userID)
	case model.RoleLmsParentRoleId:
		return a.getParentDashboard(userID)
	case model.RoleLmsStudentRoleId:
		return a.getStudentDashboard(userID)
	case model.RoleLmsCounselorRoleId:
		return a.getCounselorDashboard(userID)
	default:
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.invalid_role.app_error", map[string]any{"Role": role}, "", http.StatusBadRequest)
	}
}

func (a *LMSApp) getAdminDashboard() (*DashboardStats, *model.AppError) {
	res := &DashboardStats{}

	totalStudents, err := a.store.Dashboard().CountStudents()
	if err != nil {
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.total_students.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalStudents = new(int(totalStudents))

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
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.active_classes.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalClasses = new(int(activeClasses))

	newLeads, err := a.store.Lead().CountNewThisMonth("")
	if err != nil {
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.new_leads.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalNewLeadsThisMonth = new(int(newLeads))

	return res, nil
}

func (a *LMSApp) getCounselorDashboard(id string) (*DashboardStats, *model.AppError) {
	res := &DashboardStats{}

	newLeads, err := a.store.Lead().CountNewThisMonth(id)
	if err != nil {
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.new_leads.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalNewLeadsThisMonth = new(int(newLeads))

	return res, nil
}

func (a *LMSApp) getTeacherDashboard(userID string) (*DashboardStats, *model.AppError) {
	res := &DashboardStats{}

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
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.my_classes.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalClasses = new(int(myClasses))

	return res, nil
}

func (a *LMSApp) getParentDashboard(userID string) (*DashboardStats, *model.AppError) {
	res := &DashboardStats{}

	children, err := a.store.Dashboard().GetChildrenByParentID(userID)
	if err != nil {
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.child_info.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalChildren = new(len(children))

	return res, nil
}

func (a *LMSApp) getStudentDashboard(userID string) (*DashboardStats, *model.AppError) {
	res := &DashboardStats{}

	myClasses, err := a.store.StudentClass().CountByStudent(userID, "ACTIVE")
	if err != nil {
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.student_classes.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalClasses = new(int(myClasses))

	upcomingSessions, err := a.store.LMSSession().CountUpcomingByStudent(userID)
	if err != nil {
		return nil, model.NewAppError("GetDashboard", "app.lms.dashboard.upcoming_sessions.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	res.TotalUpcomingSessions = new(int(upcomingSessions))

	return res, nil
}
