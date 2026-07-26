'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterInput } from '@/lib/schemas'
import { submitRegistration } from '@/lib/api'
import {
  User, Phone, Mail, Users, MessageCircle,
  ArrowRight, CheckCircle2, GraduationCap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useTranslation } from '@/lib/i18n'

export default function RegisterPage() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const { t } = useTranslation()

  const registerMutation = useMutation({
    mutationFn: (values: RegisterInput) => submitRegistration({
      name: values.name,
      phone: values.phone,
      email: values.email,
      age: values.age,
      source: values.source,
      need: values.need,
    }),
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message || t('register.failed', 'Đăng ký thất bại. Vui lòng thử lại.')),
  })

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      age: '',
      source: '',
      need: '',
    },
  })

  const handleSubmit = (values: RegisterInput) => {
    setError('')
    registerMutation.mutate(values)
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="p-4 bg-sky-100 dark:bg-sky-900/30 rounded-full w-fit mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-sky-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3">{t('register.success', 'Đăng ký thành công!')}</h2>
          <p className="text-muted-foreground mb-2">
            {t('register.successMessage', 'Cảm ơn bạn đã đăng ký. Đội ngũ tư vấn của chúng tôi sẽ liên hệ bạn trong thời gian sớm nhất.')}
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            {t('register.supportHint', 'Nếu cần hỗ trợ ngay, hãy gọi hotline:')} <strong>(028) 1234 5678</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/home">
              <Button variant="outline" className="rounded-lg">
                {t('register.backHome', 'Về trang chủ')}
              </Button>
            </Link>
            <Link href="/courses">
              <Button className="rounded-lg bg-sky-600 hover:bg-sky-700">
                {t('register.viewCourses', 'Xem khóa học')}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div>
      {/* Hero Banner */}
      <section className="bg-linear-to-r from-sky-600 to-teal-600 py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 w-72 h-72 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-bold text-white"
          >
            {t('register.title', 'Đăng ký học')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-sky-100 text-lg max-w-2xl mx-auto"
          >
            {t('register.subtitle', 'Đăng ký ngay để nhận tư vấn miễn phí và kiểm tra trình độ đầu vào')}
          </motion.p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-3"
            >
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
                      <GraduationCap className="h-6 w-6 text-sky-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{t('register.form.title', 'Thông tin đăng ký')}</h2>
                      <p className="text-sm text-muted-foreground">{t('register.form.note', 'Các trường (*) là bắt buộc')}</p>
                    </div>
                  </div>

                  <Form {...form} schema={registerSchema}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('common.name', 'Họ tên')} </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder={t('register.form.namePlaceholder', 'Nhập họ và tên')} {...field} value={field.value ?? ''} className="pl-9" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('common.phone', 'Số điện thoại')} </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder={t('register.form.phonePlaceholder', 'Nhập số điện thoại')} {...field} value={field.value ?? ''} className="pl-9" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('common.email', 'Email')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input type="email" placeholder={t('register.form.emailPlaceholder', 'Nhập email')} {...field} value={field.value ?? ''} className="pl-9" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="age" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('register.form.age', 'Độ tuổi')}</FormLabel>
                            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                              <FormControl>
                                <div className="relative">
                                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                                  <SelectTrigger className="pl-9">
                                    <SelectValue placeholder={t('register.form.agePlaceholder', 'Chọn độ tuổi')} />
                                  </SelectTrigger>
                                </div>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="6-11">{t('register.form.ageChildren', '6 - 11 tuổi (Trẻ em)')}</SelectItem>
                                <SelectItem value="12-15">{t('register.form.ageTeen', '12 - 15 tuổi (Thiếu niên)')}</SelectItem>
                                <SelectItem value="16-18">{t('register.form.ageStudent', '16 - 18 tuổi (Học sinh)')}</SelectItem>
                                <SelectItem value="18+">{t('register.form.ageAdult', '18+ (Người lớn)')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="source" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('register.form.source', 'Nguồn biết đến VMG')}</FormLabel>
                          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('register.form.sourcePlaceholder', 'Chọn nguồn')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Facebook">Facebook</SelectItem>
                              <SelectItem value="Google">Google</SelectItem>
                              <SelectItem value="Bạn bè">{t('register.form.sourceFriend', 'Bạn bè / Người quen')}</SelectItem>
                              <SelectItem value="Zalo">Zalo</SelectItem>
                              <SelectItem value="Qua đường">{t('register.form.sourcePassby', 'Qua đường')}</SelectItem>
                              <SelectItem value="Khác">{t('common.other', 'Khác')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="need" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('register.form.need', 'Nhu cầu học')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Textarea
                                placeholder={t('register.form.needPlaceholder', 'Mô tả nhu cầu học của bạn (Ví dụ: Muốn giao tiếp tốt hơn, thi IELTS, tiếng Anh cho con...)')}
                                {...field}
                                value={field.value ?? ''}
                                className="pl-9"
                                rows={3}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm">
                          {error}
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full bg-sky-600 hover:bg-sky-700 rounded-lg h-11 font-semibold"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {t('common.loading', 'Đang gửi...')}
                          </span>
                        ) : (
                          <>
                            {t('register.form.submit', 'Gửi đăng ký')}
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Sidebar info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 space-y-6"
            >
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-4">{t('register.sidebar.process', 'Quy trình đăng ký')}</h3>
                  <div className="space-y-4">
                    {[
                      t('register.sidebar.step1', 'Điền thông tin đăng ký'),
                      t('register.sidebar.step2', 'Nhân viên tư vấn liên hệ trong 24h'),
                      t('register.sidebar.step3', 'Kiểm tra trình độ đầu vào miễn phí'),
                      t('register.sidebar.step4', 'Nhận lộ trình học cá nhân hóa'),
                      t('register.sidebar.step5', 'Bắt đầu khóa học'),
                    ].map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-muted-foreground">{step}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-3">{t('register.sidebar.needHelp', 'Cần hỗ trợ?')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('register.sidebar.contactDirect', 'Liên hệ trực tiếp với chúng tôi để được tư vấn nhanh nhất.')}
                  </p>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">{t('register.sidebar.hotline', 'Hotline')}: (028) 1234 5678</p>
                    <p className="font-medium">{t('common.email', 'Email')}: info@vmg.edu.vn</p>
                    <p className="text-muted-foreground">{t('register.sidebar.workingHours', 'Giờ làm việc')}: {t('register.sidebar.workingHoursValue', 'T2 - CN, 8:00 - 21:00')}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
