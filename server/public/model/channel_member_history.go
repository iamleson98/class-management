package model

type ChannelMemberHistory struct {
	ChannelId string
	UserId    string
	JoinTime  int64
	LeaveTime *int64
}
