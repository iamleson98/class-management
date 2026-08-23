// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"reflect"
	"testing"
)

// TestMakeDefaultLMSRolesGrants verifies the permission grants each LMS role
// carries — the contract the frontend views depend on (every endpoint a
// role's screens call must be permitted).
func TestMakeDefaultLMSRolesGrants(t *testing.T) {
	roles := MakeDefaultLMSRoles()

	has := func(permissions []string, id string) bool {
		for _, p := range permissions {
			if p == id {
				return true
			}
		}
		return false
	}

	t.Run("student can read sessions materials homework reviews", func(t *testing.T) {
		perms := roles[RoleLmsStudentRoleId].Permissions
		for _, id := range []string{
			PermissionLmsManageSessions.Id,
			PermissionLmsManageMaterials.Id,
			PermissionLmsManageHomework.Id,
			PermissionLmsManageWeeklyReviews.Id,
			PermissionLmsManageDashboard.Id,
		} {
			if !has(perms, id) {
				t.Errorf("lms_student missing permission %s", id)
			}
		}
	})

	t.Run("parent can read children data", func(t *testing.T) {
		perms := roles[RoleLmsParentRoleId].Permissions
		for _, id := range []string{
			PermissionLmsManageStudents.Id,
			PermissionLmsManageSessions.Id,
			PermissionLmsManageHomework.Id,
			PermissionLmsManageWeeklyReviews.Id,
			PermissionLmsManageClassMedia.Id,
			PermissionLmsManageTuition.Id,
		} {
			if !has(perms, id) {
				t.Errorf("lms_parent missing permission %s", id)
			}
		}
	})

	t.Run("teacher can manage sessions attendance homework media", func(t *testing.T) {
		perms := roles[RoleLmsTeacherRoleId].Permissions
		for _, id := range []string{
			PermissionLmsManageSessions.Id,
			PermissionLmsManageAttendance.Id,
			PermissionLmsManageStudents.Id, // class-roster reads for attendance
			PermissionLmsManageHomework.Id,
			PermissionLmsManageWeeklyReviews.Id,
			PermissionLmsManageMaterials.Id,
			PermissionLmsManageClassMedia.Id,
		} {
			if !has(perms, id) {
				t.Errorf("lms_teacher missing permission %s", id)
			}
		}
	})

	t.Run("marketing can view leads for the funnel dashboard", func(t *testing.T) {
		perms := roles[RoleLmsMarketingRoleId].Permissions
		if !has(perms, PermissionLmsManageLeads.Id) {
			t.Error("lms_marketing missing lms_manage_leads")
		}
	})

	t.Run("admin has every LMS permission including notifications", func(t *testing.T) {
		perms := roles[RoleLmsAdminRoleId].Permissions
		if !has(perms, PermissionLmsViewNotifications.Id) {
			t.Error("lms_admin missing lms_view_notifications")
		}
		expected := len(LearningSystemScopedPermissions)
		if len(perms) != expected {
			t.Errorf("lms_admin has %d permissions, want all %d", len(perms), expected)
		}
	})

	t.Run("super admin has every LMS permission", func(t *testing.T) {
		perms := roles[RoleLmsSuperAdminRoleId].Permissions
		expected := len(LearningSystemScopedPermissions)
		if len(perms) != expected {
			t.Errorf("lms_super_admin has %d permissions, want all %d", len(perms), expected)
		}
	})
}

// TestLMSRolesComplete ensures every built-in role is present in the set —
// the migration iterates this map and must cover all roles.
func TestLMSRolesComplete(t *testing.T) {
	roles := MakeDefaultLMSRoles()
	want := []string{
		RoleLmsSuperAdminRoleId,
		RoleLmsAdminRoleId,
		RoleLmsCounselorRoleId,
		RoleLmsTeacherRoleId,
		RoleLmsAccountantRoleId,
		RoleLmsMarketingRoleId,
		RoleLmsParentRoleId,
		RoleLmsStudentRoleId,
	}
	if len(roles) != len(want) {
		t.Errorf("role set has %d entries, want %d", len(roles), len(want))
	}
	for _, id := range want {
		role, ok := roles[id]
		if !ok {
			t.Fatalf("missing role %s", id)
		}
		if !role.BuiltIn {
			t.Errorf("role %s should be built-in", id)
		}
		if reflect.DeepEqual(role.Permissions, []string{}) {
			t.Errorf("role %s has no permissions", id)
		}
	}
}
