'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users, Search, Phone, Mail,
  Clock, UserCheck, UserMinus
} from 'lucide-react'
import { PaginationControls, usePagination, derivePageInfo } from '@/components/shared/pagination'
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

const STATUS_OPTIONS = [
  { value: 'ALL', labelKey: 'counselor.crm.allStatuses', label: 'Tất cả trạng thái' },
  { value: 'NEW', labelKey: 'counselor.crm.statusNew', label: 'Mới' },
  { value: 'CONTACTED', labelKey: 'counselor.crm.statusContacted', label: 'Đã liên hệ' },
  { value: 'FOLLOW_UP', labelKey: 'counselor.crm.statusFollowUp', label: 'Theo dõi' },
  { value: 'CONVERTED', labelKey: 'counselor.crm.statusConverted', label: 'Đã chuyển đổi' },
  { value: 'LOST', labelKey: 'counselor.crm.statusLost', label: 'Đã mất' },
]

const SOURCE_OPTIONS = [
  { value: 'ALL', labelKey: 'counselor.crm.allSources', label: 'Tất cả nguồn' },
  { value: 'FACEBOOK', labelKey: 'counselor.crm.sourceFacebook', label: 'Facebook' },
  { value: 'WEBSITE', labelKey: 'counselor.crm.sourceWebsite', label: 'Website' },
  { value: 'REFERRAL', labelKey: 'counselor.crm.sourceReferral', label: 'Giới thiệu' },
  { value: 'WALK_IN', labelKey: 'counselor.crm.sourceWalkIn', label: 'Đến trực tiếp' },
  { value: 'PHONE', labelKey: 'counselor.crm.sourcePhone', label: 'Điện thoại' },
  { value: 'EMAIL', labelKey: 'counselor.crm.sourceEmail', label: 'Email' },
]

function getStatusBadge(status: string, t: (key: string, fallback?: string) => string) {
  switch (status) {
    case 'NEW': return <Badge className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">{t('counselor.crm.statusNew', 'Mới')}</Badge>
    case 'CONTACTED': return <Badge className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs">{t('counselor.crm.statusContacted', 'Đã liên hệ')}</Badge>
    case 'FOLLOW_UP': return <Badge className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">{t('counselor.crm.statusFollowUp', 'Theo dõi')}</Badge>
    case 'CONVERTED': return <Badge className="rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-xs">{t('counselor.crm.statusConverted', 'Đã chuyển đổi')}</Badge>
    case 'LOST': return <Badge className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">{t('counselor.crm.statusLost', 'Đã mất')}</Badge>
    default: return <Badge variant="outline" className="rounded-full text-xs">{status}</Badge>
  }
}

function LeadsTab() {
  const { t } = useTranslation()
  const { authUser } = useLMSStore()
  const pagination = usePagination(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')

  // Reset to first page whenever filters change.
  useEffect(() => { pagination.setPageIndex(0) }, [search, statusFilter, sourceFilter, authUser?.id])

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

  if (isLoading) return <LoadingState />

  if (isError) return <ErrorState onRetry={() => refetch()} />

  const leads = data?.items ?? []
  const pageInfo = derivePageInfo(data?.totalCount ?? 0, pagination.pageIndex, pagination.pageSize, leads.length)

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('counselor.crm.searchPlaceholder', 'Tìm kiếm theo tên, email, số điện thoại...')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); pagination.reset() }}
                className="pl-9 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); pagination.reset() }}>
                <SelectTrigger className="w-37.5 h-9">
                  <SelectValue placeholder={t('common.status', 'Trạng thái')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey, opt.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); pagination.reset() }}>
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
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_OPTIONS.filter(s => s.value !== 'ALL').map(s => {
          // Counts reflect the current page only (server-side paging).
          const count = leads.filter((l: any) => l.status === s.value).length
          return (
            <div key={s.value} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border">
              <span className="text-lg font-bold">{count}</span>
              <span className="text-xs text-muted-foreground">{t(s.labelKey, s.label)}</span>
            </div>
          )
        })}
      </div>

      {/* Leads Table */}
      <Card className="rounded-xl">
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('counselor.crm.noCustomersTitle', 'Không có khách hàng')}
              description={t('counselor.crm.noCustomersDesc', 'Thử thay đổi bộ lọc hoặc thêm khách hàng mới.')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase text-xs font-semibold">{t(' ', 'Khách hàng')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('common.status', 'Trạng thái')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden sm:table-cell">{t('counselor.crm.colSource', 'Nguồn')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('common.contact', 'Liên hệ')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('common.date', 'Ngày tạo')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead: any) => (
                    <TableRow key={lead.id} className="hover:bg-muted/30 border-l-2 border-l-transparent hover:border-l-violet-400 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-violet-700 dark:text-violet-400">
                              {(lead.name || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{lead.name}</p>
                            {lead.nextFollowUp && (
                              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {t('counselor.crm.followUp', 'Theo dõi')}: {format(parseISO(lead.nextFollowUp), 'dd/MM/yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{getStatusBadge(lead.status, t)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {lead.source && (
                          <span className="text-xs text-muted-foreground">{lead.source}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="space-y-1">
                          {lead.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</p>}
                          {lead.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {lead.createdAt ? format(parseISO(lead.createdAt), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <PaginationControls
        {...pageInfo}
        onPageIndexChange={pagination.setPageIndex}
        onPageSizeChange={pagination.setPageSize}
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

  const studentsPagination = usePagination(10)
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

  const filteredUsers = convertibleUsers.filter((u: any) => {
    if (!userSearch) return true
    const q = userSearch.toLowerCase()
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.nickname || '').toLowerCase().includes(q) ||
      (`${u.firstname || ''} ${u.lastname || ''}`).toLowerCase().includes(q)
    )
  })

  const students = studentsData?.items ?? []
  const filteredStudents = students.filter((s: any) => {
    if (!studentSearch) return true
    const q = studentSearch.toLowerCase()
    return (
      (s.email || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q)
    )
  })
  const studentPageInfo = derivePageInfo(studentsData?.totalCount ?? 0, studentsPagination.pageIndex, studentsPagination.pageSize, students.length)

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
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('counselor.crm.noConvertibleUsers', 'Không có người dùng')}
              description={t('counselor.crm.noConvertibleUsersDesc', 'Tất cả người dùng hiện đã là học viên.')}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Tên')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('common.email', 'Email')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold text-right">{t('common.actions', 'Hành động')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u: any) => (
                    <TableRow key={u.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">
                        {u.nickname || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.username}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                          disabled={convertMutation.isPending}
                          onClick={() => convertMutation.mutate(u.id)}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          {t('counselor.crm.convertToStudent', 'Chuyển thành học viên')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('counselor.crm.noStudents', 'Không có học viên')}
              description={t('counselor.crm.noStudentsDesc', 'Chưa có học viên nào trong hệ thống.')}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Tên')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('common.email', 'Email')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold text-right">{t('common.actions', 'Hành động')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">{s.name || s.email}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.email || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={revertMutation.isPending}
                          onClick={() => revertMutation.mutate(s.id)}
                        >
                          <UserMinus className="h-3.5 w-3.5 mr-1" />
                          {t('counselor.crm.revertToUser', 'Chuyển về người dùng')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationControls
            {...studentPageInfo}
            onPageIndexChange={studentsPagination.setPageIndex}
            onPageSizeChange={studentsPagination.setPageSize}
          />
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
