package model

type UserAutocompleteInChannel struct {
	InChannel    []*User `json:"in_channel"`
	OutOfChannel []*User `json:"out_of_channel"`
}

type UserAutocompleteInTeam struct {
	InTeam []*User `json:"in_team"`
}

type UserAutocomplete struct {
	Users        []*User `json:"users"`
	OutOfChannel []*User `json:"out_of_channel,omitempty"`
}
