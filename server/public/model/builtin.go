package model

// NewPointer returns a pointer to the object passed.
func NewPointer[T any](t T) *T { return &t }

// SafeDereference returns the zero value of T if t is nil.
// Otherwise, it returns t dereferenced.
func SafeDereference[T any](t *T) T {
	if t == nil {
		var t T
		return t
	}
	return *t
}
