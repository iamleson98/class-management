package main

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	addrCh chan string
}

func (p *Plugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	return nil, <-p.addrCh
}

func (p *Plugin) WebSocketMessageHasBeenPosted(connID, userID string, req *model.WebSocketRequest) {
	p.addrCh <- req.Data[model.WebSocketRemoteAddr].(string)
}

func main() {
	plugin.ClientMain(&Plugin{
		addrCh: make(chan string, 1),
	})
}
