import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">الصفحة غير موجودة</h1>
      <Link to="/" className="mt-4 inline-block rounded-lg bg-accent px-5 py-2 text-accent-ink">
        العودة إلى الرئيسية
      </Link>
    </div>
  )
}
