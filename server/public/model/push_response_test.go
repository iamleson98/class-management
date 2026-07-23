package model

import (
	"testing"
)

func TestNewOkPushResponse(t *testing.T) {
	r := NewOkPushResponse()
	CheckString(t, r["status"], "OK")
}

func TestNewRemovePushResponse(t *testing.T) {
	r := NewRemovePushResponse()
	CheckString(t, r["status"], "REMOVE")
}

func TestNewErrorPushResponse(t *testing.T) {
	r := NewErrorPushResponse("error message")
	CheckString(t, r["status"], "FAIL")
	CheckString(t, r["error"], "error message")
}
