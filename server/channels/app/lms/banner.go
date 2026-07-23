package lms

import (
	"net/http"

	"github.com/iamleson98/sitename/server/v8/channels/store"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
)

func (a *LMSApp) GetBanner(id string) (*lms_models.Banner, *model.AppError) {
	banner, err := a.store.Banner().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetBanner", "app.lms.banner.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetBanner", "app.lms.banner.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return banner, nil
}

func (a *LMSApp) GetBanners() ([]*lms_models.Banner, *model.AppError) {
	banners, err := a.store.Banner().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetBanners", "app.lms.banner.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return banners, nil
}

func (a *LMSApp) CreateBanner(banner *lms_models.Banner) (*lms_models.Banner, *model.AppError) {
	result, err := a.store.Banner().Save(banner)
	if err != nil {
		return nil, model.NewAppError("CreateBanner", "app.lms.banner.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) UpdateBanner(id string, banner *lms_models.Banner) (*lms_models.Banner, *model.AppError) {
	banner.ID = id
	result, err := a.store.Banner().Update(banner)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateBanner", "app.lms.banner.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateBanner", "app.lms.banner.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) DeleteBanner(id string) *model.AppError {
	_, err := a.store.Banner().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteBanner", "app.lms.banner.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteBanner", "app.lms.banner.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.store.Banner().Delete(id); err != nil {
		return model.NewAppError("DeleteBanner", "app.lms.banner.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
