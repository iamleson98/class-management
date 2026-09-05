package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlLMSSessionStore struct {
	sqlStore store.Store
}

func NewSqlLMSSessionStore(s store.Store) store.LMSSessionStore {
	return &SqlLMSSessionStore{sqlStore: s}
}

func (s *SqlLMSSessionStore) Get(id string) (*lms_models.LMSSession, error) {
	session, err := lms_models.FindLMSSession(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("LMSSession", id)
		}
		return nil, errors.Wrap(err, "failed to get lms session")
	}
	return session, nil
}

func (s *SqlLMSSessionStore) Search(opts modelhelper.SessionFilterOpts) ([]*lms_models.LMSSession, int64, error) {
	var mods []qm.QueryMod

	modsWithPagination := append(mods, &opts.SearchOpts)
	sessions, err := lms_models.LMSSessions(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search lms sessions")
	}
	totalCount := int64(len(sessions))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.LMSSessions(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count lms sessions")
		}
	}

	return sessions, totalCount, nil
}

func (s *SqlLMSSessionStore) Save(session *lms_models.LMSSession) (*lms_models.LMSSession, error) {
	modelhelper.LMSSessionPreCreate(session)
	if err := modelhelper.LMSSessionIsValid(session); err != nil {
		return nil, err
	}

	if err := session.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save lms session")
	}
	return session, nil
}

func (s *SqlLMSSessionStore) Update(session *lms_models.LMSSession) (*lms_models.LMSSession, error) {
	modelhelper.LMSSessionPreUpdate(session)
	if err := modelhelper.LMSSessionIsValid(session); err != nil {
		return nil, err
	}

	rowsAffected, err := session.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update lms session")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("LMSSession", session.ID)
	}

	if err := session.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload lms session")
	}
	return session, nil
}

func (s *SqlLMSSessionStore) Delete(id string) error {
	session, err := lms_models.FindLMSSession(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("LMSSession", id)
		}
		return errors.Wrap(err, "failed to find lms session for deletion")
	}

	if _, err := session.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete lms session")
	}
	return nil
}

func (s *SqlLMSSessionStore) CountUpcomingByStudent(studentID string) (int64, error) {
	var count int64
	// NOTE: identifiers are quoted — PG folds unquoted mixed-case names to
	// lowercase ("LMSSessions" -> "lmssessions"), which does not match the
	// actual table/column names created by migration 000153.
	err := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT COUNT(*) FROM "lms_sessions" s
                INNER JOIN "student_classes" sc ON sc."class_id" = s."class_id"
                WHERE s."status" = 'SCHEDULED' AND s."date" >= CURRENT_DATE AND sc."student_id" = $1`,
		studentID,
	).Scan(&count)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count upcoming sessions by student")
	}
	return count, nil
}

// FindTeacherConflicts returns the teacher's non-cancelled sessions strictly
// overlapping [startMs, endMs) (start < endMs AND end > startMs), optionally
// excluding one session (the one being moved). Sorted by start time and
// capped at 25 rows so a pathological schedule cannot balloon the response.
func (s *SqlLMSSessionStore) FindTeacherConflicts(teacherID string, startMs, endMs int64, excludeSessionID string) ([]*lms_models.LMSSession, error) {
	if teacherID == "" {
		return nil, nil
	}

	mods := []qm.QueryMod{
		lms_models.LMSSessionWhere.TeacherID.EQ(teacherID),
		lms_models.LMSSessionWhere.Status.NEQ("CANCELLED"),
		lms_models.LMSSessionWhere.StartTime.LT(endMs),
		lms_models.LMSSessionWhere.EndTime.GT(startMs),
		qm.OrderBy(lms_models.LMSSessionColumns.StartTime),
		qm.Limit(25),
	}
	if excludeSessionID != "" {
		mods = append(mods, lms_models.LMSSessionWhere.ID.NEQ(excludeSessionID))
	}

	sessions, err := lms_models.LMSSessions(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to find teacher session conflicts")
	}
	return sessions, nil
}
