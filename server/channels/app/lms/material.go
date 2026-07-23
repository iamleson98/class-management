package lms

import (
	"net/http"

	"github.com/iamleson98/sitename/server/v8/channels/store"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
)

func (a *LMSApp) GetMaterial(id string) (*lms_models.Material, *model.AppError) {
	material, err := a.store.Material().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetMaterial", "app.lms.material.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetMaterial", "app.lms.material.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return material, nil
}

func (a *LMSApp) GetMaterials(opts modelhelper.MaterialFilterOpts) ([]*lms_models.Material, *model.AppError) {
	materials, err := a.store.Material().GetAll(opts)
	if err != nil {
		return nil, model.NewAppError("GetMaterials", "app.lms.material.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return materials, nil
}

func (a *LMSApp) CreateMaterial(m *lms_models.Material) (*lms_models.Material, *model.AppError) {
	result, err := a.store.Material().Save(m)
	if err != nil {
		return nil, model.NewAppError("CreateMaterial", "app.lms.material.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) UpdateMaterial(id string, m *lms_models.Material) (*lms_models.Material, *model.AppError) {
	m.ID = id
	result, err := a.store.Material().Update(m)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateMaterial", "app.lms.material.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateMaterial", "app.lms.material.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) DeleteMaterial(id string) *model.AppError {
	_, err := a.store.Material().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteMaterial", "app.lms.material.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteMaterial", "app.lms.material.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.store.Material().Delete(id); err != nil {
		return model.NewAppError("DeleteMaterial", "app.lms.material.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
