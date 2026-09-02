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

// Solo existen 3 tipos posibles de plan. Nada de armar combinaciones
// raras a mano: esto evita cargar mal un plan y que después el socio
// no pueda reservar nada porque quedó sin servicios asignados.
const TIPOS = [
  { valor: 'gimnasio', etiqueta: 'Gimnasio' },
  { valor: 'pilates', etiqueta: 'Pilates' },
  { valor: 'ambos', etiqueta: 'Ambos (Gimnasio + Pilates)' },
]

function nombrePorDefecto(tipo) {
  if (tipo === 'gimnasio') return 'Gimnasio'
  if (tipo === 'pilates') return 'Pilates'
  return 'Combo Gimnasio + Pilates'
}

function planVacio() {
  return { nombre: '', precio: '', tipo: 'gimnasio', dias_gimnasio: '', dias_pilates: '', nombreTocado: false }
}

// A partir del tipo elegido y los días por semana, arma el array que
// espera la API: [{ servicio_id, dias_por_semana }]
function armarServicios(estado, idGimnasio, idPilates) {
  const filas = []
  if ((estado.tipo === 'gimnasio' || estado.tipo === 'ambos') && idGimnasio) {
    filas.push({ servicio_id: idGimnasio, dias_por_semana: estado.dias_gimnasio ? Number(estado.dias_gimnasio) : null })
  }
  if ((estado.tipo === 'pilates' || estado.tipo === 'ambos') && idPilates) {
    filas.push({ servicio_id: idPilates, dias_por_semana: estado.dias_pilates ? Number(estado.dias_pilates) : null })
  }
  return filas
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

  const idGimnasio = servicios.find((s) => s.nombre === 'Gimnasio')?.id
  const idPilates = servicios.find((s) => s.nombre === 'Pilates')?.id

  function elegirTipoNuevo(tipo) {
    setNuevo((prev) => ({
      ...prev,
      tipo,
      // Si el admin no tocó el nombre a mano, se lo autocompletamos
      // según el tipo. Si ya lo cambió, lo respetamos.
      nombre: prev.nombreTocado ? prev.nombre : nombrePorDefecto(tipo),
    }))
  }

  async function crearPlan(e) {
    e.preventDefault()
    setMensaje('')

    const serviciosArray = armarServicios(nuevo, idGimnasio, idPilates)
    if (serviciosArray.length === 0) {
      setMensaje('❌ No se encontraron los servicios base (Gimnasio/Pilates). Revisá que existan en la tabla servicios.')
      return
    }

    setGuardando(true)
    const res = await fetch('/api/admin/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nuevo.nombre || nombrePorDefecto(nuevo.tipo),
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

  function tipoDePlan(plan) {
    const nombres = plan.servicios.map((s) => s.nombre)
    const tieneGim = nombres.includes('Gimnasio')
    const tienePil = nombres.includes('Pilates')
    if (tieneGim && tienePil) return 'ambos'
    if (tienePil) return 'pilates'
    return 'gimnasio'
  }

  function empezarEdicion(plan) {
    setEditandoId(plan.id)
    const tipo = tipoDePlan(plan)
    const diasGim = plan.servicios.find((s) => s.nombre === 'Gimnasio')?.dias_por_semana || ''
    const diasPil = plan.servicios.find((s) => s.nombre === 'Pilates')?.dias_por_semana || ''
    setBorrador({
      nombre: plan.nombre,
      precio: plan.precio || '',
      tipo,
      dias_gimnasio: diasGim,
      dias_pilates: diasPil,
    })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setBorrador(null)
  }

  async function guardarEdicion(id) {
    const serviciosArray = armarServicios(borrador, idGimnasio, idPilates)
    if (serviciosArray.length === 0) {
      setMensaje('❌ No se encontraron los servicios base (Gimnasio/Pilates)')
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

  function SelectorTipo({ estado, onElegirTipo, onCambiarDias }) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => onElegirTipo(t.valor)}
              className={`text-sm font-semibold px-3.5 py-2 rounded-lg border-2 transition ${
                estado.tipo === t.valor
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        {(estado.tipo === 'gimnasio' || estado.tipo === 'ambos') && (
          <label className="flex items-center gap-2 text-sm">
            Días de Gimnasio por semana:
            <input
              type="number"
              min="1"
              placeholder="Sin límite"
              value={estado.dias_gimnasio}
              onChange={(e) => onCambiarDias('dias_gimnasio', e.target.value)}
              className="w-24 px-2 py-1 rounded-lg border border-gray-300 text-sm"
            />
          </label>
        )}

        {(estado.tipo === 'pilates' || estado.tipo === 'ambos') && (
          <label className="flex items-center gap-2 text-sm">
            Días de Pilates por semana:
            <input
              type="number"
              min="1"
              placeholder="Sin límite"
              value={estado.dias_pilates}
              onChange={(e) => onCambiarDias('dias_pilates', e.target.value)}
              className="w-24 px-2 py-1 rounded-lg border border-gray-300 text-sm"
            />
          </label>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">Planes</h1>
        <p className="text-sm text-gray-500 mb-6">
          Elegí el tipo de plan y, si querés, un tope de días por semana para cada actividad (dejá vacío para "sin límite").
        </p>

        {(!idGimnasio || !idPilates) && !cargando && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
            ⚠️ No encuentro los servicios "Gimnasio" y/o "Pilates" en la base. Revisá que hayas corrido{' '}
            <code className="font-mono">migracion_pilates.sql</code> en Supabase.
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Crear plan nuevo</h2>
          <form onSubmit={crearPlan} className="flex flex-col gap-3 max-w-sm">
            <SelectorTipo
              estado={nuevo}
              onElegirTipo={elegirTipoNuevo}
              onCambiarDias={(campo, valor) => setNuevo((prev) => ({ ...prev, [campo]: valor }))}
            />
            <input
              type="text"
              placeholder="Nombre del plan"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value, nombreTocado: true })}
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
          {!cargando && planes.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no creaste ningún plan.</p>
          )}

          {planes.map((p) => {
            const enEdicion = editandoId === p.id

            if (enEdicion) {
              return (
                <div key={p.id} className="flex flex-col gap-3 py-3 border-b border-gray-100 bg-gray-50 -mx-2 px-2 rounded-lg">
                  <SelectorTipo
                    estado={borrador}
                    onElegirTipo={(tipo) => setBorrador((prev) => ({ ...prev, tipo }))}
                    onCambiarDias={(campo, valor) => setBorrador((prev) => ({ ...prev, [campo]: valor }))}
                  />
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
                      .map((s) => (s.dias_por_semana ? `${s.nombre} (${s.dias_por_semana}x/sem)` : `${s.nombre} (sin límite)`))
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