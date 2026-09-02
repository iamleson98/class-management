/* eslint-disable jsx-a11y/alt-text */
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Settings, Building2, Users, Image, Plus } from 'lucide-react'
import { createBranchSchema, createUserSchema, type CreateBranchInput, type CreateUserInput } from '@/lib/schemas'
import { getBranches, getUsers, updateUser, deactivateUser, reactivateUser, getBanners } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table'
import {
  createBranchColumns,
  createEmployeeColumns,
  primaryRole,
  withRole,
  ROLE_LABELS,
  type EmployeeRow,
} from './settings-columns'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useLMSStore } from '@/store/lms-store'
import { staggerContainer } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'
import { Field } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import UserForm from './components/user-form'
import BranchForm from './components/branch-form'


export default function AdminSettings({ mode = 'full' }: { mode?: 'full' | 'banners' }) {
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
    // Marketing only manages banners — skip branch/user sections entirely.
    enabled: mode === 'full',
  })

  const { data: users, isLoading: usersLoading, isError: isUsersError, refetch: refetchUsers } = useQuery({
    queryKey: ['users', includeInactive],
    queryFn: () => getUsers({ staffOnly: true, includeInactive }),
    enabled: mode === 'full',
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

  const branchColumns = useMemo(() => createBranchColumns(t), [t])
  const employeeColumns = useMemo(
    () =>
      createEmployeeColumns(t, {
        onRoleChange: (user, newRole) =>
          roleMutation.mutate({ id: user.id, roles: withRole(user.roles, newRole) }),
        onDeactivate: (user) => deactivateMutation.mutate(user.id),
        onReactivate: (user) => reactivateMutation.mutate(user.id),
        isLocked: (user) => !!authUser && user.id === authUser.id,
        isPending: deactivateMutation.isPending || reactivateMutation.isPending,
      }),
    [t, authUser, roleMutation.isPending, deactivateMutation.isPending, reactivateMutation.isPending]
  )

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
      <PageHeader
        title={t('settings.title', 'Cài đặt hệ thống')}
        description={t('settings.description', 'Quản lý chi nhánh, người dùng và banner')}
        icon={Settings}
        accentColor="sky"
      />

{mode === 'full' && (<>
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
            ) : (
              <DataTable
                columns={branchColumns}
                data={branches}
                paginationMode="client"
                initialPageSize={20}
                searchColumnId="name"
                searchPlaceholder={t('settings.searchBranch', 'Tìm chi nhánh...')}
                showViewOptions={false}
                emptyState={
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {t('settings.noBranches', 'Chưa có chi nhánh. Nhấn nút thêm để tạo chi nhánh đầu tiên.')}
                  </p>
                }
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
</>)}

{mode === 'full' && (<>
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
            ) : (
              <DataTable
                columns={employeeColumns}
                data={(users?.items ?? []) as unknown as EmployeeRow[]}
                paginationMode="client"
                initialPageSize={20}
                searchColumnId="name"
                searchPlaceholder={t('settings.searchEmployee', 'Tìm nhân viên...')}
                isLoading={usersLoading}
                emptyState={
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {t('settings.noUsers', 'Chưa có người dùng.')}
                  </p>
                }
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
</>)}

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
          <UserForm onDone={(id) => setUserDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
