// Reproduit le strict nécessaire de l'environnement Supabase (schéma auth, rôles)
// pour tester localement le schéma et les règles RLS avec PGlite.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const USER_A = '11111111-1111-4111-8111-111111111111'
export const USER_B = '22222222-2222-4222-8222-222222222222'

export async function createDb() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    insert into auth.users values ('${USER_A}'), ('${USER_B}');
  `)
  const sql = readFileSync(join(__dirname, '../../supabase/migrations/0001_elan_schema.sql'), 'utf8')
  await db.exec(sql)
  // Règles des rappels (les extensions pg_net / pg_cron n'existent pas hors de Supabase : ignorées ici)
  const rappels = readFileSync(join(__dirname, '../../supabase/migrations/0003_rappels.sql'), 'utf8')
    .split('\n').filter(l => !/^create extension/i.test(l)).join('\n')
  await db.exec(rappels)
  // Lot 1 : journal alimentaire, eau en millilitres, 5 rappels d'eau
  await db.exec(readFileSync(join(__dirname, '../../supabase/migrations/0005_journal_alimentaire.sql'), 'utf8'))
  // Droits par défaut de Supabase : les rôles API ont les droits de table, c'est la RLS qui filtre.
  await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
  return db
}

/** Exécute une requête en tant qu'utilisatrice connectée (rôle authenticated + jeton). */
export async function asUser<T = any>(db: PGlite, uid: string | null, query: string, params: any[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  await db.exec(uid ? 'set role authenticated' : 'set role anon')
  try {
    return await db.query<T>(query, params)
  } finally {
    await db.exec('reset role')
  }
}
