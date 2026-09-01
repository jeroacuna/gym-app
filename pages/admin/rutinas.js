import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
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

function ejercicioVacio(orden) {
  return {
    id: `nuevo-${Date.now()}`,
    nombre: '',
    series: 3,
    repeticiones: '10-12',
    peso_sugerido: '',
    dia_semana: 'lunes',
    orden,
    esNuevo: true,
  }
}

export default function AdminRutinas() {
  const router = useRouter()
  const [socios, setSocios] = useState([])
  const [socioId, setSocioId] = useState('')
  const [rutina, setRutina] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    fetch('/api/admin/socios')
      .then((r) => r.json())
      .then((data) => setSocios(data.socios || []))
  }, [])

  useEffect(() => {
    if (router.query.socio) {
      setSocioId(router.query.socio)
    }
  }, [router.query.socio])

  useEffect(() => {
    if (!socioId) {
      setRutina(null)
      setEjercicios([])
      return
    }
    cargarRutina(socioId)
  }, [socioId])

  function cargarRutina(id) {
    setCargando(true)
    fetch(`/api/admin/rutina?usuario_id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setRutina(data.rutina)
        setEjercicios(data.ejercicios || [])
        setCargando(false)
      })
  }

  async function crearRutina() {
    const res = await fetch('/api/admin/rutina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: socioId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      return
    }
    setRutina(data.rutina)
    setEjercicios([])
  }

  function agregarFilaVacia() {
    setEjercicios((prev) => [...prev, ejercicioVacio(prev.length)])
  }

  function actualizarCampo(id, campo, valor) {
    setEjercicios((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [campo]: valor } : e))
    )
  }

  async function guardarFila(ejercicio) {
    setMensaje('')
    if (!ejercicio.nombre) {
      setMensaje('❌ Poné un nombre de ejercicio antes de guardar')
      return
    }

    if (ejercicio.esNuevo) {
      const res = await fetch('/api/admin/ejercicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rutina_id: rutina.id, ...ejercicio }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensaje(`❌ ${data.error}`)
        return
      }
      setEjercicios((prev) =>
        prev.map((e) => (e.id === ejercicio.id ? { ...data.ejercicio, esNuevo: false } : e))
      )
    } else {
      const res = await fetch('/api/admin/ejercicio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ejercicio),
      })
      if (!res.ok) {
        setMensaje('❌ No se pudo guardar el cambio')
        return
      }
    }
    setMensaje('✅ Guardado')
  }

  async function eliminarFila(ejercicio) {
    if (!ejercicio.esNuevo) {
      await fetch('/api/admin/ejercicio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ejercicio.id }),
      })
    }
    setEjercicios((prev) => prev.filter((e) => e.id !== ejercicio.id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Rutinas de socios</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Elegí un socio</label>
          <select
            value={socioId}
            onChange={(e) => setSocioId(e.target.value)}
            className="w-full max-w-sm px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">-- Seleccionar --</option>
            {socios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.apellido}, {s.nombre} (DNI {s.dni})
              </option>
            ))}
          </select>

          {cargando && <p className="text-sm text-gray-500 mt-4">Cargando...</p>}

          {socioId && !cargando && !rutina && (
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-3">Este socio todavía no tiene una rutina asignada.</p>
              <button onClick={crearRutina} className="bg-black text-white rounded-lg px-4 py-2.5 font-medium hover:bg-brand transition">
                Crear rutina
              </button>
            </div>
          )}

          {rutina && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-4">{rutina.nombre}</h2>

              <div className="flex flex-col gap-2">
                {ejercicios.map((e) => (
                  <div key={e.id} className="flex gap-2 items-center flex-wrap bg-gray-50 rounded-xl p-3">
                    <input
                      type="text"
                      placeholder="Nombre del ejercicio"
                      value={e.nombre}
                      onChange={(ev) => actualizarCampo(e.id, 'nombre', ev.target.value)}
                      className="flex-[2] min-w-[160px] px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    />
                    <select
                      value={e.dia_semana || 'lunes'}
                      onChange={(ev) => actualizarCampo(e.id, 'dia_semana', ev.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    >
                      {DIAS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Series"
                      value={e.series}
                      onChange={(ev) => actualizarCampo(e.id, 'series', Number(ev.target.value))}
                      className="w-16 px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Reps"
                      value={e.repeticiones}
                      onChange={(ev) => actualizarCampo(e.id, 'repeticiones', ev.target.value)}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Peso sugerido"
                      value={e.peso_sugerido || ''}
                      onChange={(ev) => actualizarCampo(e.id, 'peso_sugerido', ev.target.value)}
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    />
                    <button onClick={() => guardarFila(e)} className="text-xs border border-gray-300 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-100 transition">Guardar</button>
                    <button onClick={() => eliminarFila(e)} className="text-xs border border-brand/30 text-brand bg-white rounded-lg px-3 py-1.5 hover:bg-brand-light transition">Eliminar</button>
                  </div>
                ))}
              </div>

              <button onClick={agregarFilaVacia} className="mt-3 text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition">
                + Agregar ejercicio
              </button>

              {mensaje && <p className="text-sm mt-4">{mensaje}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}