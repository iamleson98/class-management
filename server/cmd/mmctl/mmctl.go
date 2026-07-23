package main

import (
	"os"

	_ "github.com/golang/mock/mockgen/model"

	"github.com/iamleson98/sitename/server/v8/cmd/mmctl/commands"
)

func main() {
	if err := commands.Run(os.Args[1:]); err != nil {
		os.Exit(1)
	}
}
