// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package lmsstore

import "strconv"

// argN returns the textual PostgreSQL positional placeholder for index i
// (1-based), e.g. argN(3) == "3". Used when building queries whose argument
// count is dynamic.
func argN(i int) string {
	return strconv.Itoa(i)
}
