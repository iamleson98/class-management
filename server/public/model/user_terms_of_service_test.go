package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserTermsOfServiceIsValid(t *testing.T) {
	s := UserTermsOfService{}
	require.NotNil(t, s.IsValid(), "should be invalid")

	s.UserId = NewId()
	require.NotNil(t, s.IsValid(), "should be invalid")

	s.TermsOfServiceId = NewId()
	require.NotNil(t, s.IsValid(), "should be invalid")

	s.CreateAt = GetMillis()
	require.Nil(t, s.IsValid(), "should be valid")
}
