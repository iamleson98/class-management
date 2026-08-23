import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClassSchema, updateClassSchema } from '@/lib/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClass, getBranches, getCourses, getUsers, updateClass } from '@/lib/api'
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
import { type CreateClassInput, type UpdateClassInput } from '@/lib/schemas'
import z from 'zod'
import { DatePicker } from '@/components/ui/date-picker'


type ClassFormValues = z.input<typeof createClassSchema>

const EMPTY_CLASS: ClassFormValues = {
    code: '', name: '', courseId: '', teacherId: '', room: '', status: 'OPEN', startDate: '', branchId: '',
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    OPEN: { label: 'Chờ mở', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    ACTIVE: { label: 'Đang học', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
    PAUSED: { label: 'Tạm dừng', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    COMPLETED: { label: 'Hoàn thành', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    CLOSED: { label: 'Đã đóng', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
}

export type ClassFormProps = {
    editingClass: boolean;
    onDone: () => void;
    editingClassId?: string;
}

export default function ClassForm({ editingClass, onDone, editingClassId }: ClassFormProps) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const { t } = useTranslation()

    const form = useForm<ClassFormValues>({
        resolver: zodResolver(createClassSchema),
        defaultValues: EMPTY_CLASS,
    })

    const onSubmit = (values: ClassFormValues) => {
        if (editingClass) {
            updateMutation.mutate({ id: editingClassId!, data: updateClassSchema.parse(values) })
        } else {
            createMutation.mutate(createClassSchema.parse(values))
        }
    }

    const { data: branches = [], isLoading: branchesLoading, isError: isBranchesError, refetch: refetchBranches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => getBranches(),
    })

    const createMutation = useMutation({
        mutationFn: (data: CreateClassInput) => createClass(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classes'] })
            toast({ title: t('classes.createSuccess', 'Thêm lớp thành công') })
            onDone()
        },
        onError: (err: unknown) => toast({ title: (err as Error)?.message || t('classes.createFail', 'Thêm lớp thất bại'), variant: 'destructive' }),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateClassInput }) => updateClass(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classes'] })
            toast({ title: t('classes.updateSuccess', 'Cập nhật lớp thành công') })
            onDone()
        },
        onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.updateFail', 'Cập nhật thất bại'), variant: 'destructive' }),
    })

    const { data: teachersData, isLoading: isLoadingTeachers, isError: isTeachersError } = useQuery({
        queryKey: ['users-teachers'],
        queryFn: () => getUsers({ role: 'lms_teacher', staffOnly: true }),
    })
    const teachers = teachersData?.items ?? []

    const { data: courses = [], isLoading: isLoadingCourses, isError: isCoursesError } = useQuery({
        queryKey: ['courses-select'],
        queryFn: () => getCourses(),
    })

    return (
        <Form {...form} schema={editingClass ? updateClassSchema : createClassSchema}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 items-start">
                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('classes.classCode', 'Mã lớp')}</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} placeholder="OPW1-A" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="room"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('classes.roomField', 'Phòng học')}</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} placeholder="P.101" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('classes.className', 'Tên lớp')}</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} placeholder="OPW1-A Sáng T3-T5" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4 items-start">
                    <FormField
                        control={form.control}
                        name="courseId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('classes.course', 'Khóa học')}</FormLabel>
                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                    <FormControl>
                                        {isLoadingCourses ? (
                                            <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                                        ) : (
                                            <SelectTrigger><SelectValue placeholder={t('classes.selectCourse', 'Chọn khóa học')} /></SelectTrigger>
                                        )}
                                    </FormControl>
                                    <SelectContent>
                                        {isCoursesError ? (
                                            <SelectItem value="__error" disabled>
                                                <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                                            </SelectItem>
                                        ) : (
                                            courses.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="teacherId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('classes.teacher', 'Giáo viên')}</FormLabel>
                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                    <FormControl>
                                        {isLoadingTeachers ? (
                                            <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                                        ) : (
                                            <SelectTrigger><SelectValue placeholder={t('classes.selectTeacher', 'Chọn giáo viên')} /></SelectTrigger>
                                        )}
                                    </FormControl>
                                    <SelectContent>
                                        {isTeachersError ? (
                                            <SelectItem value="__error" disabled>
                                                <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                                            </SelectItem>
                                        ) : (
                                            teachers.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>{t.username || t.email}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('common.status', 'Trạng thái')}</FormLabel>
                            <Select value={field.value || ''} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {Object.entries(STATUS_MAP).map(([key, val]) => (
                                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4 items-start">
                    <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('classes.startDate', 'Ngày bắt đầu')}</FormLabel>
                                <FormControl>
                                    <DatePicker
                                        value={field.value ?? ''}
                                        onChange={(v: string) => form.setValue('startDate', v, { shouldValidate: true })}
                                        invalid={!!form.formState.errors.startDate}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="branchId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('students.branch', 'Chi nhánh')}</FormLabel>
                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                    <FormControl>
                                        {branchesLoading ? (
                                            <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                                        ) : (
                                            <SelectTrigger><SelectValue placeholder={t('settings.addBranch', 'Chọn chi nhánh')} /></SelectTrigger>
                                        )}
                                    </FormControl>
                                    <SelectContent>
                                        {isBranchesError ? (
                                            <SelectItem value="__error" disabled>
                                                <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                                            </SelectItem>
                                        ) : (
                                            branches.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={onDone}>{t('common.cancel', 'Hủy')}</Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                        {createMutation.isPending || updateMutation.isPending ? t('common.saving', 'Đang lưu...') : editingClass ? t('common.update', 'Cập nhật') : t('classes.createClass', 'Tạo lớp')}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}
