package main

//go:generate go run ./gen_model_field_types.go

import (
	"go/format"
	"log"
	"os"
	"reflect"
	"strings"
	"text/template"

	"github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
)

type FieldInfo struct {
	GoName   string
	JSONName string
}

type TypeInfo struct {
	TypeName string
	Fields   []FieldInfo
}

type TemplateData struct {
	Types []TypeInfo
}

const tmplSrc = `// Code automatically generated; 
// DO NOT EDIT

package utils

{{range $type := .Types}}
type {{$type.TypeName}}Column string

const (
{{- range $field := $type.Fields}}
    {{$type.TypeName}}{{$field.GoName}} {{$type.TypeName}}Column = "{{$field.JSONName}}"
{{- end}}
)

func (c {{$type.TypeName}}Column) IsValid() bool {
	switch c {
	{{- range $field := $type.Fields}}
	case {{$type.TypeName}}{{$field.GoName}}:
		return true
	{{- end}}
	default:
		return false
	}
}
{{end}}

type ColumnValidator interface {
    IsValid() bool
}
`

const tmplTs = `
export type ColumnNames =
{{range $type := .Types}}
	// {{$type.TypeName}}
{{- range $field := $type.Fields}}
   | "{{$field.JSONName}}"
{{- end}}
{{end}};

`

func main() {
	models := []any{
		// lms_models.Address{},
		// lms_models.TransportBrand{},
		// lms_models.Vehicle{},
		// lms_models.Seat{},
		// lms_models.Trip{},
		// lms_models.Route{},
		lms_models.User{},
		// lms_models.Reservation{},
		// lms_models.Schedule{},
		model.Channel{},
		model.Post{},
		model.Thread{},
		model.Status{},
		model.Session{},
		model.Role{},
		model.Reaction{},
		model.Job{},
		lms_models.LMSSession{},
		lms_models.Class{},
		lms_models.StudentClass{},
		lms_models.Branch{},
		lms_models.Attendance{},
		lms_models.AdditionalFee{},
		lms_models.Banner{},
		lms_models.BlogPost{},
		lms_models.ClassMedium{},
		lms_models.CourseLesson{},
		lms_models.Course{},
		lms_models.FeePackage{},
		lms_models.FeeRefund{},
		lms_models.Fileinfo{},
		lms_models.Homework{},
		lms_models.LeadActivity{},
		lms_models.Lead{},
		lms_models.Material{},
		lms_models.Notification{},
		lms_models.Payment{},
		lms_models.PostCategory{},
		lms_models.Submission{},
		lms_models.Task{},
		lms_models.Tuition{},
		lms_models.WeeklyReview{},
	}

	var types []TypeInfo

	for _, m := range models {
		t := reflect.TypeOf(m)
		typeName := t.Name()

		var fields []FieldInfo

		for f := range t.Fields() {
			f := f
			jsonTag := f.Tag.Get("json")
			if jsonTag == "" || jsonTag == "-" {
				continue
			}

			jsonName, _, _ := strings.Cut(jsonTag, ",")

			fields = append(fields, FieldInfo{
				GoName:   f.Name,
				JSONName: jsonName,
			})
		}

		types = append(types, TypeInfo{
			TypeName: typeName,
			Fields:   fields,
		})
	}

	data := TemplateData{
		Types: types,
	}

	tmpl := template.Must(template.New("col").Parse(tmplSrc))
	tmplTs := template.Must(template.New("col_ts").Parse(tmplTs))

	var out strings.Builder
	if err := tmpl.Execute(&out, data); err != nil {
		log.Fatal(err)
	}

	formatted, err := format.Source([]byte(out.String()))
	if err != nil {
		log.Fatal(err)
	}

	if err := os.WriteFile("../columns_defs.go", formatted, 0644); err != nil {
		log.Fatal(err)
	}

	var outTs strings.Builder
	if err := tmplTs.Execute(&outTs, data); err != nil {
		log.Fatal(err)
	}

	if err := os.WriteFile("../columns_defs.ts", []byte(outTs.String()), 0644); err != nil {
		log.Fatal(err)
	}

	log.Println("Generated: columns_defs.go")
}
