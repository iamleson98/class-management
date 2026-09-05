package utils

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// VnTime is a calendar DATE (no time-of-day, no zone) stored in memory as
// the UTC midnight of the date it represents. Keeping the in-memory form at
// UTC midnight makes every persistence path land on the same calendar date
// regardless of the PostgreSQL session time zone:
//
//   - Value()  -> UTC midnight -> DATE cast = the represented date under any
//     session TimeZone (UTC, Asia/Bangkok, ...).
//   - Scan()   -> any incoming time is normalized back to UTC midnight of its
//     UTC calendar date (postgres DATE values arrive as UTC-midnight times).
//   - MarshalJSON / UnmarshalJSON exchange "YYYY-MM-DD".
type VnTime time.Time

// vnLocation is the reference zone for interpreting zoneless wall-clock input.
var vnLocation = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Bangkok") // Vietnam time zone (UTC+7)
	if err != nil {
		return time.FixedZone("ICT", 7*3600)
	}
	return loc
}()

// utcMidnight returns t's calendar date (in t's own zone) as UTC midnight.
func utcMidnight(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// UnmarshalJSON accepts:
//   - "" or null            -> zero VnTime
//   - "YYYY-MM-DD"          -> that calendar date
//   - RFC3339 / ISO-8601    -> the calendar date the instant falls on in
//     Vietnam (Asia/Bangkok), so clients that send a full timestamp (e.g.
//     `2026-09-05T00:00:00.000Z` built by toISOString) still resolve to the
//     date a Vietnamese user picked, not the previous UTC day.
//   - "YYYY-MM-DD HH:MM:SS" -> the calendar date in Vietnam.
func (t *VnTime) UnmarshalJSON(s []byte) error {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		s = s[1 : len(s)-1]
	}
	if len(s) == 0 || string(s) == "null" {
		*t = VnTime(time.Time{})
		return nil
	}

	// 1) Plain date form — the canonical wire shape.
	if tim, err := time.Parse("2006-01-02", string(s)); err == nil {
		*t = VnTime(utcMidnight(tim))
		return nil
	}

	// 2) Full RFC3339 / ISO-8601 timestamp — resolve the instant's date in
	//    Vietnam, then store as that date's UTC midnight.
	if tim, err := time.Parse(time.RFC3339, string(s)); err == nil {
		*t = VnTime(utcMidnight(tim.In(vnLocation)))
		return nil
	}

	// 3) Legacy "YYYY-MM-DD HH:MM[:SS]" — date in Vietnam.
	if tim, err := time.ParseInLocation("2006-01-02 15:04:05", string(s), vnLocation); err == nil {
		*t = VnTime(utcMidnight(tim))
		return nil
	}

	return fmt.Errorf("VnTime: cannot parse %q (want \"YYYY-MM-DD\" or RFC3339)", string(s))
}

// MarshalJSON outputs "YYYY-MM-DD" (empty for the zero value).
func (t VnTime) MarshalJSON() ([]byte, error) {
	tt := time.Time(t)
	if tt.IsZero() {
		return []byte(`""`), nil
	}
	s := fmt.Sprintf("\"%s\"", tt.Format("2006-01-02"))
	return []byte(s), nil
}

// Value writes the represented calendar date as UTC midnight (driver.Valuer).
// A DATE column cast is therefore the exact represented date under any
// PostgreSQL session TimeZone. The zero value persists as 0001-01-01 (VnTime
// backs NOT NULL DATE columns; use NullVnTime for optional dates).
func (t VnTime) Value() (driver.Value, error) {
	return time.Time(t).UTC(), nil
}

// Scan loads a DATE/timestamp into the UTC midnight of its UTC calendar date.
func (t *VnTime) Scan(value any) error {
	if value == nil {
		*t = VnTime(time.Time{})
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		*t = VnTime(utcMidnight(v.UTC()))
		return nil
	case []byte:
		return t.scanString(string(v))
	case string:
		return t.scanString(v)
	default:
		return fmt.Errorf("cannot scan type %T into VnTime", value)
	}
}

func (t *VnTime) scanString(v string) error {
	// Date-only form (postgres DATE via text protocol).
	if len(v) >= 10 {
		if tim, err := time.Parse("2006-01-02", v[:10]); err == nil {
			*t = VnTime(utcMidnight(tim))
			return nil
		}
	}
	if tim, err := time.Parse("2006-01-02 15:04:05", v); err == nil {
		*t = VnTime(utcMidnight(tim))
		return nil
	}
	if tim, err := time.Parse(time.RFC3339, v); err == nil {
		*t = VnTime(utcMidnight(tim.In(vnLocation)))
		return nil
	}
	return fmt.Errorf("VnTime: cannot scan %q", v)
}

// NullVnTime is a nullable VnTime for optional DATE columns (e.g.
// classes.end_date). Invalid/nil marshals as JSON null and persists as SQL
// NULL; otherwise it behaves exactly like VnTime.
type NullVnTime struct {
	VnTime VnTime
	Valid  bool
}

// NewNullVnTime wraps a date-only "YYYY-MM-DD" string ("" -> invalid).
func NewNullVnTime(dateStr string) (NullVnTime, error) {
	n := NullVnTime{}
	if dateStr == "" {
		return n, nil
	}
	if err := n.VnTime.UnmarshalJSON([]byte(`"` + dateStr + `"`)); err != nil {
		return NullVnTime{}, err
	}
	if time.Time(n.VnTime).IsZero() {
		return NullVnTime{}, nil
	}
	n.Valid = true
	return n, nil
}

// MarshalJSON emits null when invalid, else "YYYY-MM-DD".
func (n NullVnTime) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return n.VnTime.MarshalJSON()
}

// UnmarshalJSON accepts null/"" (invalid) or any VnTime input form.
func (n *NullVnTime) UnmarshalJSON(s []byte) error {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		inner := s[1 : len(s)-1]
		if len(inner) == 0 {
			n.VnTime, n.Valid = VnTime(time.Time{}), false
			return nil
		}
	}
	if string(s) == "null" {
		n.VnTime, n.Valid = VnTime(time.Time{}), false
		return nil
	}
	var t VnTime
	if err := t.UnmarshalJSON(s); err != nil {
		return err
	}
	if time.Time(t).IsZero() {
		n.VnTime, n.Valid = VnTime(time.Time{}), false
		return nil
	}
	n.VnTime, n.Valid = t, true
	return nil
}

// Value persists SQL NULL when invalid.
func (n NullVnTime) Value() (driver.Value, error) {
	if !n.Valid {
		return nil, nil
	}
	return n.VnTime.Value()
}

// Scan loads NULL or a date into the wrapper.
func (n *NullVnTime) Scan(value any) error {
	if value == nil {
		n.VnTime, n.Valid = VnTime(time.Time{}), false
		return nil
	}
	var t VnTime
	if err := t.Scan(value); err != nil {
		return err
	}
	if time.Time(t).IsZero() {
		n.VnTime, n.Valid = VnTime(time.Time{}), false
		return nil
	}
	n.VnTime, n.Valid = t, true
	return nil
}
