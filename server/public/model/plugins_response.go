package model

type PluginInfo struct {
	Manifest
}

type PluginsResponse struct {
	Active   []*PluginInfo `json:"active"`
	Inactive []*PluginInfo `json:"inactive"`
}
