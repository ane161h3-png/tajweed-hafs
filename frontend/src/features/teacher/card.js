// باركود الحضور (QR): يحمل معرّف الطالب واسمه وحلقته، فيسجّل المعلّم حضوره بمسحه.
// المعرّف نفسه معرّف تقرير الطالب، فيُربط الحضور بتقدّمه عندما يرسل تقريره.

const TYPE = 'tjw-s'

export function encodeCard({ id, name, group }) {
  return JSON.stringify({ t: TYPE, i: id, n: name.trim(), g: (group ?? '').trim() })
}

/** يرجع { id, name, group } أو null إن لم يكن باركود حضور من البرنامج. */
export function parseCard(text) {
  try {
    const c = JSON.parse(text)
    if (c?.t !== TYPE || typeof c.i !== 'string' || !c.i || c.i.length > 40 || typeof c.n !== 'string' || !c.n.trim()) return null
    return { id: c.i, name: c.n.trim().slice(0, 60), group: typeof c.g === 'string' ? c.g.trim().slice(0, 60) : '' }
  } catch {
    return null
  }
}
