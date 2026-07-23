package model

type MfaSecret struct {
	Secret string `json:"secret"`
	QRCode string `json:"qr_code"`
}
