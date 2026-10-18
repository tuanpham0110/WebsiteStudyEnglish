import { LessonList } from '@/features/lessons/LessonList';

export default function GrammarPage() {
  return (
    <LessonList
      kind="grammar"
      title="Ngữ pháp"
      description="Bài học theo cấp độ với giải thích tiếng Việt và tiếng Anh, ví dụ đúng/sai và bài tập có giải thích đáp án."
      basePath="/app/grammar"
    />
  );
}
