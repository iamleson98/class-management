'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaginationState } from '@tanstack/react-table'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/data-table'
import {
  createCounselorLeadColumns,
  createConvertibleUserColumns,
  createRevertStudentColumns,
  COUNSELOR_STATUS_OPTIONS as STATUS_OPTIONS,
  COUNSELOR_SOURCE_OPTIONS as SOURCE_OPTIONS,
} from './crm-columns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users, Search, Phone, Mail,
  Clock, UserCheck, UserMinus
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import { useLMSStore } from '@/store/lms-store'
import {
  getLeadsPaginated, getStudentsPaginated,
  getConvertibleUsers, convertUserToStudent, revertStudentToUser,
} from '@/lib/api'
import { eq, and, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import { motion } from 'framer-motion'


function LeadsTab() {
  const { t } = useTranslation()
  const { authUser } = useLMSStore()
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')

  // Filters reset to page 0 directly in their change handlers.
  const resetPage = () => setPagination(p => ({ ...p, pageIndex: 0 }))

  // LeadFilterOpts honors a top-level `search` field; status/source/counselor
  // are column filters via typed where_ands.
  const opts = useMemo(() => ({
    search: search || undefined,
    where_ands: and(
      eq('leads.counselor_id', authUser?.id),
      eq('leads.status', statusFilter !== 'ALL' ? statusFilter : undefined),
      eq('leads.source', sourceFilter !== 'ALL' ? sourceFilter : undefined),
    ),
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [search, statusFilter, sourceFilter, authUser?.id, pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leads', 'counselor', opts],
    queryFn: () => getLeadsPaginated(opts),
    enabled: !!authUser?.id,
  })

  const leads = data?.items ?? []
  const leadColumns = useMemo(() => createCounselorLeadColumns(t), [t])

  if (isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      {/* Data table (server-driven pagination + server-side search) */}
      <DataTable
        columns={leadColumns}
        data={data?.items}
        paginationMode="server"
        paginationState={pagination}
        onPaginationChange={setPagination}
        rowCount={data?.totalCount ?? 0}
        isLoading={isLoading}
        toolbarActions={
          <>
            <div className="relative flex-1 w-full sm:max-w-70">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-slot="counselor-leads-search"
                placeholder={t('counselor.crm.searchPlaceholder', 'Tìm kiếm theo tên, email, số điện thoại...')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage() }}
                className="pl-9 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage() }}>
                <SelectTrigger className="w-37.5 h-9">
                  <SelectValue placeholder={t('common.status', 'Trạng thái')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey, opt.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); resetPage() }}>
                <SelectTrigger className="w-37.5 h-9">
                  <SelectValue placeholder={t('counselor.crm.source', 'Nguồn')} />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey, opt.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        }
        emptyState={
          <EmptyState
            icon={Users}
            title={t('counselor.crm.noCustomersTitle', 'Không có khách hàng')}
            description={t('counselor.crm.noCustomersDesc', 'Thử thay đổi bộ lọc hoặc thêm khách hàng mới.')}
          />
        }
      />
    </div>
  )
}

/** ConvertTab — lets a counselor convert a regular user into a student, or
 * revert a student back to a regular user. Backed by the
 * PermissionLmsManageStudents-gated endpoints. */
function ConvertTab() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [userSearch, setUserSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')

  const { data: convertibleUsers = [], isLoading: isLoadingUsers, isError: isErrorUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['convertible-users'],
    queryFn: () => getConvertibleUsers(),
  })

  const [studentsPagination, setStudentsPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const studentsOpts = useMemo(() => ({
    where_ands: and(eq('users.roles', 'lms_student')),
    ...paginate(studentsPagination.pageIndex, studentsPagination.pageSize),
  }), [studentsPagination.pageIndex, studentsPagination.pageSize])
  const { data: studentsData, isLoading: isLoadingStudents, isError: isErrorStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['students', 'convert', studentsOpts],
    queryFn: () => getStudentsPaginated(studentsOpts),
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['convertible-users'] })
    queryClient.invalidateQueries({ queryKey: ['students'] })
  }


  const convertMutation = useMutation({
    mutationFn: (userId: string) => convertUserToStudent(userId),
    onSuccess: () => {
      invalidateAll()
      toast({ title: t('counselor.crm.convertSuccess', 'Chuyển thành học viên thành công') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('counselor.crm.convertFail', 'Chuyển đổi thất bại'), variant: 'destructive' }),
  })

  const revertMutation = useMutation({
    mutationFn: (studentId: string) => revertStudentToUser(studentId),
    onSuccess: () => {
      invalidateAll()
      toast({ title: t('counselor.crm.revertSuccess', 'Đã chuyển học viên về người dùng') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('counselor.crm.revertFail', 'Chuyển về người dùng thất bại'), variant: 'destructive' }),
  })

  const userColumns = useMemo(
    () => createConvertibleUserColumns(t, (u) => convertMutation.mutate(u.id), convertMutation.isPending),
    [t, convertMutation.isPending]
  )
  const studentColumns = useMemo(
    () => createRevertStudentColumns(t, (s) => revertMutation.mutate(s.id), revertMutation.isPending),
    [t, revertMutation.isPending]
  )

  const students = studentsData?.items ?? []

  return (
    <div className="space-y-6">
      {/* Convertible users → students */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-violet-600" />
              {t('counselor.crm.convertibleUsers', 'Người dùng có thể chuyển')}
              <Badge variant="secondary" className="text-xs">{convertibleUsers.length}</Badge>
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search', 'Tìm kiếm...')}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 rounded-lg h-9"
              />
            </div>
          </div>
          {isErrorUsers ? (
            <ErrorState onRetry={() => refetchUsers()} />
          ) : isLoadingUsers ? (
            <LoadingState />
          ) : (
            <DataTable
              columns={userColumns}
              data={convertibleUsers}
              paginationMode="client"
              initialPageSize={10}
              searchColumnId="name"
              searchPlaceholder={t('common.search', 'Tìm kiếm...')}
              tableClassName="rounded-lg"
              emptyState={
                <EmptyState
                  icon={Users}
                  title={t('counselor.crm.noConvertibleUsers', 'Không có người dùng')}
                  description={t('counselor.crm.noConvertibleUsersDesc', 'Tất cả người dùng hiện đã là học viên.')}
                />
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Students → users */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-amber-600" />
              {t('counselor.crm.studentsList', 'Học viên')}
              <Badge variant="secondary" className="text-xs">{studentsData?.totalCount ?? 0}</Badge>
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search', 'Tìm kiếm...')}
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9 rounded-lg h-9"
              />
            </div>
          </div>
          {isErrorStudents ? (
            <ErrorState onRetry={() => refetchStudents()} />
          ) : isLoadingStudents ? (
            <LoadingState />
          ) : (
            <DataTable
              columns={studentColumns}
              data={studentsData?.items}
              paginationMode="server"
              paginationState={studentsPagination}
              onPaginationChange={setStudentsPagination}
              rowCount={studentsData?.totalCount ?? 0}
              isLoading={isLoadingStudents}
              tableClassName="rounded-lg"
              emptyState={
                <EmptyState
                  icon={Users}
                  title={t('counselor.crm.noStudents', 'Không có học viên')}
                  description={t('counselor.crm.noStudentsDesc', 'Chưa có học viên nào trong hệ thống.')}
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CounselorCrm() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('leads')

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('counselor.crm.title', 'Quản lý khách hàng')}
        description={t('counselor.crm.description', 'Danh sách khách hàng được phân công cho bạn.')}
        icon={Users}
        accentColor="violet"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="leads">{t('counselor.crm.tabLeads', 'Khách hàng')}</TabsTrigger>
          <TabsTrigger value="convert">{t('counselor.crm.tabConvert', 'Chuyển đổi người dùng')}</TabsTrigger>
        </TabsList>
        <TabsContent value="leads" className="mt-6">
          <LeadsTab />
        </TabsContent>
        <TabsContent value="convert" className="mt-6">
          <ConvertTab />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
