import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStore } from 'zustand/vanilla'
import type { Session } from '@supabase/supabase-js'
import { createAuthState, type AuthProfiles } from '../lib/authState'
import { getPostLoginRoute } from '../lib/authRouting'
import { createOAuthCodeExchange } from '../lib/oauthExchange'

const session = (id: string) => ({ user: { id } }) as Session
const profiles = (id: string): AuthProfiles => ({
  profile: {
    id: `profile-${id}`, user_id: id, type: 'user', role: 'user', verified: false,
    name: id, avatar_url: null, bio: null, location: null, phone: null,
    country: null, region: null, city_slug: null, created_at: '2026-10-21T12:00:00Z',
  },
  vetProfile: null, clinicProfile: null, organizationProfile: null,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('auth state isolates account data and survives profile failures', async t => {
  await t.test('simultaneous login and session restoration share one profile request', async () => {
    let calls = 0
    const request = deferred<AuthProfiles>()
    const store = createStore(createAuthState({
      loadProfile: async () => { calls++; return request.promise },
      signOut: async () => {}, clearUserData() {},
    }))
    store.getState().setSession(session('alice'))
    const first = store.getState().fetchProfile('alice')
    const second = store.getState().fetchProfile('alice')
    assert.equal(first, second)
    await Promise.resolve()
    assert.equal(calls, 1)
    request.resolve(profiles('alice'))
    await first
    assert.equal(store.getState().profile?.user_id, 'alice')
    assert.equal(store.getState().isLoading, false)
  })

  await t.test('a slow previous account cannot overwrite the current account', async () => {
    const alice = deferred<AuthProfiles>()
    let clears = 0
    const store = createStore(createAuthState({
      loadProfile: async id => id === 'alice' ? alice.promise : profiles(id),
      signOut: async () => {}, clearUserData() { clears++ },
    }))
    store.getState().setSession(session('alice'))
    const previous = store.getState().fetchProfile('alice')
    await Promise.resolve()
    store.getState().setSession(session('bob'))
    assert.equal(store.getState().profile, null)
    await store.getState().fetchProfile('bob')
    alice.resolve(profiles('alice'))
    await previous
    assert.equal(store.getState().profile?.user_id, 'bob')
    assert.equal(clears, 2)
  })

  await t.test('signing out while loading cannot repopulate profile or specialist data', async () => {
    const request = deferred<AuthProfiles>()
    let clears = 0
    const store = createStore(createAuthState({
      loadProfile: () => request.promise,
      signOut: async () => {}, clearUserData() { clears++ },
    }))
    store.getState().setSession(session('alice'))
    const loading = store.getState().fetchProfile('alice')
    await store.getState().signOut()
    request.resolve(profiles('alice'))
    await loading
    assert.equal(store.getState().session, null)
    assert.equal(store.getState().profile, null)
    assert.equal(store.getState().vetProfile, null)
    assert.equal(store.getState().isLoading, false)
    assert.equal(clears, 2)
  })

  await t.test('network failures settle loading and allow retry instead of onboarding', async () => {
    let calls = 0
    const store = createStore(createAuthState({
      loadProfile: async id => { if (++calls === 1) throw new Error('offline'); return profiles(id) },
      signOut: async () => {}, clearUserData() {},
    }))
    store.getState().setSession(session('alice'))
    await store.getState().fetchProfile('alice')
    assert.equal(store.getState().isLoading, false)
    assert.equal(store.getState().profileError, 'offline')
    assert.equal(getPostLoginRoute(store.getState()), '/')
    await store.getState().fetchProfile('alice')
    assert.equal(store.getState().profileError, null)
    assert.equal(store.getState().profile?.user_id, 'alice')
  })

  await t.test('a missing database profile produces a recoverable setup error', async () => {
    const store = createStore(createAuthState({
      loadProfile: async () => ({ ...profiles('alice'), profile: null }),
      signOut: async () => {}, clearUserData() {},
    }))
    store.getState().setSession(session('alice'))
    await store.getState().fetchProfile('alice')
    assert.equal(store.getState().profileError, 'profile_missing')
    assert.equal(store.getState().isLoading, false)
    assert.equal(getPostLoginRoute(store.getState()), '/')
  })

  await t.test('token refresh preserves the same account and its caches', async () => {
    let clears = 0
    const store = createStore(createAuthState({
      loadProfile: async id => profiles(id), signOut: async () => {},
      clearUserData() { clears++ },
    }))
    store.getState().setSession(session('alice'))
    await store.getState().fetchProfile('alice')
    store.getState().setSession({ ...session('alice'), access_token: 'renewed' })
    assert.equal(store.getState().profile?.user_id, 'alice')
    assert.equal(clears, 1)
  })

  await t.test('professional accounts reach onboarding when their specialist profile is absent', () => {
    for (const type of ['vet', 'clinic', 'fundacion'] as const) {
      const state = profiles('alice')
      state.profile!.type = type
      assert.equal(getPostLoginRoute({ ...state, profileError: null }), '/(auth)/onboarding')
    }
    assert.equal(getPostLoginRoute({ ...profiles('alice'), profileError: null }), '/(tabs)')
  })
})

test('OAuth handles overlapping and delayed callbacks without replaying a signed-out session', async () => {
  let calls = 0
  let current: string | null = null
  const request = deferred<string>()
  const exchange = createOAuthCodeExchange({
    exchange: async () => { calls++; current = await request.promise; return current },
    currentSession: async () => current,
    identity: value => value,
  })
  const native = exchange('pkce-code')
  const callback = exchange('pkce-code')
  assert.equal(native, callback)
  await Promise.resolve()
  assert.equal(calls, 1)
  request.resolve('alice-session')
  assert.equal(await native, 'alice-session')
  assert.equal(await callback, 'alice-session')
  // A delayed second observer uses the still-current session, not the spent code.
  assert.equal(await exchange('pkce-code'), 'alice-session')
  assert.equal(calls, 1)
  current = null
  await assert.rejects(exchange('pkce-code'), /oauth_code_already_consumed/)
  current = 'bob-session'
  await assert.rejects(exchange('pkce-code'), /oauth_code_already_consumed/)
  assert.equal(calls, 1)
  await assert.rejects(exchange(''), /missing_oauth_code/)
})
