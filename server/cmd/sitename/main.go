package main

import (
	"os"

	"github.com/iamleson98/sitename/server/v8/cmd/sitename/commands"
	// Import and register app layer slash commands
	_ "github.com/iamleson98/sitename/server/v8/channels/app/slashcommands"
	// Plugins
	_ "github.com/iamleson98/sitename/server/v8/channels/app/oauthproviders/gitlab"

	_ "github.com/iamleson98/sitename/server/v8/enterprise"
	// to register booking API endpoints
)

func main() {
	if err := commands.Run(os.Args[1:]); err != nil {
		os.Exit(1)
	}
}
