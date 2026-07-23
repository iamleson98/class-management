'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart3, Newspaper, Users, TrendingUp, Eye, MousePointerClick } from 'lucide-react'
import { PageHeader } from '@/components/lms/page-header'
import { ErrorState } from '@/components/lms/error-state'
import { StatCard } from '@/components/lms/stat-card'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDashboard } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'

export default function MarketingDashboard() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'MARKETING'],
    queryFn: () => getDashboard('MARKETING'),
  })

  const stats = data || {}

  const topPosts = (data?.topPosts || data?.posts || []) as any[]
  const recentLeads = (data?.recentLeads || data?.leads || []) as any[]

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={t('marketing.dashboard.title', 'Tổng quan Marketing')}
        description={t('marketing.dashboard.description', 'Thống kê nội dung và khách hàng tiềm năng')}
        icon={<BarChart3 className="h-5 w-5" />}
        accentColor="pink"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title={t('marketing.dashboard.totalPosts', 'Tổng bài viết')}
          value={String(stats.totalPosts ?? '—')}
          icon={<Newspaper className="h-5 w-5" />}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title={t('marketing.dashboard.totalLeads', 'Tổng leads')}
          value={String(stats.totalLeads ?? '—')}
          icon={<Users className="h-5 w-5" />}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <StatCard
          title={t('marketing.dashboard.convertedLeads', 'Leads chuyển đổi')}
          value={String(stats.convertedLeads ?? '—')}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title={t('marketing.dashboard.conversionRate', 'Tỷ lệ chuyển đổi')}
          value={stats.conversionRate != null ? `${stats.conversionRate}%` : '—'}
          icon={<MousePointerClick className="h-5 w-5" />}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Posts */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">{t('marketing.dashboard.topPosts', 'Bài viết nổi bật')}</h3>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
              </div>
            ) : topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('marketing.dashboard.noPosts', 'Chưa có bài viết nào')}</p>
            ) : (
              <div className="space-y-3">
                {topPosts.map((post: any, idx: number) => (
                  <div key={post.id || idx} className="flex items-center justify-between p-2 rounded border">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.status === 'PUBLISHED' ? t('marketing.dashboard.published', 'Đã xuất bản') : post.status || ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{post.views || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">{t('marketing.dashboard.recentLeads', 'Leads gần đây')}</h3>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
              </div>
            ) : recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('marketing.dashboard.noLeads', 'Chưa có lead nào')}</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead: any, idx: number) => (
                  <div key={lead.id || idx} className="flex items-center justify-between p-2 rounded border">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.source || ''}</p>
                    </div>
                    <div>
                      {lead.status === 'NEW' && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px]">{t('marketing.dashboard.leadNew', 'Mới')}</Badge>}
                      {lead.status === 'CONTACTED' && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-[10px]">{t('marketing.dashboard.leadContacted', 'Đã liên hệ')}</Badge>}
                      {lead.status === 'CONVERTED' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">{t('marketing.dashboard.leadConverted', 'Đã chuyển đổi')}</Badge>}
                      {lead.status === 'LOST' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">{t('marketing.dashboard.leadLost', 'Đã mất')}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
