//go:build !linux && !darwin

package platform

import "errors"

// ErrMemoryUnsupportedPlatform is returned when memory detection is not supported on the current platform.
var ErrMemoryUnsupportedPlatform = errors.New("total memory detection not supported on this platform")

// getTotalMemory returns the total system memory in bytes.
// On unsupported platforms, this returns an error.
func getTotalMemory() (uint64, error) {
	return 0, ErrMemoryUnsupportedPlatform
}
