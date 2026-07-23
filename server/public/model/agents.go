package model

type AgentsIntegrityResponse struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}
