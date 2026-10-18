// Cross-account access test against a REAL Supabase project (after migrations).
//   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npm run test:rls:remote
// Creates two temporary confirmed users, checks that neither can read or modify
// the other's data or escalate privileges, then deletes both users.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { loadEnv, report } from './load-env.mjs';

const env = loadEnv();
const { SUPABASE_URL: URL_, SUPABASE_PUBLISHABLE_KEY: PUB, SUPABASE_SECRET_KEY: SECRET } = env;
if (!URL_ || !PUB || !SECRET) {
  console.error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (env or .dev.vars). Integration pending.');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SECRET, opts);
const results = [];
const expect = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail });

async function makeUser(tag) {
  const email = `rls-${tag}-${randomBytes(4).toString('hex')}@example.com`;
  const password = `Pw-${randomBytes(12).toString('hex')}1a`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `RLS ${tag}` } });
  if (error) throw new Error(`createUser: ${error.message}`);
  const client = createClient(URL_, PUB, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, client };
}

let A;
let B;
try {
  A = await makeUser('a');
  B = await makeUser('b');

  const profile = await A.client.from('profiles').select('id, role').single();
  expect('signup trigger created profile with role=user', profile.data?.role === 'user', profile.error?.message);

  const conv = await A.client.from('conversations').insert({ user_id: A.id, title: 'A private', level: 'B1' }).select('id').single();
  expect('A can create a conversation', !conv.error, conv.error?.message);
  const msg = await A.client.from('messages').insert({ conversation_id: conv.data.id, user_id: A.id, role: 'user', content: 'secret' }).select('id').single();
  expect('A can add a message', !msg.error, msg.error?.message);

  const bRead = await B.client.from('conversations').select('id').eq('id', conv.data.id);
  expect("B cannot read A's conversation", !bRead.error && bRead.data.length === 0, bRead.error?.message);
  const bMsgs = await B.client.from('messages').select('id').eq('conversation_id', conv.data.id);
  expect("B cannot read A's messages", !bMsgs.error && bMsgs.data.length === 0, bMsgs.error?.message);
  const bInsert = await B.client.from('messages').insert({ conversation_id: conv.data.id, user_id: B.id, role: 'user', content: 'x' });
  expect("B cannot post into A's conversation", Boolean(bInsert.error), bInsert.error?.message);
  const bUpdate = await B.client.from('conversations').update({ title: 'hacked' }).eq('id', conv.data.id).select('id');
  expect("B cannot rename A's conversation", !bUpdate.error && bUpdate.data.length === 0, bUpdate.error?.message);
  const bDelete = await B.client.from('conversations').delete().eq('id', conv.data.id).select('id');
  expect("B cannot delete A's conversation", !bDelete.error && bDelete.data.length === 0, bDelete.error?.message);

  const escalate = await B.client.from('profiles').update({ role: 'admin' }).eq('id', B.id);
  expect('B cannot make themselves admin', Boolean(escalate.error), escalate.error?.message);
  const usage = await B.client.from('usage_logs').insert({ user_id: B.id, kind: 'chat' });
  expect('B cannot write usage logs', Boolean(usage.error), usage.error?.message);
  const quota = await B.client.rpc('consume_ai_quota', {
    p_user: B.id, p_kind: 'chat', p_units: 1, p_requests: 1, p_user_daily_limit: 999, p_user_minute_limit: 999, p_global_daily_limit: 999,
  });
  expect('B cannot call server-only quota function', Boolean(quota.error), quota.error?.message);
  const adminView = await B.client.rpc('admin_overview');
  expect('B cannot read the admin overview', Boolean(adminView.error), adminView.error?.message);

  const anon = createClient(URL_, PUB, opts);
  const anonRead = await anon.from('messages').select('id').limit(1);
  expect('anonymous users cannot read messages', Boolean(anonRead.error) || anonRead.data.length === 0, anonRead.error?.message);
  const content = await B.client.from('lessons').select('id').limit(1);
  expect('signed-in users can read lesson content (seed loaded)', !content.error && content.data.length > 0, content.error?.message ?? 'no lessons — run the seed migration');

  const serverQuota = await admin.rpc('consume_ai_quota', {
    p_user: A.id, p_kind: 'chat', p_units: 1, p_requests: 1, p_user_daily_limit: 5, p_user_minute_limit: 5, p_global_daily_limit: 100000,
  });
  expect('server (secret key) can call the quota function', !serverQuota.error && serverQuota.data?.allowed === true, serverQuota.error?.message);
} catch (error) {
  expect('setup', false, error.message);
} finally {
  for (const u of [A, B]) if (u) await admin.auth.admin.deleteUser(u.id);
  const leftover = A ? await admin.from('profiles').select('id').eq('id', A.id) : { data: [] };
  expect('deleting a user removes their profile (cascade)', (leftover.data ?? []).length === 0);
}

report(results);
