// محرّك صفحات الدفتر: كل كتلة (عنوان، فقرة، مثال، جدول، بطاقة…) تُقاس ثم تُوضع في صفحة ذات عدد ثابت من السطور،
// فيُعرف رقم كل صفحة قبل الطباعة ويمكن كتابة أرقام الصفحات في الفهرس، وتقع النصوص على سطور الدفتر تماماً.

export const LINES_PER_PAGE = 43 // سطور المحتوى في الصفحة الواحدة (كل سطر ٦ مم)

/** عدد السطور التي تشغلها كتلة طولها px (لا تقل عن سطر). */
export const linesFor = (px, unitPx) => Math.max(1, Math.ceil((px - 0.5) / unitPx))

/**
 * يوزّع الكتل على الصفحات بالترتيب.
 * كل كتلة: { h: عدد السطور، keepNext: تبقى مع التي بعدها (العناوين)، breakBefore: تبدأ صفحة جديدة }
 * يرجع مصفوفة صفحات، كل صفحة مصفوفة فهارس كتل. الكتلة الأطول من الصفحة تُقصّ إلى طول الصفحة.
 */
export function paginate(blocks, capacity = LINES_PER_PAGE) {
  const pages = [[]]
  let used = 0
  const h = (i) => Math.min(blocks[i].h, capacity)
  const fresh = () => {
    pages.push([])
    used = 0
  }
  const put = (i) => {
    pages.at(-1).push(i)
    used += h(i)
  }
  let i = 0
  while (i < blocks.length) {
    // سلسلة: كتل keepNext ثم الكتلة التي تليها
    let j = i
    let total = h(i)
    while (blocks[j].keepNext && j + 1 < blocks.length) {
      j++
      total += h(j)
    }
    const cur = pages.at(-1)
    if (cur.length && (blocks[i].breakBefore || used + total > capacity)) fresh()
    if (total <= capacity) {
      for (let k = i; k <= j; k++) put(k)
    } else {
      // سلسلة أطول من صفحة (نادر): تُوضع كتلةً كتلة
      for (let k = i; k <= j; k++) {
        if (pages.at(-1).length && used + h(k) > capacity) fresh()
        put(k)
      }
    }
    i = j + 1
  }
  return pages.filter((p) => p.length)
}
