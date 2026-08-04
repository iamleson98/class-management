'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Image, Play, X, CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { LoadingState } from '@/components/lms/loading-state'
import { ErrorState } from '@/components/lms/error-state'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLMSStore } from '@/store/lms-store'
import { format, parseISO } from 'date-fns'
import { getDashboard, getClassMedia } from '@/lib/api'
import { eq, and } from '@/lib/query'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

export default function ParentMedia() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()
  const [selectedMedia, setSelectedMedia] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'lms_parent', authUser?.id, 'media-child'],
    queryFn: () => getDashboard('lms_parent', authUser!.id),
    enabled: !!authUser?.id,
  })

  const child = (dashboardQuery.data?.child || dashboardQuery.data?.student || {}) as Record<string, any>
  const classId = child?.classId || child?.class?.id as string | undefined

  const mediaQuery = useQuery({
    queryKey: ['class-media', 'parent', classId],
    queryFn: () => getClassMedia({ where_ands: and(eq('class_media.class_id', classId)) }),
    enabled: !!classId,
  })

  if (dashboardQuery.isLoading || mediaQuery.isLoading) return <LoadingState />

  if (dashboardQuery.isError || mediaQuery.isError) {
    return <ErrorState onRetry={() => { dashboardQuery.refetch(); mediaQuery.refetch() }} />
  }

  const media = (mediaQuery.data || []) as Array<any>

  function openMediaDialog(item: any) {
    setSelectedMedia(item)
    setDialogOpen(true)
  }

  // Separate photos and videos
  const photos = media.filter((m: any) => m.fileType !== 'VIDEO')
  const videos = media.filter((m: any) => m.fileType === 'VIDEO')

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title={t('parent.media.title', 'Hình ảnh & Video')}
        description={t('parent.media.description', 'Hình ảnh và video buổi học của con')}
        icon={<Image className="h-5 w-5" />}
        accentColor="sky"
      />

      {media.length === 0 ? (
        <EmptyState
          icon={<Image className="h-10 w-10" />}
          title={t('parent.media.noMedia', 'Chưa có hình ảnh/video nào')}
          description={t('parent.media.noMediaDesc', 'Hình ảnh buổi học sẽ hiển thị ở đây khi giáo viên tải lên.')}
        />
      ) : (
        <div className="space-y-8">
          {/* Photos section */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{t('parent.media.photos', 'Hình ảnh')}</h2>
                <Badge variant="secondary" className="rounded-full text-xs">
                  {photos.length}
                </Badge>
              </div>
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              >
                {photos.map((item: any, idx: number) => (
                  <motion.div key={item.id || idx} variants={staggerItem}>
                    <Card
                      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => openMediaDialog(item)}
                    >
                      <div className="relative aspect-video bg-muted">
                        <img
                          src={item.fileUrl}
                          alt={item.title || t('parent.media.defaultPhotoAlt', 'Ảnh lớp học')}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-2.5">
                        {item.title && (
                          <p className="text-xs font-medium truncate">{item.title}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {item.createdAt ? format(parseISO(item.createdAt), 'dd/MM/yyyy') : ''}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* Videos section */}
          {videos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{t('parent.media.videos', 'Video')}</h2>
                <Badge variant="secondary" className="rounded-full text-xs">
                  {videos.length}
                </Badge>
              </div>
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {videos.map((item: any, idx: number) => (
                  <motion.div key={item.id || idx} variants={staggerItem}>
                    <Card
                      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => openMediaDialog(item)}
                    >
                      <div className="relative aspect-video bg-muted">
                        <video
                          src={item.fileUrl}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                          <div className="p-2.5 rounded-full bg-white/90 group-hover:scale-110 transition-transform">
                            <Play className="h-5 w-5 text-sky-600 fill-sky-600" />
                          </div>
                        </div>
                        <Badge className="absolute top-2 right-2 rounded-full text-[10px] bg-red-500 text-white hover:bg-red-500">
                          VIDEO
                        </Badge>
                      </div>
                      <div className="p-2.5">
                        {item.title && (
                          <p className="text-xs font-medium truncate">{item.title}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {item.createdAt ? format(parseISO(item.createdAt), 'dd/MM/yyyy') : ''}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* Full-size preview dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMedia?.title || (selectedMedia?.fileType === 'VIDEO' ? t('parent.media.video', 'Video') : t('parent.media.image', 'Hình ảnh'))}
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="w-full">
            {selectedMedia?.fileType === 'VIDEO' ? (
              selectedMedia?.fileUrl && (
                <video
                  src={selectedMedia.fileUrl}
                  controls
                  className="w-full rounded-lg"
                />
              )) :
              (
                selectedMedia?.fileUrl && (
                  <img
                    src={selectedMedia.fileUrl}
                    alt={selectedMedia.title || t('parent.media.preview', 'Xem trước')}
                    className="w-full rounded-lg"
                  />
                ))}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
