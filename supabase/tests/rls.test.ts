import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, asAnon, asService, asUser, createTestDb, createUser, expectDbError, type Db } from './harness';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const ADMIN = '00000000-0000-4000-8000-0000000000ad';

let db: Db;
let convA: string;
let convB: string;

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, A, 'alice@example.com', 'Alice');
  await createUser(db, B, 'bob@example.com');
  await createUser(db, ADMIN, 'admin@example.com', 'Admin');
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);

  convA = await asUser(db, A, async (q) => {
    const r = await q.query<{ id: string }>(
      `insert into public.conversations (user_id, title, mode, level) values ($1, 'A chat', 'english_tutor', 'B1') returning id`,
      [A],
    );
    await q.query(
      `insert into public.messages (conversation_id, user_id, role, content) values ($1, $2, 'user', 'Hello from A')`,
      [r.rows[0].id, A],
    );
    return r.rows[0].id;
  });
  convB = await asUser(db, B, async (q) => {
    const r = await q.query<{ id: string }>(
      `insert into public.conversations (user_id, title, level) values ($1, 'B chat', 'A2') returning id`,
      [B],
    );
    await q.query(
      `insert into public.messages (conversation_id, user_id, role, content) values ($1, $2, 'user', 'Secret from B')`,
      [r.rows[0].id, B],
    );
    return r.rows[0].id;
  });
});

afterAll(async () => {
  await db?.close();
});

describe('new user bootstrap', () => {
  it('creates profile, settings and preferences rows', async () => {
    const rows = await asUser(db, A, async (q) => {
      const p = await q.query<{ display_name: string; role: string }>(`select display_name, role from public.profiles`);
      const s = await q.query(`select * from public.user_settings`);
      const l = await q.query(`select * from public.learning_preferences`);
      return { p: p.rows, s: s.rows.length, l: l.rows.length };
    });
    expect(rows.p).toEqual([{ display_name: 'Alice', role: 'user' }]);
    expect(rows.s).toBe(1);
    expect(rows.l).toBe(1);
  });

  it('falls back to the email local part as display name', async () => {
    const name = await asUser(db, B, (q) => q.query<{ display_name: string }>(`select display_name from public.profiles`));
    expect(name.rows[0].display_name).toBe('bob');
  });
});

describe('cross-account isolation (A vs B)', () => {
  const privateTables = [
    'profiles',
    'conversations',
    'messages',
    'user_settings',
    'learning_preferences',
    'learning_progress',
    'user_vocabulary',
    'vocabulary_reviews',
    'exercise_attempts',
    'speaking_sessions',
    'speaking_transcripts',
    'usage_logs',
    'learning_plans',
  ];

  it.each(privateTables)('A cannot read any of B\'s rows in %s', async (table) => {
    const column = table === 'profiles' ? 'id' : 'user_id';
    const r = await asUser(db, A, (q) => q.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${column} = $1`, [B]));
    expect(r.rows[0].n).toBe(0);
  });

  it('A sees only their own conversation and messages', async () => {
    const r = await asUser(db, A, async (q) => ({
      convs: (await q.query<{ id: string }>(`select id from public.conversations`)).rows.map((x) => x.id),
      msgs: (await q.query<{ content: string }>(`select content from public.messages`)).rows.map((x) => x.content),
    }));
    expect(r.convs).toEqual([convA]);
    expect(r.msgs).toEqual(['Hello from A']);
  });

  it('A cannot rename or delete B\'s conversation', async () => {
    const res = await asUser(db, A, async (q) => ({
      upd: (await q.query(`update public.conversations set title = 'hacked' where id = $1`, [convB])).affectedRows,
      del: (await q.query(`delete from public.conversations where id = $1`, [convB])).affectedRows,
    }));
    expect(res).toEqual({ upd: 0, del: 0 });
    const title = await asUser(db, B, (q) => q.query<{ title: string }>(`select title from public.conversations where id = $1`, [convB]));
    expect(title.rows[0].title).toBe('B chat');
  });

  it('A cannot post a message into B\'s conversation, even claiming to be B', async () => {
    await expectDbError(
      asUser(db, A, (q) =>
        q.query(`insert into public.messages (conversation_id, user_id, role, content) values ($1, $2, 'user', 'x')`, [convB, A]),
      ),
      /row-level security/,
    );
    await expectDbError(
      asUser(db, A, (q) =>
        q.query(`insert into public.messages (conversation_id, user_id, role, content) values ($1, $2, 'user', 'x')`, [convB, B]),
      ),
      /row-level security/,
    );
  });

  it('A cannot create rows owned by B', async () => {
    await expectDbError(
      asUser(db, A, (q) => q.query(`insert into public.conversations (user_id, title, level) values ($1, 'x', 'A1')`, [B])),
      /row-level security/,
    );
    await expectDbError(
      asUser(db, A, (q) => q.query(`insert into public.learning_progress (user_id, activity, duration_seconds) values ($1, 'chat', 60)`, [B])),
      /row-level security/,
    );
  });

  it('A cannot change B\'s settings', async () => {
    const r = await asUser(db, A, (q) => q.query(`update public.user_settings set theme = 'dark' where user_id = $1`, [B]));
    expect(r.affectedRows).toBe(0);
  });
});

describe('privilege escalation is blocked', () => {
  it('a user cannot make themselves admin', async () => {
    await expectDbError(
      asUser(db, A, (q) => q.query(`update public.profiles set role = 'admin' where id = $1`, [A])),
      /permission denied/,
    );
  });

  it('a user can still edit allowed profile columns', async () => {
    const r = await asUser(db, A, (q) => q.query(`update public.profiles set display_name = 'Alice L.', level = 'B1' where id = $1`, [A]));
    expect(r.affectedRows).toBe(1);
  });

  it('a user cannot write usage logs or speaking sessions directly', async () => {
    await expectDbError(
      asUser(db, A, (q) => q.query(`insert into public.usage_logs (user_id, kind) values ($1, 'chat')`, [A])),
      /permission denied/,
    );
    await expectDbError(
      asUser(db, A, (q) =>
        q.query(`insert into public.speaking_sessions (user_id, transport, provider, level, max_seconds) values ($1, 'realtime', 'x', 'A1', 3600)`, [A]),
      ),
      /permission denied/,
    );
  });

  it('a user cannot call server-only quota functions', async () => {
    await expectDbError(
      asUser(db, A, (q) => q.query(`select public.consume_ai_quota($1, 'chat', 1, 1, 1000, 1000, 1000)`, [A])),
      /permission denied/,
    );
    await expectDbError(
      asUser(db, A, (q) => q.query(`select public.start_voice_session($1, 'g', 'm', 'A1', null, null, 3600, 99999, 100, 99999, 100)`, [A])),
      /permission denied/,
    );
  });

  it('a user cannot backdate activity (occurred_at is server-controlled)', async () => {
    await expectDbError(
      asUser(db, A, (q) =>
        q.query(`insert into public.learning_progress (user_id, activity, occurred_at) values ($1, 'chat', now() - interval '3 days')`, [A]),
      ),
      /permission denied/,
    );
  });

  it('a user cannot read the admin overview', async () => {
    await expectDbError(asUser(db, A, (q) => q.query(`select public.admin_overview()`)), /forbidden/);
  });

  it('an admin can read the aggregated overview', async () => {
    const r = await asUser(db, ADMIN, (q) => q.query<{ o: { users_total: number } }>(`select public.admin_overview() as o`));
    expect(r.rows[0].o.users_total).toBe(3);
  });
});

describe('anonymous access', () => {
  it.each(['lessons', 'vocabulary', 'profiles', 'messages'])('anon cannot read %s', async (table) => {
    await expectDbError(asAnon(db, (q) => q.query(`select * from public.${table}`)), /permission denied/);
  });

  it('anon cannot call dashboard stats', async () => {
    await expectDbError(asAnon(db, (q) => q.query(`select public.get_dashboard_stats('UTC')`)), /permission denied/);
  });
});

describe('vocabulary CRUD', () => {
  let wordId: string;
  let catalogId: string;

  beforeAll(async () => {
    const r = await db.query<{ id: string }>(
      `insert into public.vocabulary (slug, word, meaning_vi, level, topic) values ('test-apple', 'apple', 'quả táo', 'A1', 'food')
       on conflict (slug) do update set word = excluded.word returning id`,
    );
    catalogId = r.rows[0].id;
  });

  it('A creates a personal word', async () => {
    const r = await asUser(db, A, (q) =>
      q.query<{ id: string }>(
        `insert into public.vocabulary (owner_id, word, meaning_vi, part_of_speech) values ($1, 'serendipity', 'sự tình cờ may mắn', 'noun') returning id`,
        [A],
      ),
    );
    wordId = r.rows[0].id;
    expect(wordId).toBeTruthy();
  });

  it('A reads the catalog plus their own word; B only sees the catalog', async () => {
    const aWords = await asUser(db, A, (q) => q.query<{ word: string }>(`select word from public.vocabulary order by word`));
    const bWords = await asUser(db, B, (q) => q.query<{ word: string }>(`select word from public.vocabulary order by word`));
    expect(aWords.rows.map((w) => w.word)).toContain('serendipity');
    expect(bWords.rows.map((w) => w.word)).not.toContain('serendipity');
    expect(bWords.rows.map((w) => w.word)).toContain('apple');
  });

  it('B cannot update or delete A\'s word, nor track it', async () => {
    const res = await asUser(db, B, async (q) => ({
      upd: (await q.query(`update public.vocabulary set meaning_vi = 'x' where id = $1`, [wordId])).affectedRows,
      del: (await q.query(`delete from public.vocabulary where id = $1`, [wordId])).affectedRows,
    }));
    expect(res).toEqual({ upd: 0, del: 0 });
    await expectDbError(
      asUser(db, B, (q) => q.query(`insert into public.user_vocabulary (user_id, vocabulary_id) values ($1, $2)`, [B, wordId])),
      /row-level security/,
    );
  });

  it('users cannot modify or add catalog words', async () => {
    const r = await asUser(db, A, (q) => q.query(`update public.vocabulary set meaning_vi = 'x' where id = $1`, [catalogId]));
    expect(r.affectedRows).toBe(0);
    await expectDbError(
      asUser(db, A, (q) => q.query(`insert into public.vocabulary (owner_id, word, meaning_vi) values (null, 'fake', 'giả')`)),
      /row-level security|violates check constraint/,
    );
    await expectDbError(
      asUser(db, A, (q) => q.query(`insert into public.vocabulary (owner_id, slug, word, meaning_vi) values ($1, 'apple-2', 'fake', 'giả')`, [A])),
      /permission denied/,
    );
  });

  it('A tracks words, updates SRS state, reviews and deletes', async () => {
    await asUser(db, A, async (q) => {
      await q.query(`insert into public.user_vocabulary (user_id, vocabulary_id) values ($1, $2), ($1, $3)`, [A, catalogId, wordId]);
      const upd = await q.query(
        `update public.user_vocabulary set repetitions = 1, interval_days = 1, due_at = now() + interval '1 day', is_favorite = true where vocabulary_id = $1`,
        [catalogId],
      );
      expect(upd.affectedRows).toBe(1);
      await q.query(`insert into public.vocabulary_reviews (user_id, vocabulary_id, rating, interval_days) values ($1, $2, 2, 1)`, [A, catalogId]);
      const upd2 = await q.query(`update public.vocabulary set meaning_vi = 'sự may mắn bất ngờ' where id = $1`, [wordId]);
      expect(upd2.affectedRows).toBe(1);
      const del = await q.query(`delete from public.vocabulary where id = $1`, [wordId]);
      expect(del.affectedRows).toBe(1);
      const left = await q.query<{ n: number }>(`select count(*)::int as n from public.user_vocabulary`);
      expect(left.rows[0].n).toBe(1); // cascade removed tracking of the deleted personal word
    });
  });
});

describe('AI quota function', () => {
  const consume = (user: string, kind: string, opts: { daily?: number; minute?: number; global?: number; requests?: number } = {}) =>
    asService(db, (q) =>
      q.query<{ r: { allowed: boolean; reason?: string; log_id?: number; used?: number } }>(
        `select public.consume_ai_quota($1, $2, 1, $3, $4, $5, $6, 'gemini', 'test-model') as r`,
        [user, kind, opts.requests ?? 1, opts.daily ?? 3, opts.minute ?? 100, opts.global ?? 1000],
      ),
    ).then((r) => r.rows[0].r);

  it('enforces the per-user daily limit', async () => {
    expect((await consume(B, 'evaluation')).allowed).toBe(true);
    expect((await consume(B, 'evaluation')).allowed).toBe(true);
    expect((await consume(B, 'evaluation')).allowed).toBe(true);
    const fourth = await consume(B, 'evaluation');
    expect(fourth).toMatchObject({ allowed: false, reason: 'user_daily' });
  });

  it('failed provider calls do not consume the daily quota', async () => {
    const first = await consume(A, 'stt', { daily: 1 });
    expect(first.allowed).toBe(true);
    await asService(db, (q) => q.query(`select public.mark_usage_error($1, 'provider_error')`, [first.log_id]));
    expect((await consume(A, 'stt', { daily: 1 })).allowed).toBe(true);
    expect((await consume(A, 'stt', { daily: 1 })).allowed).toBe(false);
  });

  it('enforces the per-minute rate limit across AI kinds', async () => {
    const user = A;
    const recent = await db.query<{ n: number }>(
      `select count(*)::int as n from public.usage_logs where user_id = $1 and created_at > now() - interval '1 minute'`,
      [user],
    );
    const limit = recent.rows[0].n + 1;
    expect((await consume(user, 'chat', { minute: limit, daily: 100 })).allowed).toBe(true);
    expect(await consume(user, 'chat', { minute: limit, daily: 100 })).toMatchObject({ allowed: false, reason: 'rate_limited' });
  });

  it('enforces the global daily cap using provider request counts', async () => {
    const total = await db.query<{ n: number }>(
      `select coalesce(sum(requests), 0)::int as n from public.usage_logs where kind in ('chat','assist','evaluation','stt','tts')`,
    );
    const cap = total.rows[0].n + 2;
    expect(await consume(ADMIN, 'chat', { global: cap, requests: 3, daily: 100 })).toMatchObject({ allowed: false, reason: 'global_daily' });
    expect((await consume(ADMIN, 'chat', { global: cap, requests: 2, daily: 100 })).allowed).toBe(true);
  });

  it('users can read their own usage summary only', async () => {
    const r = await asUser(db, B, (q) => q.query<{ u: { evaluation: number } }>(`select public.get_my_usage_today() as u`));
    expect(r.rows[0].u.evaluation).toBe(3);
  });
});

describe('voice session budget', () => {
  const start = (user: string, opts: { session?: number; daily?: number; concurrent?: number; globalDaily?: number } = {}) =>
    asService(db, (q) =>
      q.query<{ r: { allowed: boolean; reason?: string; session_id?: string; max_seconds?: number } }>(
        `select public.start_voice_session($1, 'gemini', 'gemini-3.8-live', 'B1', 'travel', null, $2, $3, 100, $4, $5) as r`,
        [user, opts.session ?? 300, opts.daily ?? 600, opts.globalDaily ?? 100000, opts.concurrent ?? 5],
      ),
    ).then((r) => r.rows[0].r);
  const finish = (user: string, session: string, status = 'completed') =>
    asService(db, (q) =>
      q.query<{ r: { ok: boolean; duration_seconds: number; reason?: string } }>(
        `select public.finish_speaking_session($1, $2, $3) as r`,
        [user, session, status],
      ),
    ).then((r) => r.rows[0].r);

  it('allows one active session per user and finishes with a server-measured duration', async () => {
    const s1 = await start(A);
    expect(s1.allowed).toBe(true);
    expect(s1.max_seconds).toBe(300);
    expect(await start(A)).toMatchObject({ allowed: false, reason: 'session_active' });

    // Pretend the session started 400s ago: duration must be capped at the 300s grant.
    await db.query(`update public.speaking_sessions set started_at = now() - interval '400 seconds' where id = $1`, [s1.session_id]);
    const done = await finish(A, s1.session_id!);
    expect(done).toMatchObject({ ok: true, duration_seconds: 300 });

    const progress = await asUser(db, A, (q) =>
      q.query<{ n: number }>(`select count(*)::int as n from public.learning_progress where activity = 'speaking' and duration_seconds = 300`),
    );
    expect(progress.rows[0].n).toBe(1);
  });

  it('B cannot finish A\'s session', async () => {
    const s = await start(A, { daily: 100000 });
    expect(s.allowed).toBe(true);
    expect(await finish(B, s.session_id!)).toMatchObject({ ok: false, reason: 'not_found' });
    await finish(A, s.session_id!);
  });

  it('grants only the remaining daily budget and then refuses', async () => {
    const s = await start(B, { session: 300, daily: 420 });
    expect(s).toMatchObject({ allowed: true, max_seconds: 300 });
    await db.query(`update public.speaking_sessions set started_at = now() - interval '300 seconds' where id = $1`, [s.session_id]);
    await finish(B, s.session_id!);
    const s2 = await start(B, { session: 300, daily: 420 });
    expect(s2).toMatchObject({ allowed: true, max_seconds: 120 });
    await db.query(`update public.speaking_sessions set started_at = now() - interval '200 seconds' where id = $1`, [s2.session_id]);
    await finish(B, s2.session_id!);
    expect(await start(B, { session: 300, daily: 420 })).toMatchObject({ allowed: false, reason: 'user_daily_voice' });
  });

  it('deleting a session (privacy) does not refund the daily voice budget', async () => {
    const D = '00000000-0000-4000-8000-00000000000d';
    await createUser(db, D, 'dave@example.com');
    const s = await start(D, { session: 300, daily: 300 });
    await db.query(`update public.speaking_sessions set started_at = now() - interval '300 seconds' where id = $1`, [s.session_id]);
    await finish(D, s.session_id!);
    const deleted = await asUser(db, D, (q) => q.query(`delete from public.speaking_sessions where id = $1`, [s.session_id]));
    expect(deleted.affectedRows).toBe(1);
    expect(await start(D, { session: 300, daily: 300 })).toMatchObject({ allowed: false, reason: 'user_daily_voice' });
    const usage = await asUser(db, D, (q) => q.query<{ u: { voice_seconds: number } }>(`select public.get_my_usage_today() as u`));
    expect(usage.rows[0].u.voice_seconds).toBe(300);
  });

  it('enforces the global concurrency cap', async () => {
    const s = await start(ADMIN, { concurrent: 1 });
    expect(s.allowed).toBe(true);
    expect(await start(A, { concurrent: 1, daily: 100000 })).toMatchObject({ allowed: false, reason: 'global_concurrent' });
    await finish(ADMIN, s.session_id!);
  });

  it('expires abandoned sessions at their full budget', async () => {
    const s = await start(ADMIN, { session: 60, daily: 100000 });
    await db.query(`update public.speaking_sessions set started_at = now() - interval '1 hour' where id = $1`, [s.session_id]);
    const next = await start(ADMIN, { session: 60, daily: 100000 });
    expect(next.allowed).toBe(true);
    const old = await db.query<{ status: string; duration_seconds: number }>(
      `select status, duration_seconds from public.speaking_sessions where id = $1`,
      [s.session_id],
    );
    expect(old.rows[0]).toEqual({ status: 'expired', duration_seconds: 60 });
    await finish(ADMIN, next.session_id!);
  });
});

describe('dashboard stats', () => {
  it('computes streak and totals from the caller\'s own activity', async () => {
    const C = '00000000-0000-4000-8000-00000000000c';
    await createUser(db, C, 'carol@example.com');
    // Activity today, yesterday and 2 days ago (streak 3), plus a gap and an older day.
    for (const daysAgo of [0, 1, 2, 4]) {
      await db.query(
        `insert into public.learning_progress (user_id, activity, duration_seconds, occurred_at)
         values ($1, 'grammar', 120, now() - make_interval(days => $2))`,
        [C, daysAgo],
      );
    }
    await db.query(`insert into public.learning_progress (user_id, activity, duration_seconds) values ($1, 'chat', 999)`, [B]);

    const stats = await asUser(db, C, (q) =>
      q.query<{ s: { streak_days: number; total_seconds: number; today_seconds: number; daily: { seconds: number }[] } }>(
        `select public.get_dashboard_stats('UTC') as s`,
      ),
    );
    const s = stats.rows[0].s;
    expect(s.streak_days).toBe(3);
    expect(s.total_seconds).toBe(480);
    expect(s.today_seconds).toBe(120);
    expect(s.daily).toHaveLength(14);
  });

  it('falls back to UTC for an invalid timezone', async () => {
    const r = await asUser(db, A, (q) => q.query<{ s: { timezone: string } }>(`select public.get_dashboard_stats('Not/AZone') as s`));
    expect(r.rows[0].s.timezone).toBe('UTC');
  });
});

describe('account deletion', () => {
  it('removes all private data and anonymises usage logs', async () => {
    const before = await db.query<{ n: number }>(`select count(*)::int as n from public.usage_logs where user_id = $1`, [B]);
    expect(before.rows[0].n).toBeGreaterThan(0);
    await db.query(`delete from auth.users where id = $1`, [B]);
    for (const table of ['profiles', 'conversations', 'messages', 'speaking_sessions', 'learning_progress', 'user_settings']) {
      const column = table === 'profiles' ? 'id' : 'user_id';
      const r = await db.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${column} = $1`, [B]);
      expect(r.rows[0].n, table).toBe(0);
    }
    const anonymised = await db.query<{ n: number }>(`select count(*)::int as n from public.usage_logs where user_id is null`);
    expect(anonymised.rows[0].n).toBeGreaterThan(0);
  });

  it('service role bypasses RLS (used only by the server)', async () => {
    const r = await as(db, 'service_role', null, (q) => q.query<{ n: number }>(`select count(*)::int as n from public.conversations`));
    expect(r.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
