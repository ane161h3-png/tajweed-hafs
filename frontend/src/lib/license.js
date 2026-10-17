// أكواد تفعيل الاشتراك: يُصدرها صاحب البرنامج بمفتاحه الخاص (scripts/make_license.py)،
// ويتحقق منها البرنامج بالمفتاح العام دون خادم ولا إنترنت.
import { verifyAsync } from '@noble/ed25519'

export const LICENSE_PUBLIC_KEY = 'Qlfs5nRs-9kAoSjI6mU_BhUHkOmBQ0WDErKLO9keQrw'

export function fromBase64Url(s) {
  let b = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b.length % 4) b += '='
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
}

const today = (now) => now.toISOString().slice(0, 10)

/**
 * يتحقق من كود التفعيل. يرجع { ok, until, name, id } أو { ok: false, reason }
 * reason: format | signature | expired
 */
export async function verifyLicense(code, now = new Date()) {
  const m = /^TJW-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(code ?? '').replace(/\s+/g, ''))
  if (!m) return { ok: false, reason: 'format' }
  let payload
  try {
    const bytes = fromBase64Url(m[1])
    const valid = await verifyAsync(fromBase64Url(m[2]), bytes, fromBase64Url(LICENSE_PUBLIC_KEY))
    if (!valid) return { ok: false, reason: 'signature' }
    payload = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { ok: false, reason: 'signature' }
  }
  if (payload.p !== 'teacher') return { ok: false, reason: 'signature' }
  if (payload.e < today(now)) return { ok: false, reason: 'expired', until: payload.e }
  return { ok: true, until: payload.e, name: payload.n ?? '', id: payload.i }
}
