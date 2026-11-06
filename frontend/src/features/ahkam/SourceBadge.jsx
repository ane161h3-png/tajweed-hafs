/** وسم مصدر الدرس: من دفتر الطالب، أو إضافة من البرنامج ليست في الدفتر. */
export function SourceBadge({ source, compact = false }) {
  if (source === 'notebook') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
        title="هذا الدرس منقول من دفتر الطالب"
      >
        <span aria-hidden="true">📒</span>
        {compact ? 'الدفتر' : 'من دفتر الطالب'}
      </span>
    )
  }
  if (source === 'app') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--pen-red)] px-2 py-0.5 text-xs font-medium text-[var(--pen-red)]"
        title="هذا الدرس كان في البرنامج سابقاً ولم يرد في دفتر الطالب"
      >
        {compact ? 'ليس في الدفتر' : 'إضافة من البرنامج · لم يرد في دفتر الطالب'}
      </span>
    )
  }
  return null
}
