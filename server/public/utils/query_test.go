package utils

import (
	"testing"

	"github.com/aarondl/sqlboiler/v4/queries/qmhelper"
)

func TestPostgresPlaceholders(t *testing.T) {
	type testCase struct {
		args int
		want string
	}

	cases := []testCase{
		{3, "?,?,?"},
		{6, "?,?,?,?,?,?"},
		{1, "?"},
		{0, ""},
		{-1, ""},
	}

	for _, c := range cases {
		if got := SqlPlaceholders(c.args); got != c.want {
			t.Errorf("SqlPlaceholders(%v) == %q, want %q", c.args, got, c.want)
		}
	}
}

func TestBuildAnds(t *testing.T) {
	type testCase struct {
		args []WhereCond[AddressColumn]
		want string
	}

	cases := []testCase{
		{[]WhereCond[AddressColumn]{}, "TRUE"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test", Operator: OperatorEq}}, "(name = ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test1", Operator: OperatorGt}, {Column: "age", Value: 12, Operator: OperatorLt}}, "(name > ? AND age < ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test1", Operator: OperatorEq}, {Column: "name", Value: "test2", Operator: OperatorEq}, {Column: "name", Value: "test3", Operator: OperatorEq}}, "(name = ? AND name = ? AND name = ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: []any{"test1", "test2", "test3"}, Operator: OperatorIn}, {Column: "age", Value: []any{1, 2, 3}, Operator: OperatorIn}}, "(name IN (?,?,?) AND age IN (?,?,?))"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: []any{"test1", "test2", "test3"}, Operator: OperatorNotIn}, {Column: "age", Value: []any{1, 2, 3}, Operator: OperatorNotIn}}, "(name NOT IN (?,?,?) AND age NOT IN (?,?,?))"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test", Operator: OperatorLike}}, "(name LIKE ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test", Operator: OperatorILike}}, "(name ILIKE ?)"},
	}

	for _, c := range cases {
		if got := build(c.args, "AND"); got.(qmhelper.WhereQueryMod).Clause != c.want {
			t.Errorf("got: %s, want: %s", got.(qmhelper.WhereQueryMod).Clause, c.want)
		}
	}
}

func TestBuildOrs(t *testing.T) {
	type testCase struct {
		args []WhereCond[AddressColumn]
		want string
	}

	cases := []testCase{
		{[]WhereCond[AddressColumn]{}, "TRUE"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test", Operator: OperatorEq}}, "(name = ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test1", Operator: OperatorGt}, {Column: "age", Value: 12, Operator: OperatorLt}}, "(name > ? OR age < ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test1", Operator: OperatorEq}, {Column: "name", Value: "test2", Operator: OperatorEq}, {Column: "name", Value: "test3", Operator: OperatorEq}}, "(name = ? OR name = ? OR name = ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: []any{"test1", "test2", "test3"}, Operator: OperatorIn}, {Column: "age", Value: []any{1, 2, 3}, Operator: OperatorIn}}, "(name IN (?,?,?) OR age IN (?,?,?))"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: []any{"test1", "test2", "test3"}, Operator: OperatorNotIn}, {Column: "age", Value: []any{1, 2, 3}, Operator: OperatorNotIn}}, "(name NOT IN (?,?,?) OR age NOT IN (?,?,?))"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test", Operator: OperatorLike}}, "(name LIKE ?)"},
		{[]WhereCond[AddressColumn]{{Column: "name", Value: "test", Operator: OperatorILike}}, "(name ILIKE ?)"},
	}

	for _, c := range cases {
		if got := build(c.args, "OR"); got.(qmhelper.WhereQueryMod).Clause != c.want {
			t.Errorf("got: %s, want: %s", got.(qmhelper.WhereQueryMod).Clause, c.want)
		}
	}
}
