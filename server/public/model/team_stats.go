package model

type TeamStats struct {
	TeamId            string `json:"team_id"`
	TotalMemberCount  int64  `json:"total_member_count"`
	ActiveMemberCount int64  `json:"active_member_count"`
}
