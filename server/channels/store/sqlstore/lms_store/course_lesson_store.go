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

type SqlCourseLessonStore struct {
	sqlStore store.Store
}

func NewSqlCourseLessonStore(s store.Store) store.CourseLessonStore {
	return &SqlCourseLessonStore{sqlStore: s}
}

func (s *SqlCourseLessonStore) Get(id string) (*lms_models.CourseLesson, error) {
	lesson, err := lms_models.FindCourseLesson(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("CourseLesson", id)
		}
		return nil, errors.Wrap(err, "failed to get course lesson")
	}
	return lesson, nil
}

func (s *SqlCourseLessonStore) GetByCourse(courseID string) ([]*lms_models.CourseLesson, error) {
	lessons, err := lms_models.CourseLessons(
		lms_models.CourseLessonWhere.CourseID.EQ(courseID),
		qm.OrderBy(lms_models.CourseLessonColumns.SessionNumber+" ASC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get course lessons by course")
	}

	return lessons, nil
}

func (s *SqlCourseLessonStore) Save(lesson *lms_models.CourseLesson) (*lms_models.CourseLesson, error) {
	modelhelper.CourseLessonPreCreate(lesson)
	if err := modelhelper.CourseLessonIsValid(lesson); err != nil {
		return nil, err
	}

	if err := lesson.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to insert course lesson")
	}
	return lesson, nil
}

func (s *SqlCourseLessonStore) Update(lesson *lms_models.CourseLesson) (*lms_models.CourseLesson, error) {
	modelhelper.CourseLessonPreUpdate(lesson)
	if err := modelhelper.CourseLessonIsValid(lesson); err != nil {
		return nil, err
	}

	rowsAffected, err := lesson.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update course lesson")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("CourseLesson", lesson.ID)
	}

	if err := lesson.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload course lesson")
	}
	return lesson, nil
}

func (s *SqlCourseLessonStore) Delete(id string) error {
	lesson, err := lms_models.FindCourseLesson(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("CourseLesson", id)
		}
		return errors.Wrap(err, "failed to find course lesson for deletion")
	}

	if _, err := lesson.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete course lesson")
	}
	return nil
}
