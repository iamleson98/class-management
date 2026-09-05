'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Mail, ArrowLeft, Send, CheckCircle2, GraduationCap } from 'lucide-react'
import { sendPasswordReset } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useTranslation } from '@/lib/i18n'

const forgotPasswordSchema = z.object({
  email: z.email('Email không hợp lệ'),
})

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

function ForgotPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const { t } = useTranslation()

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const forgotMutation = useMutation({
    mutationFn: (values: ForgotPasswordInput) => sendPasswordReset(values.email),
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message || t('forgotPassword.sendFailed', 'Gửi yêu cầu thất bại. Vui lòng thử lại.')),
  })

  // If there's a token in URL, redirect to reset-password
  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      router.replace(`/reset-password?token=${encodeURIComponent(token)}`)
    }
  }, [searchParams, router])

  const handleSubmit = (values: ForgotPasswordInput) => {
    setError('')
    forgotMutation.mutate(values)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="p-2.5 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
            <GraduationCap className="h-7 w-7 text-sky-600" />
          </div>
          <span className="font-bold text-xl text-sky-600">VMG</span>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-4"
              >
                <div className="p-4 bg-sky-100 dark:bg-sky-900/30 rounded-full w-fit mx-auto">
                  <CheckCircle2 className="h-12 w-12 text-sky-600" />
                </div>
                <h2 className="text-2xl font-bold">{t('forgotPassword.emailSent', 'Đã gửi email!')}</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {t('forgotPassword.emailSentDesc', 'Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư (và thư rác) để tìm liên kết đặt lại mật khẩu.')}
                </p>
                <div className="pt-4">
                  <Link href="/login">
                    <Button
                      variant="outline"
                      className="rounded-lg"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {t('forgotPassword.backToLogin', 'Quay lại đăng nhập')}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="text-center mb-6 space-y-2">
                  <div className="p-3 bg-sky-100 dark:bg-sky-900/30 rounded-full w-fit mx-auto mb-4">
                    <Mail className="h-8 w-8 text-sky-600" />
                  </div>
                  <h2 className="text-2xl font-bold">{t('auth.forgotPassword', 'Quên mật khẩu?')}</h2>
                  <p className="text-muted-foreground text-sm">
                    {t('forgotPassword.description', 'Nhập email đăng ký của bạn. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.')}
                  </p>
                </div>

                <Form {...form} schema={forgotPasswordSchema}>
                  <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-5"
                  >
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('common.email', 'Email')}</FormLabel>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl>
                              <Input
                                type="email"
                                placeholder={t('forgotPassword.emailPlaceholder', 'Nhập email đăng ký')}
                                autoComplete="email"
                                {...field}
                                value={field.value ?? ''}
                                className="pl-9"
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm"
                      >
                        {error}
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-sky-600 hover:bg-sky-700 rounded-lg h-11 font-semibold text-white"
                        disabled={forgotMutation.isPending}
                      >
                        {forgotMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t('common.loading', 'Đang gửi...')}
                        </span>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1.5" />
                          {t('forgotPassword.submit', 'Gửi yêu cầu')}
                        </>
                      )}
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center">
                  <Link
                    href="/login"
                    className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t('forgotPassword.backToLogin', 'Quay lại đăng nhập')}
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  )
}
