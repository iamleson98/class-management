package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// CourseWithLessons wraps a Course with its lessons for API responses.
type CourseWithLessons struct {
	Course  *lms_models.Course        `json:"course"`
	Lessons []*lms_models.CourseLesson `json:"lessons"`
}

// Course
func (a *LMSApp) GetCourse(id string) (*lms_models.Course, *model.AppError) {
	course, err := a.store.Course().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetCourse", "app.lms.course.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetCourse", "app.lms.course.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return course, nil
}

// GetCourseWithLessons returns a course along with its lessons.
func (a *LMSApp) GetCourseWithLessons(id string) (*CourseWithLessons, *model.AppError) {
	course, appErr := a.GetCourse(id)
	if appErr != nil {
		return nil, appErr
	}

	lessons, err := a.store.CourseLesson().GetByCourse(id)
	if err != nil {
		return nil, model.NewAppError("GetCourseWithLessons", "app.lms.course.get_lessons.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &CourseWithLessons{
		Course:  course,
		Lessons: lessons,
	}, nil
}

func (a *LMSApp) GetCourses() ([]*lms_models.Course, *model.AppError) {
	courses, err := a.store.Course().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetCourses", "app.lms.course.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return courses, nil
}

func (a *LMSApp) CreateCourse(course *lms_models.Course) (*lms_models.Course, *model.AppError) {
	saved, err := a.store.Course().Save(course)
	if err != nil {
		return nil, model.NewAppError("CreateCourse", "app.lms.course.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return saved, nil
}

func (a *LMSApp) UpdateCourse(id string, course *lms_models.Course) (*lms_models.Course, *model.AppError) {
	course.ID = id
	updated, err := a.store.Course().Update(course)
	if err != nil {
		return nil, model.NewAppError("UpdateCourse", "app.lms.course.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return updated, nil
}

func (a *LMSApp) DeleteCourse(id string) *model.AppError {
	err := a.store.Course().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteCourse", "app.lms.course.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteCourse", "app.lms.course.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}
