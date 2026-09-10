import { useEffect, useRef, useState } from 'react'
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

const BLOQUES = [
  { value: 'activacion', label: 'Activación' },
  { value: 'fuerza_1', label: 'Fuerza 1' },
  { value: 'fuerza_2', label: 'Fuerza 2' },
  { value: 'finalizador', label: 'Finalizador' },
]

function ejercicioVacio(orden) {
  return {
    id: `nuevo-${Date.now()}`,
    nombre: '',
    series: 3,
    repeticiones: '10-12',
    peso_sugerido: '',
    dia_semana: 'lunes',
    bloque: 'activacion',
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

  // ------ "Ahora en el gimnasio" ------
  const [franjas, setFranjas] = useState([])
  const [cargandoFranjas, setCargandoFranjas] = useState(true)

  // ------ Buscador (reemplaza al viejo <select> con todos los socios) ------
  const [busqueda, setBusqueda] = useState('')
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const buscadorRef = useRef(null)
  const editorRef = useRef(null)

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

  // Cargamos "quién viene ahora" al entrar, y lo refrescamos solos
  // cada 1 minuto para que la franja horaria se vaya actualizando
  // sin que el admin tenga que recargar la página a mano.
  useEffect(() => {
    cargarFranjas()
    const intervalo = setInterval(cargarFranjas, 60000)
    return () => clearInterval(intervalo)
  }, [])

  // Cerramos el dropdown del buscador si el admin clickea afuera.
  useEffect(() => {
    function alClickearAfuera(e) {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) {
        setMostrarResultados(false)
      }
    }
    document.addEventListener('mousedown', alClickearAfuera)
    return () => document.removeEventListener('mousedown', alClickearAfuera)
  }, [])

  function cargarFranjas() {
    setCargandoFranjas(true)
    fetch('/api/admin/quienes-ahora')
      .then((r) => r.json())
      .then((data) => {
        setFranjas(data.franjas || [])
        setCargandoFranjas(false)
      })
  }

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

  // Se usa tanto al elegir del buscador como al tocar un nombre en
  // el panel de "Ahora en el gimnasio" — en los dos casos alcanza
  // con el id del socio.
  function elegirSocio(socio) {
    setSocioId(socio.id)
    setBusqueda('')
    setMostrarResultados(false)
    if (editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const resultadosBusqueda = busqueda.trim()
    ? socios
        .filter((s) => `${s.nombre} ${s.apellido} ${s.dni}`.toLowerCase().includes(busqueda.trim().toLowerCase()))
        .slice(0, 8)
    : []

  const socioSeleccionado = socios.find((s) => s.id === socioId)

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

        {/* ------------------ AHORA EN EL GIMNASIO ------------------ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">Ahora en el gimnasio</h2>
          <p className="text-xs text-gray-500 mb-4">
            Detecta sola el horario en curso (o el próximo de hoy) y quién tiene turno ahí. Tocá un nombre para ir directo a su rutina.
          </p>

          {cargandoFranjas && <p className="text-sm text-gray-500">Buscando...</p>}

          {!cargandoFranjas && franjas.length === 0 && (
            <p className="text-sm text-gray-500">No quedan más turnos programados por hoy.</p>
          )}

          {!cargandoFranjas &&
            franjas.map((f) => (
              <div key={f.horario.id} className="py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-sm font-semibold">
                    {f.horario.hora_inicio.slice(0, 5)} - {f.horario.hora_fin.slice(0, 5)}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {f.horario.servicio_nombre}
                  </span>
                  {f.horario.estado === 'en_curso' ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      En curso
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Empieza en {f.horario.minutos_para_empezar} min
                    </span>
                  )}
                </div>

                {f.alumnos.length === 0 && (
                  <p className="text-xs text-gray-400">Nadie anotado en este horario.</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {f.alumnos.map((alumno) => (
                    <button
                      key={alumno.id}
                      onClick={() => elegirSocio(alumno)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                        socioId === alumno.id
                          ? 'bg-black text-white border-black'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {alumno.apellido}, {alumno.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </section>

        {/* ------------------ EDITOR DE RUTINA ------------------ */}
        <div ref={editorRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Buscar un socio puntual</label>

          <div className="relative max-w-sm" ref={buscadorRef}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setMostrarResultados(true)
              }}
              onFocus={() => setMostrarResultados(true)}
              placeholder="Nombre, apellido o DNI..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />

            {mostrarResultados && busqueda.trim() && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {resultadosBusqueda.length === 0 && (
                  <p className="text-sm text-gray-400 px-3.5 py-2.5">Sin resultados</p>
                )}
                {resultadosBusqueda.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => elegirSocio(s)}
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium">{s.apellido}, {s.nombre}</span>{' '}
                    <span className="text-gray-400 font-mono text-xs">DNI {s.dni}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {socioSeleccionado && !mostrarResultados && (
            <p className="text-xs text-gray-500 mt-2">
              Editando a: <strong className="text-ink">{socioSeleccionado.apellido}, {socioSeleccionado.nombre}</strong>
              <button
                onClick={() => { setSocioId(''); setBusqueda('') }}
                className="text-brand hover:underline ml-2"
              >
                Cambiar
              </button>
            </p>
          )}

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
                    <select
                      value={e.bloque || 'activacion'}
                      onChange={(ev) => actualizarCampo(e.id, 'bloque', ev.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm"
                    >
                      {BLOQUES.map((b) => (
                        <option key={b.value} value={b.value}>{b.label}</option>
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