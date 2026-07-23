package model

type Audits []Audit

func (o Audits) Etag() string {
	if len(o) > 0 {
		// the first in the list is always the most current
		return Etag(o[0].CreateAt)
	}
	return ""
}
