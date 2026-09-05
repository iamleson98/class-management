package utils

import (
	"encoding/json"
	"testing"
	"time"
)

func TestVnTimeUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string // expected MarshalJSON output ("YYYY-MM-DD"); "" allowed
	}{
		{"date only", `"2026-09-05"`, `"2026-09-05"`},
		{"empty string", `""`, `""`},
		{"null", `null`, `""`},
		// The old frontend sent toISOString() — a UTC timestamp that must
		// resolve to the date the Vietnamese user picked, not the UTC day.
		{"RFC3339 UTC midnight", `"2026-09-05T00:00:00.000Z"`, `"2026-09-05"`},
		{"RFC3339 UTC evening", `"2026-09-05T23:30:00Z"`, `"2026-09-06"`},
		{"RFC3339 with ICT offset", `"2026-09-05T08:00:00+07:00"`, `"2026-09-05"`},
		{"RFC3339 UTC prev-evening maps to ICT date", `"2026-09-04T17:00:00Z"`, `"2026-09-05"`},
		{"legacy datetime", `"2026-09-05 08:30:00"`, `"2026-09-05"`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var v VnTime
			if err := json.Unmarshal([]byte(tc.input), &v); err != nil {
				t.Fatalf("Unmarshal(%s) error: %v", tc.input, err)
			}
			got, err := json.Marshal(v)
			if err != nil {
				t.Fatalf("Marshal error: %v", err)
			}
			if string(got) != tc.want {
				t.Errorf("round trip %s -> %s, want %s", tc.input, got, tc.want)
			}
		})
	}

	t.Run("invalid input errors", func(t *testing.T) {
		var v VnTime
		if err := json.Unmarshal([]byte(`"05/09/2026"`), &v); err == nil {
			t.Error("expected parse error for '05/09/2026'")
		}
	})
}

// The in-memory representation must be the UTC midnight of the represented
// date so that DATE casts land on the same calendar date under any postgres
// session time zone (the deployed stack defaults to TZ=UTC).
func TestVnTimeValueIsUTCMidnight(t *testing.T) {
	var v VnTime
	if err := json.Unmarshal([]byte(`"2026-09-05"`), &v); err != nil {
		t.Fatal(err)
	}
	val, err := v.Value()
	if err != nil {
		t.Fatal(err)
	}
	tm, ok := val.(time.Time)
	if !ok {
		t.Fatalf("Value() returned %T, want time.Time", val)
	}
	if got := tm.UTC().Format("2006-01-02 15:04"); got != "2026-09-05 00:00" {
		t.Errorf("Value() = %s, want 2026-09-05 00:00 UTC", got)
	}
}

func TestVnTimeScan(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  string
	}{
		{"postgres DATE as time", time.Date(2026, 9, 5, 0, 0, 0, 0, time.UTC), `"2026-09-05"`},
		{"timestamptz midnight UTC", time.Date(2026, 9, 5, 0, 0, 0, 0, time.UTC), `"2026-09-05"`},
		{"string date", "2026-09-05", `"2026-09-05"`},
		{"string datetime", "2026-09-05 08:30:00", `"2026-09-05"`},
		{"nil", nil, `""`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var v VnTime
			if err := v.Scan(tc.input); err != nil {
				t.Fatalf("Scan(%v) error: %v", tc.input, err)
			}
			got, _ := json.Marshal(v)
			if string(got) != tc.want {
				t.Errorf("Scan(%v) -> %s, want %s", tc.input, got, tc.want)
			}
		})
	}
}

func TestNullVnTime(t *testing.T) {
	t.Run("date in / date out", func(t *testing.T) {
		var n NullVnTime
		if err := json.Unmarshal([]byte(`"2026-12-30"`), &n); err != nil {
			t.Fatal(err)
		}
		if !n.Valid {
			t.Fatal("expected Valid=true")
		}
		got, _ := json.Marshal(n)
		if string(got) != `"2026-12-30"` {
			t.Errorf("got %s", got)
		}
		val, err := n.Value()
		if err != nil {
			t.Fatal(err)
		}
		if val == nil {
			t.Fatal("Value() should not be nil for valid date")
		}
	})

	t.Run("null round trip", func(t *testing.T) {
		var n NullVnTime
		if err := json.Unmarshal([]byte(`null`), &n); err != nil {
			t.Fatal(err)
		}
		if n.Valid {
			t.Fatal("expected Valid=false")
		}
		val, err := n.Value()
		if err != nil || val != nil {
			t.Fatalf("Value() = %v, %v; want nil, nil", val, err)
		}
		got, _ := json.Marshal(n)
		if string(got) != "null" {
			t.Errorf("got %s, want null", got)
		}
	})

	t.Run("scan nil", func(t *testing.T) {
		var n NullVnTime
		if err := n.Scan(nil); err != nil {
			t.Fatal(err)
		}
		if n.Valid {
			t.Fatal("expected Valid=false after nil scan")
		}
	})

	t.Run("empty string is invalid", func(t *testing.T) {
		var n NullVnTime
		if err := json.Unmarshal([]byte(`""`), &n); err != nil {
			t.Fatal(err)
		}
		if n.Valid {
			t.Fatal("expected Valid=false for empty string")
		}
	})

	t.Run("NewNullVnTime helper", func(t *testing.T) {
		n, err := NewNullVnTime("2026-09-05")
		if err != nil || !n.Valid {
			t.Fatalf("NewNullVnTime(2026-09-05) = %+v, %v", n, err)
		}
		n, err = NewNullVnTime("")
		if err != nil || n.Valid {
			t.Fatalf("NewNullVnTime('') = %+v, %v", n, err)
		}
		if _, err := NewNullVnTime("not-a-date"); err == nil {
			t.Fatal("expected error for invalid date")
		}
	})
}

// The wire contract used by the LMS session create flow: a full ISO timestamp
// (what toISOString() emits) must decode without error — the original 400
// "api.lms.session.create_body.app_error" was exactly this parse failing.
func TestVnTimeStructDecode(t *testing.T) {
	type payload struct {
		Date VnTime `json:"date"`
	}
	var p payload
	if err := json.Unmarshal([]byte(`{"date":"2026-09-05T00:00:00.000Z"}`), &p); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	got, _ := json.Marshal(p.Date)
	if string(got) != `"2026-09-05"` {
		t.Errorf("date = %s, want 2026-09-05", got)
	}
}
