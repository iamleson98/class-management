'use client'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Clock, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatVND, getPublicCourses } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { ErrorState } from '@/components/shared/error-state'

export default function CoursesPage() {
  const [filter, setFilter] = useState('all')
  const { t } = useTranslation()

  const { data: courses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['public-courses'],
    queryFn: getPublicCourses,
  })

  const levels = useMemo(() => {
    if (courses.length > 0)
      return ['all', ...new Set(courses.map(c => c.level).filter(Boolean))]

    return ['all']
  }, [courses])
  const filtered = useMemo(() => {
    if (!courses || !(courses instanceof Array)) return [];

    if (filter === 'all') return courses
    return courses.filter(c => c.level === filter)
  }, [courses, filter])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-3 border-sky-200 border-t-sky-600 rounded-full animate-spin" /></div>
  if (isError) return <ErrorState onRetry={() => refetch()} />


  return (
    <div className="min-h-screen bg-background">
      <section className="bg-linear-to-br from-sky-600 to-orange-500 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-extrabold mb-4">{t('courses.title', 'Khóa học')}</motion.h1>
          <p className="text-sky-100 text-lg">{t('courses.subtitle', 'Lộ trình học toàn diện cho mọi trình độ')}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t('courses.filterByLevel', 'Lọc theo trình độ')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all', 'Tất cả')}</SelectItem>
              {levels.filter(l => l !== 'all').map(l => <SelectItem key={l} value={l as string}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} {t('courses.courseCount', 'khóa học')}</span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course, i) => (
            <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <Card className="rounded-2xl border hover:shadow-lg transition-shadow h-full flex flex-col">
                <div className={`h-2 ${['bg-sky-500', 'bg-teal-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-blue-500'][i % 6]} rounded-t-2xl`} />
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">{course.code}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{course.level}</Badge>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{course.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-3">{course.description || t('courses.noDescription', 'Chưa có mô tả')}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{course.totalSessions} {t('courses.sessions', 'buổi')}</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{course.durationPerSession || '60'} {t('courses.minutesPerSession', 'phút/buổi')}</span>
                  </div>
                  {course.fee && Number(course.fee) > 0 && <div className="text-lg font-bold text-sky-600 mb-4">{formatVND(Number(course.fee))}</div>}
                  <div className="flex gap-2">
                    <Link href="/register" className="flex-1"><Button className="w-full bg-sky-600 hover:bg-sky-700 rounded-xl text-sm">{t('auth.register', 'Đăng ký')}</Button></Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        {!filtered.length && <div className="text-center py-12 text-muted-foreground">{t('courses.noResults', 'Không tìm thấy khóa học phù hợp')}</div>}
      </section>
    </div>
  )
}
