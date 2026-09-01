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

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const MAPA_DIA_A_NUMERO = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }

function horarioVacio(servicioId) {
  return { dia_semana: 'lunes', hora_inicio: '08:00', hora_fin: '09:00', capacidad_maxima: 10, servicio_id: servicioId || '' }
}

function proximaFecha(diaSemana) {
  const hoy = new Date()
  const objetivo = MAPA_DIA_A_NUMERO[diaSemana]
  const diferencia = (objetivo - hoy.getDay() + 7) % 7
  const fecha = new Date(hoy)
  fecha.setDate(hoy.getDate() + diferencia)
  return fecha.toISOString().slice(0, 10)
}

export default function AdminHorarios() {
  const [servicios, setServicios] = useState([])
  const [servicioActivo, setServicioActivo] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState(horarioVacio())
  const [mensaje, setMensaje] = useState('')
  const [anotadosPorHorario, setAnotadosPorHorario] = useState({})

  useEffect(() => {
    fetch('/api/admin/servicios')
      .then((r) => r.json())
      .then((data) => {
        const lista = data.servicios || []
        setServicios(lista)
        if (lista.length > 0) {
          setServicioActivo(lista[0].id)
          setNuevo(horarioVacio(lista[0].id))
        }
      })
    cargarHorarios()
  }, [])

  function cargarHorarios() {
    setCargando(true)
    fetch('/api/admin/horarios')
      .then((r) => r.json())
      .then((data) => {
        setHorarios(data.horarios || [])
        setCargando(false)
      })
  }

  async function crearHorario() {
    setMensaje('')
    const res = await fetch('/api/admin/horarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevo),
    })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      return
    }
    setNuevo(horarioVacio(servicioActivo))
    cargarHorarios()
  }

  async function toggleActivo(horario) {
    setHorarios((prev) =>
      prev.map((h) => (h.id === horario.id ? { ...h, activo: !h.activo } : h))
    )
    await fetch('/api/admin/horarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: horario.id, activo: !horario.activo }),
    })
  }

  async function actualizarCapacidad(horario, nuevaCapacidad) {
    setHorarios((prev) =>
      prev.map((h) => (h.id === horario.id ? { ...h, capacidad_maxima: nuevaCapacidad } : h))
    )
    await fetch('/api/admin/horarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: horario.id, capacidad_maxima: nuevaCapacidad }),
    })
  }

  function toggleVerAnotados(horario) {
    const actual = anotadosPorHorario[horario.id]

    if (actual?.abierto) {
      setAnotadosPorHorario((prev) => ({ ...prev, [horario.id]: { ...actual, abierto: false } }))
      return
    }

    const fechaInicial = actual?.fecha || proximaFecha(horario.dia_semana)
    setAnotadosPorHorario((prev) => ({
      ...prev,
      [horario.id]: { abierto: true, fecha: fechaInicial, lista: [], cargando: true },
    }))
    buscarAnotados(horario.id, fechaInicial)
  }

  function cambiarFechaAnotados(horarioId, fecha) {
    setAnotadosPorHorario((prev) => ({
      ...prev,
      [horarioId]: { ...prev[horarioId], fecha, cargando: true },
    }))
    buscarAnotados(horarioId, fecha)
  }

  function buscarAnotados(horarioId, fecha) {
    fetch(`/api/admin/anotados?horario_id=${horarioId}&fecha=${fecha}`)
      .then((r) => r.json())
      .then((data) => {
        setAnotadosPorHorario((prev) => ({
          ...prev,
          [horarioId]: { ...prev[horarioId], lista: data.anotados || [], cargando: false },
        }))
      })
  }

  function elegirServicio(servicioId) {
    setServicioActivo(servicioId)
    setNuevo((prev) => ({ ...prev, servicio_id: servicioId }))
  }

  const horariosDelServicio = horarios.filter((h) => h.servicio_id === servicioActivo)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Gestión de horarios</h1>

        {/* Pestañas por servicio: los horarios de gimnasio y pilates
            se manejan por separado, así no se mezclan en la lista. */}
        {servicios.length > 1 && (
          <div className="flex gap-2 mb-4">
            {servicios.map((s) => (
              <button
                key={s.id}
                onClick={() => elegirServicio(s.id)}
                className={`text-sm font-semibold px-4 py-2 rounded-lg border transition ${
                  servicioActivo === s.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Agregar horario nuevo</h2>
          <div className="flex flex-wrap gap-2 items-center">
            {servicios.length > 1 && (
              <select
                value={nuevo.servicio_id}
                onChange={(e) => setNuevo({ ...nuevo, servicio_id: e.target.value })}
                className="px-2.5 py-2 rounded-lg border border-gray-300 text-sm"
              >
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}
            <select
              value={nuevo.dia_semana}
              onChange={(e) => setNuevo({ ...nuevo, dia_semana: e.target.value })}
              className="px-2.5 py-2 rounded-lg border border-gray-300 text-sm"
            >
              {DIAS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="time"
              value={nuevo.hora_inicio}
              onChange={(e) => setNuevo({ ...nuevo, hora_inicio: e.target.value })}
              className="px-2.5 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <span className="text-sm text-gray-500">a</span>
            <input
              type="time"
              value={nuevo.hora_fin}
              onChange={(e) => setNuevo({ ...nuevo, hora_fin: e.target.value })}
              className="px-2.5 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <input
              type="number"
              value={nuevo.capacidad_maxima}
              onChange={(e) => setNuevo({ ...nuevo, capacidad_maxima: Number(e.target.value) })}
              className="w-16 px-2.5 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <span className="text-sm text-gray-500">cupos</span>
            <button onClick={crearHorario} className="bg-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand transition">
              Agregar
            </button>
          </div>
          {mensaje && <p className="text-sm mt-3">{mensaje}</p>}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-3">Horarios existentes</h2>
          {cargando && <p className="text-sm text-gray-500">Cargando...</p>}

          {DIAS.map((dia) => {
            const horariosDelDia = horariosDelServicio.filter((h) => h.dia_semana === dia)
            if (horariosDelDia.length === 0) return null

            return (
              <div key={dia} className="mt-4">
                <h3 className="capitalize font-semibold text-sm text-gray-700 mb-1.5">{dia}</h3>
                {horariosDelDia.map((h) => {
                  const estadoAnotados = anotadosPorHorario[h.id]

                  return (
                    <div key={h.id}>
                      <div className="flex flex-wrap gap-4 items-center py-2.5 border-b border-gray-100 text-sm">
                        <span className="font-medium">{h.hora_inicio.slice(0, 5)} - {h.hora_fin.slice(0, 5)}</span>
                        <span className="text-gray-500">
                          Cupo:{' '}
                          <input
                            type="number"
                            defaultValue={h.capacidad_maxima}
                            onBlur={(e) => actualizarCapacidad(h, Number(e.target.value))}
                            className="w-14 px-1.5 py-0.5 rounded border border-gray-300 text-sm"
                          />
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            h.ocupados >= h.capacidad_maxima
                              ? 'bg-red-100 text-red-700'
                              : h.capacidad_maxima - h.ocupados <= 2
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {h.ocupados}/{h.capacidad_maxima} ocupados ({Math.max(h.capacidad_maxima - h.ocupados, 0)} libres)
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${h.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {h.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <button onClick={() => toggleVerAnotados(h)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
                          {estadoAnotados?.abierto ? 'Ocultar anotados' : 'Ver anotados'}
                        </button>
                        <button onClick={() => toggleActivo(h)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
                          {h.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>

                      {estadoAnotados?.abierto && (
                        <div className="bg-gray-50 rounded-xl p-4 my-2">
                          <label className="text-xs font-semibold">
                            Fecha:{' '}
                            <input
                              type="date"
                              value={estadoAnotados.fecha}
                              onChange={(e) => cambiarFechaAnotados(h.id, e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm ml-1"
                            />
                          </label>

                          {estadoAnotados.cargando && <p className="text-sm text-gray-500 mt-2">Buscando...</p>}
                          {!estadoAnotados.cargando && estadoAnotados.lista.length === 0 && (
                            <p className="text-sm text-gray-500 mt-2">Nadie anotado para esa fecha.</p>
                          )}
                          {!estadoAnotados.cargando && estadoAnotados.lista.length > 0 && (
                            <ul className="mt-2 pl-5 text-sm list-disc">
                              {estadoAnotados.lista.map((a) => (
                                <li key={a.id}>
                                  {a.usuarios.nombre} {a.usuarios.apellido} — DNI {a.usuarios.dni}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {!cargando && horariosDelServicio.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">Todavía no hay horarios cargados para este servicio.</p>
          )}
        </section>
      </div>
    </div>
  )
}