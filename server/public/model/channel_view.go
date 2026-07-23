package model

type ChannelView struct {
	ChannelId                 string `json:"channel_id"`
	PrevChannelId             string `json:"prev_channel_id"`
	CollapsedThreadsSupported bool   `json:"collapsed_threads_supported"`
}

type ChannelViewResponse struct {
	Status            string           `json:"status"`
	LastViewedAtTimes map[string]int64 `json:"last_viewed_at_times"`
}
