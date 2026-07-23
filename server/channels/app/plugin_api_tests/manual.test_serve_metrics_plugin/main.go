package main

import (
	"net/http"

	"github.com/iamleson98/sitename/server/public/plugin"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

type Plugin struct {
	plugin.MattermostPlugin
}

func (p *Plugin) ServeMetrics(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/subpath" {
		_, err := w.Write([]byte("METRICS SUBPATH"))
		if err != nil {
			mlog.Error("Failed to write response", mlog.Err(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		return
	}

	_, err := w.Write([]byte("METRICS"))
	if err != nil {
		mlog.Error("Failed to write response", mlog.Err(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func main() {
	plugin.ClientMain(&Plugin{})
}
