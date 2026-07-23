package modelhelper

import (
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/aarondl/sqlboiler/v4/queries"
	"github.com/paulmach/orb/encoding/wkb"
)

var (
	GeometryHexRg = regexp.MustCompile(`^[0-9A-Fa-f]+$`)
)

// Parses location string in format of "POINT(long lat)" or "ST_SetSRID(ST_MakePoint(long, lat), 4326)" or "HEX" into LocationPoint struct.
func ParseLongLatFromDatabaseReturnedLocation(location string) LocationPoint {
	res := LocationPoint{
		Lon: "0",
		Lat: "0",
	}

	if strings.HasPrefix(location, "POINT(") && strings.HasSuffix(location, ")") {
		location = strings.TrimPrefix(location, "POINT(")
		location = strings.TrimSuffix(location, ")")
	} else if strings.HasPrefix(location, "ST_SetSRID(ST_MakePoint(") && strings.HasSuffix(location, "), 4326)") {
		location = strings.TrimPrefix(location, "ST_SetSRID(ST_MakePoint(")
		location = strings.TrimSuffix(location, "), 4326)")
		location = strings.ReplaceAll(location, ",", "")
	} else if GeometryHexRg.MatchString(location) {
		data, err := hex.DecodeString(location)
		if err != nil {
			return res
		}

		geometry, err := wkb.Unmarshal(data)
		if err != nil {
			return res
		}

		location = fmt.Sprintf("%f %f", geometry.Bound().Center().Lon(), geometry.Bound().Center().Lat())
	} else {
		return res
	}

	parts := strings.Fields(location)
	if len(parts) != 2 {
		return res
	}

	res.Lon = strings.TrimSpace(parts[0])
	res.Lat = strings.TrimSpace(parts[1])
	return res

}

// Makes sure the location string is in format of "ST_SetSRID(ST_MakePoint(long, lat), 4326)" or "POINT(long lat)", and parses out the long and lat into LocationPoint struct.
func IsValidLongLatFormatForSaveToDatabase(location string) bool {
	if strings.HasPrefix(location, "POINT(") && strings.HasSuffix(location, ")") {
		location = strings.TrimPrefix(location, "POINT(")
		location = strings.TrimSuffix(location, ")")
	} else if strings.HasPrefix(location, "ST_SetSRID(ST_MakePoint(") && strings.HasSuffix(location, "), 4326)") {
		location = strings.TrimPrefix(location, "ST_SetSRID(ST_MakePoint(")
		location = strings.TrimSuffix(location, "), 4326)")
		location = strings.ReplaceAll(location, ",", "")
	}

	parts := strings.Fields(location)
	if len(parts) != 2 {
		return false
	}

	lon, err1 := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	lat, err2 := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if err1 != nil || err2 != nil {
		return false
	}

	return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90
}

// returns format like "ST_SetSRID(ST_MakePoint(long, lat), 4326)".
// This is to save to database.
func CreateSqlFromLongLat[T string | float64 | float32 | uint](long, lat T) string {
	return fmt.Sprintf("ST_SetSRID(ST_MakePoint(%v, %v), 4326)", long, lat)
}

type LocationPoint struct {
	Lon string `json:"lon"`
	Lat string `json:"lat"`
}

// Implements queries.QueryMod, to be used in sqlboiler queries to specify select columns.
type SelectColumns []string

func (s SelectColumns) Apply(q *queries.Query) {
	queries.SetSelect(q, s)
}
