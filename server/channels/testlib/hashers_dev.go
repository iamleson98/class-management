//go:build !production

package testlib

import "github.com/iamleson98/sitename/server/v8/channels/app/password/hashers"

func setupFastTestHasher() {
	hashers.SetTestHasher(hashers.FastTestHasher())
}
