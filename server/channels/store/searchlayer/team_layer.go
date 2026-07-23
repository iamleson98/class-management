package searchlayer

import (
	model "github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
	store "github.com/iamleson98/sitename/server/v8/channels/store"
)

type SearchTeamStore struct {
	store.TeamStore
	rootStore *SearchStore
}

func (s SearchTeamStore) SaveMember(rctx request.CTX, teamMember *model.TeamMember, maxUsersPerTeam int) (*model.TeamMember, error) {
	member, err := s.TeamStore.SaveMember(rctx, teamMember, maxUsersPerTeam)
	if err == nil {
		// Nothing to do if search engine is not active
		if s.rootStore.searchEngine.ActiveEngine() != "database" && s.rootStore.searchEngine.ActiveEngine() != "none" {
			s.rootStore.indexUserFromID(rctx, member.UserId)
			// s.rootStore.indexChannelsForTeam(rctx, member.TeamId)
		}
	}
	return member, err
}

func (s SearchTeamStore) UpdateMember(rctx request.CTX, teamMember *model.TeamMember) (*model.TeamMember, error) {
	member, err := s.TeamStore.UpdateMember(rctx, teamMember)
	if err == nil {
		s.rootStore.indexUserFromID(rctx, member.UserId)
	}
	return member, err
}

func (s SearchTeamStore) RemoveMember(rctx request.CTX, teamId string, userId string) error {
	err := s.TeamStore.RemoveMember(rctx, teamId, userId)
	if err == nil {
		// Nothing to do if search engine is not active
		if s.rootStore.searchEngine.ActiveEngine() != "database" && s.rootStore.searchEngine.ActiveEngine() != "none" {
			s.rootStore.indexUserFromID(rctx, userId)
			// s.rootStore.indexChannelsForTeam(rctx, teamId)
		}
	}
	return err
}

func (s SearchTeamStore) RemoveAllMembersByUser(rctx request.CTX, userId string) error {
	err := s.TeamStore.RemoveAllMembersByUser(rctx, userId)
	if err == nil {
		s.rootStore.indexUserFromID(rctx, userId)
	}
	return err
}
