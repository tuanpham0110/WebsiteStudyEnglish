import { LEVELS, type Goal, type Level, type Skill } from '@shared/constants';

// Rule-based recommendation logic (not a machine-learning model). Every
// suggestion is derived from fixed rules over the learner's real data.

export type PlanItem = { skill: Skill | 'chat' | 'roleplay'; title: string; minutes: number; to: string; reason: string };

/** Estimate a CEFR band from placement answers: the highest level where ≥60% were correct, with no gaps below. */
export function estimateLevel(results: { level: Level; correct: boolean }[]): { level: Level; score: number } {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  let estimated: Level = 'A1';
  for (const level of LEVELS) {
    const items = results.filter((r) => r.level === level);
    if (items.length === 0) continue;
    const ratio = items.filter((r) => r.correct).length / items.length;
    if (ratio >= 0.6) estimated = level;
    else break;
  }
  return { level: estimated, score: total ? Math.round((correct / total) * 100) : 0 };
}

const SKILL_ROUTE: Record<Skill, { to: string; title: string }> = {
  speaking: { to: '/app/speaking', title: 'Luyện nói với AI' },
  listening: { to: '/app/listening', title: 'Bài nghe' },
  reading: { to: '/app/reading', title: 'Bài đọc' },
  writing: { to: '/app/writing', title: 'Luyện viết' },
  vocabulary: { to: '/app/vocabulary', title: 'Từ vựng & ôn tập' },
  grammar: { to: '/app/grammar', title: 'Bài ngữ pháp' },
  pronunciation: { to: '/app/pronunciation', title: 'Luyện phát âm' },
};

/** Build a daily plan from onboarding answers. */
export function buildPlan(input: { level: Level; goals: Goal[]; dailyMinutes: number; focusSkills: Skill[] }): PlanItem[] {
  const skills: Skill[] = input.focusSkills.length ? [...input.focusSkills] : ['vocabulary', 'speaking', 'grammar'];
  if (input.goals.includes('communication') || input.goals.includes('travel') || input.goals.includes('interview')) {
    if (!skills.includes('speaking')) skills.unshift('speaking');
  }
  if (!skills.includes('vocabulary')) skills.push('vocabulary');
  if ((input.level === 'A1' || input.level === 'A2') && !skills.includes('grammar')) skills.push('grammar');

  const picked = skills.slice(0, input.dailyMinutes <= 10 ? 2 : input.dailyMinutes <= 20 ? 3 : 4);
  const per = Math.max(5, Math.round(input.dailyMinutes / picked.length));
  const items: PlanItem[] = picked.map((skill) => ({
    skill,
    title: SKILL_ROUTE[skill].title,
    minutes: per,
    to: SKILL_ROUTE[skill].to,
    reason: input.focusSkills.includes(skill) ? 'Kỹ năng bạn muốn cải thiện' : 'Bổ trợ cho mục tiêu của bạn',
  }));
  if (input.goals.includes('interview')) {
    items.push({ skill: 'roleplay', title: 'Nhập vai: phỏng vấn xin việc', minutes: 10, to: '/app/roleplay', reason: 'Mục tiêu phỏng vấn' });
  } else if (input.goals.includes('travel')) {
    items.push({ skill: 'roleplay', title: 'Nhập vai: tình huống du lịch', minutes: 10, to: '/app/roleplay', reason: 'Mục tiêu du lịch' });
  }
  return items;
}

export type DashboardStats = {
  timezone: string;
  streak_days: number;
  total_seconds: number;
  today_seconds: number;
  week_seconds: number;
  words_total: number;
  words_mastered: number;
  words_due: number;
  exercises_total: number;
  exercises_correct: number;
  speaking_sessions: number;
  speaking_seconds: number;
  conversations: number;
  lessons_completed: number;
  daily: { day: string; seconds: number }[];
  by_activity: Record<string, number>;
  skill_accuracy: Record<string, { total: number; correct: number }>;
  recent: { activity: string; ref_id: string | null; duration_seconds: number; score: number | null; completed: boolean; occurred_at: string }[];
};

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export type Suggestion = { title: string; description: string; to: string; priority: number };

/** Suggestions for the dashboard, ordered by priority. */
export function suggestNext(stats: DashboardStats, ctx: { dailyMinutes: number; focusSkills: Skill[] }): Suggestion[] {
  const out: Suggestion[] = [];
  if (stats.words_due > 0) {
    out.push({ title: `Ôn ${stats.words_due} từ đến hạn`, description: 'Ôn đúng lúc giúp nhớ lâu hơn (spaced repetition).', to: '/app/vocabulary?tab=review', priority: 1 });
  }
  if (stats.words_total < 10) {
    out.push({ title: 'Thêm từ mới vào sổ từ', description: 'Bạn mới theo dõi ít từ. Hãy chọn vài từ theo chủ đề yêu thích.', to: '/app/vocabulary', priority: 3 });
  }
  const lastSpeaking = stats.recent.find((r) => r.activity === 'speaking' || r.activity === 'roleplay');
  if (!lastSpeaking || Date.now() - Date.parse(lastSpeaking.occurred_at) > 3 * 86_400_000) {
    out.push({ title: 'Luyện nói 5 phút', description: 'Đã vài ngày bạn chưa luyện nói. Một phiên ngắn là đủ.', to: '/app/speaking', priority: 2 });
  }
  const weakest = Object.entries(stats.skill_accuracy)
    .filter(([, v]) => v.total >= 5)
    .map(([skill, v]) => ({ skill, ratio: v.correct / v.total }))
    .sort((a, b) => a.ratio - b.ratio)[0];
  if (weakest && weakest.ratio < 0.7) {
    const route = SKILL_ROUTE[weakest.skill as Skill];
    if (route) out.push({ title: `Củng cố: ${lowerFirst(route.title)}`, description: `Độ chính xác 30 ngày qua: ${Math.round(weakest.ratio * 100)}%.`, to: route.to, priority: 2 });
  }
  const todayMinutes = stats.today_seconds / 60;
  if (todayMinutes < ctx.dailyMinutes) {
    const skill = ctx.focusSkills.find((s) => !(stats.by_activity[s] > 0)) ?? ctx.focusSkills[0];
    if (skill) {
      out.push({
        title: `Hoàn thành mục tiêu hôm nay (${Math.ceil(ctx.dailyMinutes - todayMinutes)} phút nữa)`,
        description: `Gợi ý: ${lowerFirst(SKILL_ROUTE[skill].title)}.`,
        to: SKILL_ROUTE[skill].to,
        priority: 2,
      });
    }
  }
  if (stats.conversations === 0) {
    out.push({ title: 'Trò chuyện đầu tiên với AI', description: 'Chọn chế độ và chủ đề, AI sẽ sửa lỗi cho bạn.', to: '/app/chat', priority: 3 });
  }
  return out.sort((a, b) => a.priority - b.priority).slice(0, 4);
}
