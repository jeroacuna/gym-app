export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6 ${className}`}>
      {children}
    </div>
  )
}