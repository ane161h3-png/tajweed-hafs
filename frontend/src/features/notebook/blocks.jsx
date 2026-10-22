// كتل الدفتر: كل عنصر { id, node, measureNode?, keepNext?, breakBefore?, part, toc? }.
// measureNode: بديل خفيف للقياس (بدل الرسم المتحرك) بالحجم نفسه.
import { arabicNumber } from '../../lib/api'
import HeadDiagram from '../makharij/HeadDiagram'
import { articulation } from '../makharij/articulation'

const num = arabicNumber
const PART_WORD = ['الأول', 'الثاني', 'الثالث']

export const SECTION_TITLES = {
  'noon-sakinah': 'أحكام النون الساكنة والتنوين',
  'meem-sakinah': 'أحكام الميم الساكنة',
  ghunnah: 'النون والميم المشددتان ومراتب الغنة',
  idgham: 'الإدغام العام',
  mudood: 'المدود',
  qalqalah: 'القلقلة',
  lamat: 'اللامات',
  tafkheem: 'التفخيم والترقيق',
  ra: 'أحكام الراء',
  hamzah: 'همزة الوصل والقطع',
  'ha-kinayah': 'هاء الكناية',
  waqf: 'الوقف والابتداء',
  sakt: 'السكت',
  'hafs-special': 'المواضع الخاصة برواية حفص',
}

const PARTS = [
  { title: 'الأحكام', blurb: 'أحكام التجويد برواية حفص عن عاصم من طريق الشاطبية: التعريف لغةً واصطلاحاً، وطريقة الأداء، وأمثلة من القرآن الكريم.' },
  { title: 'المخارج', blurb: 'مخارج الحروف العربية: الجوف والحلق واللسان والشفتان والخيشوم، ومخرج كل حرف في رسم جانبي لأعضاء النطق.' },
  { title: 'الصفات', blurb: 'صفات الحروف: المتضادة وغير المتضادة، وجدول صفات كل حرف، والفرق بين الحروف المتشابهة.' },
]

// حجم رسم المخارج في البطاقات (مم): النسبة ٥٢٥:٤٣٠ من الرسم الأصلي
const DRAW_W = 62
const DRAW_H = 51

function Diagram({ makhraj, art }) {
  return (
    <div className="nb-draw">
      <HeadDiagram makhraj={makhraj} art={art} phase="contact" labels={false} />
    </div>
  )
}
const DrawSpace = () => <div className="nb-draw" style={{ width: `${DRAW_W}mm`, height: `${DRAW_H}mm` }} />

const Verses = ({ verses }) =>
  verses?.length ? (
    <div className="nb-verses">
      <div className="nb-src">{verses[0].source || 'نظم'}</div>
      {verses.map((v, i) => (
        <div key={i} className="nb-bayt font-quran">
          <span>{v.first}</span>
          <span>{v.second}</span>
        </div>
      ))}
    </div>
  ) : null

function Table({ t }) {
  return (
    <table className="nb-table">
      {t.caption && <caption>{t.caption}</caption>}
      <thead>
        <tr>{t.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {t.rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

function Example({ e }) {
  const t = e.ayah_text
  const m = e.match
  const ok = t && m && m[0] >= 0 && m[0] < m[1] && m[1] <= t.length
  return (
    <div className="nb-ex">
      {t ? (
        <div className="nb-ayah font-quran">
          {ok ? (
            <>
              {t.slice(0, m[0])}
              <mark>{t.slice(m[0], m[1])}</mark>
              {t.slice(m[1])}
            </>
          ) : (
            t
          )}
        </div>
      ) : (
        <div className="nb-ayah font-quran">{e.word}</div>
      )}
      <div className="nb-meta">
        {e.surah_name ? `سورة ${e.surah_name}، الآية ${num(e.ayah)}` : `الآية ${num(e.ayah)}`}
        {e.note ? ` — ${e.note}` : ''}
      </div>
    </div>
  )
}

/**
 * يبني كتل الدفتر كلها.
 * data: { lessons: [درس كامل], letters: محتوى letters.json، edited: Set معرّفات الدروس التي عدّلها المستخدم أو أضافها،
 *         notes: { ahkam, makharij, sifat }، drawings: bool }
 */
export function buildBlocks({ lessons, letters: c, edited, notes, drawings }) {
  const blocks = []
  const add = (id, node, opts = {}) => blocks.push({ id, node, ...opts })
  let part = ''

  const partCover = (i) => {
    part = PARTS[i].title
    add(
      `part-${i}`,
      <div className="nb-partcover">
        <div className="nb-orn" />
        <div className="nb-partno">الباب {PART_WORD[i]}</div>
        <h2>{PARTS[i].title}</h2>
        <p>{PARTS[i].blurb}</p>
        <div className="nb-orn" />
      </div>,
      { breakBefore: true, full: true, part, toc: { level: 0, title: `الباب ${PART_WORD[i]}: ${PARTS[i].title}` } },
    )
  }
  const chapter = (id, no, title) =>
    add(
      id,
      <h2 className="nb-chapter">
        <span className="nb-no">{num(no)}</span>
        {title}
      </h2>,
      { breakBefore: true, keepNext: true, part, toc: { level: 1, no: `${num(no)}`, title } },
    )
  const notesPart = (i, key) => {
    const text = (notes?.[key] ?? '').trim()
    add(
      `notes-${i}`,
      <h2 className="nb-chapter">
        <span className="nb-no">✎</span>
        ملاحظاتي على {PARTS[i].title}
      </h2>,
      { breakBefore: true, keepNext: true, part, toc: { level: 1, no: '✎', title: `ملاحظاتي على ${PARTS[i].title}` } },
    )
    if (text) text.split(/\n+/).forEach((p, k) => add(`notes-${i}-${k}`, <p className="nb-note">{p}</p>, { part }))
    add(`notes-${i}-space`, <div style={{ height: '1px' }} />, { part, fill: 30 })
  }

  /* ———— الباب الأول: الأحكام ———— */
  partCover(0)
  const bySection = new Map()
  for (const l of lessons) {
    if (!bySection.has(l.section)) bySection.set(l.section, [])
    bySection.get(l.section).push(l)
  }
  const order = [...Object.keys(SECTION_TITLES), ...[...bySection.keys()].filter((s) => !(s in SECTION_TITLES))]
  let ch = 0
  for (const sid of order) {
    const list = (bySection.get(sid) ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    if (!list.length) continue
    ch += 1
    chapter(`ch-${sid}`, ch, SECTION_TITLES[sid] ?? sid)
    list.forEach((l, li) => {
      const mine = edited?.has(l.id)
      add(
        `lesson-${l.id}`,
        <h3 className="nb-lesson">
          <span className="nb-no">{num(ch)}-{num(li + 1)}</span>
          {l.title}
          {mine && <span className="nb-mine">✎ من تعديلك</span>}
        </h3>,
        { keepNext: true, part, toc: { level: 2, no: `${num(ch)}-${num(li + 1)}`, title: l.title, mine } },
      )
      for (const [label, key] of [['لغةً', 'lugha'], ['اصطلاحاً', 'istilah'], ['حروفه', 'letters'], ['طريقة أدائه', 'method']]) {
        if (l[key]) add(`${l.id}-${key}`, <p className="nb-def"><b>{label}:</b> {l[key]}</p>, { part })
      }
      if (l.table) add(`${l.id}-table`, <Table t={l.table} />, { part })
      if (l.exceptions) add(`${l.id}-exc`, <p className="nb-caveat"><b>تنبيه:</b> {l.exceptions}</p>, { part })
      if (l.notes) add(`${l.id}-notes`, <p className="nb-caveat"><b>ملاحظة:</b> {l.notes}</p>, { part })
      if (l.examples?.length) {
        add(`${l.id}-exh`, <h4 className="nb-exh">أمثلة من القرآن الكريم</h4>, { keepNext: true, part })
        l.examples.forEach((e, k) => add(`${l.id}-ex${k}`, <Example e={e} />, { part }))
      }
      if (l.verses?.length) add(`${l.id}-verses`, <Verses verses={l.verses} />, { part })
    })
  }
  notesPart(0, 'ahkam')

  /* ———— الباب الثاني: المخارج ———— */
  partCover(1)
  const letterById = Object.fromEntries(c.letters.map((l) => [l.id, l]))
  const makhrajById = Object.fromEntries(c.makharij.map((m) => [m.id, m]))

  chapter('mk-general', 1, 'المخارج العامة الخمسة')
  for (const g of c.general) {
    const organs = [...new Set(c.makharij.filter((m) => m.general === g.id).flatMap((m) => m.organs))]
    const mk = { id: `group-${g.id}`, name: g.name, organs }
    const body = (draw) => (
      <div className="nb-card nb-cardd">
        {draw}
        <div>
          <h4>{g.name} <span className="nb-tag">{num(g.count)} {g.count === 1 ? 'مخرج' : 'مخارج'}</span></h4>
          <p>{g.desc}</p>
        </div>
      </div>
    )
    add(`mkg-${g.id}`, body(drawings ? <Diagram makhraj={mk} art={null} /> : <div />), {
      part,
      measureNode: drawings ? body(<DrawSpace />) : undefined,
      toc: { level: 2, title: g.name },
    })
  }
  add('mk-verses', <Verses verses={c.makharij_verses} />, { part })

  chapter('mk-specific', 2, 'المخارج الخاصة السبعة عشر')
  for (const m of [...c.makharij].sort((a, b) => a.order - b.order)) {
    const first = letterById[m.letter_ids[0]]
    const chars = m.letter_ids.map((i) => letterById[i]?.char).filter(Boolean).join('  ') || m.letters
    const gen = c.general.find((g) => g.id === m.general)
    const body = (draw) => (
      <div className="nb-card nb-cardd">
        {draw}
        <div>
          <h4>
            <span className="nb-no">{num(m.order)}</span>
            {m.name} <span className="nb-tag">{gen?.name}</span>
          </h4>
          <div className="nb-chars font-quran">{chars}</div>
          <p>{m.desc}</p>
        </div>
      </div>
    )
    add(`mks-${m.id}`, body(drawings ? <Diagram makhraj={m} art={articulation(first)} /> : <div />), {
      part,
      measureNode: drawings ? body(<DrawSpace />) : undefined,
      toc: { level: 2, no: num(m.order), title: m.name },
    })
  }

  chapter('mk-letters', 3, 'الحروف واحداً واحداً')
  const sifaName = {}
  for (const g of c.opposite) for (const it of g.items) sifaName[it.id] = it.name
  for (const it of c.non_opposite) sifaName[it.id] = it.name
  for (const l of c.letters) {
    const m = makhrajById[l.makhraj]
    const body = (draw) => (
      <div className="nb-card nb-cardd nb-letter">
        {draw}
        <div className="nb-ltxt">
          <div className="nb-lhead">
            <span className="nb-big font-quran">{l.char}</span>
            <div>
              <h4>{l.name}</h4>
              <span className="nb-tag">{l.laqab}</span> <span className="nb-tag">{l.level}</span>
            </div>
          </div>
          {m && <p><b>المخرج:</b> {m.name}</p>}
          {l.pronounce && <p><b>للنطق به:</b> <span className="font-quran nb-pron">{l.pronounce}</span></p>}
          <p><b>صفاته:</b> {[...l.sifat, ...l.extra].map((s) => sifaName[s]).filter(Boolean).join('، ')}</p>
          {l.mistakes && <p><b>الأخطاء الشائعة:</b> {l.mistakes}</p>}
        </div>
      </div>
    )
    add(`mkl-${l.id}`, body(drawings ? <Diagram makhraj={m} art={articulation(l)} /> : <div />), {
      part,
      measureNode: drawings ? body(<DrawSpace />) : undefined,
      toc: { level: 2, title: `${l.char}  ${l.name}` },
    })
  }

  chapter('mk-alqab', 4, 'ألقاب الحروف وأسماء الأسنان')
  add(
    'mk-alqab-t',
    <table className="nb-table">
      <caption>ألقاب الحروف</caption>
      <thead><tr><th>اللقب</th><th>حروفه</th><th>سبب التسمية</th></tr></thead>
      <tbody>
        {c.alqab.map((a) => (
          <tr key={a.name}><td>{a.name}</td><td className="font-quran nb-chars">{[...a.letters].join('  ')}</td><td className="nb-start">{a.why}</td></tr>
        ))}
      </tbody>
    </table>,
    { part },
  )
  add(
    'mk-teeth-t',
    <table className="nb-table">
      <caption>أسماء الأسنان</caption>
      <thead><tr><th>السن</th><th>عددها</th><th>وصفها</th></tr></thead>
      <tbody>
        {c.teeth.map((t) => (
          <tr key={t.id}><td>{t.name}</td><td>{num(t.count)}</td><td className="nb-start">{t.desc}</td></tr>
        ))}
      </tbody>
    </table>,
    { part },
  )
  notesPart(1, 'makharij')

  /* ———— الباب الثالث: الصفات ———— */
  partCover(2)
  chapter('sf-opposite', 1, 'الصفات المتضادة')
  const sifa = (it) => (
    <div className="nb-card">
      <h4>
        {it.name}{' '}
        {it.letters ? <span className="font-quran nb-chars">{[...it.letters].join('  ')}</span> : <span className="nb-tag">باقي الحروف</span>}
        {it.code && <span className="font-quran nb-code"> {it.code}</span>}
      </h4>
      <p><b>لغةً:</b> {it.lugha} <b>اصطلاحاً:</b> {it.istilah}</p>
    </div>
  )
  for (const g of c.opposite) {
    add(`sf-${g.id}-h`, <h3 className="nb-lesson nb-sub">{g.name}</h3>, { keepNext: true, part })
    g.items.forEach((it) => add(`sf-${it.id}`, sifa(it), { part }))
  }
  chapter('sf-non', 2, 'الصفات غير المتضادة')
  c.non_opposite.forEach((it) => add(`sf-${it.id}`, sifa(it), { part }))
  add('sf-verses', <Verses verses={c.sifat_verses} />, { part })

  chapter('sf-matrix', 3, 'جدول صفات الحروف')
  const cols = ['jahr', 'hams', 'shidda', 'tawassut', 'rikhwa', 'istila', 'istifal', 'itbaq', 'infitah', 'idhlaq', 'ismat'].filter((x) => sifaName[x])
  add(
    'sf-matrix-t',
    <table className="nb-table nb-matrix">
      <thead>
        <tr>
          <th>الحرف</th>
          {cols.map((x) => <th key={x}>{sifaName[x]}</th>)}
          <th>صفات أخرى</th>
        </tr>
      </thead>
      <tbody>
        {c.letters.map((l) => (
          <tr key={l.id}>
            <td className="font-quran nb-mchar">{l.char}</td>
            {cols.map((x) => <td key={x} className="nb-dot">{l.sifat.includes(x) ? '●' : ''}</td>)}
            <td className="nb-small">{l.extra.map((s) => sifaName[s]).filter(Boolean).join('، ')}</td>
          </tr>
        ))}
      </tbody>
    </table>,
    { part },
  )
  chapter('sf-compare', 4, 'الفرق بين الحروف المتشابهة')
  for (const k of c.comparisons) {
    add(
      `sf-cmp-${k.id}`,
      <div className="nb-card">
        <h4 className="font-quran nb-chars">{k.letters.map((i) => letterById[i]?.char).filter(Boolean).join('  ')}</h4>
        <p>{k.note}</p>
      </div>,
      { part },
    )
  }
  notesPart(2, 'sifat')
  return blocks
}
