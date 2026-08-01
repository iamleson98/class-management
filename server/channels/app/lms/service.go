package lms

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// LMSApp is the LMS application layer that wraps store access with business logic.
type LMSApp struct {
	store store.Store
	app   AppPortionIface
}

func NewLMSApp(s store.Store, app AppPortionIface) *LMSApp {
	return &LMSApp{store: s, app: app}
}

type AppPortionIface interface {
	GetTeamByName(name string) (*model.Team, *model.AppError)
	GetChannel(rctx request.CTX, channelID string) (*model.Channel, *model.AppError)
	GetUsersInTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError)
	PermanentDeleteChannel(rctx request.CTX, channel *model.Channel) *model.AppError
	RemoveUserFromChannel(rctx request.CTX, userIDToRemove string, removerUserId string, channel *model.Channel) *model.AppError
	GetChannelByName(rctx request.CTX, channelName, teamID string, includeDeleted bool) (*model.Channel, *model.AppError)
	CreateChannel(rctx request.CTX, channel *model.Channel, addMember bool) (*model.Channel, *model.AppError)
	CreateTeam(rctx request.CTX, team *model.Team) (*model.Team, *model.AppError)
	GetChannelMembersPage(rctx request.CTX, channelID string, page, perPage int) (model.ChannelMembers, *model.AppError)
	AddChannelMember(rctx request.CTX, userID string, channel *model.Channel, opts model.ChannelMemberOpts) (*model.ChannelMember, *model.AppError)
	AddUserToTeam(rctx request.CTX, teamID string, userID string, userRequestorId string) (*model.Team, *model.TeamMember, *model.AppError)
}
