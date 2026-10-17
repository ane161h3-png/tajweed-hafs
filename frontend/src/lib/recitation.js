// مقارنة ما قرأه الطالب بنص الآية، كلمةً كلمة.
// يقارن الكلمات بعد التطبيع (بلا تشكيل، وبصيغتي الرسم والإملاء)، ويتسامح مع فروق الهمز والألف
// وحرف واحد في الكلمات الطويلة، لأن التعرّف الآلي يكتب بالإملاء الحديث.
import { normalize } from './arabic'
import { tokens } from './matching'

// صور الهمز والألف يكتبها التعرّف الآلي بأشكال مختلفة؛ تُتجاهل في المقارنة المرنة
const loose = (w) => w.replace(/[ءؤئا]/g, '')

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** هل الكلمة المسموعة هي الكلمة المتوقعة؟ */
export function sameWord(expected, heard) {
  if (!heard) return false
  const forms = [expected.a, expected.b]
  if (forms.includes(heard)) return true
  const lh = loose(heard)
  if (forms.some((f) => loose(f) === lh)) return true
  // حرف واحد مختلف في كلمة من أربعة أحرف فأكثر
  return forms.some((f) => f.length >= 4 && editDistance(f, heard) <= 1)
}

/** أطول تطابق متسلسل بين كلمات النص والكلمات المسموعة: لكل كلمة من النص هل قُرئت. */
function align(expected, heard) {
  const n = expected.length
  const m = heard.length
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = sameWord(expected[i], heard[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const ok = Array(n).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (sameWord(expected[i], heard[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) {
      ok[i] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return ok
}

/**
 * يقيّم القراءة. text: نص المقطع كما في المصحف، match: موضع كلمة الشاهد فيه، alternatives: بدائل ما سُمع.
 * يرجع { correct, score, words: [{text, start, end, ok, target}], heard }
 * الصحيح: قُرئت كلمات الشاهد كلها، و٨٥٪ على الأقل من كلمات المقطع.
 */
export function assessRecitation(text, match, alternatives) {
  const expected = tokens(text)
  let best = null
  for (const alt of alternatives.length ? alternatives : ['']) {
    const heard = normalize(alt).split(' ').filter(Boolean)
    const ok = align(expected, heard)
    const score = expected.length ? ok.filter(Boolean).length / expected.length : 0
    if (!best || score > best.score) best = { ok, score, heard: alt }
  }
  const words = expected.map((w, i) => ({
    text: w.text,
    start: w.start,
    end: w.end,
    ok: best.ok[i],
    target: !!match && w.start < match[1] && w.end > match[0],
  }))
  const targetOk = words.filter((w) => w.target).every((w) => w.ok)
  return { correct: targetOk && best.score >= 0.85, score: best.score, words, heard: best.heard }
}
