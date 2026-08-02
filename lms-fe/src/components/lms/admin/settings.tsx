/* eslint-disable jsx-a11y/alt-text */
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Settings, Building2, Users, Image, Plus, UserX, UserCheck } from 'lucide-react'
import { createBranchSchema, createUserSchema, type CreateBranchInput, type CreateUserInput } from '@/lib/schemas'
import { getBranches, getUsers, updateUser, deactivateUser, reactivateUser, getBanners } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { ErrorState } from '@/components/lms/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useLMSStore } from '@/store/lms-store'
import { staggerContainer } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'
import { Field } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import UserForm from './components/user-form'
import BranchForm from './components/branch-form'

// Staff roles a super admin / admin can assign to an employee. Keys match the
// canonical lowercase role IDs stored in the user's `roles` string.
const ROLE_LABELS: Record<string, string> = {
  lms_super_admin: 'Super Admin',
  lms_admin: 'Quản lý',
  lms_counselor: 'Tư vấn viên',
  lms_teacher: 'Giáo viên',
  lms_accountant: 'Kế toán',
  lms_marketing: 'Marketing',
}

// Priority order to pick a single primary role for display from a roles string.
const ROLE_PRIORITY: string[] = [
  'lms_super_admin', 'lms_admin', 'lms_counselor', 'lms_teacher',
  'lms_accountant', 'lms_marketing',
]

/** Extract the primary (highest-priority) staff role from a roles string. */
function primaryRole(rolesStr: string): string {
  const parts = (rolesStr || '').split(/\s+/).filter(Boolean)
  for (const r of ROLE_PRIORITY) {
    if (parts.includes(r)) return r
  }
  return ''
}

/**
 * Replace the primary LMS staff role in a roles string with `newRole`, keeping
 * system roles (system_user, system_admin) and any other non-staff roles intact.
 */
function withRole(rolesStr: string, newRole: string): string {
  const parts = (rolesStr || '').split(/\s+/).filter(Boolean)
  const kept = parts.filter((r) => !ROLE_LABELS[r])
  kept.push(newRole)
  return Array.from(new Set(kept)).join(' ')
}

export default function AdminSettings() {
  const { toast } = useToast()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()

  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)

  const branchForm = useForm<CreateBranchInput>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: { name: '', address: '', phone: '' },
  })

  const userForm = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstname: '', lastname: '', email: '', phone: '', roles: 'lms_teacher', password: '' },
  })

  const { data: branches = [], isLoading: branchesLoading, isError: isBranchesError, refetch: refetchBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => getBranches(),
  })

  const { data: users, isLoading: usersLoading, isError: isUsersError, refetch: refetchUsers } = useQuery({
    queryKey: ['users', includeInactive],
    queryFn: () => getUsers({ staffOnly: true, includeInactive }),
  })

  const { data: banners = [], isLoading: bannersLoading, isError: isBannersError, refetch: refetchBanners } = useQuery({
    queryKey: ['banners'],
    queryFn: () => getBanners(),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string }) => updateUser(id, { roles } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: t('settings.roleUpdated', 'Cập nhật vai trò thành công') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('settings.roleUpdateFailed', 'Cập nhật vai trò thất bại'), variant: 'destructive' }),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: t('settings.deactivateSuccess', 'Đã vô hiệu hóa người dùng') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('settings.deactivateFailed', 'Vô hiệu hóa thất bại'), variant: 'destructive' }),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: t('settings.reactivateSuccess', 'Đã kích hoạt lại người dùng') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('settings.reactivateFailed', 'Kích hoạt lại thất bại'), variant: 'destructive' }),
  })

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
      <PageHeader
        title={t('settings.title', 'Cài đặt hệ thống')}
        description={t('settings.description', 'Quản lý chi nhánh, người dùng và banner')}
        icon={Settings}
        accentColor="sky"
      />

      {/* Branches Section */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        <Card className="rounded-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sky-600" />
                {t('settings.manageBranches', 'Quản lý chi nhánh')}
                <Badge variant="secondary" className="text-xs">{branches.length}</Badge>
              </CardTitle>
              <Button onClick={() => { branchForm.reset({ name: '', address: '', phone: '' }); setBranchDialogOpen(true) }} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('settings.addBranch', 'Thêm chi nhánh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {isBranchesError ? (
              <div className="py-8 text-center">
                <ErrorState onRetry={() => refetchBranches()} />
              </div>
            ) : branchesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
              </div>
            ) : branches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('settings.noBranches', 'Chưa có chi nhánh. Nhấn nút thêm để tạo chi nhánh đầu tiên.')}</p>
            ) : (
              <div className="rounded-xl overflow-hidden border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Tên')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('settings.address', 'Địa chỉ')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold hidden sm:table-cell">{t('common.phone', 'SĐT')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch: any) => (
                      <TableRow key={branch.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-sm">{branch.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{branch.address || '-'}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{branch.phone || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Users Section */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        <Card className="rounded-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-600" />
                {t('settings.manageEmployees', 'Quản lý nhân viên')}
                <Badge variant="secondary" className="text-xs">{users?.items?.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-3">
                <Field orientation="horizontal">
                  <Checkbox id="include-inactive" checked={includeInactive} onCheckedChange={(checked) => setIncludeInactive(checked as boolean)} />
                  <Label htmlFor="include-inactive">{t('settings.includeInactive', 'Bao gồm đã vô hiệu')}</Label>
                </Field>
                <Button onClick={() => { userForm.reset({ firstname: '', lastname: '', email: '', phone: '', roles: 'lms_teacher', password: '' }); setUserDialogOpen(true) }} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('settings.addUser', 'Thêm người dùng')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {isUsersError ? (
              <div className="py-8 text-center">
                <ErrorState onRetry={() => refetchUsers()} />
              </div>
            ) : usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
              </div>
            ) : users?.items?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('settings.noUsers', 'Chưa có người dùng.')}</p>
            ) : (
              <div className="rounded-xl overflow-hidden border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Tên')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('common.email', 'Email')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('common.phone', 'SĐT')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold">{t('settings.role', 'Vai trò')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold">{t('settings.status', 'Trạng thái')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold text-right">{t('common.actions', 'Hành động')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(users?.items || []).map((user: any) => {
                      const isActive = !user.deleteat
                      const role = primaryRole(user.roles)
                      // A user cannot reassign their own role (also enforced server-side).
                      const isSelf = !!authUser && user.id === authUser.id
                      return (
                        <TableRow key={user.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-sm">
                            {user.nickname || user.name || [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{user.phone || '-'}</TableCell>
                          <TableCell>
                            <Select
                              value={role}
                              disabled={isSelf}
                              onValueChange={(newRole) => roleMutation.mutate({ id: user.id, roles: withRole(user.roles, newRole) })}
                            >
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue placeholder={t('settings.selectRole', 'Chọn vai trò')} />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isActive ? 'default' : 'secondary'} className={`rounded-full text-xs ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                              {isActive ? t('settings.active', 'Đang hoạt động') : t('settings.inactive', 'Đã vô hiệu')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deactivateMutation.isPending || isSelf}
                                onClick={() => deactivateMutation.mutate(user.id)}
                              >
                                <UserX className="h-3.5 w-3.5 mr-1" />
                                {t('settings.deactivate', 'Vô hiệu')}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                disabled={reactivateMutation.isPending || isSelf}
                                onClick={() => reactivateMutation.mutate(user.id)}
                              >
                                <UserCheck className="h-3.5 w-3.5 mr-1" />
                                {t('settings.reactivate', 'Kích hoạt lại')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Banners Section */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        <Card className="rounded-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Image className="h-4 w-4 text-sky-600" />
              {t('settings.manageBanners', 'Quản lý banner')}
              <Badge variant="secondary" className="text-xs">{banners.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {isBannersError ? (
              <div className="py-8 text-center">
                <ErrorState onRetry={() => refetchBanners()} />
              </div>
            ) : bannersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
              </div>
            ) : banners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('settings.noBanners', 'Chưa có banner.')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {banners.map((banner: any) => (
                  <div key={banner.id} className="rounded-xl border overflow-hidden">
                    <div className="h-32 bg-muted">
                      {banner.imageUrl ? (
                        <img src={banner.imageUrl} alt={banner.title || ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <Image className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium truncate">{banner.title || t('settings.noTitle', 'Không tiêu đề')}</p>
                      <Badge variant={banner.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1">
                        {banner.isActive ? t('settings.active', 'Đang hiển thị') : t('settings.hidden', 'Ẩn')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Branch Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settings.addBranch', 'Thêm chi nhánh')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <BranchForm onDone={() => setBranchDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settings.addUser', 'Thêm người dùng')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <UserForm onDone={() => setUserDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
