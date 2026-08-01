// Package lmschat wires LMS class lifecycle to the Mattermost chat core.
//
// It provisions a private channel per Class inside the "teaching" team,
// keeps membership in sync as students enroll/un-enroll, adds admins to
// every channel for support/moderation, and permanently deletes a channel
// (with all its messages) when the class finishes.
//
// This package lives under channels/app (and imports *app.App) rather than
// under channels/app/lms, because the channel/team methods it needs are on
// the main *app.App — and channels/app imports channels/app/lms, so lms
// cannot import app back without a cycle.
package lms

import (
	"net/http"
	"strings"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/shared/request"
)

// Team name constants. Names are lowercased to satisfy Mattermost's
// team-name validation; display names are human-readable (Vietnamese).
const (
	TeachingTeamName   = "teaching"
	OperationsTeamName = "operations"

	// ClassChannelPrefix is the channel-name prefix for class channels.
	// Channel names must be lowercase; the class code is lowercased.
	ClassChannelPrefix = "class-"
)

// ClosedClassStatuses are the class statuses that mark a class as finished.
// When a class transitions into one of these, its channel is permanently
// deleted along with all of its messages.
var ClosedClassStatuses = map[string]bool{
	"CLOSED":    true,
	"CANCELLED": true,
}

// EnsureTeachingTeams makes sure the teaching and operations teams exist,
// returning their IDs. It is idempotent: existing teams are looked up by
// name. Admins (lms_super_admin / lms_admin) are added to the teaching
// team so they can be added to every class channel for support/moderation.
func (s *LMSApp) EnsureTeachingTeams(rctx request.CTX) (teachingTeamID, operationsTeamID string, err *model.AppError) {
	teachingTeamID, err = s.ensureTeam(rctx, TeachingTeamName, "Giảng dạy", true)
	if err != nil {
		return "", "", err
	}
	operationsTeamID, err = s.ensureTeam(rctx, OperationsTeamName, "Vận hành", false)
	if err != nil {
		return "", "", err
	}
	return teachingTeamID, operationsTeamID, nil
}

// ensureTeam returns the team ID for the given name, creating it if missing.
// When addAdmins is true, all admin-role users are added as team members so
// they can later be placed in every class channel.
func (s *LMSApp) ensureTeam(rctx request.CTX, name, displayName string, addAdmins bool) (string, *model.AppError) {
	team, appErr := s.app.GetTeamByName(name)
	if appErr != nil && appErr.StatusCode != http.StatusNotFound {
		return "", appErr
	}
	if team != nil {
		// Team already exists. Make sure admins are still members (covers
		// admins created after the team was first provisioned).
		if addAdmins {
			s.addAdminsToTeam(rctx, team.Id)
		}
		return team.Id, nil
	}

	team = &model.Team{
		Name:        name,
		DisplayName: displayName,
		Type:        model.TeamInvite, // private — invite only, keeps members focused
	}
	created, appErr := s.app.CreateTeam(rctx, team)
	if appErr != nil {
		return "", appErr
	}
	if addAdmins {
		s.addAdminsToTeam(rctx, created.Id)
	}
	return created.Id, nil
}

// addAdminsToTeam adds every user with an LMS admin role to the team.
// Errors are logged, not returned — a missing admin should not break
// provisioning for the rest of the class.
func (s *LMSApp) addAdminsToTeam(rctx request.CTX, teamID string) {
	// If admins are already in the team, there is nothing to do. This check
	// keeps the call cheap on the common path (team already provisioned).
	existing, appErr := s.app.GetUsersInTeam(&model.UserGetOptions{
		InTeamId: teamID,
		Roles:    []string{model.RoleLmsSuperAdminRoleId, model.RoleLmsAdminRoleId},
		Page:     0,
		PerPage:  100,
	})
	if appErr != nil {
		rctx.Logger().Warn("LMS chat: failed to list admins already in team", mlog.String("team_id", teamID), mlog.Err(appErr))
		return
	}
	if len(existing) > 0 {
		return
	}

	// Look up admin users system-wide and add them to the team. We query
	// with InTeamId set to the empty string is not supported, so fetch all
	// admins then add each to the team.
	admins, appErr := s.app.GetUsersInTeam(&model.UserGetOptions{
		Roles:   []string{model.RoleLmsSuperAdminRoleId, model.RoleLmsAdminRoleId},
		Page:    0,
		PerPage: 200,
	})
	if appErr != nil {
		rctx.Logger().Warn("LMS chat: failed to list admin users", mlog.Err(appErr))
		return
	}
	for _, admin := range admins {
		if _, _, err := s.app.AddUserToTeam(rctx, teamID, admin.Id, ""); err != nil {
			rctx.Logger().Warn("LMS chat: failed to add admin to team", mlog.String("user_id", admin.Id), mlog.Err(err))
		}
	}
}

// classChannelName returns the canonical channel name for a class:
// "class-{lowercased, sanitized code}". Mattermost channel names must be
// lowercase and match [a-z0-9\-_]; any other character becomes a hyphen.
func classChannelName(code string) string {
	name := strings.ToLower(code)
	name = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == '_':
			return r
		default:
			return '-'
		}
	}, name)
	return ClassChannelPrefix + name
}

// EnsureClassChannel provisions a private channel for the class if one does
// not yet exist, adds the teacher + admins as members, and persists the
// resulting channel ID back onto the class row. It is idempotent: if the
// class already has a chat_channel_id it resolves and returns that channel.
//
// A chat provisioning failure never blocks class management: callers should
// log the returned error and continue, so the channel can be reprovisioned
// later by retrying this call.
func (s *LMSApp) EnsureClassChannel(rctx request.CTX, class *lms_models.Class) (*model.Channel, *model.AppError) {
	if class == nil {
		return nil, model.NewAppError("EnsureClassChannel", "app.lmschat.nil_class", nil, "", http.StatusBadRequest)
	}

	// Already provisioned — resolve and return the existing channel.
	if class.ChatChannelID != "" {
		ch, appErr := s.app.GetChannel(rctx, class.ChatChannelID)
		if appErr == nil && ch != nil && ch.DeleteAt == 0 {
			return ch, nil
		}
		// Fall through and reprovision if the channel was removed out-of-band.
	}

	teachingTeamID, _, appErr := s.EnsureTeachingTeams(rctx)
	if appErr != nil {
		return nil, appErr
	}

	displayName := class.Name
	if displayName == "" {
		displayName = class.Code
	}
	channel := &model.Channel{
		TeamId:      teachingTeamID,
		Name:        classChannelName(class.Code),
		DisplayName: displayName,
		Type:        model.ChannelTypePrivate,
	}

	created, appErr := s.app.CreateChannel(rctx, channel, false)
	if appErr != nil {
		// A name collision means a channel for this class already exists
		// (e.g. a previous provision that failed to persist the ID). Resolve
		// it by name and reuse it instead of failing.
		existing, lookupErr := s.app.GetChannelByName(rctx, channel.Name, teachingTeamID, false)
		if lookupErr != nil || existing == nil {
			return nil, appErr
		}
		created = existing
	}

	// Seed membership: teacher + admins. Admins are team members already
	// (EnsureTeachingTeams/addAdminsToTeam); the teacher is added on demand.
	memberIDs := append([]string{class.TeacherID}, s.adminUserIDs(rctx, created.TeamId)...)
	s.syncChannelMembership(rctx, created, memberIDs, class.TeacherID)

	// Persist the channel link back onto the class.
	class.ChatChannelID = created.Id
	if _, storeErr := s.UpdateClass(class.ID, class); storeErr != nil {
		// Non-fatal: the channel exists and will be reconciled by name on retry.
		rctx.Logger().Warn("LMS chat: failed to persist chat_channel_id",
			mlog.String("class_id", class.ID),
			mlog.String("channel_id", created.Id),
			mlog.Err(storeErr))
	}

	return created, nil
}

// adminUserIDs returns the user IDs of every admin currently in the team.
func (s *LMSApp) adminUserIDs(rctx request.CTX, teamID string) []string {
	admins, appErr := s.app.GetUsersInTeam(&model.UserGetOptions{
		InTeamId: teamID,
		Roles:    []string{model.RoleLmsSuperAdminRoleId, model.RoleLmsAdminRoleId},
		Page:     0,
		PerPage:  200,
	})
	if appErr != nil {
		rctx.Logger().Warn("LMS chat: failed to list team admins", mlog.String("team_id", teamID), mlog.Err(appErr))
		return nil
	}
	ids := make([]string, 0, len(admins))
	for _, u := range admins {
		ids = append(ids, u.Id)
	}
	return ids
}

// syncChannelMembership ensures exactly the given userIDs are channel members
// (the owner is always kept in, even if absent from desiredIDs, since a
// channel must keep its owner). Members no longer in desiredIDs are removed.
// Used by enrollment so a newly enrolled student is added to the class
// channel, and a removed student is taken out.
func (s *LMSApp) syncChannelMembership(rctx request.CTX, channel *model.Channel, desiredIDs []string, ownerID string) {
	if channel == nil {
		return
	}

	// Always keep the owner (teacher) in the channel.
	want := make(map[string]bool, len(desiredIDs)+1)
	for _, id := range desiredIDs {
		if id != "" {
			want[id] = true
		}
	}
	if ownerID != "" {
		want[ownerID] = true
	}

	// Add missing members. A user must be a team member before joining the
	// channel; try the add and skip silently on failure (e.g. not in team).
	for id := range want {
		if _, appErr := s.app.AddChannelMember(rctx, id, channel, model.ChannelMemberOpts{}); appErr != nil {
			rctx.Logger().Debug("LMS chat: could not add channel member",
				mlog.String("user_id", id),
				mlog.String("channel_id", channel.Id),
				mlog.Err(appErr))
		}
	}

	// Remove members no longer desired. Fetch current members and diff.
	members, appErr := s.app.GetChannelMembersPage(rctx, channel.Id, 0, 500)
	if appErr != nil {
		rctx.Logger().Warn("LMS chat: could not fetch channel members for cleanup", mlog.String("channel_id", channel.Id), mlog.Err(appErr))
		return
	}
	for i := range members {
		if !want[members[i].UserId] {
			if appErr := s.app.RemoveUserFromChannel(rctx, members[i].UserId, ownerID, channel); appErr != nil {
				rctx.Logger().Debug("LMS chat: could not remove channel member",
					mlog.String("user_id", members[i].UserId),
					mlog.String("channel_id", channel.Id),
					mlog.Err(appErr))
			}
		}
	}
}

// SyncClassChannelMembership resolves the class's channel and reconciles its
// membership to teacher + admins + the given student user IDs. It is the
// enrollment hook: pass the full current student user-ID set of the class.
func (s *LMSApp) SyncClassChannelMembership(rctx request.CTX, class *lms_models.Class, studentUserIDs []string) *model.AppError {
	if class == nil {
		return nil
	}
	channel, appErr := s.EnsureClassChannel(rctx, class)
	if appErr != nil {
		return appErr
	}
	if channel == nil {
		return nil
	}
	desired := append([]string{class.TeacherID}, studentUserIDs...)
	desired = append(desired, s.adminUserIDs(rctx, channel.TeamId)...)
	s.syncChannelMembership(rctx, channel, desired, class.TeacherID)
	return nil
}

// CloseClassChannel permanently deletes the class's chat channel and all of
// its messages. Called when a class is finished (status CLOSED/CANCELLED) or
// deleted. After deletion the stored chat_channel_id is cleared. A missing
// or already-deleted channel is a no-op.
func (s *LMSApp) CloseClassChannel(rctx request.CTX, class *lms_models.Class) *model.AppError {
	if class == nil || class.ChatChannelID == "" {
		return nil
	}

	channel, appErr := s.app.GetChannel(rctx, class.ChatChannelID)
	if appErr != nil {
		// Already gone — clear the stale link and return.
		s.clearChannelLink(rctx, class)
		return nil
	}

	// PermanentDeleteChannel wipes posts, memberships, and the channel row.
	if appErr := s.app.PermanentDeleteChannel(rctx, channel); appErr != nil {
		return model.NewAppError("CloseClassChannel", "app.lmschat.close.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	s.clearChannelLink(rctx, class)
	return nil
}

// clearChannelLink nulls chat_channel_id on the class row.
func (s *LMSApp) clearChannelLink(rctx request.CTX, class *lms_models.Class) {
	class.ChatChannelID = ""
	if _, appErr := s.UpdateClass(class.ID, class); appErr != nil {
		rctx.Logger().Warn("LMS chat: failed to clear chat_channel_id",
			mlog.String("class_id", class.ID),
			mlog.Err(appErr))
	}
}
