'use client'

/**
 * Account management page — the "Tài khoản của tôi" view available to every
 * role. Three zones:
 *
 *   1. Profile banner — gradient identity card with the user's avatar
 *      (server image with initials fallback), display name, email and role
 *      badges. Avatar upload / removal uses the Mattermost user image API.
 *   2. Profile form — first/last name, nickname and job position, saved via
 *      PATCH /users/me (client4.patchMe). Email and username are read-only
 *      (changing them requires admin + email verification flows).
 *   3. Security form — change password with current-password confirmation via
 *      PUT /users/{id}/password (client4.updateUserPassword), plus a link to
 *      the public "forgot password" flow and account metadata (created date,
 *      last password change).
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import {
  User, Mail, Lock, KeyRound, Camera, Trash2, CheckCircle2, Save,
  CalendarDays, ShieldCheck, Eye, EyeOff, UserCircle, Info,
} from 'lucide-react'
import Link from 'next/link'
import { client4 } from '@/lib/chat/client'
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/schemas'
import { useLMSStore, parseAllLMSRoles, ROLE_COLORS } from '@/store/lms-store'
import { getUserDisplayName } from '@/lib/api'
import { getInitials } from '@/components/shared/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'

/** Extract the human-readable message from a ClientError / Error. */
function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    // ClientError message is "server message: url" — keep only the message part
    return err.message.split(' /api/v4')[0] || fallback
  }
  return fallback
}

/** Read a string user field, tolerating this fork's non-underscored serialization (firstname vs first_name). */
function userStr(user: unknown, ...keys: string[]): string {
  const u = user as Record<string, unknown> | null | undefined
  if (!u) return ''
  for (const k of keys) {
    const v = u[k]
    if (typeof v === 'string' && v) return v
  }
  return ''
}

/** Read a numeric user field (createat / lastpasswordupdate …). */
function userNum(user: unknown, ...keys: string[]): number | undefined {
  const u = user as Record<string, unknown> | null | undefined
  if (!u) return undefined
  for (const k of keys) {
    const v = u[k]
    if (typeof v === 'number' && v) return v
  }
  return undefined
}

function formatDate(ms: number | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AccountView() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Page heading ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="p-2.5 rounded-xl bg-linear-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/25">
          <UserCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('account.title', 'Tài khoản của tôi')}</h1>
          <p className="text-sm text-muted-foreground">{t('account.subtitle', 'Quản lý hồ sơ cá nhân, ảnh đại diện và bảo mật tài khoản')}</p>
        </div>
      </motion.div>

      {/* ── Identity banner ── */}
      <ProfileBanner />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Profile form */}
        <div className="lg:col-span-3">
          <ProfileForm />
        </div>

        {/* Security + info */}
        <div className="lg:col-span-2 space-y-6">
          <SecurityCard />
          <AccountInfoCard />
        </div>
      </div>
    </div>
  )
}

// ─── Identity banner ───────────────────────────────────────────────

function ProfileBanner() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const authUser = useLMSStore((s) => s.authUser)
  const allRoles = authUser?.roles ? parseAllLMSRoles(authUser.roles) : []

  const fileRef = useRef<HTMLInputElement>(null)
  const [imgVersion, setImgVersion] = useState(0)
  const [imgFailed, setImgFailed] = useState(false)
  const [hasServerAvatar, setHasServerAvatar] = useState(false)
  const avatarUrl = authUser ? `/api/v4/users/${authUser.id}/image?_${imgVersion}` : ''

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      await client4.uploadProfileImage(authUser!.id, file)
    },
    onSuccess: () => {
      setImgFailed(false)
      setHasServerAvatar(true)
      setImgVersion(Date.now())
      toast({ title: t('account.avatarUpdated', 'Đã cập nhật ảnh đại diện') })
    },
    onError: (err) => {
      toast({
        title: t('account.avatarUpdateFailed', 'Không thể cập nhật ảnh'),
        description: toErrorMessage(err, t('account.tryAgain', 'Vui lòng thử lại')),
        variant: 'destructive',
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      await client4.setDefaultProfileImage(authUser!.id)
    },
    onSuccess: () => {
      setImgFailed(true)
      setHasServerAvatar(false)
      setImgVersion(Date.now())
      toast({ title: t('account.avatarRemoved', 'Đã xóa ảnh đại diện') })
    },
    onError: (err) => {
      toast({
        title: t('account.avatarUpdateFailed', 'Không thể cập nhật ảnh'),
        description: toErrorMessage(err, ''),
        variant: 'destructive',
      })
    },
  })

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: t('account.avatarNotImage', 'Vui lòng chọn tệp hình ảnh'), variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('account.avatarTooLarge', 'Ảnh tối đa 5MB'), variant: 'destructive' })
      return
    }
    uploadMutation.mutate(file)
    e.target.value = ''
  }

  const displayName = authUser ? (authUser.nickname || getUserDisplayName(authUser)) : ''
  const initials = getInitials(displayName || 'U')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 via-indigo-500 to-sky-500 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20"
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-200 blur-3xl" />
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Avatar with upload controls */}
        <div className="group relative shrink-0">
          <div className="h-24 w-24 rounded-full ring-4 ring-white/40 shadow-2xl overflow-hidden bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
            {!imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                onLoad={() => setHasServerAvatar(true)}
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
            title={t('account.uploadAvatar', 'Tải ảnh lên')}
            className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-white text-indigo-600 shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          >
            {uploadMutation.isPending ? (
              <span className="h-4 w-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold truncate">{displayName || '—'}</h2>
            {authUser?.position && (
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
                {authUser.position}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-indigo-50">
            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{authUser?.email}</span>
            <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />@{authUser?.username}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allRoles.map((role) => {
              const rc = ROLE_COLORS[role]
              return (
                <span
                  key={role}
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white/15 text-white backdrop-blur border border-white/20"
                >
                  {rc?.label ?? role}
                </span>
              )
            })}
          </div>
        </div>

        {/* Remove avatar */}
        {hasServerAvatar && !imgFailed && (
          <div className="sm:self-end">
            <Button
              size="sm"
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/15"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('account.removeAvatar', 'Xóa ảnh')}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Profile form ──────────────────────────────────────────────────

interface ProfileFormValues {
  firstName: string
  lastName: string
  nickname: string
  position: string
}

function ProfileForm() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const authUser = useLMSStore((s) => s.authUser)

  const form = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: userStr(authUser, 'first_name', 'firstname'),
      lastName: userStr(authUser, 'last_name', 'lastname'),
      nickname: authUser?.nickname ?? '',
      position: authUser?.position ?? '',
    },
  })

  // Re-sync defaults if the user refreshes (e.g. after avatar upload state sync).
  useEffect(() => {
    form.reset({
      firstName: userStr(authUser, 'first_name', 'firstname'),
      lastName: userStr(authUser, 'last_name', 'lastname'),
      nickname: authUser?.nickname ?? '',
      position: authUser?.position ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])

  const saveMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const patch = {
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        nickname: values.nickname.trim(),
        position: values.position.trim(),
      }
      return await client4.patchMe(patch as never)
    },
    onSuccess: (user) => {
      useLMSStore.setState({
        authUser: { ...authUser, ...(user as object) } as typeof authUser,
      })
      toast({ title: t('account.profileSaved', 'Đã lưu hồ sơ cá nhân') })
    },
    onError: (err) => {
      toast({
        title: t('account.profileSaveFailed', 'Không thể lưu hồ sơ'),
        description: toErrorMessage(err, t('account.tryAgain', 'Vui lòng thử lại')),
        variant: 'destructive',
      })
    },
  })

  const dirty = form.formState.isDirty

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-2xl border bg-card shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
          <User className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold">{t('account.profileSection', 'Thông tin cá nhân')}</h3>
          <p className="text-xs text-muted-foreground">{t('account.profileSectionHint', 'Tên hiển thị khi bạn trò chuyện và tương tác')}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('account.lastName', 'Họ')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Nguyễn" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('account.firstName', 'Tên')}</FormLabel>
                  <FormControl>
                    <Input placeholder="An" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.nickname', 'Biệt danh')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('account.nicknamePlaceholder', 'Tên muốn mọi người gọi')} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.position', 'Chức danh')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('account.positionPlaceholder', 'VD: Giáo viên tiếng Anh')} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Read-only identity fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">{t('account.usernameLabel', 'Tên đăng nhập')}</Label>
              <div className="flex items-center h-9 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                <span className="truncate">@{authUser?.username}</span>
                <Lock className="ml-auto h-3 w-3 shrink-0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">{t('common.email', 'Email')}</Label>
              <div className="flex items-center h-9 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                <span className="truncate">{authUser?.email}</span>
                <Lock className="ml-auto h-3 w-3 shrink-0" />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {t('account.readOnlyNote', 'Tên đăng nhập và email do quản trị viên quản lý. Liên hệ quản lý nếu cần thay đổi.')}
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saveMutation.isPending || !dirty} className="bg-linear-to-r from-indigo-600 to-sky-500 hover:from-indigo-700 hover:to-sky-600 text-white shadow-md shadow-indigo-500/20">
              {saveMutation.isPending ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('common.save', 'Lưu')}
            </Button>
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => form.reset()}>
                {t('common.reset', 'Hoàn tác')}
              </Button>
            )}
            {!dirty && saveMutation.isSuccess && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {t('account.saved', 'Đã lưu')}
              </span>
            )}
          </div>
        </form>
      </Form>
    </motion.div>
  )
}

// ─── Security card ─────────────────────────────────────────────────

function SecurityCard() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const authUser = useLMSStore((s) => s.authUser)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [generalError, setGeneralError] = useState('')

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const changeMutation = useMutation({
    mutationFn: async (values: ChangePasswordInput) => {
      await client4.updateUserPassword(authUser!.id, values.currentPassword, values.newPassword)
    },
    onSuccess: () => {
      form.reset()
      setGeneralError('')
      toast({ title: t('account.passwordChanged', 'Đã đổi mật khẩu thành công') })
    },
    onError: (err) => {
      setGeneralError(toErrorMessage(err, t('account.passwordChangeFailed', 'Đổi mật khẩu thất bại')))
    },
  })

  const newPassword = form.watch('newPassword')
  const strength = passwordStrength(newPassword)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border bg-card shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
          <KeyRound className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold">{t('account.securitySection', 'Bảo mật')}</h3>
          <p className="text-xs text-muted-foreground">{t('account.securitySectionHint', 'Đổi mật khẩu định kỳ để bảo vệ tài khoản')}</p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => { setGeneralError(''); changeMutation.mutate(v) })}
          className="space-y-4 p-5"
        >
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.currentPassword', 'Mật khẩu hiện tại')}</FormLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      className="pl-9 pr-9"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.newPassword', 'Mật khẩu mới')}</FormLabel>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input
                      type={showNew ? 'text' : 'password'}
                      className="pl-9 pr-9"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && <PasswordStrengthBar score={strength.score} label={strength.label} />}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.confirmPassword', 'Nhập lại mật khẩu mới')}</FormLabel>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      className="pl-9 pr-9"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {generalError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{generalError}</div>
          )}

          <Button type="submit" disabled={changeMutation.isPending} className="w-full bg-linear-to-r from-indigo-600 to-sky-500 hover:from-indigo-700 hover:to-sky-600 text-white shadow-md shadow-indigo-500/20">
            {changeMutation.isPending ? (
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {t('account.changePassword', 'Đổi mật khẩu')}
          </Button>

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('account.forgotHint', 'Quên mật khẩu hiện tại?')}</span>
            <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline-offset-4 hover:underline">
              {t('account.resetHere', 'Đặt lại tại đây')}
            </Link>
          </div>
        </form>
      </Form>
    </motion.div>
  )
}

// ─── Account info card ─────────────────────────────────────────────

function AccountInfoCard() {
  const { t } = useTranslation()
  const authUser = useLMSStore((s) => s.authUser)

  const rows: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[] = [
    { icon: User, label: t('account.usernameLabel', 'Tên đăng nhập'), value: `@${authUser?.username ?? '—'}` },
    { icon: Mail, label: t('common.email', 'Email'), value: authUser?.email ?? '—' },
    { icon: CalendarDays, label: t('account.createdAt', 'Ngày tạo'), value: formatDate(userNum(authUser, 'create_at', 'createat')) },
    { icon: ShieldCheck, label: t('account.lastPasswordChange', 'Đổi mật khẩu lần cuối'), value: formatDate(userNum(authUser, 'last_password_update', 'lastpasswordupdate')) },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border bg-card shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
          <Info className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold">{t('account.infoSection', 'Thông tin tài khoản')}</h3>
          <p className="text-xs text-muted-foreground">{t('account.infoSectionHint', 'Tổng quan tài khoản của bạn')}</p>
        </div>
      </div>
      <div className="divide-y">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-3">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="ml-auto text-sm font-medium truncate max-w-55">{value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Password strength meter ───────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['Rất yếu', 'Yếu', 'Trung bình', 'Tốt', 'Mạnh']
  return { score, label: labels[score] ?? '' }
}

function PasswordStrengthBar({ score, label }: { score: number; label: string }) {
  const colors = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500']
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex gap-1 flex-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-muted'}`} />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground w-16 text-right">{label}</span>
    </div>
  )
}
