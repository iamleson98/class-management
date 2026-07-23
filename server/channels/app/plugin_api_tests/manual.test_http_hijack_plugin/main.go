package main

import (
	"net/http"

	"github.com/iamleson98/sitename/server/public/plugin"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

type Plugin struct {
	plugin.MattermostPlugin
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, _ *http.Request) {
	hj, ok := w.(http.Hijacker)
	if !ok {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	conn, brw, err := hj.Hijack()
	if conn == nil || brw == nil || err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	_, err = conn.Write([]byte("HTTP/1.1 200\n\nOK"))
	if err != nil {
		mlog.Error("Failed to write to connection", mlog.Err(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	err = conn.Close()
	if err != nil {
		mlog.Error("Failed to close connection", mlog.Err(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func main() {
	plugin.ClientMain(&Plugin{})
}
