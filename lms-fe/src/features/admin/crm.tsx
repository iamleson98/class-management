'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Plus, Pencil, Trash2, Search, Eye, UserCheck } from 'lucide-react'
import { createLeadSchema, updateLeadSchema, leadActivitySchema, type CreateLeadInput, type UpdateLeadInput, type LeadActivityInput } from '@/lib/schemas'
import { getLeadsPaginated, createLead, updateLead, deleteLead, getLeadActivities, createLeadActivity, convertLeadToStudent, getUsers } from '@/lib/api'
import { eq, and, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { useLMSStore } from '@/store/lms-store'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PaginationControls, usePagination, derivePageInfo } from '@/components/shared/pagination'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  NEW: { label: 'Mới', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  CONTACTED: { label: 'Đã liên hệ', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  TEST_SCHEDULED: { label: 'Hẹn test', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  TESTED: { label: 'Đã test', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  PENDING_PAYMENT: { label: 'Chờ đóng phí', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  ENROLLED: { label: 'Đã đăng ký', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  NOT_INTERESTED: { label: 'Không nhu cầu', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const SOURCE_MAP: Record<string, string> = {
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  REFERRAL: 'Giới thiệu',
  PHONE: 'Điện thoại',
  WALK_IN: 'Đến trực tiếp',
  ZALO: 'Zalo',
  TIKTOK: 'TikTok',
}

const EMPTY_ACTIVITY: LeadActivityInput = { type: 'NOTE', content: '', nextFollowUp: '' }

export default function AdminCRM() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()

  type LeadFormValues = z.input<typeof updateLeadSchema>

  const EMPTY_LEAD_FORM: LeadFormValues = {
    name: '', phone: '', email: '', source: 'WEBSITE', status: 'NEW', counselorId: '', notes: '',
    age: '', school: '', need: '', testDate: '', testResult: '', testScore: undefined, studentId: '',
  }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<any>(null)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pagination = usePagination(10)

  const leadForm = useForm<LeadFormValues>({
    resolver: zodResolver(updateLeadSchema),
    defaultValues: EMPTY_LEAD_FORM,
  })

  const activityForm = useForm<LeadActivityInput>({
    resolver: zodResolver(leadActivitySchema),
    defaultValues: EMPTY_ACTIVITY,
  })

  // Reset to first page whenever filters change so the user doesn't land on
  // an empty page after narrowing the result set.
  useEffect(() => { pagination.setPageIndex(0) }, [search, statusFilter, sourceFilter])

  // Build the typed SearchOpts body. LeadFilterOpts honors a top-level
  // `search` field (see server/public/model_helper/lms.go), so it goes at the
  // body root; status/source/counselor filters go into where_ands via eq().
  const opts = useMemo(() => ({
    search: search || undefined,
    where_ands: and(
      eq('leads.status', statusFilter !== 'all' ? statusFilter : undefined),
      eq('leads.source', sourceFilter !== 'all' ? sourceFilter : undefined),
      eq('leads.counselor_id', undefined),
    ),
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [search, statusFilter, sourceFilter, pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leads', opts],
    queryFn: () => getLeadsPaginated(opts),
  })

  const leads = data?.items ?? []
  const pageInfo = derivePageInfo(data?.totalCount ?? 0, pagination.pageIndex, pagination.pageSize, leads.length)

  const { data: counselorsData, isLoading: isLoadingCounselors, isError: isCounselorsError, refetch: refetchCounselors } = useQuery({
    queryKey: ['users-counselors'],
    queryFn: () => getUsers({ role: 'lms_counselor' }),
  })
  const counselors = counselorsData?.items ?? []

  const { data: activities = [], isLoading: isLoadingActivities, isError: isActivitiesError, refetch: refetchActivities } = useQuery({
    queryKey: ['lead-activities', selectedLead?.id],
    queryFn: () => selectedLead ? getLeadActivities(selectedLead.id) : Promise.resolve([]),
    enabled: detailOpen && !!selectedLead,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateLeadInput) => createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast({ title: t('crm.createLeadSuccess', 'Thêm lead thành công') })
      closeDialog()
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('crm.createLeadFail', 'Thêm lead thất bại'), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeadInput }) => updateLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast({ title: t('crm.updateLeadSuccess', 'Cập nhật lead thành công') })
      closeDialog()
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.updateFail', 'Cập nhật thất bại'), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast({ title: t('crm.deleteLeadSuccess', 'Xóa lead thành công') })
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.deleteFail', 'Xóa thất bại'), variant: 'destructive' }),
  })

  const activityMutation = useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: LeadActivityInput }) => createLeadActivity(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] })
      toast({ title: t('crm.addActivitySuccess', 'Thêm hoạt động thành công') })
      setActivityOpen(false)
      activityForm.reset(EMPTY_ACTIVITY)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('crm.addActivityFail', 'Thêm hoạt động thất bại'), variant: 'destructive' }),
  })

  const convertMutation = useMutation({
    mutationFn: ({ leadId }: { leadId: string }) => convertLeadToStudent(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast({ title: t('crm.convertSuccess', 'Chuyển đổi thành học viên thành công') })
      setDetailOpen(false)
      setSelectedLead(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('crm.convertFail', 'Chuyển đổi thất bại'), variant: 'destructive' }),
  })

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingLead(null)
    leadForm.reset(EMPTY_LEAD_FORM)
  }

  const openCreate = () => {
    setEditingLead(null)
    leadForm.reset(EMPTY_LEAD_FORM)
    setDialogOpen(true)
  }

  const openEdit = (lead: any) => {
    setEditingLead(lead)
    leadForm.reset({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || 'WEBSITE',
      status: lead.status || 'NEW',
      counselorId: lead.counselorId || '',
      notes: lead.notes || lead.note || '',
      age: lead.age || '',
      school: lead.school || '',
      need: lead.need || '',
      testDate: lead.testDate || '',
      testResult: lead.testResult || '',
      testScore: lead.testScore ?? undefined,
      studentId: lead.studentId || '',
    })
    setDialogOpen(true)
  }

  const openDetail = (lead: any) => {
    setSelectedLead(lead)
    setDetailOpen(true)
  }

  const onLeadSubmit = (values: LeadFormValues) => {
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: updateLeadSchema.parse(values) })
    } else {
      createMutation.mutate(createLeadSchema.parse(values))
    }
  }

  const onActivitySubmit = (values: LeadActivityInput) => {
    if (!selectedLead) return
    activityMutation.mutate({ leadId: selectedLead.id, data: values })
  }

  const handleConvert = () => {
    if (!selectedLead) return
    // No body needed — the server builds the student from the stored lead.
    convertMutation.mutate({ leadId: selectedLead.id })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('crm.title', 'Quản lý CRM')}
        description={t('crm.description', 'Quản lý khách hàng tiềm năng và chuyển đổi')}
        icon={Users}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('crm.addLead', 'Thêm lead')}
          </Button>
        }
      />

      {/* Filters */}
      <Card className="rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('crm.searchPlaceholder', 'Tìm theo tên, SĐT...')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); pagination.reset() }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); pagination.reset() }}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder={t('common.status', 'Trạng thái')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allStatuses', 'Tất cả trạng thái')}</SelectItem>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); pagination.reset() }}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder={t('crm.source', 'Nguồn')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('crm.allSources', 'Tất cả nguồn')}</SelectItem>
              {Object.entries(SOURCE_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('crm.emptyTitle', 'Chưa có lead')}
          description={t('crm.emptyDescription', 'Thêm khách hàng tiềm năng đầu tiên.')}
          actionLabel={t('crm.addLead', 'Thêm lead')}
          onAction={openCreate}
        />
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Tên')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('common.phone', 'SĐT')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('crm.source', 'Nguồn')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('common.status', 'Trạng thái')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('crm.counselor', 'Tư vấn viên')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('crm.createdDate', 'Ngày tạo')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold w-30">{t('common.actions', 'Thao tác')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead: any) => {
                  const status = STATUS_MAP[lead.status] || STATUS_MAP.NEW
                  return (
                    <motion.tr key={lead.id} variants={staggerItem} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">{lead.name}</TableCell>
                      <TableCell className="text-sm">{lead.phone || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="rounded-full text-xs">{SOURCE_MAP[lead.source] || lead.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{lead.counselor?.name || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('vi-VN') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(lead)} title={t('common.details', 'Chi tiết')}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(lead)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setDeletingId(lead.id); setDeleteOpen(true) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </TableBody>
            </Table>
          </motion.div>
          <PaginationControls {...pageInfo} onPageIndexChange={pagination.setPageIndex} onPageSizeChange={pagination.setPageSize} />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLead ? t('crm.editLead', 'Chỉnh sửa lead') : t('crm.addNewLead', 'Thêm lead mới')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...leadForm} schema={editingLead ? updateLeadSchema : createLeadSchema}>
            <form onSubmit={leadForm.handleSubmit(onLeadSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={leadForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name', 'Tên')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="Nguyễn Văn A" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crm.phoneNumber', 'Số điện thoại')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="0901xxx" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={leadForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.email', 'Email')}</FormLabel>
                      <FormControl><Input type="email" {...field} value={field.value ?? ''} placeholder="email@example.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="counselorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crm.counselor', 'Tư vấn viên')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          {isLoadingCounselors ? (
                            <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                          ) : (
                            <SelectTrigger><SelectValue placeholder={t('crm.selectCounselor', 'Chọn tư vấn viên')} /></SelectTrigger>
                          )}
                        </FormControl>
                        <SelectContent>
                          {isCounselorsError ? (
                            <SelectItem value="__error" disabled>
                              <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                            </SelectItem>
                          ) : (
                            counselors.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={leadForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crm.source', 'Nguồn')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(SOURCE_MAP).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {editingLead && (
                  <FormField
                    control={leadForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.status', 'Trạng thái')}</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                              <SelectItem key={key} value={key}>{val.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <FormField
                control={leadForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crm.notes', 'Ghi chú')}</FormLabel>
                    <FormControl><Textarea {...field} value={field.value ?? ''} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4 items-start">
                <FormField
                  control={leadForm.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crm.age', 'Độ tuổi')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="VD: 15" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crm.school', 'Trường')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('crm.schoolPlaceholder', 'Trường')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="need"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crm.need', 'Nhu cầu')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('crm.needPlaceholder', 'VD: Giao tiếp')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Hidden fields to preserve existing values */}
              <input type="hidden" {...leadForm.register('testDate')} />
              <input type="hidden" {...leadForm.register('testResult')} />
              <input type="hidden" {...leadForm.register('testScore')} />
              <input type="hidden" {...leadForm.register('studentId')} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={closeDialog}>{t('common.cancel', 'Hủy')}</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {createMutation.isPending || updateMutation.isPending ? t('common.saving', 'Đang lưu...') : editingLead ? t('common.update', 'Cập nhật') : t('common.addNew', 'Thêm mới')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('crm.leadDetail', 'Chi tiết lead')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">{t('crm.information', 'Thông tin')}</TabsTrigger>
              <TabsTrigger value="activities">{t('crm.activities', 'Hoạt động')}</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('common.name', 'Tên')}</p>
                  <p className="font-medium text-sm mt-1">{selectedLead?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('common.phone', 'SĐT')}</p>
                  <p className="font-medium text-sm mt-1">{selectedLead?.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('common.email', 'Email')}</p>
                  <p className="font-medium text-sm mt-1">{selectedLead?.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('crm.source', 'Nguồn')}</p>
                  <p className="font-medium text-sm mt-1">{SOURCE_MAP[selectedLead?.source] || selectedLead?.source || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('common.status', 'Trạng thái')}</p>
                  <div className="mt-1">
                    {selectedLead && (
                      <Badge className={cn('rounded-full text-xs', STATUS_MAP[selectedLead.status]?.className)}>
                        {STATUS_MAP[selectedLead.status]?.label || selectedLead.status}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('crm.counselor', 'Tư vấn viên')}</p>
                  <p className="font-medium text-sm mt-1">{selectedLead?.counselor?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('crm.createdDate', 'Ngày tạo')}</p>
                  <p className="font-medium text-sm mt-1">{selectedLead?.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString('vi-VN') : '-'}</p>
                </div>
              </div>
              {(selectedLead?.notes || selectedLead?.note) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('crm.notes', 'Ghi chú')}</p>
                    <p className="text-sm mt-1">{selectedLead.notes || selectedLead.note}</p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setDetailOpen(false); if (selectedLead) openEdit(selectedLead) }}>
                  <Pencil className="h-4 w-4 mr-2" />{t('common.edit', 'Chỉnh sửa')}
                </Button>
                {selectedLead?.status !== 'ENROLLED' && (
                  <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={handleConvert} disabled={convertMutation.isPending}>
                    <UserCheck className="h-4 w-4 mr-2" />
                    {convertMutation.isPending ? t('crm.converting', 'Đang chuyển...') : t('crm.convertToStudent', 'Chuyển thành học viên')}
                  </Button>
                )}
              </div>
            </TabsContent>
            <TabsContent value="activities" className="mt-4">
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" onClick={() => {
                  activityForm.reset({ type: 'NOTE', content: '', nextFollowUp: '' })
                  setActivityOpen(true)
                }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />{t('crm.addActivity', 'Thêm hoạt động')}
                </Button>
              </div>
              <ScrollArea className="h-75">
                <div className="space-y-3">
                  {isLoadingActivities ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
                    </div>
                  ) : isActivitiesError ? (
                    <div className="py-8 text-center">
                      <ErrorState onRetry={() => refetchActivities()} />
                    </div>
                  ) : activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('crm.noActivities', 'Chưa có hoạt động nào')}</p>
                  ) : (
                    activities.map((activity: any) => (
                      <div key={activity.id} className="p-3 rounded-lg border space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">{activity.type || t('crm.note', 'Ghi chú')}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString('vi-VN') : ''}
                          </span>
                        </div>
                        <p className="text-sm">{activity.content || activity.note || ''}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Activity Dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('crm.addActivity', 'Thêm hoạt động')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...activityForm} schema={leadActivitySchema}>
            <form onSubmit={activityForm.handleSubmit(onActivitySubmit)} className="space-y-4">
              <FormField
                control={activityForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crm.activityType', 'Loại')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="NOTE">{t('crm.activityNote', 'Ghi chú')}</SelectItem>
                        <SelectItem value="CALL">{t('crm.activityCall', 'Cuộc gọi')}</SelectItem>
                        <SelectItem value="MEETING">{t('crm.activityMeeting', 'Cuộc họp')}</SelectItem>
                        <SelectItem value="EMAIL">{t('crm.activityEmail', 'Email')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={activityForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crm.activityContent', 'Nội dung')}</FormLabel>
                    <FormControl><Textarea {...field} value={field.value ?? ''} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setActivityOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={activityMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {activityMutation.isPending ? t('common.saving', 'Đang lưu...') : t('common.add', 'Thêm')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crm.confirmDeleteLead', 'Xác nhận xóa lead')}</AlertDialogTitle>
            <AlertDialogDescription>{t('crm.confirmDeleteLeadDescription', 'Bạn có chắc muốn xóa lead này? Hành động này không thể hoàn tác.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Hủy')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)} className="bg-red-600 hover:bg-red-700 text-white">{t('common.delete', 'Xóa')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
