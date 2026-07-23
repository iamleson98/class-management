package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpAndDownMigrations(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	testDrivers := []string{
		model.DatabaseDriverPostgres,
	}

	for _, driver := range testDrivers {
		t.Run("Should be reversible for "+driver, func(t *testing.T) {
			settings, err := makeSqlSettings(driver)
			if err != nil {
				t.Skip(err)
			}

			store, err := New(*settings, logger, nil)
			require.NoError(t, err)
			defer store.Close()

			err = store.migrate(migrationsDirectionDown, false, true)
			assert.NoError(t, err, "downing migrations should not error")
		})
	}
}
