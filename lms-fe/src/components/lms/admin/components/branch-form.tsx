import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateBranchInput, createBranchSchema } from '@/lib/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBranch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import {
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'


export type BranchFormProps = {
    onDone: () => void;
}

export default function BranchForm({ onDone }: BranchFormProps) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const { t } = useTranslation()

    const branchForm = useForm<CreateBranchInput>({
        resolver: zodResolver(createBranchSchema),
        defaultValues: { name: '', address: '', phone: '' },
    })

    const branchMutation = useMutation({
        mutationFn: (data: CreateBranchInput) => createBranch(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] })
            toast({ title: t('settings.addBranchSuccess', 'Thêm chi nhánh thành công') })
            onDone()
            branchForm.reset({ name: '', address: '', phone: '' })
        },
        onError: (err: unknown) => toast({ title: (err as Error)?.message || t('settings.addBranchFailed', 'Thêm chi nhánh thất bại'), variant: 'destructive' }),
    })

    return (
        <Form {...branchForm} schema={createBranchSchema}>
            <form onSubmit={branchForm.handleSubmit((data) => branchMutation.mutate(data))} className="space-y-4">
                <FormField
                    control={branchForm.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('settings.branchName', 'Tên chi nhánh')}</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} placeholder="Trung tâm ABC" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={branchForm.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('settings.address', 'Địa chỉ')}</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} placeholder="123 Đường XYZ, Quận Z" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={branchForm.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('common.phone', 'Số điện thoại')}</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} placeholder="028-xxxx" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={onDone}>{t('common.cancel', 'Hủy')}</Button>
                    <Button type="submit" disabled={branchMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                        {branchMutation.isPending ? t('common.loading', 'Đang lưu...') : t('common.create', 'Thêm')}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}
