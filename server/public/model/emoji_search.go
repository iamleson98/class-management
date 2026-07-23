package model

type EmojiSearch struct {
	Term       string `json:"term"`
	PrefixOnly bool   `json:"prefix_only"`
}
