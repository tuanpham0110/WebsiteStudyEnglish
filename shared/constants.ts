// Values shared by the frontend and the API. The API validates every request
// against these lists, so clients cannot pick arbitrary modes, models or voices.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_INFO: Record<Level, { name: string; vi: string }> = {
  A1: { name: 'Beginner', vi: 'Mới bắt đầu' },
  A2: { name: 'Elementary', vi: 'Sơ cấp' },
  B1: { name: 'Intermediate', vi: 'Trung cấp' },
  B2: { name: 'Upper-intermediate', vi: 'Trung cao cấp' },
  C1: { name: 'Advanced', vi: 'Cao cấp' },
  C2: { name: 'Proficient', vi: 'Thành thạo' },
};

export const CHAT_MODES = [
  'conversation_partner',
  'english_tutor',
  'grammar_coach',
  'vocabulary_coach',
  'interview_practice',
  'travel_english',
  'business_english',
] as const;
export type ChatMode = (typeof CHAT_MODES)[number];
export type ConversationMode = ChatMode | 'roleplay';

export const CHAT_MODE_INFO: Record<ChatMode, { label: string; vi: string; description: string }> = {
  conversation_partner: {
    label: 'Conversation Partner',
    vi: 'Bạn trò chuyện',
    description: 'Trò chuyện tự nhiên về bất kỳ chủ đề nào.',
  },
  english_tutor: {
    label: 'English Tutor',
    vi: 'Gia sư tiếng Anh',
    description: 'Giải thích, ví dụ và bài tập nhỏ theo trình độ.',
  },
  grammar_coach: {
    label: 'Grammar Coach',
    vi: 'Huấn luyện ngữ pháp',
    description: 'Tập trung vào cấu trúc câu và lỗi ngữ pháp.',
  },
  vocabulary_coach: {
    label: 'Vocabulary Coach',
    vi: 'Huấn luyện từ vựng',
    description: 'Mở rộng vốn từ, collocation và cách dùng từ.',
  },
  interview_practice: {
    label: 'Interview Practice',
    vi: 'Luyện phỏng vấn',
    description: 'Mô phỏng phỏng vấn xin việc và nhận xét câu trả lời.',
  },
  travel_english: {
    label: 'Travel English',
    vi: 'Tiếng Anh du lịch',
    description: 'Sân bay, khách sạn, hỏi đường, gọi món.',
  },
  business_english: {
    label: 'Business English',
    vi: 'Tiếng Anh công việc',
    description: 'Email, họp, thuyết trình, đàm phán.',
  },
};

export const GOALS = ['communication', 'work', 'travel', 'exam', 'study', 'interview', 'daily_life'] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_INFO: Record<Goal, string> = {
  communication: 'Giao tiếp tự tin',
  work: 'Công việc',
  travel: 'Du lịch',
  exam: 'Thi chứng chỉ',
  study: 'Học tập, du học',
  interview: 'Phỏng vấn xin việc',
  daily_life: 'Đời sống hằng ngày',
};

export const SKILLS = ['speaking', 'listening', 'reading', 'writing', 'vocabulary', 'grammar', 'pronunciation'] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_INFO: Record<Skill, string> = {
  speaking: 'Nói',
  listening: 'Nghe',
  reading: 'Đọc',
  writing: 'Viết',
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  pronunciation: 'Phát âm',
};

export const EXPLANATION_LANGUAGES = ['vi', 'en'] as const;
export type ExplanationLanguage = (typeof EXPLANATION_LANGUAGES)[number];

export const DAILY_MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;

/**
 * Prebuilt voices offered for realtime speaking. Gemini's Live API docs state
 * native-audio models accept the TTS voice names; this is a curated subset.
 */
export const LIVE_VOICES = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Leda', 'Orus', 'Zephyr'] as const;
export type LiveVoice = (typeof LIVE_VOICES)[number];

export const SPEAKING_TOPICS = [
  'Daily life',
  'Hobbies',
  'Family and friends',
  'Food',
  'Travel',
  'Work',
  'Study',
  'Technology',
  'Health',
  'Movies and music',
  'Environment',
  'Free talk',
] as const;

export const ACTIVITIES = [
  'chat',
  'speaking',
  'roleplay',
  'vocabulary',
  'grammar',
  'listening',
  'reading',
  'writing',
  'pronunciation',
  'placement',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const ACTIVITY_LABEL: Record<Activity, string> = {
  chat: 'AI Chat',
  speaking: 'Luyện nói',
  roleplay: 'Nhập vai',
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  listening: 'Nghe',
  reading: 'Đọc',
  writing: 'Viết',
  pronunciation: 'Phát âm',
  placement: 'Kiểm tra đầu vào',
};

export const ASSIST_TASKS = ['translate', 'explain_vocab', 'rewrite', 'grammar_check'] as const;
export type AssistTask = (typeof ASSIST_TASKS)[number];

export const WRITING_TYPES = ['email', 'paragraph', 'essay'] as const;
export type WritingType = (typeof WRITING_TYPES)[number];

/** Error codes returned by the API (`{ error: { code, message } }`). */
export const API_ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'FEATURE_DISABLED',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'GLOBAL_LIMIT',
  'SESSION_ACTIVE',
  'PROVIDER_QUOTA',
  'PROVIDER_ERROR',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
