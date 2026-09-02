package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlClassMediaStore struct {
	sqlStore store.Store
}

func NewSqlClassMediaStore(s store.Store) store.ClassMediaStore {
	return &SqlClassMediaStore{sqlStore: s}
}

func (s *SqlClassMediaStore) Get(id string) (*lms_models.ClassMedium, error) {
	classMedia, err := lms_models.FindClassMedium(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("ClassMedium", id)
		}
		return nil, errors.Wrap(err, "failed to find class media")
	}

	return classMedia, nil
}

// GetByFileID returns the first class media row referencing the given
// Mattermost FileInfo id. Used by the LMS media file-serving route to scope
// file access to files that actually belong to LMS media (as opposed to
// arbitrary chat files).
func (s *SqlClassMediaStore) GetByFileID(fileID string) (*lms_models.ClassMedium, error) {
	classMedia, err := lms_models.ClassMedia(qm.Where("file_id = ?", fileID)).One(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("ClassMedium", fileID)
		}
		return nil, errors.Wrap(err, "failed to find class media by file id")
	}

	return classMedia, nil
}

func (s *SqlClassMediaStore) Search(opts modelhelper.ClassMediaFilterOpts) ([]*lms_models.ClassMedium, int64, error) {
	mods := []qm.QueryMod{}

	modsWithPagination := append(mods, &opts.SearchOpts)
	classMedia, err := lms_models.ClassMedia(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search class media")
	}
	totalCount := int64(len(classMedia))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.ClassMedia(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count class media")
		}
	}

	return classMedia, totalCount, nil
}

func (s *SqlClassMediaStore) Save(cm *lms_models.ClassMedium) (*lms_models.ClassMedium, error) {
	modelhelper.ClassMediaPreCreate(cm)
	if err := modelhelper.ClassMediaIsValid(cm); err != nil {
		return nil, err
	}

	if err := cm.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save class media")
	}

	return cm, nil
}

func (s *SqlClassMediaStore) Delete(id string) error {
	classMedia, err := lms_models.FindClassMedium(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("ClassMedia", id)
		}
		return errors.Wrap(err, "failed to find class media for deletion")
	}

	if _, err := classMedia.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete class media")
	}

	return nil
}
