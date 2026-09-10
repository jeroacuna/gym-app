import Link from 'next/link'
import { useEffect, useState } from 'react'

// Menú lateral tipo "hamburguesa" (las tres rayitas de siempre) con
// accesos directos. Sirve tanto para navegar entre pantallas (rutas
// reales, ej: "/admin/socios") como para saltar a una sección
// puntual dentro de la MISMA página (anchors tipo "#rutina"), que es
// como lo usamos en el dashboard del socio: es una sola pantalla
// larga con todo adentro, así que en vez de navegar hacemos scroll.
export default function HamburgerMenu({ items = [] }) {
  const [abierto, setAbierto] = useState(false)

  // Bloqueamos el scroll de fondo mientras el menú está abierto.
  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [abierto])

  function irA(href) {
    setAbierto(false)
    if (href.startsWith('#')) {
      // Pequeño delay para que el panel termine de cerrarse antes
      // de scrollear, si no queda un salto brusco.
      setTimeout(() => {
        const el = document.querySelector(href)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }

  if (items.length === 0) return null

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="text-white/70 hover:text-white transition p-1.5"
        aria-label="Menú de accesos directos"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-40 flex">
          {/* Fondo oscuro clickeable para cerrar */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />

          {/* Panel lateral */}
          <div className="relative bg-ink text-white w-72 max-w-[80vw] h-full shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
              <span className="font-display font-semibold text-sm uppercase tracking-widest text-brand">
                Accesos directos
              </span>
              <button onClick={() => setAbierto(false)} className="text-white/60 hover:text-white text-xl leading-none">
                ×
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
              {items.map((item) =>
                item.href.startsWith('#') ? (
                  <button
                    key={item.href}
                    onClick={() => irA(item.href)}
                    className="w-full text-left flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition"
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAbierto(false)}
                    className="w-full text-left flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition"
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}