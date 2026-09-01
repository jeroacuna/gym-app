export default function Badge({ children, tone = 'neutral' }) {
  const tonos = {
    success: 'bg-green-100 text-green-700',
    danger: 'bg-brand-light text-brand-dark',
    neutral: 'bg-gray-100 text-gray-500',
  }

  return (
    <span className={`inline-block text-[11px] font-mono font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${tonos[tone]}`}>
      {children}
    </span>
  )
}