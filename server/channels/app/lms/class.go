package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetClass(id string) (*lms_models.Class, *model.AppError) {
	class, err := a.store.Class().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetClass", "app.lms.class.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetClass", "app.lms.class.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return class, nil
}

func (a *LMSApp) GetClasses(opts modelhelper.ClassFilterOpts) ([]*lms_models.Class, int64, *model.AppError) {
	classes, totalCount, err := a.store.Class().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetClasses", "app.lms.class.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return classes, totalCount, nil
}

func (a *LMSApp) CreateClass(class *lms_models.Class) (*lms_models.Class, *model.AppError) {
	saved, err := a.store.Class().Save(class)
	if err != nil {
		return nil, model.NewAppError("CreateClass", "app.lms.class.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateClass(id string, class *lms_models.Class) (*lms_models.Class, *model.AppError) {
	class.ID = id
	updated, err := a.store.Class().Update(class)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateClass", "app.lms.class.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateClass", "app.lms.class.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeleteClass(id string) *model.AppError {
	err := a.store.Class().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteClass", "app.lms.class.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteClass", "app.lms.class.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}

func (a *LMSApp) EnrollStudent(classID, studentID string) (*lms_models.StudentClass, *model.AppError) {
	// Check for existing enrollment
	existing, err := a.store.StudentClass().GetExisting(studentID, classID)
	if err == nil && existing != nil {
		return nil, model.NewAppError("EnrollStudent", "app.lms.class.already_enrolled", nil, "", http.StatusConflict)
	}

	sc := &lms_models.StudentClass{
			ClassID:   classID,
			StudentID: studentID,
			Status:    "active",
		}

		saved, err := a.store.StudentClass().Save(sc)
	if err != nil {
		return nil, model.NewAppError("EnrollStudent", "app.lms.class.enroll.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) GetClassStudents(classID string) ([]*lms_models.StudentClass, *model.AppError) {
	students, err := a.store.StudentClass().GetByClass(classID)
	if err != nil {
		return nil, model.NewAppError("GetClassStudents", "app.lms.class.get_students.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return students, nil
}

// EnrollStudents enrolls the given studentIDs into the class, skipping duplicates.
func (a *LMSApp) EnrollStudents(classID string, studentIDs []string) ([]*lms_models.StudentClass, *model.AppError) {
	var enrolled []*lms_models.StudentClass

	for _, studentID := range studentIDs {
		// Check if already enrolled; skip duplicate.
		existing, err := a.store.StudentClass().GetExisting(studentID, classID)
		if err == nil && existing != nil {
			continue
		}

			sc := &lms_models.StudentClass{
				StudentID: studentID,
				ClassID:   classID,
			}

				saved, err := a.store.StudentClass().Save(sc)
		if err != nil {
			return nil, model.NewAppError("EnrollStudents", "app.lms.class.enroll.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		enrolled = append(enrolled, saved)
	}

	return enrolled, nil
}
