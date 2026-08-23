'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Clock, BookOpen, Users, DollarSign, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatVND, getPublicCourses } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { ErrorState } from '@/components/shared/error-state'

export default function CourseDetailPage() {
  const params = useParams()
  const { t } = useTranslation()

  const { data: courses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['public-courses'],
    queryFn: getPublicCourses,
  })

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-3 border-sky-200 border-t-sky-600 rounded-full animate-spin" /></div>
  if (isError) return <ErrorState onRetry={() => refetch()} />

  const course = courses.find((c: any) => c.code === params.slug || c.id === params.slug) || null
  
  if (!course) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-4">{t('courses.notFound', 'Không tìm thấy khóa học')}</h1><Link href="/courses"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />{t('common.back', 'Quay lại')}</Button></Link></div></div>

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-linear-to-br from-sky-600 to-orange-500 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <Link href="/courses" className="text-sky-200 hover:text-white text-sm mb-4 inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />{t('courses.backToList', 'Quay lại danh sách')}</Link>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-4xl font-extrabold mt-2">{course.name}</motion.h1>
          <div className="flex items-center gap-3 mt-4">
            <Badge className="bg-white/20 border-0">{course.code}</Badge>
            <Badge className="bg-white/20 border-0">{course.level}</Badge>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">{t('courses.detail.description', 'Mô tả khóa học')}</h2>
                <p className="text-muted-foreground leading-relaxed">{course.description || t('courses.detail.contactForDetails', 'Liên hệ trung tâm để biết thêm chi tiết.')}</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">{t('courses.detail.generalInfo', 'Thông tin chung')}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center"><Clock className="h-5 w-5 text-sky-600" /></div><div><div className="text-xs text-muted-foreground">{t('courses.detail.sessions', 'Số buổi')}</div><div className="font-semibold text-sm">{course.totalSessions} {t('courses.sessions', 'buổi')}</div></div></div>
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center"><BookOpen className="h-5 w-5 text-sky-600" /></div><div><div className="text-xs text-muted-foreground">{t('courses.detail.duration', 'Thời lượng/buổi')}</div><div className="font-semibold text-sm">{course.durationPerSession || 60} {t('courses.detail.minutes', 'phút')}</div></div></div>
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center"><Users className="h-5 w-5 text-sky-600" /></div><div><div className="text-xs text-muted-foreground">{t('courses.detail.ageRange', 'Độ tuổi')}</div><div className="font-semibold text-sm">{course.ageRange || t('common.all', 'Tất cả')}</div></div></div>
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center"><DollarSign className="h-5 w-5 text-sky-600" /></div><div><div className="text-xs text-muted-foreground">{t('courses.detail.tuition', 'Học phí')}</div><div className="font-semibold text-sm">{course.fee ? formatVND(Number(course.fee)) : t('courses.detail.contact', 'Liên hệ')}</div></div></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="rounded-2xl border sticky top-24">
              <CardContent className="p-6 text-center">
                {course.fee && Number(course.fee) > 0 && <div className="text-3xl font-extrabold text-sky-600 mb-4">{formatVND(Number(course.fee))}</div>}
                <p className="text-sm text-muted-foreground mb-6">{t('courses.detail.registerNow', 'Đăng ký ngay để nhận ưu đãi')}</p>
                <Link href="/register"><Button className="w-full bg-sky-600 hover:bg-sky-700 rounded-xl py-6 text-base">{t('courses.detail.registerCourse', 'Đăng ký khóa học')}</Button></Link>
                <div className="mt-6 space-y-2 text-left">
                  {[t('courses.detail.feature1', 'Giáo viên bản ngữ'), t('courses.detail.feature2', 'Lớp tối đa 12 người'), t('courses.detail.feature3', 'Tài liệu miễn phí'), t('courses.detail.feature4', 'Bằng cấp chứng nhận')].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-sky-500 shrink-0" /><span>{item}</span></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
