'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contactSchema, type ContactInput } from '@/lib/schemas'
import { submitContact } from '@/lib/api'
import { Phone, Mail, MapPin, Clock, Send, MessageCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useTranslation } from '@/lib/i18n'

export default function ContactPage() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const { t } = useTranslation()

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', message: '' },
  })

  const contactMutation = useMutation({
    mutationFn: (values: ContactInput) => submitContact({
      name: values.name,
      email: values.email || '',
      phone: values.phone || '',
      message: values.message,
    }),
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message || t('contact.sendFailed', 'Gửi tin nhắn thất bại. Vui lòng thử lại.')),
  })

  const handleSubmit = (values: ContactInput) => {
    setError('')
    contactMutation.mutate(values)
  }

  const contactInfo = [
    { icon: Phone, title: t('contact.info.hotline', 'Hotline'), value: '(028) 1234 5678', desc: t('contact.info.hotlineHours', 'Thứ 2 - Chủ nhật, 8:00 - 21:00') },
    { icon: Mail, title: t('common.email', 'Email'), value: 'info@vmg.edu.vn', desc: t('contact.info.emailReply', 'Phản hồi trong vòng 24 giờ') },
    { icon: MapPin, title: t('contact.info.mainBranch', 'Cơ sở chính'), value: '123 Nguyễn Văn Linh, Quận 7', desc: t('contact.info.city', 'TP. Hồ Chí Minh') },
    { icon: Clock, title: t('contact.info.workingHours', 'Giờ làm việc'), value: t('contact.info.workingHoursValue', 'T2 - CN: 8:00 - 21:00'), desc: t('contact.info.workingHoursNote', 'Cả ngày lễ và chủ nhật') },
  ]

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
            {t('contact.title', 'Liên hệ')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-sky-100 text-lg max-w-2xl mx-auto"
          >
            {t('contact.subtitle', 'Hãy liên hệ với chúng tôi để được tư vấn miễn phí')}
          </motion.p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Info */}
            <div className="space-y-4">
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl font-bold mb-6"
              >
                {t('contact.info.title', 'Thông tin liên hệ')}
              </motion.h2>

              {contactInfo.map((c, i) => (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center shrink-0">
                        <c.icon className="h-5 w-5 text-sky-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{c.title}</div>
                        <div className="text-sm">{c.value}</div>
                        <div className="text-xs text-muted-foreground">{c.desc}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {/* Map placeholder */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="pt-4"
              >
                <div className="rounded-xl border bg-gray-50 dark:bg-gray-900/50 h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MapPin className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">{t('contact.map', 'Bản đồ')}</p>
                    <p className="text-xs mt-1">123 Nguyễn Văn Linh, Quận 7, TP. HCM</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 sm:p-8">
                  {success ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8"
                    >
                      <div className="p-3 bg-sky-100 dark:bg-sky-900/30 rounded-full w-fit mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-sky-600" />
                      </div>
                      <h3 className="font-bold text-xl mb-2">{t('contact.success', 'Gửi thành công!')}</h3>
                      <p className="text-muted-foreground mb-6">{t('contact.successMessage', 'Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi trong thời gian sớm nhất.')}</p>
                      <Button variant="outline" onClick={() => { setSuccess(false); form.reset({ name: '', email: '', phone: '', message: '' }) }} className="rounded-lg">
                        {t('contact.sendAnother', 'Gửi tin nhắn khác')}
                      </Button>
                    </motion.div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
                          <MessageCircle className="h-6 w-6 text-sky-600" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{t('contact.form.title', 'Gửi tin nhắn')}</h2>
                          <p className="text-sm text-muted-foreground">{t('contact.form.replyTime', 'Chúng tôi sẽ phản hồi trong 24 giờ')}</p>
                        </div>
                      </div>

                      <Form {...form} schema={contactSchema}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FormField control={form.control} name="name" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('contact.form.name', 'Họ tên')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('contact.form.namePlaceholder', 'Nhập họ tên')} {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('common.email', 'Email')}</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder={t('contact.form.emailPlaceholder', 'Nhập email')} {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>

                          <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('common.phone', 'Số điện thoại')}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input placeholder={t('contact.form.phonePlaceholder', 'Nhập số điện thoại')} {...field} value={field.value ?? ''} className="pl-9" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={form.control} name="message" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('contact.form.message', 'Nội dung')}</FormLabel>
                              <FormControl>
                                <Textarea placeholder={t('contact.form.messagePlaceholder', 'Nhập nội dung tin nhắn...')} {...field} value={field.value ?? ''} rows={5} />
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
                            disabled={contactMutation.isPending}
                            className="w-full bg-sky-600 hover:bg-sky-700 rounded-lg h-11 font-semibold"
                          >
                            {contactMutation.isPending ? (
                              <span className="flex items-center gap-2">
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('common.loading', 'Đang gửi...')}
                              </span>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                {t('contact.form.submit', 'Gửi tin nhắn')}
                              </>
                            )}
                          </Button>
                        </form>
                      </Form>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
