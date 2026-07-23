package bleveengine

import (
	"strconv"

	"github.com/iamleson98/sitename/server/public/model"
)

func createPost(userId string, channelId string) *model.Post {
	post := &model.Post{
		Message:       model.NewRandomString(15),
		ChannelId:     channelId,
		PendingPostId: model.NewId() + ":" + strconv.FormatInt(model.GetMillis(), 10),
		UserId:        userId,
		CreateAt:      1000000,
	}
	post.PreSave()

	return post
}
