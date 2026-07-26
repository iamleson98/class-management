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

type SqlTaskStore struct {
	sqlStore store.Store
}

func NewSqlTaskStore(s store.Store) store.TaskStore {
	return &SqlTaskStore{sqlStore: s}
}

func (s *SqlTaskStore) Get(id string) (*lms_models.Task, error) {
	task, err := lms_models.FindTask(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Task", id)
		}
		return nil, errors.Wrap(err, "failed to find task")
	}

	return task, nil
}

func (s *SqlTaskStore) Search(opts modelhelper.TaskFilterOpts) ([]*lms_models.Task, int64, error) {
	mods := []qm.QueryMod{}

	modsWithPagination := append(mods, &opts.SearchOpts)
	tasks, err := lms_models.Tasks(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search tasks")
	}
	totalCount := int64(len(tasks))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.Tasks(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count tasks")
		}
	}

	return tasks, totalCount, nil
}

func (s *SqlTaskStore) Save(task *lms_models.Task) (*lms_models.Task, error) {
	modelhelper.TaskPreCreate(task)
	if err := modelhelper.TaskIsValid(task); err != nil {
		return nil, err
	}

	if err := task.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save task")
	}

	return task, nil
}

func (s *SqlTaskStore) Update(task *lms_models.Task) (*lms_models.Task, error) {
	modelhelper.TaskPreUpdate(task)
	if err := modelhelper.TaskIsValid(task); err != nil {
		return nil, err
	}

	rowsAffected, err := task.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update task")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Task", task.ID)
	}

	if err := task.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload task")
	}

	return task, nil
}

func (s *SqlTaskStore) Delete(id string) error {
	task, err := lms_models.FindTask(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Task", id)
		}
		return errors.Wrap(err, "failed to find task for deletion")
	}

	if _, err := task.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete task")
	}

	return nil
}
