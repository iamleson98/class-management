package utils

import _ "embed"

//go:embed license-public-key.txt
var productionPublicKey []byte

//go:embed license-public-key-test.txt
var testPublicKey []byte
