package users

const (
	TokenTypePasswordRecovery = "password_recovery"
	TokenTypeVerifyEmail      = "verify_email"
	TokenTypeTeamInvitation   = "team_invitation"
	TokenTypeGuestInvitation  = "guest_invitation"
	InvitationExpiryTime      = 1000 * 60 * 60 * 48 // 48 hours
)
