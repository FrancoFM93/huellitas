import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeBase64, photoPayload } from '../lib/photoPayload.ts'

test('base64 preserves binary bytes, padding and line breaks without a Blob', () => {
  for (const bytes of [[0xff], [0xff, 0x00], [0xff, 0x00, 0x81], [0, 1, 2, 3, 254, 255]]) {
    const encoded = Buffer.from(bytes).toString('base64')
    assert.deepEqual([...new Uint8Array(decodeBase64(encoded + '\n'))], bytes)
  }
})

test('photo content type and extension follow uploaded bytes after picker conversion', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')
  assert.equal(photoPayload(png).contentType, 'image/png')
  assert.equal(photoPayload(png).extension, 'png')
  assert.equal(photoPayload(jpg).contentType, 'image/jpeg')
  assert.equal(photoPayload(jpg).extension, 'jpg')
})

test('missing, malformed or non-image picker data is rejected', () => {
  for (const invalid of ['', '=', 'aaa', 'aa=a', '!!!!', 'YWJj===']) {
    assert.throws(() => decodeBase64(invalid))
  }
  assert.throws(() => photoPayload(Buffer.from('not an image').toString('base64')))
})
