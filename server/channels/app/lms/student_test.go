package lms

import (
	"testing"
)

func TestDeriveUsernameFromEmail(t *testing.T) {
	tests := []struct {
		email string
		want  string
	}{
		// The reported production case: plain local part, unchanged.
		{"nguyenan@sitename.me", "nguyenan"},
		// Mixed case is lower-cased.
		{"Nguyen.An@Sitename.me", "nguyen.an"},
		// Invalid characters are replaced with '-'.
		{"nguyen.an+01@sitename.me", "nguyen.an-01"},
		{"an_nguyen-99@x.com", "an_nguyen-99"},
		// Unicode local part: each non-ASCII rune becomes one '-'.
		{"ảnhnguyễn@x.com", "-nhnguy-n"},
		// No @ separator: the whole string is treated as the local part.
		{"nguyenan", "nguyenan"},
		// Empty email yields an empty candidate (caller falls back).
		{"", ""},
		{"@x.com", ""},
	}

	for _, tc := range tests {
		got := deriveUsernameFromEmail(tc.email)
		if got != tc.want {
			t.Errorf("deriveUsernameFromEmail(%q) = %q, want %q", tc.email, got, tc.want)
		}
	}
}
