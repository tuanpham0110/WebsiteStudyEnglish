import { LessonList } from '@/features/lessons/LessonList';

export default function ListeningPage() {
  return (
    <LessonList
      kind="listening"
      title="Luyện nghe"
      description="Hội thoại và bài nói theo cấp độ, có câu hỏi và nghe chính tả. Âm thanh được tạo trên thiết bị của bạn bằng giọng đọc của trình duyệt từ kịch bản gốc."
      basePath="/app/listening"
    />
  );
}
