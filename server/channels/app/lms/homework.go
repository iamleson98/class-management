package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetHomework(opts modelhelper.HomeworkFilterOpts) ([]*lms_models.Homework, int64, *model.AppError) {
	homeworks, totalCount, err := a.store.Homework().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetHomework", "app.lms.homework.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return homeworks, totalCount, nil
}

// GetHomeworkByID returns a homework by ID along with its submissions.
func (a *LMSApp) GetHomeworkByID(id string) (*lms_models.Homework, *model.AppError) {
	hw, err := a.store.Homework().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetHomeworkByID", "app.lms.homework.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetHomeworkByID", "app.lms.homework.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return hw, nil
}

// GetHomeworkByIDWithSubmissions returns a homework along with its submissions.
func (a *LMSApp) GetHomeworkByIDWithSubmissions(id string) (*lms_models.Homework, []*lms_models.Submission, *model.AppError) {
	hw, appErr := a.GetHomeworkByID(id)
	if appErr != nil {
		return nil, nil, appErr
	}

	submissions, err := a.store.Submission().GetByHomework(id)
	if err != nil {
		return nil, nil, model.NewAppError("GetHomeworkByIDWithSubmissions", "app.lms.homework.get_submissions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return hw, submissions, nil
}

func (a *LMSApp) CreateHomework(hw *lms_models.Homework) (*lms_models.Homework, *model.AppError) {
	saved, err := a.store.Homework().Save(hw)
	if err != nil {
		return nil, model.NewAppError("CreateHomework", "app.lms.homework.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateHomework(id string, hw *lms_models.Homework) (*lms_models.Homework, *model.AppError) {
	hw.ID = id
	updated, err := a.store.Homework().Update(hw)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateHomework", "app.lms.homework.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateHomework", "app.lms.homework.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeleteHomework(id string) *model.AppError {
	err := a.store.Homework().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteHomework", "app.lms.homework.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteHomework", "app.lms.homework.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}

// BulkAssignHomework creates one homework per studentID based on the provided template.
// Returns the count of homeworks created.
func (a *LMSApp) BulkAssignHomework(hw *lms_models.Homework, studentIDs []string) (int, *model.AppError) {
	count := 0

	for range studentIDs {
			// Clone the homework template for each student.
			clone := &lms_models.Homework{
				Title:       hw.Title,
				Description: hw.Description,
				SessionID:   hw.SessionID,
				ClassID:     hw.ClassID,
				CourseID:    hw.CourseID,
				TeacherID:   hw.TeacherID,
				Deadline:    hw.Deadline,
				FileID:      hw.FileID,
			}

			_, err := a.store.Homework().Save(clone)
		if err != nil {
			return count, model.NewAppError("BulkAssignHomework", "app.lms.homework.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		count++
	}

	return count, nil
}

func (a *LMSApp) GetHomeworkSubmissions(homeworkID string) ([]*lms_models.Submission, *model.AppError) {
	submissions, err := a.store.Submission().GetByHomework(homeworkID)
	if err != nil {
		return nil, model.NewAppError("GetHomeworkSubmissions", "app.lms.homework.get_submissions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return submissions, nil
}

// UpsertHomeworkSubmission checks if a submission already exists for the homework+student.
// If so, it updates; otherwise it creates a new submission.
func (a *LMSApp) UpsertHomeworkSubmission(homeworkID, studentID string, sub *lms_models.Submission) (*lms_models.Submission, *model.AppError) {
	sub.HomeworkID = homeworkID
	sub.StudentID = studentID

	// Check if submission already exists for this homework+student.
	existing, err := a.store.Submission().GetByHomeworkAndStudent(sub.HomeworkID, sub.StudentID)
	if err == nil && existing != nil {
		// Update existing submission.
		sub.ID = existing.ID

			updated, err := a.store.Submission().Update(sub)
		if err != nil {
			return nil, model.NewAppError("UpsertHomeworkSubmission", "app.lms.homework.update_submission.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return updated, nil
	}

	// Create new submission.
	saved, err := a.store.Submission().Save(sub)
	if err != nil {
		return nil, model.NewAppError("UpsertHomeworkSubmission", "app.lms.homework.create_submission.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}
