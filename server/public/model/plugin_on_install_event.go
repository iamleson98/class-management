package model

// OnInstallEvent is sent to the plugin when it gets installed.
type OnInstallEvent struct {
	UserId string // The user who installed the plugin
}
