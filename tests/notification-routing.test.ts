import assert from 'node:assert/strict'
import test from 'node:test'
import { getNotificationPath } from '../lib/notificationRouting.ts'

const id = 'a1234567-1234-1234-1234-123456789abc'

test('sighting notifications open their missing report from either supported key', () => {
  assert.equal(getNotificationPath({ report_id: id, sighting_id: id }), `/missing/${id}`)
  assert.equal(getNotificationPath({ missing_report_id: id }), `/missing/${id}`)
})

test('specific monitoring session takes priority over its parent contract', () => {
  assert.equal(getNotificationPath({ contract_id: id, session_id: id }), `/monitoring/${id}`)
  assert.equal(getNotificationPath({ thread_id: id }), `/messages/${id}`)
  assert.equal(getNotificationPath({ broadcast_id: id }), '/(tabs)/profile')
})

test('notification metadata cannot supply an arbitrary route or non-UUID parameter', () => {
  for (const value of [null, [], 'https://example.com', {}, { url: 'https://example.com' },
    { report_id: '../admin' }, { alert_id: 12 }, { post_id: { id } }]) {
    assert.equal(getNotificationPath(value), null)
  }
})
