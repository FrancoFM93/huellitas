import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createTestDatabase, asUser } from './helpers/database.mjs'

test('profile bootstrap supports clean installs without trusting privilege metadata', async t => {
  const db = await createTestDatabase()
  t.after(() => db.close())
  await t.test('email registration creates exactly one base profile for each supported type', async () => {
    for (const [index, type] of ['user', 'vet', 'clinic', 'fundacion'].entries()) {
      const id = `10000000-0000-4000-8000-00000000000${index}`
      await db.query('INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, $2)', [id, { name: '  Test user  ', type }])
      const { rows } = await db.query('SELECT name, type, role, verified FROM profiles WHERE user_id=$1', [id])
      assert.deepEqual(rows, [{ name: 'Test user', type, role: 'user', verified: false }])
    }
  })
  await t.test('Google-style metadata supplies a name and cannot grant admin/verified', async () => {
    const id = '20000000-0000-4000-8000-000000000001'
    await db.query('INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, $2)', [id, {
      full_name: 'Google user', type: 'admin', role: 'admin', verified: true,
    }])
    const { rows } = await db.query('SELECT name,type,role,verified FROM profiles WHERE user_id=$1', [id])
    assert.deepEqual(rows, [{ name: 'Google user', type: 'user', role: 'user', verified: false }])
  })
  await t.test('empty metadata still creates a usable unprivileged profile', async () => {
    const id = '20000000-0000-4000-8000-000000000002'
    await db.query('INSERT INTO auth.users (id) VALUES ($1)', [id])
    const { rows } = await db.query('SELECT name,type,role,verified FROM profiles WHERE user_id=$1', [id])
    assert.deepEqual(rows, [{ name: 'Usuario', type: 'user', role: 'user', verified: false }])
  })
  await t.test('rerunning the bootstrap preserves existing names and privilege decisions', async () => {
    const id = '10000000-0000-4000-8000-000000000000'
    await db.query("UPDATE profiles SET name='Edited name', verified=true WHERE user_id=$1", [id])
    await db.exec(await readFile(new URL('../supabase/migrations/2026_10_21_13_auth_profile_bootstrap.sql', import.meta.url), 'utf8'))
    const { rows } = await db.query('SELECT name,verified FROM profiles WHERE user_id=$1', [id])
    assert.deepEqual(rows, [{ name: 'Edited name', verified: true }])
  })
  await t.test('bootstrap function is not callable by API users', async () => {
    await assert.rejects(asUser(db, '10000000-0000-4000-8000-000000000000', tx =>
      tx.query('SELECT public.fn_create_profile_for_auth_user()')), /permission denied/)
  })
})

test('profile migration backfills pre-existing accounts with no profile', async t => {
  const db = await createTestDatabase({ throughMigration: '2026_10_21_12_security_baseline.sql' })
  t.after(() => db.close())
  const id = '30000000-0000-4000-8000-000000000001'
  await db.query('INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1,$2)', [id, { type: 'vet', name: 'Existing account' }])
  assert.equal((await db.query('SELECT id FROM profiles WHERE user_id=$1', [id])).rows.length, 0)
  await db.exec(await readFile(new URL('../supabase/migrations/2026_10_21_13_auth_profile_bootstrap.sql', import.meta.url), 'utf8'))
  assert.deepEqual((await db.query('SELECT type,name,role FROM profiles WHERE user_id=$1', [id])).rows,
    [{ type: 'vet', name: 'Existing account', role: 'user' }])
})
