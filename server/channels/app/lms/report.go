package lms

import (
	"net/http"

	sq "github.com/mattermost/squirrel"

	"github.com/iamleson98/sitename/server/public/model"
)

func (a *LMSApp) GetReport(reportType string) (map[string]any, *model.AppError) {
	data := make(map[string]any)
	data["type"] = reportType

	exec := a.store.GetMasterExecuter()

	switch reportType {
	case "enrollment":
		totalQuery := sq.Select("COUNT(*)").From("StudentClasses").Where(sq.Eq{"Status": "ACTIVE"}).PlaceholderFormat(sq.Dollar)
		queryStr, args, err := totalQuery.ToSql()
		if err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.enrollment_query.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		var total int64
		if err := exec.QueryRow(queryStr, args...).Scan(&total); err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.enrollment.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		data["totalEnrollments"] = total

	case "revenue":
		totalQuery := sq.Select("COALESCE(SUM(Amount), 0)").From("Payments").PlaceholderFormat(sq.Dollar)
		queryStr, args, err := totalQuery.ToSql()
		if err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.revenue_query.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		var total float64
		if err := exec.QueryRow(queryStr, args...).Scan(&total); err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.revenue.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		data["totalRevenue"] = total

	case "attendance":
		presentQuery := sq.Select("COUNT(*)").From("Attendances").Where(sq.Eq{"Status": "PRESENT"}).PlaceholderFormat(sq.Dollar)
		queryStr, args, err := presentQuery.ToSql()
		if err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.attendance_query.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		var present int64
		if err := exec.QueryRow(queryStr, args...).Scan(&present); err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.attendance.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		absentQuery := sq.Select("COUNT(*)").From("Attendances").Where(sq.Eq{"Status": "ABSENT"}).PlaceholderFormat(sq.Dollar)
		queryStr, args, err = absentQuery.ToSql()
		if err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.attendance_query.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		var absent int64
		if err := exec.QueryRow(queryStr, args...).Scan(&absent); err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.attendance.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		data["present"] = present
		data["absent"] = absent

	case "course-progress":
		totalQuery := sq.Select("COUNT(*)").From("Submissions").PlaceholderFormat(sq.Dollar)
		queryStr, args, err := totalQuery.ToSql()
		if err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.course_progress_query.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		var total int64
		if err := exec.QueryRow(queryStr, args...).Scan(&total); err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.course_progress.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		gradedQuery := sq.Select("COUNT(*)").From("Submissions").Where(sq.Eq{"Grade": "GRADED"}).PlaceholderFormat(sq.Dollar)
		queryStr, args, err = gradedQuery.ToSql()
		if err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.course_progress_query.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		var graded int64
		if err := exec.QueryRow(queryStr, args...).Scan(&graded); err != nil {
			return nil, model.NewAppError("GetReport", "app.lms.report.course_progress.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		data["totalSubmissions"] = total
		data["gradedSubmissions"] = graded

	default:
		return nil, model.NewAppError("GetReport", "app.lms.report.invalid_type.app_error", map[string]any{"Type": reportType}, "", http.StatusBadRequest)
	}

	return data, nil
}
