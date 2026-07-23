package model

const (
	PushStatus         = "status"
	PushStatusOk       = "OK"
	PushStatusFail     = "FAIL"
	PushStatusRemove   = "REMOVE"
	PushStatusErrorMsg = "error"
)

type PushResponse map[string]string

func NewOkPushResponse() PushResponse {
	m := make(map[string]string)
	m[PushStatus] = PushStatusOk
	return m
}

func NewRemovePushResponse() PushResponse {
	m := make(map[string]string)
	m[PushStatus] = PushStatusRemove
	return m
}

func NewErrorPushResponse(message string) PushResponse {
	m := make(map[string]string)
	m[PushStatus] = PushStatusFail
	m[PushStatusErrorMsg] = message
	return m
}
