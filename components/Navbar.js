import Link from 'next/link'
import { useRouter } from 'next/router'
import Logo from './Logo'
import { NOMBRE_GIMNASIO } from '../lib/config'

export default function Navbar({ links = [] }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="bg-ink text-white sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo className="w-8 h-4 text-brand" />
          <span className="font-display font-semibold tracking-wide uppercase text-sm sm:text-base">
            {NOMBRE_GIMNASIO}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-semibold uppercase tracking-wide border border-white/20 rounded-lg px-3 py-1.5 hover:border-brand hover:text-brand transition"
        >
          Salir
        </button>
      </div>

      {links.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-0 flex gap-1 flex-wrap overflow-x-auto">
          {links.map((l) => {
            const activo = router.pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-xs sm:text-sm font-semibold uppercase tracking-wide px-3 py-2.5 border-b-2 transition whitespace-nowrap ${
                  activo
                    ? 'border-brand text-white'
                    : 'border-transparent text-white/50 hover:text-white hover:border-white/30'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}