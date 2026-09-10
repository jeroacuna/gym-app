import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

// Campanita de notificaciones que vive en el Navbar. Hace 3 cosas:
// 1. Dispara un toast de 10 segundos por cada anuncio nuevo (no
//    visto) que todavía no le mostramos en esta pestaña.
// 2. Si el socio no llega a verlo o lo cierra sin querer, el aviso
//    queda esperando en la campanita (con un contador de "no
//    leídos") para que lo pueda revisar cuando quiera.
// 3. Al abrir la campanita y tocar un aviso (o el toast mismo), se
//    marca como visto y deja de contar como pendiente.
export default function NotificationBell() {
  const [anuncios, setAnuncios] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const contenedorRef = useRef(null)
  // Guardamos qué ids ya disparamos como toast en ESTA carga de
  // página, para no repetir el mismo aviso cada vez que refrescamos
  // la lista (por ejemplo, después de marcar otro como visto).
  const yaNotificados = useRef(new Set())

  useEffect(() => {
    cargar()
  }, [])

  // Cerramos el dropdown si el socio hace click afuera.
  useEffect(() => {
    function alClickearAfuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', alClickearAfuera)
    return () => document.removeEventListener('mousedown', alClickearAfuera)
  }, [])

  function cargar() {
    fetch('/api/anuncios')
      .then((r) => r.json())
      .then((data) => {
        const lista = data.anuncios || []
        setAnuncios(lista)
        setCargando(false)
        dispararToastsNuevos(lista)
      })
  }

  function dispararToastsNuevos(lista) {
    lista
      .filter((a) => !a.visto && !yaNotificados.current.has(a.id))
      .forEach((a) => {
        yaNotificados.current.add(a.id)
        toast(
          (t) => (
            <div onClick={() => marcarVisto(a.id, t.id)} className="cursor-pointer">
              <strong className="block text-xs uppercase tracking-wide text-brand mb-0.5">
                📣 Anuncio nuevo
              </strong>
              <span className="text-sm text-ink">{a.mensaje}</span>
            </div>
          ),
          { duration: 10000 }
        )
      })
  }

  async function marcarVisto(anuncioId, toastId) {
    if (toastId) toast.dismiss(toastId)
    setAnuncios((prev) => prev.map((a) => (a.id === anuncioId ? { ...a, visto: true } : a)))
    await fetch('/api/anuncios/marcar-visto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anuncio_id: anuncioId }),
    })
  }

  async function marcarTodasVistas() {
    const pendientes = anuncios.filter((a) => !a.visto)
    setAnuncios((prev) => prev.map((a) => ({ ...a, visto: true })))
    await Promise.all(pendientes.map((a) => marcarVisto(a.id)))
  }

  const noLeidos = anuncios.filter((a) => !a.visto).length

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((prev) => !prev)}
        className="relative text-white/70 hover:text-white transition p-1.5"
        aria-label="Notificaciones"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {noLeidos > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-brand text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {noLeidos > 9 ? '9+' : noLeidos}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white text-ink rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-20">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <span className="font-display font-semibold text-sm uppercase tracking-wide">Notificaciones</span>
            {noLeidos > 0 && (
              <button onClick={marcarTodasVistas} className="text-xs text-brand font-semibold hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {cargando && <p className="text-sm text-concrete px-4 py-4">Cargando...</p>}
            {!cargando && anuncios.length === 0 && (
              <p className="text-sm text-concrete px-4 py-4">No hay notificaciones todavía.</p>
            )}
            {anuncios.map((a) => (
              <button
                key={a.id}
                onClick={() => marcarVisto(a.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition ${
                  a.visto ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!a.visto && <span className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0" />}
                  <div>
                    <p className="text-sm">{a.mensaje}</p>
                    <span className="text-[11px] font-mono text-gray-400">
                      {new Date(a.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}