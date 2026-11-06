import { useId } from 'react'

// رسوم مجسّمة للميزات الرئيسية: كل رسم قائم على قاعدة رخامية مُعيّنة الشكل بإطار ذهبي.
// مرسومة باليد بـ SVG (بلا صور خارجية) لتعمل دون إنترنت وتبقى حادّة في كل الأحجام.

function Defs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}top`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fbf8f1" />
        <stop offset="1" stopColor="#ddd5c4" />
      </linearGradient>
      <linearGradient id={`${id}gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f3d58b" />
        <stop offset=".55" stopColor="#c9993f" />
        <stop offset="1" stopColor="#8e6522" />
      </linearGradient>
      <linearGradient id={`${id}green`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2f8f6f" />
        <stop offset="1" stopColor="#0f4a37" />
      </linearGradient>
      <linearGradient id={`${id}page`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf6" />
        <stop offset="1" stopColor="#ece2c9" />
      </linearGradient>
      <linearGradient id={`${id}wood`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#a5683a" />
        <stop offset="1" stopColor="#6e3f1d" />
      </linearGradient>
      <radialGradient id={`${id}shine`} cx=".35" cy=".3" r=".8">
        <stop offset="0" stopColor="#fff" stopOpacity=".55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

function Base({ id }) {
  return (
    <g>
      <ellipse cx="40" cy="74" rx="30" ry="5" fill="#000" opacity=".18" />
      <path d="M10 60 40 72v5L10 65z" fill="#c3baa6" />
      <path d="M40 72 70 60v5L40 77z" fill="#a89f8b" />
      <path d="M40 48 70 60 40 72 10 60z" fill={`url(#${id}top)`} />
      <path d="M40 51.5 63 60 40 68.5 17 60z" fill="none" stroke={`url(#${id}gold)`} strokeWidth="1.3" />
      <path d="M40 54.5 55 60 40 65.5 25 60z" fill="none" stroke="#c9993f" strokeOpacity=".35" strokeWidth=".8" />
    </g>
  )
}

const ART = {
  // مصحف مفتوح على كرسي (رحل)
  mushaf: (id) => (
    <g>
      <path d="M24 60 52 40M56 60 28 40" stroke={`url(#${id}wood)`} strokeWidth="4" strokeLinecap="round" />
      <path d="M15 41 40 47 65 41 63 21 40 26 17 21z" fill={`url(#${id}green)`} />
      <path d="M18 38.5 40 44V26.5C33 22 25 21 19.5 21.5z" fill={`url(#${id}page)`} />
      <path d="M62 38.5 40 44V26.5C47 22 55 21 60.5 21.5z" fill={`url(#${id}page)`} />
      <path d="M22 27c5-.6 10 .6 15 3M22 31c5-.6 10 .6 15 3M22 35c5-.6 10 .6 15 3M58 27c-5-.6-10 .6-15 3M58 31c-5-.6-10 .6-15 3M58 35c-5-.6-10 .6-15 3" stroke="#3b6f5b" strokeOpacity=".45" strokeWidth=".9" fill="none" />
      <path d="M40 26.5V44" stroke={`url(#${id}gold)`} strokeWidth="1.4" />
      <path d="M15 41 40 47 65 41" fill="none" stroke={`url(#${id}gold)`} strokeWidth="1.4" />
    </g>
  ),
  // لوح ذهبي عليه نون ساكنة
  ahkam: (id) => (
    <g>
      <path d="M22 56V18a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v38z" fill={`url(#${id}gold)`} />
      <path d="M25 55V19a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v36z" fill={`url(#${id}page)`} />
      <path d="M29 20h22M29 50h22" stroke="#c9993f" strokeOpacity=".6" strokeWidth="1" />
      <text x="40" y="45" textAnchor="middle" fontSize="27" fontFamily="'Amiri Quran','Amiri',serif" fill="#1f6f5c">نْ</text>
      <circle cx="51" cy="16" r="5" fill="#d64545" />
      <path d="M49 16l1.5 1.5L53.5 14.5" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  ),
  // رأس جانبي ومسار الهواء من الفم
  makharij: (id) => (
    <g>
      <path d="M47 13c-11 0-18 8-18 18 0 3 .8 5 1.5 6.5L26 43c-.6 1 0 2 1.2 2H30v4c0 2 1.6 3 3.5 3H38v6h17c1-4 4-8 4-16v-7c0-11-5-20-12-20z" fill="#e9c4a2" />
      <path d="M47 13c-11 0-18 8-18 18 0 3 .8 5 1.5 6.5L26 43c-.6 1 0 2 1.2 2H30v4c0 2 1.6 3 3.5 3H38v6h17c1-4 4-8 4-16v-7c0-11-5-20-12-20z" fill={`url(#${id}shine)`} />
      <path d="M47 13c7 0 12 7 12 16-3-4-8-5-12-4-2-5-6-7-12-6 3-4 7-6 12-6z" fill="#3a2c22" />
      <path d="M38 47c3 1.5 7 1.5 10-1M44 36c1-3 4-4 6-3.5" stroke="#b27a55" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M50 46c2-6 3-10 2-14" stroke="#d64545" strokeWidth="1.6" strokeDasharray="2 2" fill="none" />
      <circle cx="52" cy="31" r="2.3" fill="#d64545" />
      <path d="M22 40c-3 2-3 6 0 8M17 37c-5 4-5 10 0 14" stroke="#2f9aa0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="35" cy="28" r="1.4" fill="#3a2c22" />
    </g>
  ),
  // بطاقات حروف مروحية
  sifat: (id) => {
    const cards = [
      { r: -28, l: 'ط', c: '#583878' },
      { r: 28, l: 'ص', c: '#17636a' },
      { r: 0, l: 'ق', c: '#8e6522' },
    ]
    return (
      <g>
        {cards.map((k) => (
          <g key={k.l} transform={`translate(${Math.sign(k.r) * 4} 0) rotate(${k.r} 40 54)`}>
            <rect x="28" y="16" width="24" height="34" rx="4" fill={`url(#${id}page)`} stroke={k.c} strokeWidth="1.6" />
            <text x="40" y={k.r ? 30 : 40} textAnchor="middle" fontSize={k.r ? 12 : 18} fontFamily="'Amiri Quran','Amiri',serif" fill={k.c}>{k.l}</text>
          </g>
        ))}
        <path d="M60 14l1.2 3 3 1.2-3 1.2L60 22.4l-1.2-3-3-1.2 3-1.2z" fill={`url(#${id}gold)`} />
      </g>
    )
  },
  // سماعتا رأس
  listen: (id) => (
    <g>
      <path d="M22 44V36a18 18 0 0 1 36 0v8" stroke="#3a3f45" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M22 44V36a18 18 0 0 1 36 0v8" stroke="#fff" strokeOpacity=".25" strokeWidth="1.2" fill="none" />
      <rect x="15" y="38" width="12" height="18" rx="5" fill="#c0605a" />
      <rect x="53" y="38" width="12" height="18" rx="5" fill="#c0605a" />
      <rect x="15" y="38" width="12" height="18" rx="5" fill={`url(#${id}shine)`} />
      <rect x="53" y="38" width="12" height="18" rx="5" fill={`url(#${id}shine)`} />
      <path d="M36 41v6M40 38v12M44 41v6" stroke={`url(#${id}gold)`} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  // ميكروفون على حامل وموجات صوت
  tasmee: (id) => (
    <g>
      <path d="M40 46v10M33 57h14" stroke="#5b636b" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 32a10 10 0 0 0 20 0" stroke="#5b636b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="33" y="12" width="14" height="30" rx="7" fill={`url(#${id}green)`} />
      <rect x="33" y="12" width="14" height="30" rx="7" fill={`url(#${id}shine)`} />
      <path d="M35.5 20h9M35.5 24h9M35.5 28h9" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" />
      <path d="M57 22c3 3 3 9 0 12M62 18c5 5 5 15 0 20M23 22c-3 3-3 9 0 12M18 18c-5 5-5 15 0 20" stroke={`url(#${id}gold)`} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  ),
  // لوح اختبار بعلامات صح ونجمة
  quiz: (id) => (
    <g>
      <rect x="23" y="14" width="32" height="42" rx="4" fill={`url(#${id}wood)`} />
      <rect x="26" y="19" width="26" height="34" rx="2" fill={`url(#${id}page)`} />
      <rect x="33" y="11" width="12" height="6" rx="2" fill="#8a929a" />
      <path d="M29 26l2 2 3.5-3.5M29 34l2 2 3.5-3.5M29 42l2 2 3.5-3.5" stroke="#2f8f6f" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37 27h11M37 35h11M37 43h8" stroke="#9aa6a4" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M57 38l2.3 4.6 5 .7-3.6 3.5.9 5-4.6-2.4-4.6 2.4.9-5-3.6-3.5 5-.7z" fill={`url(#${id}gold)`} stroke="#8e6522" strokeWidth=".6" />
    </g>
  ),
  // يدان مرفوعتان بالدعاء وهلال
  adiya: (id) => (
    <g>
      <path d="M38 56c-6 0-11-4-12-10l-3-14c-.4-2 2.4-3 3.3-1.2L30 38V20a2.2 2.2 0 0 1 4.4 0v14l1-17a2.2 2.2 0 0 1 4.4.2L39 40z" fill="#e9c4a2" />
      <path d="M42 56c6 0 11-4 12-10l3-14c.4-2-2.4-3-3.3-1.2L50 38V20a2.2 2.2 0 0 0-4.4 0v14l-1-17a2.2 2.2 0 0 0-4.4.2L41 40z" fill="#e2b994" />
      <path d="M38 56c-6 0-11-4-12-10l-3-14 7 6 9 2zM42 56c6 0 11-4 12-10l3-14-7 6-9 2z" fill={`url(#${id}shine)`} />
      <path d="M33 37.5c1.5-.7 3-.7 4.5 0M42.5 37.5c1.5-.7 3-.7 4.5 0" stroke="#b27a55" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M47 8.5a6 6 0 1 0 6.5 7.6A4.6 4.6 0 1 1 47 8.5z" fill={`url(#${id}gold)`} />
      <path d="M30 12l.9 2.1 2.1.9-2.1.9L30 18l-.9-2.1L27 15l2.1-.9z" fill={`url(#${id}gold)`} />
    </g>
  ),
  // كتب مصفوفة بزخرفة ذهبية
  library: (id) => (
    <g>
      <rect x="17" y="22" width="10" height="34" rx="1.5" fill={`url(#${id}green)`} />
      <rect x="28" y="16" width="11" height="40" rx="1.5" fill="#7b2d33" />
      <rect x="40" y="19" width="9" height="37" rx="1.5" fill="#1f4f6e" />
      <g transform="rotate(14 56 54)">
        <rect x="50" y="20" width="10" height="35" rx="1.5" fill={`url(#${id}wood)`} />
        <path d="M50 26h10M50 49h10" stroke={`url(#${id}gold)`} strokeWidth="1.4" />
      </g>
      <path d="M17 27h10M17 51h10M28 21h11M28 51h11M40 24h9M40 51h9" stroke={`url(#${id}gold)`} strokeWidth="1.4" />
      <circle cx="33.5" cy="36" r="3" fill="none" stroke={`url(#${id}gold)`} strokeWidth="1.3" />
      <rect x="17" y="22" width="32" height="34" fill={`url(#${id}shine)`} opacity=".5" />
    </g>
  ),
  // ميزان ذهبي على كتاب
  masail: (id) => (
    <g>
      <path d="M22 54h36l-3-6H25z" fill={`url(#${id}green)`} />
      <path d="M25 48h30" stroke={`url(#${id}gold)`} strokeWidth="1.3" />
      <path d="M40 16v32M33 48h14" stroke={`url(#${id}gold)`} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 22h36" stroke={`url(#${id}gold)`} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="40" cy="14" r="2.6" fill={`url(#${id}gold)`} />
      <path d="M24 22l-6 13M24 22l6 13M56 22l-6 13M56 22l6 13" stroke="#8e6522" strokeWidth=".9" />
      <path d="M16.5 35h15a7.5 4 0 0 1-15 0zM48.5 35h15a7.5 4 0 0 1-15 0z" fill={`url(#${id}gold)`} />
    </g>
  ),
}

export default function TileArt({ name, className = '' }) {
  const id = useId().replace(/:/g, '')
  const art = ART[name]
  if (!art) return null
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true" focusable="false">
      <Defs id={id} />
      <Base id={id} />
      {art(id)}
    </svg>
  )
}
