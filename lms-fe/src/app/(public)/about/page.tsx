'use client'
import { motion } from 'framer-motion'
import { Heart, Target, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n'

export default function AboutPage() {
  const { t } = useTranslation()

  const values = [
    { icon: Target, title: t('about.vision', 'Tầm nhìn'), desc: t('about.visionDesc', 'Trở thành trung tâm Anh ngữ hàng đầu Việt Nam, đào tạo thế hệ công dân toàn cầu tự tin và thành công.') },
    { icon: Heart, title: t('about.mission', 'Sứ mệnh'), desc: t('about.missionDesc', 'Cung cấp môi trường học tập chất lượng cao, truyền cảm hứng và đồng hành cùng học viên trên con route chinh phục tiếng Anh.') },
    { icon: Eye, title: t('about.values', 'Giá trị cốt lõi'), desc: t('about.valuesDesc', 'Chất lượng, Tận tâm, Đổi mới, Uy tín. Mọi hoạt động đều hướng tới kết quả tốt nhất cho học viên.') },
  ]

  const milestones = [
    { year: '2014', event: t('about.timeline.1', 'Thành lập VMG tại Quận 1, TP.HCM') },
    { year: '2016', event: t('about.timeline.2', 'Mở cơ sở thứ 2 tại Quận 7') },
    { year: '2018', event: t('about.timeline.3', 'Đạt chứng nhận Cambridge Preparation Center') },
    { year: '2020', event: t('about.timeline.4', 'Ra mắt nền tảng học trực tuyến VMG Online') },
    { year: '2023', event: t('about.timeline.5', 'Đón 5000+ học viên, 98% hài lòng') },
    { year: '2024', event: t('about.timeline.6', 'Mở rộng chương trình Du học & IELTS cấp tốc') },
  ]

  const team = [
    { name: 'Nguyễn Văn Admin', role: t('about.team.role1', 'Giám đốc'), desc: t('about.team.desc1', '20+ năm kinh nghiệm quản lý giáo dục') },
    { name: 'Mr. John Smith', role: t('about.team.role2', 'Giám đốc học thuật'), desc: t('about.team.desc2', 'TESOL, CELTA, 15 năm giảng dạy') },
    { name: 'Ms. Sarah Johnson', role: t('about.team.role3', 'Giáo viên IELTS'), desc: t('about.team.desc3', 'IELTS 9.0, 10 năm kinh nghiệm') },
    { name: 'Ms. Emily Davis', role: t('about.team.role4', 'Giáo viên TOEIC'), desc: t('about.team.desc4', 'Chuyên gia TOEIC, SAT') },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-linear-to-br from-sky-600 to-teal-700 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-extrabold mb-4">{t('about.title', 'Giới thiệu Việt Mỹ Global')}</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-sky-100 text-lg max-w-2xl mx-auto">{t('about.subtitle', 'Hơn 10 năm đồng hành cùng hàng ngàn học viên trên con route chinh phục tiếng Anh')}</motion.p>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {values.map((v, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <Card className="rounded-2xl border h-full">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center mx-auto mb-4">
                    <v.icon className="h-7 w-7 text-sky-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-extrabold text-center mb-12">{t('about.timelineTitle', 'Lịch sử phát triển')}</h2>
          <div className="space-y-6">
            {milestones.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex gap-4 items-start">
                <div className="w-16 shrink-0 text-right">
                  <span className="text-sm font-bold text-sky-600">{m.year}</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                <div className="text-sm text-muted-foreground">{m.event}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-extrabold text-center mb-12">{t('about.teamTitle', 'Đội ngũ')}</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {team.map((tItem, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <Card className="rounded-2xl border text-center">
                <CardContent className="p-6">
                  <div className="w-20 h-20 rounded-full bg-linear-to-br from-sky-400 to-teal-500 flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                    {tItem.name.split(' ').slice(-1)[0][0]}{tItem.name.split(' ').slice(-2)[0][0]}
                  </div>
                  <h3 className="font-bold">{tItem.name}</h3>
                  <div className="text-xs text-sky-600 font-medium mb-1">{tItem.role}</div>
                  <p className="text-xs text-muted-foreground">{tItem.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
