package model

type Permalink struct {
	PreviewPost *PreviewPost `json:"preview_post"`
}

type PreviewPost struct {
	PostID             string      `json:"post_id"`
	Post               *Post       `json:"post"`
	TeamName           string      `json:"team_name"`
	ChannelDisplayName string      `json:"channel_display_name"`
	ChannelType        ChannelType `json:"channel_type"`
	ChannelID          string      `json:"channel_id"`
}

func NewPreviewPost(post *Post, team *Team, channel *Channel) *PreviewPost {
	if post == nil {
		return nil
	}
	return &PreviewPost{
		PostID:             post.Id,
		Post:               post,
		TeamName:           team.Name,
		ChannelDisplayName: channel.DisplayName,
		ChannelType:        channel.Type,
		ChannelID:          channel.Id,
	}
}
