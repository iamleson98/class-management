package lms

import (
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetClassMedia(opts modelhelper.ClassMediaFilterOpts) ([]*lms_models.ClassMedium, int64, *model.AppError) {
	media, totalCount, err := a.store.ClassMedia().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetClassMedia", "app.lms.class_media.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return media, totalCount, nil
}

// GetClassMediaByFileID finds the class media row referencing the given
// Mattermost FileInfo id (used to scope the LMS media file route).
func (a *LMSApp) GetClassMediaByFileID(fileID string) (*lms_models.ClassMedium, *model.AppError) {
	cm, err := a.store.ClassMedia().GetByFileID(fileID)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetClassMediaByFileID", "app.lms.class_media.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetClassMediaByFileID", "app.lms.class_media.get_by_file_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return cm, nil
}

// MediaFileURL is the canonical display URL for a media file stored through
// the Mattermost file API. It routes through the LMS media endpoint so any
// role that may read class media (admin/teacher/parent) can view the bytes,
// regardless of which team/channel the underlying FileInfo belongs to.
func MediaFileURL(fileID string) string {
	return "/api/v4/lms/media/" + fileID
}

func (a *LMSApp) CreateClassMedia(cm *lms_models.ClassMedium) (*lms_models.ClassMedium, *model.AppError) {
	// Canonicalize: rows backed by a server-side file always point at the
	// LMS media route (the client-provided URL may use any legacy format).
	if cm.FileID != "" && model.IsValidId(cm.FileID) {
		cm.FileURL = MediaFileURL(cm.FileID)
	}
	result, err := a.store.ClassMedia().Save(cm)
	if err != nil {
		return nil, model.NewAppError("CreateClassMedia", "app.lms.class_media.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if m := a.app.Metrics(); m != nil {
		m.IncrementLMSClassMediaCreated()
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
	if m := a.app.Metrics(); m != nil {
		m.IncrementLMSClassMediaDeleted()
	}
	return nil
}
