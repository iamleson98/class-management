'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTheme } from 'next-themes'
import {
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  GraduationCap,
  Sun,
  Moon,
  Users,
  BookOpen,
  Award,
  ChevronRight,
} from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/schemas'
import { loginWithMattermost } from '@/lib/api'
import { useLMSStore } from '@/store/lms-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useTranslation } from '@/lib/i18n'

const STATS = [
  { icon: Users, value: '5,000+', label: 'login.stats.students' },
  { icon: BookOpen, value: '50+', label: 'login.stats.courses' },
  { icon: Award, value: '98%', label: 'login.stats.satisfied' },
]

export default function PublicLoginPage() {
  const router = useRouter()
  const login = useLMSStore((s) => s.login)
  const { theme, setTheme } = useTheme()
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useTranslation()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginInput) => loginWithMattermost(values.email, values.password),
    onSuccess: (user) => {
      // login() persists auth to sessionStorage + sets zustand state
      login(user)
      // Navigate to app root using Next.js router
      router.push('/')
    },
    onError: (err) => {
      setError(err.message || t('auth.loginFailed', 'Đăng nhập thất bại. Vui lòng thử lại.'))
    },
  })

  const handleSubmit = (values: LoginInput) => {
    setError('')
    loginMutation.mutate(values)
  }

  return (
    <div className="min-h-screen flex">
      {/* ============================================================ */}
      {/*  Left branding panel — desktop only                          */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-sky-600 via-teal-600 to-cyan-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full" />
        <div className="absolute -bottom-15 -left-15 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-white/5 rounded-full blur-xl" />

        {/* Top: Logo */}
        <div className="relative z-10">
          <Link href="/home" className="inline-flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <div>
              <span className="font-bold text-2xl text-white tracking-tight">VMG</span>
              <p className="text-sky-100 text-sm font-medium">{t('layout.brand', 'Việt Mỹ Global')}</p>
            </div>
          </Link>
        </div>

        {/* Center: Tagline */}
        <div className="relative z-10 space-y-8">
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
            {t('login.hero.leftTitle', 'Nâng tầm')}
            <br />
            {t('login.hero.leftTitleLine2', 'tiếng Anh')}
            <br />
            <span className="text-sky-200">{t('login.hero.leftTitleLine3', 'cùng bạn')}</span>
          </h1>
          <p className="text-sky-100 text-lg max-w-md leading-relaxed">
            {t('login.hero.leftDescription', 'Nền tảng quản lý học tập thông minh, giúp bạn theo dõi tiến độ và đạt mục tiêu tiếng Anh nhanh hơn.')}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-8 pt-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <stat.icon className="h-5 w-5 text-sky-200 mr-1.5" />
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <span className="text-sky-200 text-sm">{t(stat.label, '')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Copyright */}
        <div className="relative z-10 text-sky-200/60 text-sm">
          &copy; {new Date().getFullYear()} {t('layout.brand', 'Việt Mỹ Global')}. {t('layout.footer.copyright', 'Tất cả quyền được bảo lưu.')}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Right form panel                                             */}
      {/* ============================================================ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-4">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
              <GraduationCap className="h-7 w-7 text-sky-600" />
            </div>
            <div>
              <span className="font-bold text-xl text-sky-600">VMG</span>
              <p className="text-xs text-muted-foreground">{t('layout.brand', 'Việt Mỹ Global')}</p>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight">{t('auth.login', 'Đăng nhập')}</h2>
            <p className="text-muted-foreground mt-2">
              {t('login.publicSubtitle', 'Đăng nhập vào cổng thông tin học viên VMG')}
            </p>
          </div>

          {/* Form */}
          <Form {...form} schema={loginSchema}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.email', 'Email')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder={t('login.hero.emailPlaceholder', 'example@vmg.edu.vn')}
                          autoComplete="email"
                          {...field}
                          value={field.value ?? ''}
                          className="pl-9"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t('auth.password', 'Mật khẩu')}</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium"
                      >
                        {t('auth.forgotPassword', 'Quên mật khẩu?')}
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={t('auth.passwordPlaceholder', 'Nhập mật khẩu')}
                          autoComplete="current-password"
                          {...field}
                          value={field.value ?? ''}
                          className="pl-9 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? t('auth.hidePassword', 'Ẩn mật khẩu') : t('auth.showPassword', 'Hiện mật khẩu')}
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

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-700 rounded-lg h-11 font-semibold text-white"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('auth.loggingIn', 'Đang đăng nhập...')}
                  </span>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-1.5" />
                    {t('auth.loginBtn', 'Đăng nhập')}
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Register link */}
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.noAccount', 'Chưa có tài khoản?')}{' '}
            <Link
              href="/register"
              className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium inline-flex items-center gap-0.5"
            >
              {t('auth.registerNow', 'Đăng ký ngay')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </p>

          {/* Demo hint */}
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium text-muted-foreground">{t('login.demoAccount', 'Tài khoản dùng thử')}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">{t('common.email', 'Email')}: </span>
                <span className="font-mono text-foreground">admin@vmg.vn</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('auth.password', 'Mật khẩu')}: </span>
                <span className="font-mono text-foreground">admin123</span>
              </div>
            </div>
          </div>

          {/* Theme toggle */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={t('layout.toggleTheme', 'Chuyển đổi giao diện')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
