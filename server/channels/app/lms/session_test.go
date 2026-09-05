package lms

import (
	"net/http"
	"testing"
	"time"

	"github.com/aarondl/null/v8"
	"github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/iamleson98/sitename/server/v8/channels/store/storetest/mocks"
	"github.com/iamleson98/sitename/server/v8/einterfaces"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// testStore embeds the (nil) store.Store interface so only the methods the
// test overrides are callable — everything else would panic, keeping these
// unit tests strictly about the app-layer logic.
type testStore struct {
	store.Store
	sessions *mocks.LMSSessionStore
	classes  *mocks.ClassStore
	users    *mocks.UserStore
}

func (s *testStore) LMSSession() store.LMSSessionStore { return s.sessions }
func (s *testStore) Class() store.ClassStore           { return s.classes }
func (s *testStore) User() store.UserStore             { return s.users }

func newTestApp() (*LMSApp, *mocks.LMSSessionStore, *mocks.ClassStore, *mocks.UserStore) {
	sessions := &mocks.LMSSessionStore{}
	classes := &mocks.ClassStore{}
	users := &mocks.UserStore{}
	ts := &testStore{sessions: sessions, classes: classes, users: users}
	return NewLMSApp(ts, nil), sessions, classes, users
}

func baseSession() *lms_models.LMSSession {
	return &lms_models.LMSSession{
		ClassID:   "class123456789012345678",
		TeacherID: "teach123456789012345678",
		Date:      utils.VnTime(time.Date(2026, 9, 7, 0, 0, 0, 0, time.UTC)), // Monday
		StartTime: time.Date(2026, 9, 7, 1, 0, 0, 0, time.UTC).UnixMilli(),   // 08:00 ICT
		EndTime:   time.Date(2026, 9, 7, 2, 30, 0, 0, time.UTC).UnixMilli(),  // 09:30 ICT
		Title:     null.StringFrom("Buổi 1"),
		Status:    "SCHEDULED",
	}
}

func TestCreateSessionsWithRepeat_Single(t *testing.T) {
	app, sessions, _, _ := newTestApp()

	sessions.On("FindTeacherConflicts", "teach123456789012345678", mock.Anything, mock.Anything, "").
		Return([]*lms_models.LMSSession{}, nil)
	sessions.EXPECT().Save(mock.Anything).RunAndReturn(func(s *lms_models.LMSSession) (*lms_models.LMSSession, error) {
		s.ID = model.NewId()
		return s, nil
	})

	created, conflicts, appErr := app.CreateSessionsWithRepeat(baseSession(), "", false)
	require.Nil(t, appErr)
	require.Empty(t, conflicts)
	require.Len(t, created, 1)
	sessions.AssertNumberOfCalls(t, "Save", 1)
}

func TestCreateSessionsWithRepeat_Weekly(t *testing.T) {
	app, sessions, _, _ := newTestApp()

	sessions.On("FindTeacherConflicts", "teach123456789012345678", mock.Anything, mock.Anything, "").
		Return([]*lms_models.LMSSession{}, nil)
	sessions.EXPECT().Save(mock.Anything).RunAndReturn(func(s *lms_models.LMSSession) (*lms_models.LMSSession, error) {
		s.ID = model.NewId()
		return s, nil
	})

	// 2026-09-07 + 4 weeks inclusive = 5 occurrences.
	created, conflicts, appErr := app.CreateSessionsWithRepeat(baseSession(), "2026-10-05", false)
	require.Nil(t, appErr)
	require.Empty(t, conflicts)
	require.Len(t, created, 5)
	sessions.AssertNumberOfCalls(t, "Save", 5)

	// Dates are 7 days apart; start/end times advance by one week.
	base := baseSession()
	ids := map[string]bool{}
	for i, occ := range created {
		require.Equal(t,
			time.Time(base.Date).AddDate(0, 0, 7*i).UTC().Format("2006-01-02"),
			time.Time(occ.Date).UTC().Format("2006-01-02"),
		)
		require.Equal(t, base.StartTime+int64(i)*7*24*3600*1000, occ.StartTime)
		require.Equal(t, base.EndTime+int64(i)*7*24*3600*1000, occ.EndTime)
		require.Equal(t, base.ClassID, occ.ClassID)
		require.Equal(t, base.TeacherID, occ.TeacherID)
		require.False(t, ids[occ.ID], "each occurrence must have its own ID")
		ids[occ.ID] = true
	}
}

func TestCreateSessionsWithRepeat_RepeatUntilEqualsDate(t *testing.T) {
	app, sessions, _, _ := newTestApp()
	sessions.On("FindTeacherConflicts", mock.Anything, mock.Anything, mock.Anything, "").
		Return([]*lms_models.LMSSession{}, nil)
	sessions.EXPECT().Save(mock.Anything).RunAndReturn(func(s *lms_models.LMSSession) (*lms_models.LMSSession, error) {
		return s, nil
	})

	// until == the session's own date -> exactly one occurrence.
	created, _, appErr := app.CreateSessionsWithRepeat(baseSession(), "2026-09-07", false)
	require.Nil(t, appErr)
	require.Len(t, created, 1)
}

func TestCreateSessionsWithRepeat_ConflictBlocks(t *testing.T) {
	app, sessions, classes, users := newTestApp()

	existing := &lms_models.LMSSession{
		ID:        "conf1234567890123456789",
		ClassID:   "other123456789012345678",
		TeacherID: "teach123456789012345678",
		Date:      utils.VnTime(time.Date(2026, 9, 7, 0, 0, 0, 0, time.UTC)),
		StartTime: time.Date(2026, 9, 7, 1, 30, 0, 0, time.UTC).UnixMilli(), // overlaps 08:00-09:30
		EndTime:   time.Date(2026, 9, 7, 3, 0, 0, 0, time.UTC).UnixMilli(),
		Status:    "SCHEDULED",
	}
	sessions.On("FindTeacherConflicts", "teach123456789012345678", mock.Anything, mock.Anything, "").
		Return([]*lms_models.LMSSession{existing}, nil)
	classes.On("Get", "other123456789012345678").Return(&lms_models.Class{ID: "other123456789012345678", Name: "Lớp Toán B"}, nil)
	users.On("Get", mock.Anything, "teach123456789012345678").Return(&model.User{
		Id:        "teach123456789012345678",
		FirstName: "Nguyễn",
		LastName:  "Lan",
	}, nil)

	created, conflicts, appErr := app.CreateSessionsWithRepeat(baseSession(), "", false)
	require.Nil(t, appErr)
	require.Empty(t, created)
	require.Len(t, conflicts, 1)
	require.Equal(t, "Lớp Toán B", conflicts[0].ClassName)
	require.Equal(t, "Nguyễn Lan", conflicts[0].TeacherName)
	require.Equal(t, "2026-09-07", conflicts[0].Date)
	// Nothing saved when conflicts block the create.
	sessions.AssertNotCalled(t, "Save", mock.Anything)
}

func TestCreateSessionsWithRepeat_ConflictForceProceeds(t *testing.T) {
	app, sessions, _, _ := newTestApp()

	// force -> the conflict query is skipped entirely (no FindTeacherConflicts).
	sessions.EXPECT().Save(mock.Anything).RunAndReturn(func(s *lms_models.LMSSession) (*lms_models.LMSSession, error) {
		return s, nil
	})

	created, conflicts, appErr := app.CreateSessionsWithRepeat(baseSession(), "", true)
	require.Nil(t, appErr)
	require.Empty(t, conflicts) // force -> no conflicts returned, rows created
	require.Len(t, created, 1)
	sessions.AssertNumberOfCalls(t, "Save", 1)
	sessions.AssertNotCalled(t, "FindTeacherConflicts", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestCreateSessionsWithRepeat_Validation(t *testing.T) {
	app, _, _, _ := newTestApp()

	// End before start.
	s := baseSession()
	s.EndTime = s.StartTime - 1
	_, _, appErr := app.CreateSessionsWithRepeat(s, "", false)
	require.NotNil(t, appErr)
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

	// Bad repeat_until format.
	_, _, appErr = app.CreateSessionsWithRepeat(baseSession(), "07/09/2026", false)
	require.NotNil(t, appErr)
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

	// repeat_until before the session date.
	_, _, appErr = app.CreateSessionsWithRepeat(baseSession(), "2026-08-31", false)
	require.NotNil(t, appErr)
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

	// Missing class.
	s = baseSession()
	s.ClassID = ""
	_, _, appErr = app.CreateSessionsWithRepeat(s, "", false)
	require.NotNil(t, appErr)

	// Missing teacher.
	s = baseSession()
	s.TeacherID = ""
	_, _, appErr = app.CreateSessionsWithRepeat(s, "", false)
	require.NotNil(t, appErr)
}

func TestCreateSessionsWithRepeat_TooMany(t *testing.T) {
	app, _, _, _ := newTestApp()
	_, _, appErr := app.CreateSessionsWithRepeat(baseSession(), "2030-12-31", false)
	require.NotNil(t, appErr)
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
}

func TestUpdateSession_ConflictBlocks(t *testing.T) {
	app, sessions, classes, users := newTestApp()

	updated := baseSession()
	updated.ID = "sess1234567890123456789"
	updated.StartTime = time.Date(2026, 9, 8, 1, 0, 0, 0, time.UTC).UnixMilli()
	updated.EndTime = time.Date(2026, 9, 8, 2, 30, 0, 0, time.UTC).UnixMilli()

	existing := &lms_models.LMSSession{
		ID:        "conf1234567890123456789",
		ClassID:   "other123456789012345678",
		TeacherID: "teach123456789012345678",
		Date:      utils.VnTime(time.Date(2026, 9, 8, 0, 0, 0, 0, time.UTC)),
		StartTime: time.Date(2026, 9, 8, 2, 0, 0, 0, time.UTC).UnixMilli(), // overlaps proposed end 09:30
		EndTime:   time.Date(2026, 9, 8, 3, 30, 0, 0, time.UTC).UnixMilli(),
		Status:    "SCHEDULED",
	}
	sessions.On("FindTeacherConflicts", "teach123456789012345678", mock.Anything, mock.Anything, "sess1234567890123456789").
		Return([]*lms_models.LMSSession{existing}, nil)
	classes.On("Get", "other123456789012345678").Return(&lms_models.Class{Name: "Lớp khác"}, nil)
	users.On("Get", mock.Anything, "teach123456789012345678").Return(&model.User{FirstName: "Trần", LastName: "Bình"}, nil)

	result, conflicts, appErr := app.UpdateSession("sess1234567890123456789", updated, false)
	require.Nil(t, appErr)
	require.Nil(t, result)
	require.Len(t, conflicts, 1)
	sessions.AssertNotCalled(t, "Update", mock.Anything)
}

func TestUpdateSession_NoConflictSaves(t *testing.T) {
	app, sessions, _, _ := newTestApp()

	updated := baseSession()
	updated.ID = "sess1234567890123456789"
	updated.LessonID = "less1234567890123456789" // non-empty: skips the lesson-preservation Get
	sessions.On("FindTeacherConflicts", mock.Anything, mock.Anything, mock.Anything, "sess1234567890123456789").
		Return([]*lms_models.LMSSession{}, nil)
	sessions.EXPECT().Update(mock.Anything).RunAndReturn(func(s *lms_models.LMSSession) (*lms_models.LMSSession, error) {
		return s, nil
	})

	result, conflicts, appErr := app.UpdateSession("sess1234567890123456789", updated, false)
	require.Nil(t, appErr)
	require.Empty(t, conflicts)
	require.NotNil(t, result)
	sessions.AssertNumberOfCalls(t, "Update", 1)
}

func TestUpdateSession_ForceSkipsCheck(t *testing.T) {
	app, sessions, _, _ := newTestApp()

	updated := baseSession()
	updated.ID = "sess1234567890123456789"
	updated.LessonID = "less1234567890123456789" // non-empty: skips the lesson-preservation Get
	sessions.EXPECT().Update(mock.Anything).RunAndReturn(func(s *lms_models.LMSSession) (*lms_models.LMSSession, error) {
		return s, nil
	})

	// force -> the conflict query is skipped entirely.
	result, conflicts, appErr := app.UpdateSession("sess1234567890123456789", updated, true)
	require.Nil(t, appErr)
	require.Empty(t, conflicts)
	require.NotNil(t, result)
	sessions.AssertNotCalled(t, "FindTeacherConflicts", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

// metricsNilApp stubs the app portion with Metrics() returning nil so
// CreateStudent's metrics hook is a no-op in tests.
type metricsNilApp struct {
	AppPortionIface
}

func (metricsNilApp) Metrics() einterfaces.MetricsInterface { return nil }

// CreateStudent must hand the store the PLAINTEXT default password so
// User.PreSave() hashes it exactly once (the double-hash bug left students
// unable to log in with Student@123).
func TestCreateStudentPasswordHashedOnceByStore(t *testing.T) {
	app, _, _, users := newTestApp()
	app.app = metricsNilApp{}

	users.EXPECT().Save(mock.Anything, mock.Anything).RunAndReturn(func(_ request.CTX, u *model.User) (*model.User, error) {
		return u, nil
	})

	created, appErr := app.CreateStudent(&model.User{
		Email:     "hocsinh@example.com",
		FirstName: "Nguyễn",
		LastName:  "An",
	}, map[string]any{"code": "HV001"})
	require.Nil(t, appErr)
	require.NotNil(t, created)
	require.Equal(t, defaultStudentPassword, created.Password, "app layer must pass the plaintext password; PreSave() owns hashing")
}

// The admin form never sends lesson_id; UpdateSession must carry the stored
// value over instead of overwriting it with "".
func TestUpdateSession_PreservesLessonID(t *testing.T) {
	app, sessions, _, _ := newTestApp()

	updated := baseSession()
	updated.ID = "sess1234567890123456789"

	sessions.On("FindTeacherConflicts", mock.Anything, mock.Anything, mock.Anything, "sess1234567890123456789").
		Return([]*lms_models.LMSSession{}, nil)
	sessions.On("Get", "sess1234567890123456789").Return(&lms_models.LMSSession{
		ID:       "sess1234567890123456789",
		LessonID: "less1234567890123456789",
	}, nil)
	var seen *lms_models.LMSSession
	sessions.EXPECT().Update(mock.Anything).RunAndReturn(func(s *lms_models.LMSSession) (*lms_models.LMSSession, error) {
		seen = s
		return s, nil
	})

	_, _, appErr := app.UpdateSession("sess1234567890123456789", updated, false)
	require.Nil(t, appErr)
	require.NotNil(t, seen)
	require.Equal(t, "less1234567890123456789", seen.LessonID)
}

func TestSessionConflictSummary(t *testing.T) {
	require.Empty(t, SessionConflictSummary(nil))
	one := []*SessionConflict{{Date: "2026-09-07", ClassName: "Lớp A"}}
	require.Contains(t, SessionConflictSummary(one), "2026-09-07 Lớp A")

	many := []*SessionConflict{
		{Date: "2026-09-07", ClassName: "A"},
		{Date: "2026-09-14", ClassName: "B"},
		{Date: "2026-09-21", ClassName: "C"},
		{Date: "2026-09-28", ClassName: "D"},
	}
	require.Contains(t, SessionConflictSummary(many), "+1")
}
