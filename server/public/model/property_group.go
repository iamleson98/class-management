package model

type PropertyGroup struct {
	ID   string
	Name string
}

func (pg *PropertyGroup) PreSave() {
	if pg.ID == "" {
		pg.ID = NewId()
	}
}
