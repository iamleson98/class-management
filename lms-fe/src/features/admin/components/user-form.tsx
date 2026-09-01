import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createUserSchema, type CreateUserInput } from '@/lib/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createUser } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'


// Staff roles a super admin / admin can assign to an employee. Keys match the
// canonical lowercase role IDs stored in the user's `roles` string.
const ROLE_LABELS: Record<string, string> = {
    lms_super_admin: 'Super Admin',
    lms_admin: 'Quản lý',
    lms_counselor: 'Tư vấn viên',
    lms_teacher: 'Giáo viên',
    lms_accountant: 'Kế toán',
    lms_marketing: 'Marketing',
}

export type UserFormProps = {
    onDone: (id?: string) => void;
}

export default function UserForm({ onDone }: UserFormProps) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const { t } = useTranslation()

    const userForm = useForm<CreateUserInput>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { firstname: '', lastname: '', email: '', phone: '', roles: 'lms_teacher', password: '' },
    })

    const userMutation = useMutation({
        mutationFn: (data: CreateUserInput) => createUser(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast({ title: t('settings.addUserSuccess', 'Thêm người dùng thành công') })
            userForm.reset({ firstname: '', lastname: '', email: '', phone: '', roles: 'lms_teacher', password: '' })
            onDone(data.id)
        },
        onError: (err: unknown) => toast({ title: (err as Error)?.message || t('settings.addUserFailed', 'Thêm người dùng thất bại'), variant: 'destructive' }),
    })

    return (
        <Form {...userForm} schema={createUserSchema}>
            <form onSubmit={userForm.handleSubmit((data) => userMutation.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 items-start">
                    <FormField
                        control={userForm.control}
                        name="firstname"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('settings.firstName', 'Tên')}</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} placeholder="Nga" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={userForm.control}
                        name="lastname"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('settings.lastName', 'Họ')}</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} placeholder="Nguyen" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={userForm.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('common.email', 'Email')}</FormLabel>
                            <FormControl><Input type="email" {...field} value={field.value ?? ''} placeholder="email@example.com" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={userForm.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('common.username', 'Tên đăng nhập')}</FormLabel>
                            <FormControl><Input type="text" {...field} value={field.value ?? ''} placeholder="username1" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4 items-start">
                    <FormField
                        control={userForm.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('common.phone', 'Số điện thoại')}</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} placeholder="0901xxx" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={userForm.control}
                        name="roles"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('settings.role', 'Vai trò')}</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={userForm.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('settings.password', 'Mật khẩu')}</FormLabel>
                            <FormControl><Input type="password" {...field} value={field.value ?? ''} placeholder={t('settings.defaultPassword', 'Mật khẩu mặc định')} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => onDone()}>{t('common.cancel', 'Hủy')}</Button>
                    <Button type="submit" disabled={userMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                        {userMutation.isPending ? t('common.loading', 'Đang lưu...') : t('common.create', 'Thêm')}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}
