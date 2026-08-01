'use client'

/**
 * Edit history modal — ports the vendored post_edit_history.tsx. Shows all
 * prior versions of a post (getPostEditHistory) with timestamps, oldest→newest.
 */

import { format } from 'date-fns'
import { History, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { usePostEditHistory, useUsers } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { displayUsername } from '@/lib/chat/utils'
import { useTranslation } from '@/lib/i18n'

interface EditHistoryModalProps {
  postId: string
  onClose: () => void
}

export function EditHistoryModal({ postId, onClose }: EditHistoryModalProps) {
  const { t } = useTranslation()
  const historyQuery = usePostEditHistory(postId)
  const users = useChatStore((s) => s.users)
  const authorIds = (historyQuery.data ?? []).map((p) => p.user_id)
  useUsers(authorIds)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-xl border bg-background shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 flex items-center gap-2 px-4 border-b shrink-0">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t('chat.editHistory', 'Lịch sử chỉnh sửa')}</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {historyQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
            ) : (historyQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('chat.noHistory', 'Không có lịch sử chỉnh sửa')}</p>
            ) : (
              (historyQuery.data ?? []).map((post, i, arr) => (
                <div key={post.id + i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold">{displayUsername(users[post.user_id])}</span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {i === arr.length - 1 ? t('chat.original', 'Gốc') : ''} {format(new Date(post.update_at || post.create_at), 'dd/MM/yyyy HH:mm:ss')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap wrap-break-word">{post.message}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
