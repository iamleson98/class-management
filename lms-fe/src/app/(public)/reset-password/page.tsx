'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  GraduationCap,
  AlertTriangle,
} from 'lucide-react'
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
import { verifyResetToken, resetPassword } from '@/lib/api'

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .max(128, 'Mật khẩu tối đa 128 ký tự'),
    confirmPassword: z.string().min(1, 'Xác nhận mật khẩu là bắt buộc'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

type TokenStatus = 'loading' | 'valid' | 'invalid'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const { t } = useTranslation()

  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Verify token
  const { data: tokenData, isLoading: isVerifying, isError, refetch } = useQuery({
    queryKey: ['reset-token', token],
    queryFn: () => verifyResetToken(token),
    enabled: !!token,
    retry: false,
  })

  const tokenStatus: TokenStatus = !token ? 'invalid' : isVerifying ? 'loading' : tokenData?.valid ? 'valid' : 'invalid'

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const resetMutation = useMutation({
    mutationFn: (values: ResetPasswordInput) => resetPassword(token, values.password),
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message || t('resetPassword.failed', 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.')),
  })

  const handleSubmit = (values: ResetPasswordInput) => {
    setError('')
    resetMutation.mutate(values)
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
            {/* Loading state */}
            {tokenStatus === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-8 w-8 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">{t('resetPassword.verifying', 'Đang xác minh liên kết...')}</p>
              </div>
            )}

            {/* Invalid OR expired token — the backend verify-token endpoint only
                reports {valid: boolean}, so both cases share this block. */}
            {tokenStatus === 'invalid' && !isError && (
              <div className="text-center py-4 space-y-4">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto">
                  <AlertTriangle className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold">{t('resetPassword.invalidLink', 'Liên kết không hợp lệ')}</h2>
                <p className="text-muted-foreground">
                  {t('resetPassword.invalidLinkDesc', 'Liên kết đặt lại mật khẩu không tồn tại hoặc đã bị hủy. Vui lòng yêu cầu lại liên kết mới.')}
                </p>
                <div className="pt-2">
                  <Link href="/forgot-password">
                    <Button className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white">
                      {t('auth.forgotPassword', 'Quên mật khẩu?')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Error verifying token */}
            {isError && tokenStatus === 'invalid' && (
              <div className="text-center py-4 space-y-4">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto">
                  <AlertTriangle className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold">{t('common.errorTitle', 'Đã xảy ra lỗi')}</h2>
                <p className="text-muted-foreground">
                  {t('resetPassword.verifyError', 'Không thể xác minh liên kết. Vui lòng thử lại.')}
                </p>
                <div className="pt-2">
                  <Button variant="outline" onClick={() => refetch()}>
                    {t('common.retry', 'Thử lại')}
                  </Button>
                </div>
              </div>
            )}

            {/* Valid token - show form or success */}
            {tokenStatus === 'valid' && (
              <>
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-4 space-y-4"
                  >
                    <div className="p-4 bg-sky-100 dark:bg-sky-900/30 rounded-full w-fit mx-auto">
                      <CheckCircle2 className="h-12 w-12 text-sky-600" />
                    </div>
                    <h2 className="text-2xl font-bold">{t('resetPassword.success', 'Đặt lại thành công!')}</h2>
                    <p className="text-muted-foreground">
                      {t('resetPassword.successDesc', 'Mật khẩu của bạn đã được cập nhật thành công. Bạn có thể đăng nhập bằng mật khẩu mới.')}
                    </p>
                    <div className="pt-4">
                      <Link href="/login">
                        <Button className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white">
                          <KeyRound className="h-4 w-4 mr-1.5" />
                          {t('auth.loginNow', 'Đăng nhập ngay')}
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <div className="text-center mb-6 space-y-2">
                      <div className="p-3 bg-sky-100 dark:bg-sky-900/30 rounded-full w-fit mx-auto mb-4">
                        <KeyRound className="h-8 w-8 text-sky-600" />
                      </div>
                      <h2 className="text-2xl font-bold">{t('auth.resetPassword', 'Đặt lại mật khẩu')}</h2>
                      <p className="text-muted-foreground text-sm">
                        {t('resetPassword.description', 'Nhập mật khẩu mới cho tài khoản của bạn.')}
                      </p>
                    </div>

                    <Form {...form} schema={resetPasswordSchema}>
                      <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-5"
                      >
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('resetPassword.newPassword', 'Mật khẩu mới')}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={t('resetPassword.newPasswordPlaceholder', 'Nhập mật khẩu mới')}
                                    autoComplete="new-password"
                                    {...field}
                                    value={field.value ?? ''}
                                    className="pl-9 pr-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    tabIndex={-1}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('resetPassword.confirmPassword', 'Xác nhận mật khẩu')}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder={t('resetPassword.confirmPasswordPlaceholder', 'Nhập lại mật khẩu mới')}
                                    autoComplete="new-password"
                                    {...field}
                                    value={field.value ?? ''}
                                    className="pl-9 pr-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    tabIndex={-1}
                                  >
                                    {showConfirm ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </FormControl>
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
                          disabled={resetMutation.isPending}
                        >
                          {resetMutation.isPending ? (
                            <span className="flex items-center gap-2">
                              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              {t('resetPassword.updating', 'Đang cập nhật...')}
                            </span>
                          ) : (
                            t('auth.resetPassword', 'Đặt lại mật khẩu')
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
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
