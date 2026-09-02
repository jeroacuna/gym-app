import { useEffect, useState } from 'react'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import Navbar from '../../components/Navbar'
import { ADMIN_NAV_LINKS } from '../../lib/adminNav'

export async function getServerSideProps({ req, res }) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  if (session.usuario.rol !== 'admin') {
    return { redirect: { destination: '/dashboard', permanent: false } }
  }
  return { props: { usuario: session.usuario } }
}

export default function AdminAnuncios() {
  const [anuncios, setAnuncios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensajeNuevo, setMensajeNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  function cargar() {
    setCargando(true)
    fetch('/api/admin/anuncios')
      .then((r) => r.json())
      .then((data) => {
        setAnuncios(data.anuncios || [])
        setCargando(false)
      })
  }

  async function publicar(e) {
    e.preventDefault()
    if (!mensajeNuevo.trim()) return
    setGuardando(true)
    await fetch('/api/admin/anuncios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: mensajeNuevo }),
    })
    setGuardando(false)
    setMensajeNuevo('')
    cargar()
  }

  async function toggleActivo(anuncio) {
    setAnuncios((prev) => prev.map((a) => (a.id === anuncio.id ? { ...a, activo: !a.activo } : a)))
    await fetch('/api/admin/anuncios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: anuncio.id, activo: !anuncio.activo }),
    })
  }

  async function borrar(anuncio) {
    if (!window.confirm('¿Borrar este anuncio definitivamente?')) return
    setAnuncios((prev) => prev.filter((a) => a.id !== anuncio.id))
    await fetch(`/api/admin/anuncios?id=${anuncio.id}`, { method: 'DELETE' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">Anuncios</h1>
        <p className="text-sm text-gray-500 mb-6">
          Lo que publiques acá aparece arriba del dashboard de TODOS los socios mientras esté activo.
        </p>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Publicar anuncio nuevo</h2>
          <form onSubmit={publicar} className="flex flex-col gap-3">
            <textarea
              value={mensajeNuevo}
              onChange={(e) => setMensajeNuevo(e.target.value)}
              placeholder="Ej: El lunes 8 el gimnasio permanece cerrado por feriado"
              rows={3}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
            <button
              type="submit"
              disabled={guardando || !mensajeNuevo.trim()}
              className="bg-black text-white rounded-lg py-2.5 font-medium hover:bg-brand transition disabled:opacity-50 self-start px-6"
            >
              {guardando ? 'Publicando...' : 'Publicar'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-3">Anuncios ({anuncios.length})</h2>
          {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
          {!cargando && anuncios.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no publicaste ningún anuncio.</p>
          )}

          {anuncios.map((a) => (
            <div key={a.id} className="flex justify-between items-start gap-3 py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm">{a.mensaje}</p>
                <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${a.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {a.activo ? 'Visible para socios' : 'Oculto'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActivo(a)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
                  {a.activo ? 'Ocultar' : 'Mostrar'}
                </button>
                <button onClick={() => borrar(a)} className="text-xs border border-red-200 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50 transition">
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}