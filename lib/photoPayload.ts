const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Decode picker data without relying on browser Blob/File implementations on native. */
export function decodeBase64(base64: string): ArrayBuffer {
  const input = base64.replace(/\s/g, '')
  if (!input || input.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) {
    throw new Error('Invalid photo data')
  }
  const padding = input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0
  const bytes = new Uint8Array((input.length / 4) * 3 - padding)
  let output = 0
  for (let i = 0; i < input.length; i += 4) {
    const a = alphabet.indexOf(input[i])
    const b = alphabet.indexOf(input[i + 1])
    const c = input[i + 2] === '=' ? 0 : alphabet.indexOf(input[i + 2])
    const d = input[i + 3] === '=' ? 0 : alphabet.indexOf(input[i + 3])
    const value = (a << 18) | (b << 12) | (c << 6) | d
    if (output < bytes.length) bytes[output++] = (value >> 16) & 255
    if (output < bytes.length) bytes[output++] = (value >> 8) & 255
    if (output < bytes.length) bytes[output++] = value & 255
  }
  return bytes.buffer
}

export function photoPayload(base64: string) {
  const body = decodeBase64(base64)
  const bytes = new Uint8Array(body)
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte)

  // Cropping/conversion can change the format, so the original filename is unreliable.
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { body, contentType: 'image/png', extension: 'png' }
  }
  if (starts(0xff, 0xd8, 0xff)) return { body, contentType: 'image/jpeg', extension: 'jpg' }
  if (starts(0x47, 0x49, 0x46, 0x38)) return { body, contentType: 'image/gif', extension: 'gif' }
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return { body, contentType: 'image/webp', extension: 'webp' }
  }
  if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.slice(8, 12))
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) {
      return { body, contentType: 'image/heic', extension: 'heic' }
    }
    if (['mif1', 'msf1'].includes(brand)) return { body, contentType: 'image/heif', extension: 'heif' }
    if (['avif', 'avis'].includes(brand)) return { body, contentType: 'image/avif', extension: 'avif' }
  }
  throw new Error('Unsupported photo format')
}
