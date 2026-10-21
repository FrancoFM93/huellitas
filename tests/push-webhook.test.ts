import assert from 'node:assert/strict'
import test from 'node:test'
import { createPushHandler } from '../supabase/functions/send-push/handler.ts'

const notificationId = 'a1234567-1234-1234-1234-123456789abc'
const userId = 'b1234567-1234-1234-1234-123456789abc'
const secret = 'test-webhook-secret-never-use-in-production'
const event = { type: 'INSERT', table: 'notifications', schema: 'public', record: { id: notificationId } }

function fixture() {
  const requests: Record<string, unknown>[] = []
  const lookups: string[] = []
  const deps = {
    webhookSecret: secret as string | undefined,
    getNotification: async (id: string) => {
      lookups.push(id)
      return { data: { id: notificationId, user_id: userId, title: 'Database title', body: 'Database body', metadata: { report_id: notificationId } }, error: null }
    },
    getPushToken: async (id: string) => {
      lookups.push(id)
      return { data: { push_token: 'ExponentPushToken[test]' }, error: null }
    },
    send: async (message: Record<string, unknown>) => {
      requests.push(message)
      return Response.json({ data: { status: 'ok', id: 'expo-ticket' } })
    },
  }
  return { deps, requests, lookups }
}

const request = (body: unknown, header: string | null = secret) => new Request('https://local.test/send-push', {
  method: 'POST', headers: header ? { 'x-webhook-secret': header } : {}, body: JSON.stringify(body),
})

test('unauthenticated or user-JWT-only requests cannot read data or send pushes', async () => {
  const { deps, requests, lookups } = fixture()
  const handler = createPushHandler(deps)
  for (const header of [null, 'incorrect-secret']) {
    assert.equal((await handler(request(event, header))).status, 401)
  }
  assert.deepEqual(lookups, [])
  assert.deepEqual(requests, [])
})

test('missing deployment secret fails closed and malformed webhook events are rejected', async () => {
  const { deps, requests } = fixture()
  assert.equal((await createPushHandler({ ...deps, webhookSecret: undefined })(request(event))).status, 503)
  for (const payload of [null, [], {}, { ...event, type: 'UPDATE' }, { ...event, table: 'profiles' },
    { ...event, record: { id: '../other' } }]) {
    assert.equal((await createPushHandler(deps)(request(payload))).status, 400)
  }
  assert.deepEqual(requests, [])
})

test('webhook body cannot override database recipient, text or routing metadata', async () => {
  const { deps, requests, lookups } = fixture()
  const response = await createPushHandler(deps)(request({
    ...event, record: { id: notificationId, user_id: 'attacker', title: 'Forged', body: 'Forged', metadata: { url: 'evil' } },
  }))
  assert.equal(response.status, 202)
  assert.deepEqual(lookups, [notificationId, userId])
  assert.deepEqual(requests[0], {
    to: 'ExponentPushToken[test]', title: 'Database title', body: 'Database body',
    data: { report_id: notificationId }, sound: 'default', channelId: 'default',
  })
})

test('Expo HTTP errors and rejected tickets are not reported as successful sends', async () => {
  const { deps } = fixture()
  for (const send of [
    async () => new Response('temporarily unavailable', { status: 503 }),
    async () => Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }),
  ]) {
    assert.equal((await createPushHandler({ ...deps, send })(request(event))).status, 502)
  }
})
