package lmsapi

// LMSResponse is the standard API response envelope.
type LMSResponse struct {
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}
