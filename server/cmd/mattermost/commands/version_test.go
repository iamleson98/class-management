package commands

import (
	"testing"
)

func TestVersion(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping version test in short mode")
	}

	th := SetupWithStoreMock(t)

	th.CheckCommand(t, "version")
}
