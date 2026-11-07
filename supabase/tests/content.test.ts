import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { asAnon, asService, asUser, createTestDb, createUser, expectDbError, type Db } from './harness';
const ADMIN = '10000000-0000-4000-8000-000000000001';
const USER = '10000000-0000-4000-8000-000000000002';
let db: Db;
beforeAll(async () => { db = await createTestDb(); await createUser(db,ADMIN,'admin@test.example'); await createUser(db,USER,'user@test.example'); await db.query(`update public.profiles set role='admin' where id=$1`,[ADMIN]); });
afterAll(async () => { await db?.close(); });
describe('content administration RLS', () => {
    it('only admins create drafts and edit shared catalog content', async () => {
        const insert = (q: Parameters<Parameters<typeof asUser>[2]>[0]) => q.exec(`insert into public.lessons(id,kind,level,topic,title,is_published) values('cms-draft','reading','B1','work','Draft',false)`);
        await expectDbError(asUser(db,USER,insert),/row-level security/);
        await expectDbError(asAnon(db,insert),/permission denied/);
        await asUser(db,ADMIN,insert);
        await asUser(db,ADMIN,(q) => q.exec(`insert into public.exercises(id,lesson_id,type,prompt,answer) values('cms-question','cms-draft','fill_blank','Draft question','{"accepted":["yes"]}')`));
        expect((await asUser(db,USER,(q) => q.query(`select id from public.lessons where id='cms-draft'`))).rows).toHaveLength(0);
        expect((await asUser(db,USER,(q) => q.query(`select id from public.exercises where id='cms-question'`))).rows).toHaveLength(0);
        await asUser(db,ADMIN,(q) => q.exec(`update public.lessons set title='Teacher edit', is_published=true where id='cms-draft'`));
        expect((await asUser(db,USER,(q) => q.query(`select id from public.exercises where id='cms-question'`))).rows).toHaveLength(1);
        expect((await asUser(db,USER,(q) => q.query(`update public.lessons set title='Hacked' where id='cms-draft' returning id`))).rows).toHaveLength(0);
        await asUser(db,ADMIN,(q) => q.exec(`insert into public.vocabulary(owner_id,word,meaning_vi) values(null,'teacher-word','từ mới')`));
        expect((await asUser(db,ADMIN,(q) => q.query<{slug: string}>(`select slug from public.vocabulary where word='teacher-word'`))).rows[0].slug).toMatch(/^cms-/);
        expect((await asUser(db,USER,(q) => q.query(`update public.vocabulary set meaning_vi='wrong' where word='teacher-word' returning id`))).rows).toHaveLength(0);
    });
    it('re-running bootstrap seed preserves teacher edits and new exercises', async () => {
        await asUser(db,ADMIN,(q) => q.exec(`update public.lessons set title='Edited in CMS' where id='present-perfect'`));
        await db.exec(readFileSync(new URL('../migrations/20261010000002_seed_content.sql',import.meta.url),'utf8'));
        expect((await db.query<{title: string}>(`select title from public.lessons where id='present-perfect'`)).rows[0].title).toBe('Edited in CMS');
        expect((await db.query(`select id from public.exercises where id='cms-question'`)).rows).toHaveLength(1);
    });
    it('counts mastered words when they return for scheduled review', async () => {
        await asUser(db,USER,(q) => q.query(`insert into public.user_vocabulary(user_id,vocabulary_id,status,due_at) select $1,id,'mastered',now()-interval '1 day' from public.vocabulary limit 1`,[USER]));
        const result = await asUser(db,USER,(q) => q.query<{stats: {words_due: number}}>(`select public.get_dashboard_stats('UTC') as stats`));
        expect(result.rows[0].stats.words_due).toBe(1);
    });
});
describe('shared model RPM', () => {
    it('reserves request counts across users and retains failed calls in the rolling window', async () => {
        const reserve = (user: string,requests: number) => asService(db,(q) => q.query<{r: {allowed: boolean; reason?: string; log_id?: number}}>(`select public.consume_ai_quota($1,'chat',1,$2,100,100,1000,'gemini','rpm-test','{}',3) as r`,[user,requests])).then((r) => r.rows[0].r);
        const first = await reserve(USER,2); expect(first.allowed).toBe(true);
        await asService(db,(q) => q.query(`select public.mark_usage_error($1,'quota')`,[first.log_id]));
        expect(await reserve(ADMIN,2)).toMatchObject({ allowed: false,reason: 'global_rate_limited' });
        expect((await reserve(ADMIN,1)).allowed).toBe(true);
        expect(await reserve(USER,1)).toMatchObject({ allowed: false,reason: 'global_rate_limited' });
    });
});
