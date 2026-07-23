'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { LoadingState } from '@/components/lms/loading-state'
import { ErrorState } from '@/components/lms/error-state'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Users, Search, Phone, Mail,
  Clock
} from 'lucide-react'
import { PaginationControls, usePagination, paginate } from '@/components/lms/shared/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import { useLMSStore } from '@/store/lms-store'
import { getLeads } from '@/lib/api'
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

function CounselorCrmInner() {
  const { t } = useTranslation()
  const { authUser } = useLMSStore()
  const pagination = usePagination(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')

  const { data: leads, isLoading, isError, refetch } = useQuery({
    queryKey: ['leads', 'counselor', authUser?.id, statusFilter, sourceFilter, search],
    queryFn: () => getLeads({
      counselorId: authUser!.id,
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
      search: search || undefined,
    }),
    enabled: !!authUser?.id,
  })

  if (isLoading) return <LoadingState />

  if (isError) return <ErrorState onRetry={() => refetch()} />

  const allLeads = leads || []
  const filtered = allLeads
  const paginated = paginate(filtered, pagination.pageIndex, pagination.pageSize)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('counselor.crm.title', 'Quản lý khách hàng')}
        description={t('counselor.crm.description', 'Danh sách khách hàng được phân công cho bạn.')}
        icon={Users}
        accentColor="violet"
      />

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
          const count = allLeads.filter((l: any) => l.status === s.value).length
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
          {paginated.data.length === 0 ? (
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
                    <TableHead className="uppercase text-xs font-semibold">{t('counselor.crm.colCustomer', 'Khách hàng')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('common.status', 'Trạng thái')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden sm:table-cell">{t('counselor.crm.colSource', 'Nguồn')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('common.contact', 'Liên hệ')}</TableHead>
                    <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('common.date', 'Ngày tạo')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.data.map((lead: any) => (
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
at
      <PaginationControls
        {...paginated}
        onPageIndexChange={pagination.setPageIndex}
        onPageSizeChange={pagination.setPageSize}
      />
    </motion.div>
  )
}

export default function CounselorCrm() {
  return <CounselorCrmInner />
}
