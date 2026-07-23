package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetCourseLesson(id string) (*lms_models.CourseLesson, *model.AppError) {
	lesson, err := a.store.CourseLesson().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetCourseLesson", "app.lms.course_lesson.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetCourseLesson", "app.lms.course_lesson.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return lesson, nil
}

func (a *LMSApp) CreateCourseLesson(lesson *lms_models.CourseLesson) (*lms_models.CourseLesson, *model.AppError) {
	saved, err := a.store.CourseLesson().Save(lesson)
	if err != nil {
		return nil, model.NewAppError("CreateCourseLesson", "app.lms.course_lesson.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateCourseLesson(id string, lesson *lms_models.CourseLesson) (*lms_models.CourseLesson, *model.AppError) {
	lesson.ID = id
	updated, err := a.store.CourseLesson().Update(lesson)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateCourseLesson", "app.lms.course_lesson.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateCourseLesson", "app.lms.course_lesson.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeleteCourseLesson(id string) *model.AppError {
	err := a.store.CourseLesson().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteCourseLesson", "app.lms.course_lesson.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteCourseLesson", "app.lms.course_lesson.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}
