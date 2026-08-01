import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Việt Mỹ Global — Trung Tâm Anh Ngữ',
    template: '%s | Việt Mỹ Global',
  },
  description: 'Trung tâm Anh ngữ Việt Mỹ Global — Đào tạo tiếng Anh chất lượng cao với phương pháp hiện đại, giáo viên bản ngữ và lộ trình cá nhân hóa cho mọi trình độ.',
  keywords: ['tiếng Anh', 'IELTS', 'TOEFL', 'học tiếng Anh', 'Anh ngữ', 'Việt Mỹ Global', 'VMG', 'trung tâm Anh ngữ'],
  icons: {
    icon: [
      { url: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'Việt Mỹ Global — Trung Tâm Anh Ngữ',
    description: 'Đào tạo tiếng Anh chất lượng cao với phương pháp hiện đại',
    url: 'https://vmg.edu.vn',
    siteName: 'Việt Mỹ Global',
    locale: 'vi_VN',
    type: 'website',
    images: [
      {
        url: '/logo.svg',
        width: 1200,
        height: 630,
        alt: 'Việt Mỹ Global Logo',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}