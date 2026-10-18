import { LessonList } from '@/features/lessons/LessonList';

export default function ReadingPage() {
  return (
    <LessonList
      kind="reading"
      title="Đọc hiểu"
      description="Đoạn văn theo cấp độ CEFR. Nhấn vào bất kỳ từ nào để tra nghĩa và lưu vào sổ từ."
      basePath="/app/reading"
    />
  );
}
