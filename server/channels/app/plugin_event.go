package app

import (
	"encoding/json"

	"github.com/iamleson98/sitename/server/public/model"
)

func (ch *Channels) notifyClusterPluginEvent(event model.ClusterEvent, data model.PluginEventData) {
	buf, _ := json.Marshal(data)
	if ch.srv.platform.Cluster() != nil {
		ch.srv.platform.Cluster().SendClusterMessage(&model.ClusterMessage{
			Event:            event,
			SendType:         model.ClusterSendReliable,
			WaitForAllToSend: true,
			Data:             buf,
		})
	}
}
