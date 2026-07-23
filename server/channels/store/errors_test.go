package store

import (
	"errors"
	"testing"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestErrNotFound(t *testing.T) {
	id := model.NewId()

	t.Run("plain", func(t *testing.T) {
		err := NewErrNotFound("channel", id)

		assert.EqualError(t, err, "resource \"channel\" not found, id: "+id)
	})
	t.Run("with wrapped error", func(t *testing.T) {
		err := NewErrNotFound("channel", id)
		err = err.Wrap(errors.New("some error"))

		assert.EqualError(t, err, "resource \"channel\" not found, id: "+id+", error: some error")
	})
}
