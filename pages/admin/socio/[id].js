import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import Link from 'next/link'
import Navbar from '../../../components/Navbar'
import { ADMIN_NAV_LINKS } from '../../../lib/adminNav'

export async function getServerSideProps({ req, res }) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  if (session.usuario.rol !== 'admin') {
    return { redirect: { destination: '/dashboard', permanent: false } }
  }
  return { props: {} }
}

const DIAS_LEGIBLES = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' }

function SeccionTurnosFijos({ socioId }) {
  const [turnosFijos, setTurnosFijos] = useState([])
  const [servicios, setServicios] = useState([])
  const [horarios, setHorarios] = useState([])
  const [servicioElegido, setServicioElegido] = useState('')
  const [horarioElegido, setHorarioElegido] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargar()
    fetch('/api/admin/servicios')
      .then((r) => r.json())
      .then((data) => setServicios(data.servicios || []))
    fetch('/api/admin/horarios')
      .then((r) => r.json())
      .then((data) => setHorarios(data.horarios || []))
  }, [socioId])

  function cargar() {
    fetch(`/api/admin/turnos-fijos?usuario_id=${socioId}`)
      .then((r) => r.json())
      .then((data) => setTurnosFijos(data.turnosFijos || []))
  }

  async function asignar(e) {
    e.preventDefault()
    if (!horarioElegido) return
    setMensaje('')
    setGuardando(true)
    const res = await fetch('/api/admin/turnos-fijos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: socioId, horario_id: horarioElegido }),
    })
    const data = await res.json()
    setGuardando(false)
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      return
    }
    setHorarioElegido('')
    cargar()
  }

  async function quitar(turno) {
    if (!window.confirm('¿Quitar este turno fijo? (las reservas ya generadas de semanas pasadas no se tocan)')) return
    await fetch(`/api/admin/turnos-fijos?id=${turno.id}`, { method: 'DELETE' })
    cargar()
  }

  const horariosDelServicio = horarios.filter((h) => h.servicio_id === servicioElegido && h.activo)

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
      <h2 className="text-lg font-semibold mb-1">Turnos fijos</h2>
      <p className="text-xs text-gray-500 mb-3">
        El socio queda anotado automáticamente todas las semanas en este horario, sin tener que reservar cada vez.
      </p>

      {turnosFijos.length === 0 && <p className="text-sm text-gray-500 mb-3">Todavía no tiene ningún turno fijo asignado.</p>}
      {turnosFijos.map((t) => (
        <div key={t.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-sm">
          <span>{DIAS_LEGIBLES[t.dia_semana] || t.dia_semana} {t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)} · {t.servicio_nombre}</span>
          <button onClick={() => quitar(t)} className="text-xs border border-red-200 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50 transition">
            Quitar
          </button>
        </div>
      ))}

      <form onSubmit={asignar} className="flex flex-wrap gap-2 items-center mt-4">
        <select
          value={servicioElegido}
          onChange={(e) => { setServicioElegido(e.target.value); setHorarioElegido('') }}
          className="px-2.5 py-2 rounded-lg border border-gray-300 text-sm"
        >
          <option value="">Elegí servicio</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        <select
          value={horarioElegido}
          onChange={(e) => setHorarioElegido(e.target.value)}
          disabled={!servicioElegido}
          className="px-2.5 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
        >
          <option value="">Elegí horario</option>
          {horariosDelServicio.map((h) => (
            <option key={h.id} value={h.id}>
              {DIAS_LEGIBLES[h.dia_semana] || h.dia_semana} {h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={guardando || !horarioElegido}
          className="bg-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand transition disabled:opacity-50"
        >
          {guardando ? 'Asignando...' : 'Asignar turno fijo'}
        </button>
      </form>
      {mensaje && <p className="text-sm mt-2">{mensaje}</p>}
    </section>
  )
}

export default function FichaSocio() {
  const router = useRouter()
  const { id } = router.query
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/ficha-socio?usuario_id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDatos(data)
        setCargando(false)
      })
  }, [id])

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar links={ADMIN_NAV_LINKS} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-sm text-gray-500">Cargando ficha...</p>
        </div>
      </div>
    )
  }

  if (!datos || datos.error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar links={ADMIN_NAV_LINKS} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-sm">No se encontró el socio.</p>
        </div>
      </div>
    )
  }

  const { socio, rutina, ejercicios, pagos, reservas } = datos

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-2xl font-bold">{socio.nombre} {socio.apellido}</h1>
          <Link href="/admin/socios" className="text-sm text-brand hover:underline">← Volver a socios</Link>
        </div>
        <p className="text-sm text-gray-500">
          DNI {socio.dni} · {socio.email || 'sin email'} · {socio.telefono || 'sin teléfono'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${socio.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {socio.activo ? 'Activo' : 'Inactivo'}
          </span>
          <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
            {socio.planes?.nombre || 'Sin plan asignado'}
          </span>
        </div>

        {/* ------------------ RUTINA ------------------ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-lg font-semibold">Rutina</h2>
            <Link href={`/admin/rutinas?socio=${socio.id}`} className="text-sm text-brand hover:underline">Editar rutina →</Link>
          </div>

          {!rutina && <p className="text-sm text-gray-500">No tiene una rutina asignada.</p>}
          {rutina && ejercicios.length === 0 && (
            <p className="text-sm text-gray-500">La rutina "{rutina.nombre}" no tiene ejercicios cargados.</p>
          )}
          {rutina && ejercicios.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-4 font-medium">Día</th>
                    <th className="py-2 pr-4 font-medium">Ejercicio</th>
                    <th className="py-2 pr-4 font-medium">Series</th>
                    <th className="py-2 pr-4 font-medium">Reps</th>
                  </tr>
                </thead>
                <tbody>
                  {ejercicios.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 capitalize">{e.dia_semana || '-'}</td>
                      <td className="py-2 pr-4 font-medium">{e.nombre}</td>
                      <td className="py-2 pr-4">{e.series}</td>
                      <td className="py-2 pr-4">{e.repeticiones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ------------------ PAGOS ------------------ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
          <h2 className="text-lg font-semibold mb-3">Historial de pagos</h2>
          {pagos.length === 0 && <p className="text-sm text-gray-500">Todavía no hay pagos registrados.</p>}
          {pagos.map((p, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-sm">
              <span className="capitalize">{p.mes_nombre} {p.anio}</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.estado === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-brand-light text-brand-dark'}`}>
                {p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
              </span>
            </div>
          ))}
        </section>

        {/* ------------------ TURNOS FIJOS ------------------ */}
        <SeccionTurnosFijos socioId={socio.id} />

        {/* ------------------ RESERVAS ------------------ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
          <h2 className="text-lg font-semibold mb-3">Próximas reservas</h2>
          {reservas.length === 0 && <p className="text-sm text-gray-500">No tiene turnos reservados.</p>}
          {reservas.map((r) => (
            <div key={r.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-sm">
              <span>{r.fecha}</span>
              <span className="text-gray-500">
                {r.horarios.hora_inicio.slice(0, 5)} a {r.horarios.hora_fin.slice(0, 5)}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}