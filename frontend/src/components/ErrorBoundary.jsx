import { Component } from 'react'

/**
 * شبكة أمان: أي خطأ غير متوقع في صفحة يُعرض له إشعار مفهوم بدل شاشة بيضاء،
 * مع أزرار للعودة إلى الرئيسية أو إعادة التحميل. يُعاد ضبطه عند تغيّر الصفحة (resetKey).
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  componentDidCatch(error, info) {
    console.error('خطأ في الواجهة:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto my-10 max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="mb-1 text-lg font-bold">حدث خطأ غير متوقع</p>
        <p className="mb-4 text-sm text-muted">لم تتأثر بياناتك. جرّب إعادة التحميل أو العودة إلى الصفحة الرئيسية.</p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-accent px-4 py-2 font-medium text-accent-ink">
            إعادة التحميل
          </button>
          <a href={import.meta.env.BASE_URL} className="rounded-xl border border-line px-4 py-2">
            الرئيسية
          </a>
        </div>
        {import.meta.env.DEV && <pre dir="ltr" className="mt-4 overflow-auto text-start text-xs text-[var(--pen-red)]">{String(this.state.error?.stack ?? this.state.error)}</pre>}
      </div>
    )
  }
}
