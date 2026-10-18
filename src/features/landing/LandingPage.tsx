import {
  ArrowRight,
  AudioLines,
  BookA,
  BookOpenText,
  CheckCircle2,
  Drama,
  Headphones,
  MessageSquareText,
  Mic,
  PenLine,
  ShieldCheck,
  SpellCheck,
  Wand2,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';

const SKILLS = [
  { icon: MessageSquareText, title: 'AI Chat', text: '7 chế độ: bạn trò chuyện, gia sư, ngữ pháp, từ vựng, phỏng vấn, du lịch, công việc. Sửa lỗi, dịch, giải thích từ.' },
  { icon: Mic, title: 'Luyện nói realtime', text: 'Nói chuyện bằng giọng nói hai chiều với AI, có bản ghi và báo cáo sau buổi học.' },
  { icon: Drama, title: 'Nhập vai', text: '10 tình huống: nhà hàng, sân bay, khách sạn, phỏng vấn, họp nhóm, thuyết trình…' },
  { icon: BookA, title: 'Từ vựng', text: 'Flashcard, sổ từ cá nhân, ôn tập ngắt quãng (spaced repetition) và quiz.' },
  { icon: SpellCheck, title: 'Ngữ pháp', text: 'Giải thích song ngữ, ví dụ đúng/sai, trắc nghiệm, điền từ, sắp xếp câu, sửa lỗi.' },
  { icon: Headphones, title: 'Nghe', text: 'Hội thoại theo cấp độ, chỉnh tốc độ, bật/tắt transcript, nghe chính tả.' },
  { icon: BookOpenText, title: 'Đọc', text: 'Bài đọc theo CEFR, tra từ ngay trong bài, câu hỏi đọc hiểu, lưu từ mới.' },
  { icon: PenLine, title: 'Viết', text: 'Email, đoạn văn, bài luận: sửa lỗi, gợi ý từ vựng, so sánh bản gốc và bản sửa.' },
  { icon: AudioLines, title: 'Phát âm', text: 'Đọc câu mẫu và so sánh bản ghi nhận dạng giọng nói với câu gốc.' },
];

const STEPS = [
  { title: 'Tạo tài khoản & chọn mục tiêu', text: 'Chọn trình độ, mục tiêu và thời gian học mỗi ngày.' },
  { title: 'Làm bài kiểm tra đầu vào', text: '20 câu ngắn để ước lượng trình độ (không phải chứng chỉ chính thức).' },
  { title: 'Nhận kế hoạch học', text: 'Kế hoạch được tạo theo quy tắc từ câu trả lời của bạn.' },
  { title: 'Luyện tập mỗi ngày', text: 'Chat, nói, ôn từ và theo dõi tiến độ thật trên bảng điều khiển.' },
];

const FAQ = [
  {
    q: 'EnglishAI có miễn phí không?',
    a: 'Bạn có thể dùng miễn phí trong giới hạn lượt dùng hằng ngày. Các tính năng AI chạy trên gói miễn phí của nhà cung cấp; khi hết hạn mức trong ngày, hệ thống thông báo và không tự chuyển sang dịch vụ trả phí.',
  },
  {
    q: 'Luyện nói có phải là hội thoại giọng nói thật không?',
    a: 'Có. Khi máy chủ đã bật, bạn nói chuyện trực tiếp với một mô hình giọng nói-tới-giọng nói (Gemini Live) qua kết nối realtime. Nếu tính năng này không khả dụng, ứng dụng chuyển sang chế độ dự phòng dùng nhận dạng và đọc giọng nói của trình duyệt — và luôn ghi rõ đó không phải hội thoại realtime.',
  },
  {
    q: 'Ứng dụng có chấm điểm phát âm không?',
    a: 'Ứng dụng so sánh bản ghi do hệ thống nhận dạng giọng nói tạo ra với câu mẫu để chỉ ra từ bị thiếu hoặc nhận dạng sai. Đây không phải chấm điểm âm vị, trọng âm hay ngữ điệu chuyên sâu.',
  },
  {
    q: 'Kết quả kiểm tra trình độ có giá trị như chứng chỉ không?',
    a: 'Không. Kết quả chỉ là ước lượng để gợi ý bài học phù hợp, không phải chứng chỉ CEFR chính thức.',
  },
  {
    q: 'Giọng nói của tôi có bị lưu lại không?',
    a: 'Không. Ứng dụng không lưu file âm thanh. Chỉ bản ghi văn bản của phiên luyện nói được lưu để bạn xem lại và có thể xóa bất cứ lúc nào. Chi tiết trong Chính sách quyền riêng tư.',
  },
  {
    q: 'Tôi cần thiết bị gì?',
    a: 'Một trình duyệt hiện đại (Chrome, Edge, Safari, Firefox) trên máy tính hoặc điện thoại. Luyện nói cần micro và kết nối HTTPS.',
  },
];

function DemoChat() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquareText className="h-4 w-4 text-primary" aria-hidden /> English Tutor · B1
        </div>
        <Badge>Ví dụ minh họa</Badge>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-fg">
          Yesterday I go to the cinema with my friends.
        </div>
        <div className="ml-auto max-w-[85%] rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs">
          <p className="flex items-center gap-1 font-semibold text-warning">
            <Wand2 className="h-3.5 w-3.5" aria-hidden /> Gợi ý sửa
          </p>
          <p className="mt-1 text-fg-2">
            <span className="line-through">go</span> → <strong className="text-fg">went</strong>
          </p>
          <p className="mt-0.5 text-fg-2">“Yesterday” là quá khứ nên dùng quá khứ đơn: go → went.</p>
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-fg">
          That sounds fun! What movie did you watch, and did you enjoy it?
        </div>
      </div>
    </Card>
  );
}

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2">
        <div>
          <Badge tone="primary" className="mb-4">
            Học tiếng Anh cùng AI
          </Badge>
          <h1 className="text-4xl leading-tight font-bold tracking-tight text-fg sm:text-5xl">
            Nói tiếng Anh tự tin hơn, mỗi ngày một chút.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-fg-2">
            Trò chuyện với AI bằng tin nhắn hoặc giọng nói, được sửa lỗi ngay, học từ vựng, ngữ pháp, nghe, đọc, viết — và theo dõi tiến độ
            thật của chính bạn.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/register" size="lg">
              Bắt đầu miễn phí <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/login" size="lg" variant="outline">
              Tôi đã có tài khoản
            </ButtonLink>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {['Không cần thẻ thanh toán', 'Dùng trên máy tính & điện thoại', 'Không lưu file ghi âm'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
        <DemoChat />
      </section>

      {/* Skills */}
      <section id="skills" className="border-t border-border bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tất cả kỹ năng ở một nơi</h2>
          <p className="mt-2 max-w-2xl text-fg-2">Mỗi module lưu kết quả vào tài khoản của bạn để đề xuất bài học tiếp theo.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SKILLS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border bg-bg p-5">
                <div className="mb-3 inline-flex rounded-lg bg-primary-soft p-2 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-fg-2">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Quy trình học</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-surface p-5">
                <span className="tabular inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-fg-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Voice honesty */}
      <section id="voice" className="border-y border-border bg-surface py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Luyện nói: minh bạch về công nghệ</h2>
            <p className="mt-3 text-fg-2">
              Chúng tôi luôn cho bạn biết bạn đang dùng chế độ nào. Trạng thái “Đang nghe” chỉ hiện khi micro thực sự hoạt động, và không có
              âm thanh giả lập.
            </p>
          </div>
          <ol className="space-y-3">
            {[
              ['Realtime voice', 'Âm thanh hai chiều trực tiếp với mô hình giọng nói. Bạn có thể ngắt lời AI.'],
              ['Chế độ dự phòng', 'Nhận dạng giọng nói và đọc văn bản của trình duyệt + AI văn bản. Không phải realtime.'],
              ['Chế độ văn bản', 'Khi trình duyệt không hỗ trợ giọng nói, bạn vẫn có thể gõ để luyện hội thoại.'],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-3 rounded-xl border border-border bg-bg p-4">
                <span className="tabular mt-0.5 text-sm font-semibold text-primary">Cấp {i + 1}</span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-fg-2">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Câu hỏi thường gặp</h2>
          <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.q}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl bg-primary px-6 py-10 text-primary-fg sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="text-2xl font-semibold">Sẵn sàng cho buổi học đầu tiên?</h2>
            <p className="mt-1 opacity-90">Mất khoảng 3 phút để tạo tài khoản và nhận kế hoạch học.</p>
          </div>
          <ButtonLink to="/register" size="lg" variant="secondary" className="bg-white text-[#1d3c8a] hover:bg-white/90">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Tạo tài khoản
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
