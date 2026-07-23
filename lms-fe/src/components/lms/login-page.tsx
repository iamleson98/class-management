'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, LogIn, Eye, EyeOff, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { loginSchema, type LoginInput } from '@/lib/schemas'
import { loginWithMattermost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useTheme } from 'next-themes'
import { useTranslation } from '@/lib/i18n'

interface LoginPageProps {
  onLogin: (user: any) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { setTheme, theme } = useTheme()
  const { t } = useTranslation()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginInput) => loginWithMattermost(values.email, values.password),
    onSuccess: (user) => onLogin(user),
    onError: (err) => setError(err.message),
  })

  const handleLogin = (values: LoginInput) => {
    setError('')
    loginMutation.mutate(values)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-sky-600 via-teal-600 to-cyan-700 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-yellow-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('layout.brand', 'Việt Mỹ Global')}</h1>
              <p className="text-sky-100 text-sm">{t('layout.subtitle', 'Hệ thống Quản lý Trung tâm Anh ngữ')}</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-bold text-white leading-tight">
            {t('login.hero.title', 'Quản lý trung tâm')}
            <br />
            {t('login.hero.titleLine2', 'tiếng Anh toàn diện')}
          </h2>
          <p className="text-sky-100 text-lg max-w-md">
            {t('login.hero.description', 'Website tuyển sinh, CRM, quản lý học viên, học phí, điểm danh, giáo án, báo cáo — tất cả trong một hệ thống.')}
          </p>
          <div className="flex gap-8 text-white/80">
            <div>
              <div className="text-2xl font-bold">7+</div>
              <div className="text-sm">{t('login.hero.statRoles', 'Vai trò')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">15</div>
              <div className="text-sm">{t('login.hero.statModules', 'Phân hệ')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">100%</div>
              <div className="text-sm">{t('login.hero.statVietnamese', 'Tiếng Việt')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden justify-center mb-8">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
              <GraduationCap className="h-7 w-7 text-sky-600 dark:text-sky-400" />
            </div>
            <h1 className="text-xl font-bold">{t('layout.brand', 'Việt Mỹ Global')}</h1>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t('auth.login', 'Đăng nhập')}</h2>
            <p className="text-muted-foreground mt-1">{t('login.subtitle', 'Hệ thống quản lý Việt Mỹ Global')}</p>
          </div>

          <Form {...form} schema={loginSchema}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
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
                          placeholder="email@example.com"
                          className="pl-9"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password', 'Mật khẩu')}</FormLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={t('auth.passwordPlaceholder', 'Mật khẩu')}
                          className="pl-9 pr-9"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300">
                  {t('auth.forgotPassword', 'Quên mật khẩu?')}
                </Link>
              </div>

              <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 rounded-lg h-11" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('auth.loggingIn', 'Đang đăng nhập...')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    {t('auth.loginBtn', 'Đăng nhập')}
                  </span>
                )}
              </Button>
            </form>
          </Form>

          {/* Demo hint */}
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>{t('login.demoAccount', 'Tài khoản demo')}: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">admin@vmg.edu.vn</code> / <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">password123</code></p>
          </div>

          {/* Theme toggle */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              suppressHydrationWarning
            >
              {theme === 'dark' ? `☀️ ${t('layout.lightMode', 'Chế độ sáng')}` : `🌙 ${t('layout.darkMode', 'Chế độ tối')}`}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
