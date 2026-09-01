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

function planVacio() {
  return { nombre: '', precio: '', servicios: {} } // servicios: { [servicio_id]: { incluido, dias_por_semana } }
}

// Convierte el objeto { [servicio_id]: {incluido, dias_por_semana} } al
// array plano que espera la API: [{ servicio_id, dias_por_semana }]
function aArrayServicios(mapaServicios) {
  return Object.entries(mapaServicios)
    .filter(([, v]) => v.incluido)
    .map(([servicio_id, v]) => ({
      servicio_id,
      dias_por_semana: v.dias_por_semana ? Number(v.dias_por_semana) : null,
    }))
}

export default function AdminPlanes() {
  const [planes, setPlanes] = useState([])
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState(planVacio())
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [borrador, setBorrador] = useState(null)

  useEffect(() => {
    cargarTodo()
  }, [])

  function cargarTodo() {
    setCargando(true)
    Promise.all([
      fetch('/api/admin/planes').then((r) => r.json()),
      fetch('/api/admin/servicios').then((r) => r.json()),
    ]).then(([dataPlanes, dataServicios]) => {
      setPlanes(dataPlanes.planes || [])
      setServicios(dataServicios.servicios || [])
      setCargando(false)
    })
  }

  function toggleServicio(setEstado, servicioId) {
    setEstado((prev) => {
      const actual = prev.servicios[servicioId] || { incluido: false, dias_por_semana: '' }
      return {
        ...prev,
        servicios: {
          ...prev.servicios,
          [servicioId]: { ...actual, incluido: !actual.incluido },
        },
      }
    })
  }

  function cambiarDiasPorSemana(setEstado, servicioId, valor) {
    setEstado((prev) => ({
      ...prev,
      servicios: {
        ...prev.servicios,
        [servicioId]: { ...prev.servicios[servicioId], dias_por_semana: valor },
      },
    }))
  }

  async function crearPlan(e) {
    e.preventDefault()
    setMensaje('')

    const serviciosArray = aArrayServicios(nuevo.servicios)
    if (serviciosArray.length === 0) {
      setMensaje('❌ Elegí al menos un servicio para el plan')
      return
    }

    setGuardando(true)
    const res = await fetch('/api/admin/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nuevo.nombre,
        precio: nuevo.precio ? Number(nuevo.precio) : null,
        servicios: serviciosArray,
      }),
    })
    const data = await res.json()
    setGuardando(false)

    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      return
    }

    setMensaje(`✅ Plan "${data.plan.nombre}" creado`)
    setNuevo(planVacio())
    cargarTodo()
  }

  function empezarEdicion(plan) {
    setEditandoId(plan.id)
    const mapa = {}
    plan.servicios.forEach((s) => {
      mapa[s.id] = { incluido: true, dias_por_semana: s.dias_por_semana || '' }
    })
    setBorrador({ nombre: plan.nombre, precio: plan.precio || '', servicios: mapa })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setBorrador(null)
  }

  async function guardarEdicion(id) {
    const serviciosArray = aArrayServicios(borrador.servicios)
    if (serviciosArray.length === 0) {
      setMensaje('❌ Un plan necesita al menos un servicio')
      return
    }

    const res = await fetch('/api/admin/planes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        nombre: borrador.nombre,
        precio: borrador.precio ? Number(borrador.precio) : null,
        servicios: serviciosArray,
      }),
    })
    if (!res.ok) {
      setMensaje('❌ No se pudo guardar el cambio')
      return
    }
    setEditandoId(null)
    setBorrador(null)
    cargarTodo()
  }

  async function toggleActivo(plan) {
    setPlanes((prev) => prev.map((p) => (p.id === plan.id ? { ...p, activo: !p.activo } : p)))
    await fetch('/api/admin/planes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: plan.id, activo: !plan.activo }),
    })
  }

  function FilaServicio({ servicio, estado, onToggle, onDias }) {
    const info = estado.servicios[servicio.id] || { incluido: false, dias_por_semana: '' }
    return (
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5 w-32">
          <input type="checkbox" checked={info.incluido} onChange={() => onToggle(servicio.id)} />
          {servicio.nombre}
        </label>
        {info.incluido && (
          <input
            type="number"
            min="1"
            placeholder="Sin límite"
            value={info.dias_por_semana}
            onChange={(e) => onDias(servicio.id, e.target.value)}
            className="w-28 px-2 py-1 rounded-lg border border-gray-300 text-xs"
          />
        )}
        {info.incluido && <span className="text-xs text-gray-400">veces/semana</span>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">Planes</h1>
        <p className="text-sm text-gray-500 mb-6">
          Definí qué servicios incluye cada plan, su precio, y si tiene un tope de turnos por semana (dejá vacío para "sin límite").
        </p>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Crear plan nuevo</h2>
          <form onSubmit={crearPlan} className="flex flex-col gap-3 max-w-sm">
            <input
              type="text"
              placeholder="Nombre del plan (ej: Combo Full)"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
            <input
              type="number"
              placeholder="Precio mensual"
              value={nuevo.precio}
              onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
              className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incluye</span>
              {servicios.map((s) => (
                <FilaServicio
                  key={s.id}
                  servicio={s}
                  estado={nuevo}
                  onToggle={(id) => toggleServicio(setNuevo, id)}
                  onDias={(id, v) => cambiarDiasPorSemana(setNuevo, id, v)}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={guardando}
              className="bg-black text-white rounded-lg py-2.5 font-medium hover:bg-brand transition disabled:opacity-50"
            >
              {guardando ? 'Creando...' : 'Crear plan'}
            </button>
          </form>
          {mensaje && <p className="text-sm mt-3">{mensaje}</p>}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-3">Planes cargados ({planes.length})</h2>
          {cargando && <p className="text-sm text-gray-500">Cargando...</p>}

          {planes.map((p) => {
            const enEdicion = editandoId === p.id

            if (enEdicion) {
              return (
                <div key={p.id} className="flex flex-col gap-2 py-3 border-b border-gray-100 bg-gray-50 -mx-2 px-2 rounded-lg">
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="text"
                      value={borrador.nombre}
                      onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                      placeholder="Nombre"
                    />
                    <input
                      type="number"
                      value={borrador.precio}
                      onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })}
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                      placeholder="Precio"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {servicios.map((s) => (
                      <FilaServicio
                        key={s.id}
                        servicio={s}
                        estado={borrador}
                        onToggle={(id) => toggleServicio(setBorrador, id)}
                        onDias={(id, v) => cambiarDiasPorSemana(setBorrador, id, v)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => guardarEdicion(p.id)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-white transition">Guardar</button>
                    <button onClick={cancelarEdicion} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-white transition">Cancelar</button>
                  </div>
                </div>
              )
            }

            return (
              <div key={p.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                <div>
                  <span className="font-semibold text-sm">{p.nombre}</span>{' '}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <div className="text-xs text-gray-500">
                    {p.servicios
                      .map((s) => (s.dias_por_semana ? `${s.nombre} (${s.dias_por_semana}x/sem)` : s.nombre))
                      .join(' + ')}
                    {p.precio ? ` · $${p.precio}/mes` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => empezarEdicion(p)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">Editar</button>
                  <button onClick={() => toggleActivo(p)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
                    {p.activo ? 'Desactivar' : 'Activar'}
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