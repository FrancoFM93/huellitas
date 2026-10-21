import assert from 'node:assert/strict'
import test from 'node:test'
import { createStore } from 'zustand/vanilla'
import { createNotificationState } from '../store/notificationState.ts'
import type { AppNotification } from '../types/index.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const row = (id: string, user_id: string, read = false): AppNotification => ({
  id, user_id, read, type: 'pet_sighting', title: 'Sighting', body: 'Found nearby',
  metadata: {}, created_at: '2026-10-21T12:00:00Z',
})

function fixture() {
  const reads: ReturnType<typeof deferred<{ data: AppNotification[]; error: unknown }>>[] = []
  const listeners: ((payload: { new: AppNotification }) => void)[] = []
  let updateError: unknown = null
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => {
        const pending = deferred<{ data: AppNotification[]; error: unknown }>()
        reads.push(pending)
        return pending.promise
      } }) }) }),
      update: () => {
        const query = { eq: () => query, then: (resolve: (value: { error: unknown }) => void) => Promise.resolve({ error: updateError }).then(resolve) }
        return query
      },
    }),
    channel: () => {
      const channel = { on: (_event: string, _filter: unknown, callback: (payload: { new: AppNotification }) => void) => {
        listeners.push(callback)
        return channel
      }, subscribe: () => channel }
      return channel
    },
    removeChannel: async () => 'ok',
  }
  const state = createStore(createNotificationState(client as never))
  return { state, reads, listeners, failUpdate: () => { updateError = new Error('offline') } }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

test('logout clears notifications and ignores an in-flight fetch or old Realtime event', async () => {
  const { state, reads, listeners } = fixture()
  state.getState().subscribe('alice')
  listeners[0]({ new: row('first', 'alice') })
  assert.equal(state.getState().unreadCount, 1)
  state.getState().unsubscribe()
  reads[0].resolve({ data: [row('late', 'alice')], error: null })
  listeners[0]({ new: row('later', 'alice') })
  await flush()
  assert.equal(state.getState().userId, null)
  assert.deepEqual(state.getState().notifications, [])
  assert.equal(state.getState().unreadCount, 0)
})

test('account switch cannot display the previous account response', async () => {
  const { state, reads, listeners } = fixture()
  state.getState().subscribe('alice')
  state.getState().subscribe('bob')
  reads[1].resolve({ data: [row('bobs-notification', 'bob')], error: null })
  await flush()
  reads[0].resolve({ data: [row('alices-notification', 'alice')], error: null })
  listeners[0]({ new: row('old-channel', 'alice') })
  await flush()
  assert.equal(state.getState().userId, 'bob')
  assert.deepEqual(state.getState().notifications.map((n) => n.id), ['bobs-notification'])
})

test('a failed mark-read does not erase the unread indicator', async () => {
  const { state, reads, failUpdate } = fixture()
  state.getState().subscribe('alice')
  reads[0].resolve({ data: [row('n1', 'alice')], error: null })
  await flush()
  failUpdate()
  await state.getState().markRead('n1')
  assert.equal(state.getState().unreadCount, 1)
  assert.equal(state.getState().notifications[0].read, false)
})

test('an insert during initial fetch is retained once, without duplicate rows', async () => {
  const { state, reads, listeners } = fixture()
  state.getState().subscribe('alice')
  listeners[0]({ new: row('new', 'alice') })
  listeners[0]({ new: row('new', 'alice') })
  reads[0].resolve({ data: [row('old', 'alice')], error: null })
  await flush()
  assert.deepEqual(new Set(state.getState().notifications.map((n) => n.id)), new Set(['new', 'old']))
  assert.equal(state.getState().unreadCount, 2)
})
