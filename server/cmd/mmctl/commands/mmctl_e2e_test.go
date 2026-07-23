//go:build e2e

package commands

import (
	"testing"

	"github.com/stretchr/testify/suite"
)

func TestMmctlE2ESuite(t *testing.T) {
	suite.Run(t, new(MmctlE2ETestSuite))
}
