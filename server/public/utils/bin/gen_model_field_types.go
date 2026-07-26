package main

//go:generate go run ./gen_model_field_types.go

import (
	"fmt"
	"go/format"
	"log"
	"os"
	"reflect"
	"strings"
	"text/template"

	"github.com/iamleson98/sitename/server/public/lms_models"
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

type ModalConfig struct {
	Model  any
	DbName string
}

func main() {
	models := []ModalConfig{
		{Model: lms_models.User{}, DbName: "users"},
		{Model: lms_models.LMSSession{}, DbName: "lms_sessions"},
		{Model: lms_models.Class{}, DbName: "classes"},
		{Model: lms_models.StudentClass{}, DbName: "student_classes"},
		{Model: lms_models.Branch{}, DbName: "branches"},
		{Model: lms_models.Attendance{}, DbName: "attendances"},
		{Model: lms_models.AdditionalFee{}, DbName: "additional_fees"},
		{Model: lms_models.Banner{}, DbName: "banners"},
		{Model: lms_models.BlogPost{}, DbName: "blog_posts"},
		{Model: lms_models.ClassMedium{}, DbName: "class_media"},
		{Model: lms_models.CourseLesson{}, DbName: "course_lessons"},
		{Model: lms_models.Course{}, DbName: "courses"},
		{Model: lms_models.FeePackage{}, DbName: "fee_packages"},
		{Model: lms_models.FeeRefund{}, DbName: "fee_refunds"},
		{Model: lms_models.Fileinfo{}, DbName: "fileinfos"},
		{Model: lms_models.Homework{}, DbName: "homeworks"},
		{Model: lms_models.LeadActivity{}, DbName: "lead_activities"},
		{Model: lms_models.Lead{}, DbName: "leads"},
		{Model: lms_models.Material{}, DbName: "materials"},
		{Model: lms_models.Notification{}, DbName: "notifications"},
		{Model: lms_models.Payment{}, DbName: "payments"},
		{Model: lms_models.PostCategory{}, DbName: "post_categories"},
		{Model: lms_models.Submission{}, DbName: "submissions"},
		{Model: lms_models.Task{}, DbName: "tasks"},
		{Model: lms_models.Tuition{}, DbName: "tuitions"},
		{Model: lms_models.WeeklyReview{}, DbName: "weekly_reviews"},
	}

	var types []TypeInfo

	for _, m := range models {
		t := reflect.TypeOf(m.Model)
		typeName := t.Name()

		var fields []FieldInfo

		for f := range t.Fields() {
			jsonTag := f.Tag.Get("json")
			if jsonTag == "" || jsonTag == "-" {
				continue
			}

			jsonName, _, _ := strings.Cut(jsonTag, ",")
			tableName := fmt.Sprintf("%s.%s", m.DbName, jsonName)

			fields = append(fields, FieldInfo{
				GoName:   f.Name,
				JSONName: tableName,
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
