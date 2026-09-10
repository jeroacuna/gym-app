import NotificationBell from './NotificationBell'
import HamburgerMenu from './HamburgerMenu'
import Logo from './Logo'
import { NOMBRE_GIMNASIO } from '../lib/config'

// "links" = navegación real de páginas del admin (ahora solo vive
// adentro del menú hamburguesa, ya no como pestañas a la vista).
// "accesos" = atajos por ancla dentro de la MISMA página (dashboard
// del socio, que no tiene páginas separadas).
//
// Usamos "links.length > 0" como señal de "esta es una pantalla de
// admin" (hoy es así en toda la app) para decidir dos cosas: qué le
// mostramos al hamburguesa, y si corresponde mostrar la campanita de
// anuncios (el admin no la necesita — los anuncios son un mensaje
// para los socios, no para él).
export default function Navbar({ links = [], accesos = [] }) {
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const esAdmin = links.length > 0
  const itemsMenu = esAdmin ? links : accesos

  return (
    <div className="bg-ink text-white sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HamburgerMenu items={itemsMenu} />
          <div className="flex items-center gap-2.5">
            <Logo className="w-8 h-8" />
            <span className="font-display font-semibold tracking-wide uppercase text-sm sm:text-base">
              {NOMBRE_GIMNASIO}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!esAdmin && <NotificationBell />}
          <button
            onClick={handleLogout}
            className="text-xs font-semibold uppercase tracking-wide border border-white/20 rounded-lg px-3 py-1.5 hover:border-brand hover:text-brand transition"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}