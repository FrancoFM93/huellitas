import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const root = new URL('../../', import.meta.url)

// Run the checked-in SQL against a real, in-memory PostgreSQL engine. Only
// unused native extensions are substituted; policies, grants, triggers and RPCs
// are executed unchanged. This does not emulate the hosted Auth/Storage APIs.
export async function createTestDatabase({ throughMigration } = {}) {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB NOT NULL DEFAULT '{}'
      );
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      CREATE FUNCTION public.uuid_generate_v4() RETURNS UUID LANGUAGE SQL AS $$
        SELECT gen_random_uuid()
      $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
    `)
    const schema = await readFile(new URL('supabase/schema.sql', root), 'utf8')
    await db.exec(schema.replace(/^CREATE EXTENSION IF NOT EXISTS "(?:uuid-ossp|postgis)";.*$/gm, ''))
    const migrations = (await readdir(new URL('supabase/migrations/', root)))
      .filter(name => name.endsWith('.sql'))
      .sort()
    for (const name of migrations) {
      if (throughMigration && name > throughMigration) break
      try {
        await db.exec(await readFile(new URL(`supabase/migrations/${name}`, root), 'utf8'))
      } catch (error) {
        throw new Error(`Migration failed: ${name}`, { cause: error })
      }
    }
    return db
  } catch (error) {
    await db.close()
    throw error
  }
}

export async function asUser(db, userId, fn, role = 'authenticated') {
  if (!['authenticated', 'anon', 'service_role'].includes(role)) throw new Error('Invalid test role')
  return db.transaction(async tx => {
    await tx.exec(`SET LOCAL ROLE ${role}`)
    await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId ?? ''])
    return fn(tx)
  })
}
