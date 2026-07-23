package model

type ClusterInfo struct {
	Id            string `json:"id"`
	Version       string `json:"version"`
	SchemaVersion string `json:"schema_version"`
	ConfigHash    string `json:"config_hash"`
	IPAddress     string `json:"ipaddress"`
	Hostname      string `json:"hostname"`
}
