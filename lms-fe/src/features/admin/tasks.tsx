'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ListTodo, Plus } from 'lucide-react'
import { createTaskSchema, updateTaskSchema, type CreateTaskInput, type UpdateTaskInput } from '@/lib/schemas'
import { getTasks, createTask, updateTask } from '@/lib/api'
import { useLMSStore } from '@/store/lms-store'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'

const COLUMNS = [
  { key: 'TODO', label: 'TODO', headerClass: 'border-t-blue-400', dotClass: 'bg-blue-400' },
  { key: 'IN_PROGRESS', label: 'Đang làm', headerClass: 'border-t-amber-400', dotClass: 'bg-amber-400' },
  { key: 'REVIEW', label: 'Chờ duyệt', headerClass: 'border-t-violet-400', dotClass: 'bg-violet-400' },
  { key: 'DONE', label: 'Hoàn thành', headerClass: 'border-t-sky-400', dotClass: 'bg-sky-400' },
]

const PRIORITY_MAP: Record<string, { label: string; className: string }> = {
  HIGH: { label: 'Cao', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  MEDIUM: { label: 'Trung bình', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  LOW: { label: 'Thấp', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

export default function AdminTasks() {
  const { toast } = useToast()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()

  type TaskFormValues = z.input<typeof updateTaskSchema>
  type TaskStatus = NonNullable<UpdateTaskInput['status']>
  const EMPTY_TASK_FORM: TaskFormValues = {
    title: '', description: '', assigneeId: '', deadline: '', priority: 'MEDIUM', status: 'TODO', notes: '',
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: EMPTY_TASK_FORM,
  })

  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskInput) => createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast({ title: t('tasks.addSuccess', 'Thêm công việc thành công') })
      closeDialog()
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('tasks.addFailed', 'Thêm công việc thất bại'), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast({ title: t('tasks.updateSuccess', 'Cập nhật công việc thành công') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('tasks.updateFailed', 'Cập nhật thất bại'), variant: 'destructive' }),
  })

  const tasksByColumn = useMemo(() => {
    const map: Record<string, any[]> = { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] }
    ;(tasks || []).forEach((task: any) => {
      const col = task.status || 'TODO'
      if (!map[col]) map[col] = []
      map[col].push(task)
    })
    return map
  }, [tasks])

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingTask(null)
    form.reset(EMPTY_TASK_FORM)
  }

  const openCreate = () => {
    setEditingTask(null)
    form.reset(EMPTY_TASK_FORM)
    setDialogOpen(true)
  }

  const openEdit = (task: any) => {
    setEditingTask(task)
    form.reset({
      title: task.title || '',
      description: task.description || '',
      assigneeId: task.assigneeId || '',
      deadline: task.deadline?.split('T')[0] || '',
      priority: task.priority || 'MEDIUM',
      status: task.status || 'TODO',
      notes: task.notes || '',
    })
    setDialogOpen(true)
  }

  const onSubmit = (values: TaskFormValues) => {
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: updateTaskSchema.parse(values) })
      closeDialog()
    } else {
      createMutation.mutate(createTaskSchema.parse({ ...values, creatorId: authUser?.id || '' }))
    }
  }

  const handleMoveTask = (task: any, newStatus: TaskStatus) => {
    updateMutation.mutate({ id: task.id, data: { status: newStatus } })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('tasks.title', 'Quản lý công việc')}
        description={t('tasks.description', 'Theo dõi tiến độ công việc')}
        icon={ListTodo}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('tasks.addTask', 'Thêm công việc')}
          </Button>
        }
      />

      {/* Kanban Board */}
      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={t('tasks.noTasks', 'Chưa có công việc')}
          description={t('tasks.noTasksDesc', 'Tạo công việc đầu tiên để bắt đầu.')}
          actionLabel={t('tasks.addTask', 'Thêm công việc')}
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <Card key={col.key} className="rounded-xl border-t-4 border-t-transparent">
              <div className={cn('border-t-4 rounded-t-xl', col.headerClass)} />
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2.5 w-2.5 rounded-full', col.dotClass)} />
                  <CardTitle className="text-sm font-semibold">{col.label}</CardTitle>
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {tasksByColumn[col.key]?.length || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <ScrollArea className="h-100">
                  <div className="space-y-2">
                    {(tasksByColumn[col.key] || []).map((task: any) => {
                      const priority = PRIORITY_MAP[task.priority] || PRIORITY_MAP.MEDIUM
                      return (
                        <motion.div
                          key={task.id}
                          variants={staggerItem}
                          initial="initial"
                          animate="animate"
                          className="p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => openEdit(task)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                            <Badge className={cn('rounded-full text-[10px] shrink-0', priority.className)}>
                              {priority.label}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            {(task.deadline || task.dueDate) && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(task.deadline || task.dueDate).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                            {task.assignee?.name && (
                              <span className="text-[10px] text-muted-foreground">{task.assignee.name}</span>
                            )}
                          </div>
                          {/* Move buttons */}
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                              <Button
                                key={c.key}
                                variant="outline"
                                size="sm"
                                className="h-6 text-[9px] px-1.5 rounded"
                                onClick={(e) => { e.stopPropagation(); handleMoveTask(task, c.key as TaskStatus) }}
                              >
                                {c.label}
                              </Button>
                            ))}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? t('tasks.editTask', 'Chỉnh sửa công việc') : t('tasks.addTaskTitle', 'Thêm công việc mới')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...form} schema={editingTask ? updateTaskSchema : createTaskSchema}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tasks.title', 'Tiêu đề')}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('tasks.titlePlaceholder', 'Tiêu đề công việc')} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tasks.description', 'Mô tả')}</FormLabel>
                    <FormControl><Textarea {...field} value={field.value ?? ''} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.assignee', 'Người thực hiện (ID)')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('tasks.userIdPlaceholder', 'ID người dùng')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.deadline', 'Hạn hoàn thành')}</FormLabel>
                      <DatePicker value={field.value || ''} onChange={(v) => field.onChange(v)} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.priority', 'Mức ưu tiên')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(PRIORITY_MAP).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.status', 'Trạng thái')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {COLUMNS.map((col) => (
                            <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={closeDialog}>{t('common.cancel', 'Hủy')}</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {createMutation.isPending || updateMutation.isPending ? t('common.loading', 'Đang lưu...') : editingTask ? t('common.update', 'Cập nhật') : t('common.create', 'Thêm mới')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
