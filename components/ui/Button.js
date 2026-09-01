export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const base = 'font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'

  const variantes = {
    primary: 'bg-ink text-white hover:bg-brand px-5 py-2.5',
    secondary: 'border border-gray-300 text-ink hover:border-brand hover:text-brand px-4 py-2 text-sm',
    ghost: 'text-concrete hover:text-brand px-3 py-1.5 text-sm',
    danger: 'border border-brand/30 text-brand hover:bg-brand-light px-3 py-1.5 text-sm',
  }

  return (
    <button className={`${base} ${variantes[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}