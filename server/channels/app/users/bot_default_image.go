package users

import _ "embed"

// This embed duplicates ../../../../webapp/channels/src/images/bot_default_icon.png
//
//go:embed bot_default_icon.png
var botDefaultImage []byte
