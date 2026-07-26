package lms

import (
	"net/http"

	"github.com/iamleson98/sitename/server/v8/channels/store"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
)

func (a *LMSApp) GetTask(id string) (*lms_models.Task, *model.AppError) {
	task, err := a.store.Task().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetTask", "app.lms.task.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetTask", "app.lms.task.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return task, nil
}

func (a *LMSApp) GetTasks(opts modelhelper.TaskFilterOpts) ([]*lms_models.Task, int64, *model.AppError) {
	tasks, totalCount, err := a.store.Task().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetTasks", "app.lms.task.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tasks, totalCount, nil
}

func (a *LMSApp) CreateTask(task *lms_models.Task) (*lms_models.Task, *model.AppError) {
	result, err := a.store.Task().Save(task)
	if err != nil {
		return nil, model.NewAppError("CreateTask", "app.lms.task.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) UpdateTask(id string, task *lms_models.Task) (*lms_models.Task, *model.AppError) {
	task.ID = id
	result, err := a.store.Task().Update(task)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateTask", "app.lms.task.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateTask", "app.lms.task.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) DeleteTask(id string) *model.AppError {
	_, err := a.store.Task().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteTask", "app.lms.task.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteTask", "app.lms.task.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.store.Task().Delete(id); err != nil {
		return model.NewAppError("DeleteTask", "app.lms.task.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
