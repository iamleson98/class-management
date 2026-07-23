package model

var (
	PermissionManageWebsiteContent = &Permission{
		Id:    "manage_website_content",
		Name:  "Manage Website Content",
		Scope: PermissionScopeWebsite,
	}
	PermissionManageRollCall = &Permission{
		Id:    "manage_roll_call",
		Name:  "Manage Roll Call",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionManageCourse = &Permission{
		Id:    "manage_course",
		Name:  "Manage Course",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionEditClass = &Permission{
		Id:    "edit_class",
		Name:  "Edit Class",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionViewClass = &Permission{
		Id:    "view_class",
		Name:  "View Class",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionManageCoursePrice = &Permission{
		Id:    "manage_course_price",
		Name:  "Manage Course Price",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionManageLearningMaterial = &Permission{
		Id:    "manage_learning_material",
		Name:  "Manage Learning Material",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionSubmitExercise = &Permission{
		Id:    "submit_exercise",
		Name:  "Submit Exercise",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionReadFinaceReport = &Permission{
		Id:    "read_finance_report",
		Name:  "Read Finance Report",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionEditCalendar = &Permission{
		Id:    "edit_calendar",
		Name:  "Edit Calendar",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionViewCalendar = &Permission{
		Id:    "view_calendar",
		Name:  "View Calendar",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionEditLearningAbility = &Permission{
		Id:    "edit_learning_ability",
		Name:  "Edit Learning Ability",
		Scope: PermissionScopeLearningSystem,
	}
	PermissionViewLearningAbility = &Permission{
		Id:    "view_learning_ability",
		Name:  "View Learning Ability",
		Scope: PermissionScopeLearningSystem,
	}
)
