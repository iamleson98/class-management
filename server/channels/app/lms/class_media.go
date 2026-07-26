package lms

import (
	"net/http"

	"github.com/iamleson98/sitename/server/v8/channels/store"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
)

func (a *LMSApp) GetClassMedia(opts modelhelper.ClassMediaFilterOpts) ([]*lms_models.ClassMedium, int64, *model.AppError) {
	media, totalCount, err := a.store.ClassMedia().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetClassMedia", "app.lms.class_media.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return media, totalCount, nil
}

func (a *LMSApp) CreateClassMedia(cm *lms_models.ClassMedium) (*lms_models.ClassMedium, *model.AppError) {
	result, err := a.store.ClassMedia().Save(cm)
	if err != nil {
		return nil, model.NewAppError("CreateClassMedia", "app.lms.class_media.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) DeleteClassMedia(id string) *model.AppError {
	_, err := a.store.ClassMedia().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteClassMedia", "app.lms.class_media.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteClassMedia", "app.lms.class_media.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.store.ClassMedia().Delete(id); err != nil {
		return model.NewAppError("DeleteClassMedia", "app.lms.class_media.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
