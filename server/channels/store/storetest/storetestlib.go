package storetest

import (
	"github.com/iamleson98/sitename/server/public/model"
)

func MakeEmail() string {
	return "success_" + model.NewId() + "@simulator.amazonses.com"
}
