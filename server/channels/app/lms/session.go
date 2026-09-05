package lms

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// maxRepeatOccurrences caps the weekly expansion (2 years of weekly lessons)
// so a runaway repeat_until can never insert thousands of rows.
const maxRepeatOccurrences = 104

// SessionConflict describes one teacher-schedule overlap blocking (or
// warning about) a session create/update. Serialized snake_case for the
// 409 response body.
type SessionConflict struct {
	Date        string `json:"date"` // "YYYY-MM-DD" of the conflicting session
	StartTimeMs int64  `json:"start_time"`
	EndTimeMs   int64  `json:"end_time"`
	ClassID     string `json:"class_id"`
	ClassName   string `json:"class_name"`
	TeacherID   string `json:"teacher_id"`
	TeacherName string `json:"teacher_name"`
}

func (a *LMSApp) GetSession(id string) (*lms_models.LMSSession, *model.AppError) {
	session, err := a.store.LMSSession().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSession", "app.lms.session.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSession", "app.lms.session.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return session, nil
}

func (a *LMSApp) GetSessions(opts modelhelper.SessionFilterOpts) ([]*lms_models.LMSSession, int64, *model.AppError) {
	sessions, totalCount, err := a.store.LMSSession().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetSessions", "app.lms.session.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return sessions, totalCount, nil
}

// CreateSession creates a single session (no repeat, no conflict check).
// Retained for callers that only need one row; the API path uses
// CreateSessionsWithRepeat.
func (a *LMSApp) CreateSession(session *lms_models.LMSSession) (*lms_models.LMSSession, *model.AppError) {
	saved, err := a.store.LMSSession().Save(session)
	if err != nil {
		return nil, model.NewAppError("CreateSession", "app.lms.session.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

// CreateSessionsWithRepeat creates one session, or — when repeatUntil is a
// non-empty "YYYY-MM-DD" — a weekly series on the same weekday with the same
// start/end times, from the session's date up to and including repeatUntil.
//
// Every occurrence (single included) is checked against the teacher's
// existing non-cancelled sessions. When overlaps exist and force is false,
// the conflicts are returned and NOTHING is created (the API answers 409 so
// the admin can review them and resubmit with force). With force=true the
// series is created as requested despite the overlaps.
func (a *LMSApp) CreateSessionsWithRepeat(session *lms_models.LMSSession, repeatUntil string, force bool) ([]*lms_models.LMSSession, []*SessionConflict, *model.AppError) {
	if session == nil {
		return nil, nil, model.NewAppError("CreateSessionsWithRepeat", "api.lms.session.create_body.app_error", nil, "missing session", http.StatusBadRequest)
	}
	if session.ClassID == "" || session.TeacherID == "" || time.Time(session.Date).IsZero() {
		return nil, nil, model.NewAppError("CreateSessionsWithRepeat", "model.lms.session.class_id.app_error", nil, "class_id, teacher_id and date are required", http.StatusBadRequest)
	}
	if session.EndTime <= session.StartTime {
		return nil, nil, model.NewAppError("CreateSessionsWithRepeat", "app.lms.session.time_order.app_error", nil, "", http.StatusBadRequest)
	}

	occurrences, appErr := expandWeeklyOccurrences(session, repeatUntil)
	if appErr != nil {
		return nil, nil, appErr
	}

	// With force the schedule check is skipped entirely: the admin already
	// reviewed the conflicts and chose to proceed.
	if !force {
		// One span query for the whole series, then overlap checks in memory.
		conflicts, appErr := a.checkOccurrenceConflicts(session.TeacherID, occurrences, "")
		if appErr != nil {
			return nil, nil, appErr
		}
		if len(conflicts) > 0 {
			return nil, conflicts, nil
		}
	}

	created := make([]*lms_models.LMSSession, 0, len(occurrences))
	for _, occ := range occurrences {
		saved, err := a.store.LMSSession().Save(occ)
		if err != nil {
			return nil, nil, model.NewAppError("CreateSessionsWithRepeat", "app.lms.session.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		created = append(created, saved)
	}
	return created, nil, nil
}

// expandWeeklyOccurrences returns the session rows to insert: just the base
// session when repeatUntil is empty, otherwise base + weekly clones until
// (inclusive) repeatUntil, capped at maxRepeatOccurrences.
func expandWeeklyOccurrences(session *lms_models.LMSSession, repeatUntil string) ([]*lms_models.LMSSession, *model.AppError) {
	if repeatUntil == "" {
		return []*lms_models.LMSSession{session}, nil
	}

	until, err := time.Parse("2006-01-02", repeatUntil)
	if err != nil {
		return nil, model.NewAppError("CreateSessionsWithRepeat", "app.lms.session.repeat_until.app_error", nil, "", http.StatusBadRequest)
	}

	baseDate := time.Time(session.Date).UTC()
	untilDate := time.Date(until.Year(), until.Month(), until.Day(), 0, 0, 0, 0, time.UTC)
	if untilDate.Before(baseDate) {
		return nil, model.NewAppError("CreateSessionsWithRepeat", "app.lms.session.repeat_until_before.app_error", nil, "", http.StatusBadRequest)
	}

	weeks := int(untilDate.Sub(baseDate).Hours()/24/7) + 1
	if weeks > maxRepeatOccurrences {
		return nil, model.NewAppError("CreateSessionsWithRepeat", "app.lms.session.repeat_too_many.app_error",
			map[string]any{"Max": maxRepeatOccurrences}, "", http.StatusBadRequest)
	}

	occurrences := make([]*lms_models.LMSSession, 0, weeks)
	for k := 0; k < weeks; k++ {
		if k == 0 {
			occurrences = append(occurrences, session)
			continue
		}
		occ := *session // shallow copy: value fields copied, fresh row below
		occ.ID = ""
		occ.Date = utils.VnTime(baseDate.AddDate(0, 0, 7*k))
		occ.StartTime = session.StartTime + int64(k)*7*24*3600*1000
		occ.EndTime = session.EndTime + int64(k)*7*24*3600*1000
		occ.Createat = 0
		occ.Updateat = 0
		occurrences = append(occurrences, &occ)
	}
	return occurrences, nil
}

// checkOccurrenceConflicts loads the teacher's sessions overlapping the whole
// occurrence span in one query and reports per-occurrence overlaps with
// display names filled in.
func (a *LMSApp) checkOccurrenceConflicts(teacherID string, occurrences []*lms_models.LMSSession, excludeSessionID string) ([]*SessionConflict, *model.AppError) {
	if teacherID == "" || len(occurrences) == 0 {
		return nil, nil
	}

	minStart, maxEnd := occurrences[0].StartTime, occurrences[0].EndTime
	for _, occ := range occurrences {
		if occ.StartTime < minStart {
			minStart = occ.StartTime
		}
		if occ.EndTime > maxEnd {
			maxEnd = occ.EndTime
		}
	}

	overlapRows, err := a.store.LMSSession().FindTeacherConflicts(teacherID, minStart, maxEnd, excludeSessionID)
	if err != nil {
		return nil, model.NewAppError("CreateSessionsWithRepeat", "app.lms.session.conflict_check.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(overlapRows) == 0 {
		return nil, nil
	}

	teacherName := a.teacherDisplayName(teacherID)
	classNames := a.classNamesForSessions(overlapRows)

	conflicts := make([]*SessionConflict, 0, len(overlapRows))
	for _, existing := range overlapRows {
		for _, occ := range occurrences {
			if occ.StartTime < existing.EndTime && occ.EndTime > existing.StartTime {
				conflicts = append(conflicts, &SessionConflict{
					Date:        time.Time(existing.Date).UTC().Format("2006-01-02"),
					StartTimeMs: existing.StartTime,
					EndTimeMs:   existing.EndTime,
					ClassID:     existing.ClassID,
					ClassName:   classNames[existing.ClassID],
					TeacherID:   teacherID,
					TeacherName: teacherName,
				})
				break // one report row per conflicting existing session
			}
		}
	}
	return conflicts, nil
}

// teacherDisplayName resolves a user id to a full name (cached per call by
// the caller; single teacher per create/update).
func (a *LMSApp) teacherDisplayName(teacherID string) string {
	user, err := a.store.User().Get(context.Background(), teacherID)
	if err != nil || user == nil {
		return ""
	}
	if name := user.GetFullName(); name != "" {
		return name
	}
	return user.Username
}

// classNamesForSessions batches class-name lookups for conflict display.
func (a *LMSApp) classNamesForSessions(sessions []*lms_models.LMSSession) map[string]string {
	names := make(map[string]string)
	for _, s := range sessions {
		if s.ClassID == "" {
			continue
		}
		if _, ok := names[s.ClassID]; ok {
			continue
		}
		if class, err := a.store.Class().Get(s.ClassID); err == nil && class != nil {
			names[s.ClassID] = class.Name
		} else {
			names[s.ClassID] = ""
		}
	}
	return names
}

// UpdateSession updates a session. Unless force is set, the new time slot is
// checked against the teacher's other sessions (the session itself excluded);
// overlaps are returned as conflicts without saving (API answers 409).
func (a *LMSApp) UpdateSession(id string, session *lms_models.LMSSession, force bool) (*lms_models.LMSSession, []*SessionConflict, *model.AppError) {
	if session == nil {
		return nil, nil, model.NewAppError("UpdateSession", "api.lms.session.update_body.app_error", nil, "missing session", http.StatusBadRequest)
	}
	session.ID = id

	if session.EndTime != 0 && session.StartTime != 0 && session.EndTime <= session.StartTime {
		return nil, nil, model.NewAppError("UpdateSession", "app.lms.session.time_order.app_error", nil, "", http.StatusBadRequest)
	}

	if !force && session.TeacherID != "" && session.StartTime != 0 && session.EndTime != 0 {
		conflicts, appErr := a.checkOccurrenceConflicts(session.TeacherID, []*lms_models.LMSSession{session}, id)
		if appErr != nil {
			return nil, nil, appErr
		}
		if len(conflicts) > 0 {
			return nil, conflicts, nil
		}
	}

	// The admin form has no lesson picker and never sends lesson_id; a
	// full-row update with "" would silently clear an existing link.
	// Carry the stored value over when the request leaves it empty.
	if session.LessonID == "" {
		if existing, err := a.store.LMSSession().Get(id); err == nil && existing != nil {
			session.LessonID = existing.LessonID
		}
	}

	updated, err := a.store.LMSSession().Update(session)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, nil, model.NewAppError("UpdateSession", "app.lms.session.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, nil, model.NewAppError("UpdateSession", "app.lms.session.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil, nil
}

func (a *LMSApp) DeleteSession(id string) *model.AppError {
	err := a.store.LMSSession().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteSession", "app.lms.session.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteSession", "app.lms.session.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}

// SessionConflictSummary builds a short human-readable summary of the
// conflicts for error messages/logs.
func SessionConflictSummary(conflicts []*SessionConflict) string {
	if len(conflicts) == 0 {
		return ""
	}
	const maxShown = 3
	out := ""
	for i, cf := range conflicts {
		if i == maxShown {
			out += fmt.Sprintf(" (+%d nữa)", len(conflicts)-maxShown)
			break
		}
		if i > 0 {
			out += "; "
		}
		name := cf.ClassName
		if name == "" {
			name = cf.ClassID
		}
		out += fmt.Sprintf("%s %s", cf.Date, name)
	}
	return out
}
