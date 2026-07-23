package lms

import (
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
)

// GetAttendance returns all attendance records for a session.
func (a *LMSApp) GetAttendance(sessionID string) ([]*lms_models.Attendance, *model.AppError) {
	records, err := a.store.Attendance().GetBySession(sessionID)
	if err != nil {
		return nil, model.NewAppError("GetAttendance", "app.lms.attendance.get_by_session.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return records, nil
}

// SaveAttendance deletes all existing attendance for the session, then saves the new records.
func (a *LMSApp) SaveAttendance(sessionID string, records []*lms_models.Attendance) ([]*lms_models.Attendance, *model.AppError) {
	// Delete all existing attendance for this session.
	if err := a.store.Attendance().DeleteBySession(sessionID); err != nil {
		return nil, model.NewAppError("SaveAttendance", "app.lms.attendance.delete_existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var saved []*lms_models.Attendance
	for _, record := range records {
		record.SessionID = sessionID

		s, err := a.store.Attendance().Save(record)
		if err != nil {
			return nil, model.NewAppError("SaveAttendance", "app.lms.attendance.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		saved = append(saved, s)
	}

	return saved, nil
}
