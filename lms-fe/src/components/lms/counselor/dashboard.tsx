'use client'

import { useQuery } from '@tanstack/react-query'
import { StatCard } from '@/components/lms/stat-card'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { LoadingState } from '@/components/lms/loading-state'
import { ErrorState } from '@/components/lms/error-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, UserPlus, Target, ArrowRight, Phone, Mail, MessageSquare, LayoutDashboard, TrendingUp, CalendarDays } from 'lucide-react'
import { parseISO, isToday } from 'date-fns'
import { useLMSStore } from '@/store/lms-store'
import { getDashboard, getLeads } from '@/lib/api'
import { eq, and } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { motion, type Variants } from 'framer-motion'
import { SMOOTH_EASE } from '@/components/lms/shared/animations'

const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.06 } }
}

const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: SMOOTH_EASE } }
}

function CounselorDashboardInner() {
  const { t } = useTranslation()
  const { authUser } = useLMSStore()
  const { toast } = useToast()

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'COUNSELOR', authUser?.id],
    queryFn: () => getDashboard('COUNSELOR', authUser!.id),
  })

  const leadsQuery = useQuery({
    queryKey: ['leads', 'counselor', authUser?.id],
    queryFn: () => getLeads({ where_ands: and(eq('leads.counselor_id', authUser!.id)) }),
    enabled: !!authUser?.id,
  })

  if (dashboardQuery.isLoading || leadsQuery.isLoading) return <LoadingState />

  if (dashboardQuery.isError) {
    return <ErrorState onRetry={() => dashboardQuery.refetch()} />
  }
  if (leadsQuery.isError) {
    return <ErrorState onRetry={() => leadsQuery.refetch()} />
  }

  const dashboard = dashboardQuery.data
  const leads = leadsQuery.data || []
  const stats = dashboard || {}

  const myLeads = leads.length
  const newLeads = leads.filter((l: any) => l.status === 'NEW').length
  const convertedLeads = leads.filter((l: any) => l.status === 'CONVERTED').length
  const conversionRate = myLeads > 0 ? Math.round((convertedLeads / myLeads) * 100) : 0

  const followUpsToday = leads.filter((l: any) => {
    if (!l.nextFollowUp) return false
    return isToday(parseISO(l.nextFollowUp))
  }).length

  const recentLeads = [...leads]
    .sort((a: any, b: any) => b.createdAt?.localeCompare(a.createdAt) || 0)
    .slice(0, 6)

  const QUICK_LINKS = [
    { id: 'crm', label: t('counselor.dashboard.viewCrm', 'Xem CRM'), icon: Users, color: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-950/50' },
    { id: null, label: t('counselor.dashboard.addCustomer', 'Them khach'), icon: UserPlus, color: 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-950/50', action: () => toast({ title: t('counselor.dashboard.addCustomerToast', 'Chuc nang them khach moi') }) },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return <Badge className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">Moi</Badge>
      case 'CONTACTED': return <Badge className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs">Da lien he</Badge>
      case 'FOLLOW_UP': return <Badge className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Theo doi</Badge>
      case 'CONVERTED': return <Badge className="rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-xs">Da chuyen doi</Badge>
      case 'LOST': return <Badge className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Da mat</Badge>
      default: return <Badge variant="outline" className="rounded-full text-xs">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('counselor.dashboard.title', 'Tong quan Tu van')}
        description={t('counselor.dashboard.description', 'Chao mung tro lai! Day la tong quan khach hang cua ban.')}
        icon={LayoutDashboard}
        accentColor="violet"
      />

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('counselor.dashboard.assignedCustomers', 'Khach phan cong')}
            value={myLeads}
            icon={Users}
            iconColor="text-violet-600"
            iconBg="bg-violet-50 dark:bg-violet-950/30"
            description={t('counselor.dashboard.totalCustomers', 'Tong so khach hang')}
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('counselor.dashboard.newCustomers', 'Khach moi')}
            value={newLeads}
            icon={UserPlus}
            iconColor="text-blue-600"
            iconBg="bg-blue-50 dark:bg-blue-950/30"
            description={t('counselor.dashboard.needContact', 'Can lien he')}
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('counselor.dashboard.conversionRate', 'Ti le chuyen doi')}
            value={`${conversionRate}%`}
            icon={TrendingUp}
            iconColor="text-sky-600"
            iconBg="bg-sky-50 dark:bg-sky-950/30"
            description={t('counselor.dashboard.convertedStudents', 'Da chuyen doi hoc vien')}
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('counselor.dashboard.followUpsToday', 'Theo doi hom nay')}
            value={followUpsToday}
            icon={CalendarDays}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-950/30"
            description={t('counselor.dashboard.needCounseling', 'Can tu van')}
          />
        </motion.div>
      </motion.div>

      {/* Quick Links */}
      <Card className="rounded-2xl border">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            {t('counselor.dashboard.quickLinks', 'Lien ket nhanh')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {QUICK_LINKS.map((link, i) => {
              const Icon = link.icon
              const baseProps = {
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.1 + i * 0.05, duration: 0.3 },
                className: "shrink-0 flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/60 hover:border-violet-200/60 dark:hover:border-violet-800/40 transition-all duration-200 group min-w-40 cursor-pointer no-underline",
              } as any
              if (link.id) {
                return (
                  <motion.a
                    {...baseProps}
                    key={link.id}
                    href={`#counselor/${link.id}`}
                  >
                    <div className={cn('p-2.5 rounded-xl transition-all duration-200 group-hover:scale-110', link.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-nowrap">{link.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </motion.a>
                )
              }
              return (
                <motion.button
                  key={link.id}
                  {...baseProps}
                  onClick={() => link.action?.()}
                >
                  <div className={cn('p-2.5 rounded-xl transition-all duration-200 group-hover:scale-110', link.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-nowrap">{link.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </motion.button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Leads */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-600" />
            {t('counselor.dashboard.recentCustomers', 'Khach hang gan day')}
            {recentLeads.length > 0 && (
              <Badge variant="secondary" className="rounded-full text-xs bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                {recentLeads.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('counselor.dashboard.noCustomersTitle', 'Chua co khach hang nao')}
              description={t('counselor.dashboard.noCustomersDesc', 'Ban chua duoc phan cong khach hang nao. He thong se cap nhat khi co du lieu.')}
            />
          ) : (
            <div className="space-y-2">
              {recentLeads.map((lead: any, idx: number) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                >
                  <a
                    href="#counselor/crm"
                    className="flex items-center gap-4 p-4 rounded-xl border hover:bg-muted/30 transition-all cursor-pointer no-underline"
                  >
                    <div className="min-w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-violet-700 dark:text-violet-400">
                        {(lead.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{lead.name}</p>
                        {getStatusBadge(lead.status)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {lead.phone && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>
                        )}
                        {lead.source && (
                          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{lead.source}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CounselorDashboard() {
  return <CounselorDashboardInner />
}
