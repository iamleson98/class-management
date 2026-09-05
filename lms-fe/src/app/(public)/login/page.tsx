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
import { login } from '@/lib/api'
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
  const storeLogin = useLMSStore((s) => s.login)
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
    mutationFn: (values: LoginInput) => login(values.email, values.password),
    onSuccess: (user) => {
      // login() persists auth to sessionStorage + sets zustand state
      storeLogin(user)
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
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-indigo-700 via-indigo-600 to-sky-500 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative aurora blobs */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-15 -left-15 w-64 h-64 bg-cyan-300/20 rounded-full blur-2xl" />
        <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-violet-400/15 rounded-full blur-3xl" />
        <div className="absolute inset-0 dot-pattern opacity-15" />

        {/* Top: Logo */}
        <div className="relative z-10">
          <Link href="/home" className="inline-flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl ring-1 ring-white/30 shadow-lg">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <div>
              <span className="font-bold text-2xl text-white tracking-tight">VMG</span>
              <p className="text-indigo-100 text-sm font-medium">{t('layout.brand', 'Việt Mỹ Global')}</p>
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
            <span className="bg-linear-to-r from-cyan-200 to-white bg-clip-text text-transparent">{t('login.hero.leftTitleLine3', 'cùng bạn')}</span>
          </h1>
          <p className="text-indigo-100 text-lg max-w-md leading-relaxed">
            {t('login.hero.leftDescription', 'Nền tảng quản lý học tập thông minh, giúp bạn theo dõi tiến độ và đạt mục tiêu tiếng Anh nhanh hơn.')}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-8 pt-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <stat.icon className="h-5 w-5 text-cyan-200 mr-1.5" />
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <span className="text-indigo-200 text-sm">{t(stat.label, '')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Copyright */}
        <div className="relative z-10 text-indigo-200/70 text-sm">
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
            <div className="p-2.5 bg-linear-to-br from-indigo-500 to-sky-400 rounded-xl shadow-lg shadow-indigo-500/25">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl gradient-text">VMG</span>
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
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t('login.hero.emailPlaceholder', 'example@vmg.edu.vn')}
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t('auth.password', 'Mật khẩu')}</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                      >
                        {t('auth.forgotPassword', 'Quên mật khẩu?')}
                      </Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={t('auth.passwordPlaceholder', 'Nhập mật khẩu')}
                          autoComplete="current-password"
                          {...field}
                          value={field.value ?? ''}
                          className="pl-9 pr-10"
                        />
                      </FormControl>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold text-white bg-linear-to-r from-indigo-600 to-sky-500 hover:from-indigo-700 hover:to-sky-600 shadow-lg shadow-indigo-500/25"
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
              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium inline-flex items-center gap-0.5"
            >
              {t('auth.registerNow', 'Đăng ký ngay')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </p>

          {/* Demo hint */}
          <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm space-y-2">
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
