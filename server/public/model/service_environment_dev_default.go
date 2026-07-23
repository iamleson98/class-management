//go:build !production

package model

func getDefaultServiceEnvironment() string {
	return ServiceEnvironmentDev
}
