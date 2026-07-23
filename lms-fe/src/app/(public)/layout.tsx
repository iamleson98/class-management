import PublicLayout from '@/components/public/public-layout'
import PublicQueryProvider from '@/components/public/public-query-provider'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Việt Mỹ Global — Trung Tâm Anh Ngữ',
    template: '%s | Việt Mỹ Global',
  },
  description: 'Trung tâm Anh ngữ Việt Mỹ Global — Đào tạo tiếng Anh chất lượng cao với phương pháp hiện đại, giáo viên bản ngữ và lộ trình cá nhân hóa cho mọi trình độ.',
  keywords: ['tiếng Anh', 'IELTS', 'TOEFL', 'học tiếng Anh', 'Anh ngữ', 'Việt Mỹ Global', 'VMG', 'trung tâm Anh ngữ'],
  openGraph: {
    title: 'Việt Mỹ Global — Trung Tâm Anh Ngữ',
    description: 'Đào tạo tiếng Anh chất lượng cao với phương pháp hiện đại',
    url: 'https://vmg.edu.vn',
    siteName: 'Việt Mỹ Global',
    locale: 'vi_VN',
    type: 'website',
  },
}

export default function PublicGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicQueryProvider>
      <PublicLayout>{children}</PublicLayout>
    </PublicQueryProvider>
  )
}
