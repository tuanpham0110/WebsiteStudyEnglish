// Test harness: runs the real migrations on PGlite (PostgreSQL compiled to WASM)
// with a minimal stand-in for Supabase's `auth` schema and API roles. RLS,
// grants and plpgsql behave exactly as in Postgres, so these tests exercise the
// same policies that run in production.
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $f$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $f$;
  create or replace function auth.jwt() returns jsonb language sql stable as $f$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $f$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`;

export type Db = PGlite;
export type Q = Pick<Transaction, 'query' | 'exec'>;

export async function createTestDb(): Promise<Db> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

export async function createUser(db: Db, id: string, email: string, displayName?: string) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    email,
    JSON.stringify(displayName ? { display_name: displayName } : {}),
  ]);
}

type Role = 'authenticated' | 'anon' | 'service_role';

/** Run `fn` inside a transaction as the given API role (and user, for authenticated). */
export async function as<T>(db: Db, role: Role, userId: string | null, fn: (q: Q) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = userId ? JSON.stringify({ sub: userId, role }) : JSON.stringify({ role });
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

export const asUser = <T>(db: Db, userId: string, fn: (q: Q) => Promise<T>) => as(db, 'authenticated', userId, fn);
export const asAnon = <T>(db: Db, fn: (q: Q) => Promise<T>) => as(db, 'anon', null, fn);
export const asService = <T>(db: Db, fn: (q: Q) => Promise<T>) => as(db, 'service_role', null, fn);

/** Expect the callback to fail with a Postgres error whose message matches `pattern`. */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp) {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    if (!pattern.test(message)) {
      throw new Error(`Expected error matching ${pattern}, got: ${message}`);
    }
    return message;
  }
  throw new Error(`Expected error matching ${pattern}, but the statement succeeded`);
}
