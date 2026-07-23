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

type SqlClassStore struct {
	sqlStore store.Store
}

func NewSqlClassStore(s store.Store) store.ClassStore {
	return &SqlClassStore{sqlStore: s}
}

func (s *SqlClassStore) Get(id string) (*lms_models.Class, error) {
	class, err := lms_models.FindClass(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Class", id)
		}
		return nil, errors.Wrap(err, "failed to get class")
	}
	return class, nil
}

func (s *SqlClassStore) GetAll(opts modelhelper.ClassFilterOpts) ([]*lms_models.Class, error) {
	var mods []qm.QueryMod

	if opts.CourseID != "" {
		mods = append(mods, lms_models.ClassWhere.CourseID.EQ(opts.CourseID))
	}
	if opts.Status != "" {
		mods = append(mods, lms_models.ClassWhere.Status.EQ(opts.Status))
	}
	if opts.TeacherID != "" {
		mods = append(mods, lms_models.ClassWhere.TeacherID.EQ(opts.TeacherID))
	}

	mods = append(mods, qm.OrderBy(lms_models.ClassColumns.Createat+" DESC"))

	if opts.PerPage > 0 {
		mods = append(mods, qm.Limit(opts.PerPage))
		if opts.Page > 0 {
			mods = append(mods, qm.Offset((opts.Page-1)*opts.PerPage))
		}
	}

	classes, err := lms_models.Classes(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get classes")
	}

	return classes, nil
}

func (s *SqlClassStore) Save(class *lms_models.Class) (*lms_models.Class, error) {
	modelhelper.ClassPreCreate(class)
	if err := modelhelper.ClassIsValid(class); err != nil {
		return nil, err
	}

	if err := class.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save class")
	}
	return class, nil
}

func (s *SqlClassStore) Update(class *lms_models.Class) (*lms_models.Class, error) {
	modelhelper.ClassPreUpdate(class)
	if err := modelhelper.ClassIsValid(class); err != nil {
		return nil, err
	}

	rowsAffected, err := class.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update class")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Class", class.ID)
	}

	if err := class.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload class")
	}
	return class, nil
}

func (s *SqlClassStore) Delete(id string) error {
	class, err := lms_models.FindClass(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Class", id)
		}
		return errors.Wrap(err, "failed to find class for deletion")
	}

	if _, err := class.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete class")
	}
	return nil
}

func (s *SqlClassStore) Count(opts modelhelper.ClassFilterOpts) (int64, error) {
	var mods []qm.QueryMod

	if opts.CourseID != "" {
		mods = append(mods, lms_models.ClassWhere.CourseID.EQ(opts.CourseID))
	}
	if opts.Status != "" {
		mods = append(mods, lms_models.ClassWhere.Status.EQ(opts.Status))
	}
	if opts.TeacherID != "" {
		mods = append(mods, lms_models.ClassWhere.TeacherID.EQ(opts.TeacherID))
	}

	count, err := lms_models.Classes(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count classes")
	}
	return count, nil
}
