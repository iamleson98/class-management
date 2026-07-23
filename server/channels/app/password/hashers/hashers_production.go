//go:build production

package hashers

// getLatestHasher returns the hasher to use for password operations.
// In production builds, this always returns the latestHasher.
func getLatestHasher() PasswordHasher {
	return latestHasher
}
