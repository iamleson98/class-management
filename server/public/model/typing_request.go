package model

type TypingRequest struct {
	ChannelId string `json:"channel_id"`
	ParentId  string `json:"parent_id"`
}
