import { useEffect, useState } from 'react'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import Link from 'next/link'
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

function socioVacio() {
  return { dni: '', nombre: '', apellido: '', email: '', telefono: '' }
}

export default function AdminSocios() {
  const [socios, setSocios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState(socioVacio())
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [borrador, setBorrador] = useState(null)

  useEffect(() => {
    cargarSocios()
  }, [])

  function cargarSocios() {
    setCargando(true)
    fetch('/api/admin/socios?todos=true')
      .then((r) => r.json())
      .then((data) => {
        setSocios(data.socios || [])
        setCargando(false)
      })
  }

  async function crearSocio(e) {
    e.preventDefault()
    setMensaje('')
    setGuardando(true)

    const res = await fetch('/api/admin/socios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevo),
    })
    const data = await res.json()
    setGuardando(false)

    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      return
    }

    setMensaje(`✅ Socio ${data.socio.nombre} ${data.socio.apellido} creado`)
    setNuevo(socioVacio())
    cargarSocios()
  }

  function empezarEdicion(socio) {
    setEditandoId(socio.id)
    setBorrador({ ...socio })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setBorrador(null)
  }

  async function guardarEdicion() {
    const res = await fetch('/api/admin/socios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(borrador),
    })
    if (!res.ok) {
      setMensaje('❌ No se pudo guardar el cambio')
      return
    }
    setEditandoId(null)
    setBorrador(null)
    cargarSocios()
  }

  async function toggleActivo(socio) {
    const confirmacion = socio.activo
      ? `¿Dar de baja a ${socio.nombre} ${socio.apellido}? Sigue existiendo su historial, pero deja de aparecer como socio activo.`
      : `¿Reactivar a ${socio.nombre} ${socio.apellido}?`

    if (!window.confirm(confirmacion)) return

    setSocios((prev) =>
      prev.map((s) => (s.id === socio.id ? { ...s, activo: !s.activo } : s))
    )

    await fetch('/api/admin/socios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: socio.id, activo: !socio.activo }),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Socios</h1>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Dar de alta un socio nuevo</h2>
          <form onSubmit={crearSocio} className="flex flex-col gap-3 max-w-sm">
            <input
              type="text"
              placeholder="DNI *"
              value={nuevo.dni}
              onChange={(e) => setNuevo({ ...nuevo, dni: e.target.value })}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
            <input
              type="text"
              placeholder="Nombre *"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
            <input
              type="text"
              placeholder="Apellido *"
              value={nuevo.apellido}
              onChange={(e) => setNuevo({ ...nuevo, apellido: e.target.value })}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
            <input
              type="email"
              placeholder="Email (opcional)"
              value={nuevo.email}
              onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              type="text"
              placeholder="Teléfono (opcional)"
              value={nuevo.telefono}
              onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={guardando}
              className="bg-black text-white rounded-lg py-2.5 font-medium hover:bg-brand transition disabled:opacity-50"
            >
              {guardando ? 'Creando...' : 'Crear socio'}
            </button>
          </form>
          {mensaje && <p className="text-sm mt-3">{mensaje}</p>}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-3">Socios cargados ({socios.length})</h2>
          {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
          {!cargando && socios.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no hay socios cargados.</p>
          )}

          {socios.map((s) => {
            const enEdicion = editandoId === s.id

            if (enEdicion) {
              return (
                <div key={s.id} className="flex gap-2 items-center flex-wrap py-3 border-b border-gray-100 bg-gray-50 -mx-2 px-2 rounded-lg">
                  <input
                    type="text"
                    value={borrador.nombre}
                    onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    placeholder="Nombre"
                  />
                  <input
                    type="text"
                    value={borrador.apellido}
                    onChange={(e) => setBorrador({ ...borrador, apellido: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    placeholder="Apellido"
                  />
                  <input
                    type="email"
                    value={borrador.email || ''}
                    onChange={(e) => setBorrador({ ...borrador, email: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    placeholder="Email"
                  />
                  <input
                    type="text"
                    value={borrador.telefono || ''}
                    onChange={(e) => setBorrador({ ...borrador, telefono: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    placeholder="Teléfono"
                  />
                  <button onClick={guardarEdicion} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-white transition">Guardar</button>
                  <button onClick={cancelarEdicion} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-white transition">Cancelar</button>
                </div>
              )
            }

            return (
              <div key={s.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                <div>
                  <span className="font-semibold text-sm">{s.nombre} {s.apellido}</span>{' '}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.activo ? 'Activo' : 'De baja'}
                  </span>
                  <div className="text-xs text-gray-500">DNI {s.dni}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/socio/${s.id}`} className="text-sm text-brand hover:underline">Ver ficha →</Link>
                  <button onClick={() => empezarEdicion(s)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">Editar</button>
                  <button onClick={() => toggleActivo(s)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
                    {s.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}