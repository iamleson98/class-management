package utils

import (
	"bytes"
	"errors"
	"fmt"
	"strings"

	"github.com/aarondl/sqlboiler/v4/queries"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	"github.com/aarondl/sqlboiler/v4/queries/qmhelper"
)

type Operator string

const (
	OperatorEq       Operator = Operator(qmhelper.EQ)
	OperatorNeq      Operator = Operator(qmhelper.NEQ)
	OperatorGt       Operator = Operator(qmhelper.GT)
	OperatorLt       Operator = Operator(qmhelper.LT)
	OperatorGte      Operator = Operator(qmhelper.GTE)
	OperatorLte      Operator = Operator(qmhelper.LTE)
	OperatorIn       Operator = "IN"
	OperatorNotIn    Operator = "NOT IN"
	OperatorLike     Operator = "LIKE"
	OperatorILike    Operator = "ILIKE"
	OperatorNotLike  Operator = "NOT LIKE"
	OperatorNotILike Operator = "NOT ILIKE"
)

func (o Operator) IsValid() bool {
	switch o {
	case OperatorEq, OperatorNeq, OperatorGt, OperatorLt, OperatorGte, OperatorLte, OperatorIn, OperatorNotIn, OperatorLike, OperatorILike, OperatorNotLike, OperatorNotILike:
		return true
	default:
		return false
	}
}

type SearchOpts[T ColumnValidator] struct {
	WhereAnds  WhereAnds[T] `json:"where_ands"`
	WhereOrs   WhereOrs[T]  `json:"where_ors"`
	Orderings  OrderBys[T]  `json:"orderings"`
	Limit      int          `json:"limit"`  // Only apply if > 0
	Offset     int          `json:"offset"` // Only apply if >= 0
	CountTotal bool         `json:"count_total"`
}

type ResponseList struct {
	Items      any   `json:"items"`
	TotalCount int64 `json:"total_count"`
}

// set limit and offset to -1 to exclude them from count query
func (s *SearchOpts[T]) ExludePaginationForCount() *SearchOpts[T] {
	if s == nil {
		return nil
	}

	return &SearchOpts[T]{
		Limit:     -1,
		Offset:    -1,
		WhereAnds: s.WhereAnds,
		WhereOrs:  s.WhereOrs,
		Orderings: s.Orderings,
	}
}

var _ qm.QueryMod = (*SearchOpts[ColumnValidator])(nil)

func (s *SearchOpts[T]) Apply(q *queries.Query) {
	if s == nil {
		return
	}

	if s.Limit > 0 {
		queries.SetLimit(q, s.Limit)
	}
	if s.Offset >= 0 {
		queries.SetOffset(q, s.Offset)
	}
	s.WhereAnds.Apply(q)
	s.WhereOrs.Apply(q)
	s.Orderings.Apply(q)
}

// Checks if options are provided valid
func (s *SearchOpts[T]) IsValid() error {
	if s == nil {
		return errors.New("SearchOpts cannot be nil")
	}

	for _, cond := range s.WhereAnds {
		if !cond.IsValid() {
			return errors.New("Invalid WhereAnds condition")
		}
	}
	for _, cond := range s.WhereOrs {
		if !cond.IsValid() {
			return errors.New("Invalid WhereOrs condition")
		}
	}
	for _, order := range s.Orderings {
		if !order.IsValid() {
			return errors.New("Invalid Orderings condition")
		}
	}

	return nil
}

// can be either "ASC" or "DESC"
type OrderDirection string

const (
	OrderDirectionAsc  OrderDirection = "ASC"
	OrderDirectionDesc OrderDirection = "DESC"
)

type OrderBy[T ColumnValidator] struct {
	Column T              `json:"column"`
	Dir    OrderDirection `json:"dir"`
}

func (o *OrderBy[T]) IsValid() bool {
	if o == nil {
		return false
	}
	return o.Column.IsValid()
}

func (o *OrderBy[T]) Apply(q *queries.Query) {
	if o == nil {
		return
	}

	queries.AppendOrderBy(q, o.String())
}

func (o OrderBy[T]) String() string {
	return fmt.Sprintf("%v %s", o.Column, o.Dir)
}

type OrderBys[T ColumnValidator] []OrderBy[T]

func (o *OrderBys[T]) Apply(q *queries.Query) {
	if o == nil {
		return
	}

	for _, item := range *o {
		item.Apply(q)
	}
}

type WhereCond[T ColumnValidator] struct {
	Column   T        `json:"column"`
	Value    any      `json:"value"`
	Operator Operator `json:"operator"`
}

func (w *WhereCond[T]) IsValid() bool {
	if w == nil {
		return false
	}
	return w.Column.IsValid() && w.Operator.IsValid()
}

// Apply implements [qm.QueryMod].
func (w *WhereCond[T]) Apply(q *queries.Query) {
	if w == nil {
		return
	}

	w.build().Apply(q)
}

func build[T ColumnValidator](conds []WhereCond[T], sep string) qm.QueryMod {
	if len(conds) == 0 {
		return qmhelper.WhereQueryMod{
			Clause: "TRUE",
		}
	}

	var clause bytes.Buffer
	clause.WriteByte('(')
	args := []any{}

	for i, cond := range conds {
		mod := cond.build()
		if i < (len(conds) - 1) {
			fmt.Fprintf(&clause, "%s %s ", mod.Clause, sep)
		} else {
			fmt.Fprintf(&clause, "%s)", mod.Clause)
		}
		args = append(args, mod.Args...)
	}

	return qmhelper.WhereQueryMod{
		Clause: clause.String(),
		Args:   args,
	}
}

func (w *WhereCond[T]) build() qmhelper.WhereQueryMod {
	noop := qmhelper.WhereQueryMod{
		Clause: "TRUE",
	}
	if w == nil {
		return noop
	}

	var clause string
	var args []any

	if w.Operator == OperatorIn || w.Operator == OperatorNotIn {
		if v, ok := w.Value.([]any); ok && len(v) > 0 {
			if w.Operator == OperatorIn {
				clause = fmt.Sprintf("%v IN (%s)", w.Column, SqlPlaceholders(len(v)))
			} else {
				clause = fmt.Sprintf("%v NOT IN (%s)", w.Column, SqlPlaceholders(len(v)))
			}
			args = v
		}
	} else {
		clause = fmt.Sprintf("%v %v ?", w.Column, w.Operator)
		args = []any{w.Value}
	}

	if clause != "" && len(args) > 0 {
		return qmhelper.WhereQueryMod{
			Clause: clause,
			Args:   args,
		}
	}

	return noop
}

// A custom implementation of [qm.QueryMod] for AND conditions.
type WhereAnds[T ColumnValidator] []WhereCond[T]

// Apply implements [qm.QueryMod].
func (w *WhereAnds[T]) Apply(q *queries.Query) {
	if w == nil {
		return
	}
	build(*w, "AND").Apply(q)
}

// A custom implementation of [qm.QueryMod] for OR conditions.
type WhereOrs[T ColumnValidator] []WhereCond[T]

// Apply implements [qm.QueryMod].
func (w *WhereOrs[T]) Apply(q *queries.Query) {
	if w == nil {
		return
	}
	build(*w, "OR").Apply(q)
}

func SqlPlaceholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.Repeat(",?", n)[1:]
}

// specifies if you want to soft delete, hard delete or restore a record. Used in delete endpoints that support both soft and hard delete and restore endpoints
type DeleteOrRestore string

const (
	SoftDelete DeleteOrRestore = "soft_delete"
	HardDelete DeleteOrRestore = "hard_delete"
	Restore    DeleteOrRestore = "restore"
)

func (d DeleteOrRestore) IsValid() bool {
	return d == SoftDelete || d == HardDelete || d == Restore
}
