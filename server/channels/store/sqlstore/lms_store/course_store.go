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

type SqlCourseStore struct {
	sqlStore store.Store
}

func NewSqlCourseStore(s store.Store) store.CourseStore {
	return &SqlCourseStore{sqlStore: s}
}

func (s *SqlCourseStore) Get(id string) (*lms_models.Course, error) {
	course, err := lms_models.FindCourse(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Course", id)
		}
		return nil, errors.Wrap(err, "failed to get course")
	}
	return course, nil
}

func (s *SqlCourseStore) GetAll() ([]*lms_models.Course, error) {
	courses, err := lms_models.Courses(
		qm.OrderBy(lms_models.CourseColumns.Name + " ASC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all courses")
	}

	return courses, nil
}

func (s *SqlCourseStore) GetLessons(courseID string) ([]*lms_models.CourseLesson, error) {
	lessons, err := lms_models.CourseLessons(
		lms_models.CourseLessonWhere.CourseID.EQ(courseID),
		qm.OrderBy(lms_models.CourseLessonColumns.SessionNumber+" ASC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get course lessons")
	}

	return lessons, nil
}

func (s *SqlCourseStore) Save(course *lms_models.Course) (*lms_models.Course, error) {
	modelhelper.CoursePreCreate(course)
	if err := modelhelper.CourseIsValid(course); err != nil {
		return nil, err
	}

	if err := course.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to insert course")
	}
	return course, nil
}

func (s *SqlCourseStore) Update(course *lms_models.Course) (*lms_models.Course, error) {
	modelhelper.CoursePreUpdate(course)
	if err := modelhelper.CourseIsValid(course); err != nil {
		return nil, err
	}

	rowsAffected, err := course.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update course")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Course", course.ID)
	}

	if err := course.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload course")
	}
	return course, nil
}

func (s *SqlCourseStore) Delete(id string) error {
	course, err := lms_models.FindCourse(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Course", id)
		}
		return errors.Wrap(err, "failed to find course for deletion")
	}

	rowsAffected, err := course.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete course")
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("Course", id)
	}
	return nil
}
