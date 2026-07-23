package model

type ChannelData struct {
	Channel *Channel       `json:"channel"`
	Member  *ChannelMember `json:"member"`
}

func (o *ChannelData) Etag() string {
	var mt int64
	if o.Member != nil {
		mt = o.Member.LastUpdateAt
	}

	return Etag(o.Channel.Id, o.Channel.UpdateAt, o.Channel.LastPostAt, mt)
}
