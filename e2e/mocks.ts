import type { Page, Route } from '@playwright/test';

export const USER_ID = '11111111-1111-4111-8111-111111111111';

const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const fakeJwt = (exp: number) => `${b64url({ alg: 'ES256', typ: 'JWT' })}.${b64url({ sub: USER_ID, role: 'authenticated', exp, email: 'linh@example.com' })}.c2ln`;

/** Store a non-expired session where supabase-js looks for it (sb-<ref>-auth-token). */
export async function signIn(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: fakeJwt(exp),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'e2e-refresh',
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'linh@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { display_name: 'Linh' },
      created_at: '2026-10-01T00:00:00Z',
    },
  };
  await page.addInitScript((value) => {
    localStorage.setItem('sb-e2e-auth-token', value);
  }, JSON.stringify(session));
}

const today = new Date();
const day = (offset: number) => new Date(today.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

export const fixtures = {
  profile: { id: USER_ID, display_name: 'Linh', level: 'B1', role: 'admin', onboarded_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
  settings: { theme: 'system', auto_correct: true, show_translation: false, tts_voice: null, tts_rate: 1, speaking_voice: 'Kore', timezone: 'Asia/Ho_Chi_Minh' },
  preferences: { goals: ['communication', 'work'], daily_minutes: 20, explanation_language: 'vi', focus_skills: ['speaking', 'vocabulary'], placement_level: 'B1', placement_score: 64 },
  stats: {
    timezone: 'Asia/Ho_Chi_Minh',
    streak_days: 3,
    total_seconds: 7260,
    today_seconds: 540,
    week_seconds: 3900,
    words_total: 24,
    words_mastered: 5,
    words_due: 4,
    exercises_total: 40,
    exercises_correct: 31,
    speaking_sessions: 2,
    speaking_seconds: 840,
    conversations: 3,
    lessons_completed: 4,
    daily: Array.from({ length: 14 }, (_, i) => ({ day: day(13 - i), seconds: [0, 300, 900, 0, 1200, 600, 0, 1500, 900, 300, 0, 1800, 1200, 540][i] })),
    by_activity: { chat: 1800, speaking: 840, grammar: 1500, vocabulary: 1200 },
    skill_accuracy: { grammar: { total: 20, correct: 15 }, vocabulary: { total: 20, correct: 16 } },
    recent: [{ activity: 'grammar', ref_id: 'present-perfect', duration_seconds: 300, score: 80, completed: true, occurred_at: today.toISOString() }],
  },
  config: {
    features: { aiText: true, aiVoice: false, textModel: 'gemini-3.5-flash-lite', liveModel: null },
    limits: { chatPerDay: 60, assistPerDay: 40, evalPerDay: 15, aiPerMinute: 8, voiceSecondsPerDay: 900, voiceSessionSeconds: 300 },
    usage: { chat: 3, assist: 1, evaluation: 0, stt: 0, voice_sessions: 0, voice_seconds: 0, resets_at: new Date(Date.now() + 3600_000).toISOString() },
  },
  lessons: [
    {
      id: 'present-perfect',
      kind: 'grammar',
      level: 'B1',
      topic: 'tenses',
      title: 'Present perfect',
      title_vi: 'Thì hiện tại hoàn thành',
      summary: 'Kinh nghiệm và kết quả hiện tại.',
      sort_order: 0,
      content: {
        explanationVi: 'Dùng have/has + V3.',
        explanationEn: 'Use have/has + past participle.',
        structure: ['S + have/has + V3'],
        examples: [{ en: 'I have been to Hue.', vi: 'Tôi đã từng đến Huế.', correct: true }],
        tips: [],
      },
    },
  ],
  exercises: [
    { id: 'present-perfect-1', lesson_id: 'present-perfect', type: 'multiple_choice', level: 'B1', prompt: 'She ___ here since 2022.', data: { options: ['works', 'has worked'] }, answer: { index: 1 }, explanation_vi: 'since → hiện tại hoàn thành.', explanation_en: null, sort_order: 0 },
  ],
  vocabulary: [
    { id: 'v1', owner_id: null, word: 'deadline', part_of_speech: 'noun', ipa: '/ˈdedlaɪn/', meaning_vi: 'hạn chót', definition_en: 'a time limit', example_en: 'The deadline is Friday.', example_vi: null, level: 'B1', topic: 'work' },
    { id: 'v2', owner_id: null, word: 'colleague', part_of_speech: 'noun', ipa: '/ˈkɑːliːɡ/', meaning_vi: 'đồng nghiệp', definition_en: 'a person you work with', example_en: null, example_vi: null, level: 'A2', topic: 'work' },
  ],
};

function tableFromUrl(url: string) {
  const m = /\/rest\/v1\/(rpc\/)?([a-z_]+)/.exec(new URL(url).pathname);
  return m ? (m[1] ? `rpc:${m[2]}` : m[2]) : '';
}

/** Mock Supabase PostgREST and the EnglishAI API with realistic shapes. */
export async function mockBackend(page: Page, overrides: Partial<Record<string, unknown>> = {}) {
  const data: Record<string, unknown> = {
    profiles: [fixtures.profile],
    user_settings: [fixtures.settings],
    learning_preferences: [fixtures.preferences],
    learning_plans: [{ id: 'p1', title: 'Kế hoạch 20 phút/ngày — B1', level: 'B1', items: [{ skill: 'speaking', title: 'Luyện nói với AI', minutes: 7, to: '/app/speaking', reason: 'Kỹ năng bạn muốn cải thiện' }], created_at: today.toISOString() }],
    lessons: fixtures.lessons,
    exercises: fixtures.exercises,
    vocabulary: fixtures.vocabulary,
    user_vocabulary: [],
    conversations: [],
    messages: [],
    speaking_sessions: [],
    speaking_transcripts: [],
    learning_progress: [],
    'rpc:get_dashboard_stats': fixtures.stats,
    'rpc:admin_overview': {
      users_total: 12,
      users_new_7d: 4,
      users_onboarded: 10,
      active_today: 3,
      requests_today: { chat: 40, assist: 6 },
      errors_today: 0,
      voice_seconds_today: 600,
      voice_active_now: 0,
      daily: fixtures.stats.daily.map((d) => ({ day: d.day, requests: Math.round(d.seconds / 30), voice_seconds: d.seconds / 3 })),
      top_users_today: [{ user_ref: '11111111', display_name: 'Linh', requests: 12 }],
      content: { lessons: 26, exercises: 113, vocabulary: 114 },
    },
    ...overrides,
  };

  await page.route('https://e2e.supabase.co/**', async (route: Route) => {
    const req = route.request();
    const table = tableFromUrl(req.url());
    if (req.url().includes('/auth/v1/')) return route.fulfill({ json: {} });
    if (req.method() !== 'GET' && !table.startsWith('rpc:')) {
      return route.fulfill({ status: req.method() === 'POST' ? 201 : 204, body: req.method() === 'POST' ? '[]' : '' });
    }
    const value = data[table] ?? [];
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const body = wantsObject && Array.isArray(value) ? value[0] ?? null : value;
    return route.fulfill({ json: body, headers: { 'content-range': '0-0/*' } });
  });

  await page.route('**/api/config', (route) => route.fulfill({ json: fixtures.config }));
  await page.route('**/api/chat/stream', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: [
        `event: meta\ndata: ${JSON.stringify({ conversationId: '22222222-2222-4222-8222-222222222222', userMessageId: 'm-user' })}\n\n`,
        `event: delta\ndata: ${JSON.stringify({ text: 'Great! ' })}\n\n`,
        `event: delta\ndata: ${JSON.stringify({ text: 'Where did you go?' })}\n\n`,
        `event: correction\ndata: ${JSON.stringify({ messageId: 'm-user', correction: { hasErrors: true, original: 'I go to Hue yesterday', corrected: 'I went to Hue yesterday', explanation: 'Quá khứ đơn: go → went.', example: 'I went home early.' } })}\n\n`,
        `event: done\ndata: ${JSON.stringify({ assistantMessageId: 'm-bot' })}\n\n`,
      ].join(''),
    }),
  );
  await page.route('**/api/speaking/sessions', (route) =>
    route.fulfill({ json: { transport: 'fallback', sessionId: '33333333-3333-4333-8333-333333333333', maxSeconds: 1800, opening: 'Hi! How was your day?' } }),
  );
  await page.route('**/api/speaking/sessions/*/turn', (route) => route.fulfill({ json: { reply: 'That sounds nice. What did you eat?' } }));
  await page.route('**/api/speaking/sessions/*/end', (route) => route.fulfill({ json: { durationSeconds: 42, status: 'completed' } }));
}

/** Fail if the page scrolls horizontally (layout wider than the viewport). */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
