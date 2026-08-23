'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart3, Newspaper, Users, TrendingUp, Eye, MousePointerClick } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLeadsPaginated, getPosts } from '@/lib/api'
import { desc } from '@/lib/query'
import { useTranslation } from '@/lib/i18n'

/**
 * Marketing overview. The backend dashboard endpoint only serves
 * admin/teacher/parent/student/counselor roles, so marketing stats are
 * aggregated client-side from endpoints the lms_marketing role can access:
 *   - leads   (POST /lms/leads)   → funnel + conversion rate
 *   - posts   (POST /lms/posts)   → content stats + latest posts
 */
export default function MarketingDashboard() {
  const { t } = useTranslation()

  const leadsQuery = useQuery({
    queryKey: ['dashboard', 'marketing', 'leads'],
    queryFn: () => getLeadsPaginated({ count_total: true, limit: 1000 }),
  })
  const postsQuery = useQuery({
    queryKey: ['dashboard', 'marketing', 'posts'],
    queryFn: () => getPosts({ orderings: [desc('blog_posts.published_at')], limit: 5 }),
  })
  const publishedPostsQuery = useQuery({
    queryKey: ['dashboard', 'marketing', 'posts-published'],
    queryFn: () => getPosts({ where_ands: [{ column: 'blog_posts.status', operator: '=', value: 'PUBLISHED' }], limit: 1000 }),
  })

  const isLoading = leadsQuery.isLoading || postsQuery.isLoading
  const isError = leadsQuery.isError || postsQuery.isError
  const refetch = () => { leadsQuery.refetch(); postsQuery.refetch() }

  const leads = leadsQuery.data?.items || []
  const convertedLeads = leads.filter((l: any) => l.status === 'ENROLLED').length
  const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0
  const totalPosts = (publishedPostsQuery.data || []).length
  const topPosts = (postsQuery.data || []).slice(0, 5)
  const recentLeads = leads.slice(0, 5)

  if (isError) {
    return <ErrorState onRetry={refetch} />
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
          value={String(totalPosts)}
          icon={<Newspaper className="h-5 w-5" />}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title={t('marketing.dashboard.totalLeads', 'Tổng leads')}
          value={String(leadsQuery.data?.totalCount ?? leads.length)}
          icon={<Users className="h-5 w-5" />}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <StatCard
          title={t('marketing.dashboard.convertedLeads', 'Leads chuyển đổi')}
          value={String(convertedLeads)}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title={t('marketing.dashboard.conversionRate', 'Tỷ lệ chuyển đổi')}
          value={`${conversionRate}%`}
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
                      <span className="text-xs text-muted-foreground">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('vi-VN') : '—'}</span>
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
