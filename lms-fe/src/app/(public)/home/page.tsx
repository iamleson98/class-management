'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterInput } from '@/lib/schemas'
import { useLMSStore } from '@/store/lms-store'
import { useTranslation } from '@/lib/i18n'
import { getPublicCourses, submitRegistration } from '@/lib/api'
import {
  GraduationCap, Users, Award, Globe, BookOpen, Headphones,
  ChevronRight, Star, Phone, Mail, MapPin, Clock, ChevronUp, LogIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/lms/error-state'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                          */
/* ────────────────────────────────────────────────────────────────── */

const formatVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0)

const cardColors = [
  'bg-sky-500', 'bg-teal-500', 'bg-violet-500',
  'bg-amber-500', 'bg-rose-500', 'bg-blue-500',
]

/* ────────────────────────────────────────────────────────────────── */
/*  Page                                                             */
/* ────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [ctaSuccess, setCtaSuccess] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const { isAuthenticated } = useLMSStore()
  const { t } = useTranslation()

  /* ---------- fetch courses ---------- */
  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-courses'],
    queryFn: getPublicCourses,
  })

  /* ---------- scroll-to-top visibility ---------- */
  const onScroll = () => setShowScrollTop(window.scrollY > 300)

  useEffect(() => {
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ---------- CTA form ---------- */
  const ctaForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      age: '',
      source: 'Website',
      need: 'Đăng ký từ trang chủ',
    },
  })

  const ctaMutation = useMutation({
    mutationFn: (values: RegisterInput) => submitRegistration({ ...values, source: 'Website', need: 'Đăng ký từ trang chủ' }),
    onSuccess: () => {
      setCtaSuccess(true)
      ctaForm.reset({
        name: '',
        phone: '',
        email: '',
        age: '',
        source: 'Website',
        need: 'Đăng ký từ trang chủ',
      })
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-3 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  /* ---------- static data ---------- */
  const stats = [
    { value: '10+', label: t('home.stats.experience', 'Năm kinh nghiệm'), icon: Award },
    { value: '5000+', label: t('home.stats.students', 'Học viên'), icon: Users },
    { value: '98%', label: t('home.stats.satisfied', 'Hài lòng'), icon: Star },
    { value: '50+', label: t('home.stats.teachers', 'Giáo viên'), icon: GraduationCap },
  ]

  const features = [
    { title: t('home.features.nativeTeachers', 'Giáo viên bản ngữ'), desc: t('home.features.nativeTeachersDesc', 'Đội ngũ giáo viên Anh, Mỹ, Úc có chứng chỉ quốc tế'), icon: Globe },
    { title: t('home.features.smallClasses', 'Lớp học nhỏ'), desc: t('home.features.smallClassesDesc', 'Tối đa 12 học viên/lớp, tương tác cá nhân cao'), icon: Users },
    { title: t('home.features.modernMethod', 'Phương pháp hiện đại'), desc: t('home.features.modernMethodDesc', 'Kết hợp Communicative Approach và Công nghệ'), icon: BookOpen },
    { title: t('home.features.support247', 'Hỗ trợ 24/7'), desc: t('home.features.support247Desc', 'Đội ngũ tư vấn và hỗ trợ học viên mọi lúc'), icon: Headphones },
  ]

  const testimonials = [
    { name: 'Nguyễn Minh Anh', role: 'IELTS 7.5', text: t('home.testimonials.1', 'Nhờ VMG mà mình đạt IELTS 7.5 sau 6 tháng học. Giáo viên rất tận tâm và phương pháp học hiệu quả.') },
    { name: 'Trần Văn Hùng', role: t('home.testimonials.role2', 'Khóa Giao tiếp'), text: t('home.testimonials.2', 'Lớp học vui, giáo viên hài hước. Mình tự tin giao tiếp tiếng Anh hơn rất nhiều sau khóa học.') },
    { name: 'Lê Thị Mai', role: 'Toeic 850', text: t('home.testimonials.3', 'Lộ trình học được cá nhân hóa, phù hợp với level và mục tiêu của mình. Rất recommend!') },
  ]

  const steps = [
    { num: 1, title: t('home.steps.1.title', 'Điền thông tin'), desc: t('home.steps.1.desc', 'Đăng ký và cung cấp thông tin cơ bản') },
    { num: 2, title: t('home.steps.2.title', 'Kiểm tra trình độ'), desc: t('home.steps.2.desc', 'Kiểm tra đầu vào miễn phí') },
    { num: 3, title: t('home.steps.3.title', 'Nhận lộ trình'), desc: t('home.steps.3.desc', 'Lộ trình học cá nhân hóa') },
    { num: 4, title: t('home.steps.4.title', 'Bắt đầu học'), desc: t('home.steps.4.desc', 'Tham gia lớp và bắt đầu hành trình') },
  ]

  const contacts = [
    { icon: Phone, label: t('home.contact.hotline', 'Hotline'), value: '(028) 1234 5678', desc: t('home.contact.hotlineHours', 'Thứ 2 - Chủ nhật, 8:00 - 21:00') },
    { icon: Mail, label: t('common.email', 'Email'), value: 'info@vmg.edu.vn', desc: t('home.contact.emailReply', 'Phản hồi trong vòng 24 giờ') },
    { icon: MapPin, label: t('home.contact.mainBranch', 'Cơ sở chính'), value: '123 Nguyễn Văn Linh, Quận 7, TP. HCM', desc: '' },
    { icon: Clock, label: t('home.contact.openingHours', 'Giờ mở cửa'), value: t('home.contact.openingHoursValue', 'T2 - CN: 8:00 - 21:00'), desc: '' },
  ]

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <div className="min-h-screen bg-background">
      {/* ───────── Section 1: Hero ───────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-linear-to-br from-sky-500 via-sky-600 to-orange-500 text-white">
        {/* SVG pattern overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="white" />
              <line x1="14" y1="14" x2="20" y2="20" stroke="white" strokeWidth="0.6" />
              <line x1="20" y1="14" x2="14" y2="20" stroke="white" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Floating decorative circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-96 h-96 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="absolute -bottom-16 right-1/4 w-56 h-56 rounded-full bg-sky-200/10 blur-2xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-24 md:py-32 w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              {t('home.hero.title', 'Học Tiếng Anh')}
              <br />
              <span className="text-sky-200">{t('home.hero.titleHighlight', 'Mở Ra Tương Lai')}</span>
            </h1>

            <p className="text-lg md:text-xl text-sky-100 mb-8 leading-relaxed max-w-2xl">
              {t('home.hero.subtitle', 'Việt Mỹ Global — Trung tâm Anh ngữ hàng đầu với phương pháp học hiện đại,')}
              <br />
              {t('home.hero.subtitleLine2', 'giáo viên bản ngữ và lộ trình cá nhân hóa cho mọi trình độ.')}
            </p>

            <div className="flex flex-wrap gap-4">
              {!isAuthenticated && (
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-sky-700 hover:bg-sky-50 rounded-xl text-base px-8 shadow-lg"
                >
                  <Link href="/register">{t('home.hero.ctaTrial', 'Đăng ký học thử')}</Link>
                </Button>
              )}
              {isAuthenticated ? (
                <Button
                  asChild
                  size="lg"
                  className="border border-white/30 bg-white/10 text-white hover:bg-white/20 rounded-xl text-base px-8"
                >
                  <Link href="/">
                    {t('home.hero.ctaDashboard', 'Vào hệ thống quản lý')}
                    <LogIn className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  className="border border-white/30 bg-white/10 text-white hover:bg-white/20 rounded-xl text-base px-8"
                >
                  <Link href="/login">
                    {t('home.hero.ctaLogin', 'Đăng nhập hệ thống')}
                    <LogIn className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              )}
              <Button
                asChild
                size="lg"
                className="border border-white/30 bg-white/10 text-white hover:bg-white/20 rounded-xl text-base px-8"
              >
                <Link href="/courses">
                  {t('home.hero.ctaCourses', 'Xem khóa học')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───────── Section 2: Stats Bar ───────── */}
      <section className="bg-white dark:bg-gray-950 border-y">
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <s.icon className="h-6 w-6 mx-auto mb-2 text-sky-600" />
              <div className="text-3xl font-extrabold text-sky-700 dark:text-sky-400">
                {s.value}
              </div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───────── Section 3: Featured Courses ───────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-extrabold mb-3">{t('home.courses.title', 'Khóa học nổi bật')}</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {t('home.courses.subtitle', 'Lộ trình học toàn diện từ cơ bản đến nâng cao, phù hợp mọi độ tuổi và mục tiêu')}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {(courses || []).slice(0, 6).map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow h-full">
                <div className={`h-2 ${cardColors[i % cardColors.length]}`} />
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-sky-600">{course.code}</span>
                    <Badge variant="secondary" className="text-xs">
                      {course.level}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{course.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {course.description || ''}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">{course.totalSessions} {t('home.courses.sessions', 'buổi')}</span>
                      <span className="font-semibold text-sky-700 dark:text-sky-400">
                        {formatVND(Number(course.fee || 0))}
                      </span>
                    </div>
                    <Button asChild size="sm" className="bg-sky-600 hover:bg-sky-700 rounded-lg text-xs">
                      <Link href="/register">{t('auth.register', 'Đăng ký')}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/courses">
              {t('home.courses.viewAll', 'Xem tất cả khóa học')} <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ───────── Section 4: Why Choose Us ───────── */}
      <section className="bg-muted/50">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-extrabold mb-3">{t('home.whyUs.title', 'Tại sao chọn Việt Mỹ Global?')}</h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="rounded-2xl border h-full text-center hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-14 h-14 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center mx-auto mb-4">
                      <f.icon className="h-7 w-7 text-sky-600" />
                    </div>
                    <h3 className="font-bold text-base mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Section 5: Testimonials ───────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-extrabold mb-3">{t('home.testimonials.title', 'Học viên nói gì?')}</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((tItem, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="rounded-2xl border h-full">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    &ldquo;{tItem.text}&rdquo;
                  </p>
                  <div className="font-semibold text-sm">{tItem.name}</div>
                  <Badge className="mt-1 bg-sky-600 text-white text-xs">{tItem.role}</Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───────── Section 6: How It Works ───────── */}
      <section className="bg-muted/50">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-extrabold mb-3">{t('home.howItWorks.title', 'Quy trình học')}</h2>
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex flex-col items-center text-center flex-1 px-2 relative"
              >
                {/* Connector line (desktop) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-[calc(50%+24px)] right-[calc(-50%+24px)] h-0.5 bg-sky-300" />
                )}
                {/* Connector line (mobile) */}
                {i < steps.length - 1 && (
                  <div className="md:hidden absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-[calc(100%-20px)] bg-sky-300" />
                )}

                <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center text-lg font-bold mb-3 relative z-10">
                  {step.num}
                </div>
                <h3 className="font-bold text-base mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground max-w-40">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Section 7: CTA ───────── */}
      <section className="relative overflow-hidden bg-linear-to-br from-sky-600 to-orange-500 text-white">
        {/* Decorative blurs */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-teal-300/15 blur-2xl" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-extrabold mb-4">{t('home.cta.title', 'Đăng ký tư vấn miễn phí')}</h2>
            <p className="text-sky-100 mb-8">
              {t('home.cta.subtitle', 'Để lại thông tin, đội ngũ tư vấn sẽ liên hệ bạn trong vòng 30 phút')}
            </p>

            {ctaSuccess && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm px-5 py-3 text-sm">
                <Star className="h-4 w-4 text-amber-300" />
                {t('home.cta.success', 'Đăng ký thành công! Chúng tôi sẽ liên hệ bạn sớm nhất.')}
              </div>
            )}

            <Form {...ctaForm} schema={registerSchema}>
              <form
                onSubmit={ctaForm.handleSubmit((values) => ctaMutation.mutate(values))}
                className="max-w-md mx-auto flex flex-col sm:flex-row gap-3"
              >
                <FormField
                  control={ctaForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder={t('common.name', 'Họ tên')}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ctaForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder={t('common.phone', 'Số điện thoại')}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={ctaMutation.isPending}
                  className="bg-white text-sky-700 hover:bg-sky-50 rounded-xl font-semibold shrink-0"
                >
                  {ctaMutation.isPending ? t('common.loading', 'Đang gửi...') : t('home.cta.submit', 'Đăng ký ngay')}
                </Button>
              </form>
            </Form>
          </motion.div>
        </div>
      </section>

      {/* ───────── Section 8: Contact ───────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-extrabold mb-3">{t('contact.title', 'Liên hệ')}</h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {contacts.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="rounded-2xl border h-full text-center hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center mx-auto mb-3">
                    <c.icon className="h-6 w-6 text-sky-600" />
                  </div>
                  <div className="text-xs font-semibold text-sky-600 mb-1">{c.label}</div>
                  <div className="text-sm font-bold">{c.value}</div>
                  {c.desc && (
                    <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───────── Section 9: Scroll-to-top ───────── */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-sky-600 hover:bg-sky-700 text-white shadow-lg flex items-center justify-center transition-colors"
          aria-label={t('common.scrollTop', 'Cuộn lên đầu trang')}
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </div>
  )
}
