package platform

import (
	"testing"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
)

func TestClusterDiscoveryService(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	ds := th.Service.NewClusterDiscoveryService()
	ds.Type = model.CDSTypeApp
	ds.ClusterName = "ClusterA"
	ds.AutoFillHostname()

	ds.Start()
	time.Sleep(2 * time.Second)

	ds.Stop()
	time.Sleep(2 * time.Second)
}
