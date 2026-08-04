package utils

import (
	"database/sql/driver"
	"fmt"
	"time"
)

type VnTime time.Time

// Parse "YYYY-MM-DD" as GMT+7, store as UTC
func (t *VnTime) UnmarshalJSON(s []byte) error {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		s = s[1 : len(s)-1]
	}
	loc, err := time.LoadLocation("Asia/Bangkok") // Vietnam time zone
	if err != nil {
		return err
	}
	tim, err := time.ParseInLocation("2006-01-02", string(s), loc)
	if err != nil {
		return err
	}
	*t = VnTime(tim.UTC())
	return nil
}

// Output as "YYYY-MM-DD"
func (t VnTime) MarshalJSON() ([]byte, error) {
	tt := time.Time(t)
	s := fmt.Sprintf("\"%s\"", tt.Format("2006-01-02"))
	return []byte(s), nil
}

// Save to DB as UTC
func (t VnTime) Value() (driver.Value, error) {
	return time.Time(t).UTC(), nil
}

// Load from DB
func (t *VnTime) Scan(value any) error {
	if value == nil {
		*t = VnTime(time.Time{})
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		*t = VnTime(v.UTC())
		return nil
	case []byte:
		parsed, err := time.Parse("2006-01-02 15:04:05", string(v))
		if err != nil {
			return err
		}
		*t = VnTime(parsed.UTC())
		return nil
	case string:
		parsed, err := time.Parse("2006-01-02 15:04:05", v)
		if err != nil {
			return err
		}
		*t = VnTime(parsed.UTC())
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into VnTime", value)
	}
}
