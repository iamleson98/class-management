package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetSession(id string) (*lms_models.LMSSession, *model.AppError) {
	session, err := a.store.LMSSession().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSession", "app.lms.session.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSession", "app.lms.session.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return session, nil
}

func (a *LMSApp) GetSessions(opts modelhelper.SessionFilterOpts) ([]*lms_models.LMSSession, int64, *model.AppError) {
	sessions, totalCount, err := a.store.LMSSession().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetSessions", "app.lms.session.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return sessions, totalCount, nil
}

func (a *LMSApp) CreateSession(session *lms_models.LMSSession) (*lms_models.LMSSession, *model.AppError) {
	saved, err := a.store.LMSSession().Save(session)
	if err != nil {
		return nil, model.NewAppError("CreateSession", "app.lms.session.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateSession(id string, session *lms_models.LMSSession) (*lms_models.LMSSession, *model.AppError) {
	session.ID = id
	updated, err := a.store.LMSSession().Update(session)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateSession", "app.lms.session.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateSession", "app.lms.session.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeleteSession(id string) *model.AppError {
	err := a.store.LMSSession().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteSession", "app.lms.session.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteSession", "app.lms.session.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}
