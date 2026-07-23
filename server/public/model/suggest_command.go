package model

type SuggestCommand struct {
	Suggestion  string `json:"suggestion"`
	Description string `json:"description"`
}
