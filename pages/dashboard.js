import { useEffect, useState } from 'react'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '../lib/session'
import Navbar from '../components/Navbar'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Eyebrow from '../components/ui/Eyebrow'

export async function getServerSideProps({ req, res }) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: { usuario: session.usuario } }
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

function agruparPorDia(ejercicios) {
  const grupos = {}
  ejercicios.forEach((e) => {
    const dia = e.dia_semana || 'sin día'
    if (!grupos[dia]) grupos[dia] = []
    grupos[dia].push(e)
  })
  return grupos
}

export default function Dashboard({ usuario }) {
  const [rutina, setRutina] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [anuncios, setAnuncios] = useState([])
  const [todosLosServicios, setTodosLosServicios] = useState([])
  const [misServicios, setMisServicios] = useState([])
  const [servicioElegido, setServicioElegido] = useState(null)
  const [fechaElegida, setFechaElegida] = useState(hoyISO())
  const [horarios, setHorarios] = useState([])
  const [proximoDisponible, setProximoDisponible] = useState(null)
  const [misReservas, setMisReservas] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [cargandoHorarios, setCargandoHorarios] = useState(false)

  useEffect(() => {
    fetch('/api/mi-rutina')
      .then((r) => r.json())
      .then((data) => {
        setRutina(data.rutina)
        setEjercicios(data.ejercicios)
      })

    fetch('/api/anuncios')
      .then((r) => r.json())
      .then((data) => setAnuncios(data.anuncios || []))

    fetch('/api/servicios')
      .then((r) => r.json())
      .then((data) => {
        const servicios = data.servicios || []
        setTodosLosServicios(servicios)
        setServicioElegido((prev) => prev || (servicios[0] && servicios[0].id))
      })

    fetch('/api/mi-plan')
      .then((r) => r.json())
      .then((data) => setMisServicios(data.servicios || []))

    cargarMisReservas()
  }, [])

  const servicioIncluido = (id) => misServicios.some((s) => s.id === id)

  useEffect(() => {
    if (!servicioElegido || !servicioIncluido(servicioElegido)) {
      setHorarios([])
      setProximoDisponible(null)
      return
    }
    setCargandoHorarios(true)
    fetch(`/api/horarios-disponibles?fecha=${fechaElegida}&servicio_id=${servicioElegido}`)
      .then((r) => r.json())
      .then((data) => {
        setHorarios(data.horarios || [])
        setProximoDisponible(data.proximoDisponible || null)
        setCargandoHorarios(false)
      })
  }, [fechaElegida, servicioElegido, misServicios])

  function cargarMisReservas() {
    fetch('/api/reservas')
      .then((r) => r.json())
      .then((data) => setMisReservas(data.reservas || []))
  }

  function recargarHorarios() {
    if (!servicioElegido || !servicioIncluido(servicioElegido)) return
    fetch(`/api/horarios-disponibles?fecha=${fechaElegida}&servicio_id=${servicioElegido}`)
      .then((r) => r.json())
      .then((data) => {
        setHorarios(data.horarios || [])
        setProximoDisponible(data.proximoDisponible || null)
      })
  }

  async function reservar(horarioId) {
    setMensaje('')
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horario_id: horarioId, fecha: fechaElegida }),
    })
    const data = await res.json()

    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      return
    }

    if (data.ajustada) {
      setMensaje(`⚠️ Ese horario ya pasó por hoy — te reservamos para el ${data.fecha_final} en su lugar`)
    } else {
      setMensaje('✅ Reserva confirmada')
    }

    recargarHorarios()
    cargarMisReservas()
  }

  async function cancelar(reservaId) {
    await fetch('/api/reservas/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reserva_id: reservaId }),
    })
    cargarMisReservas()
    recargarHorarios()
  }

  const tieneGimnasio = misServicios.some((s) => s.nombre === 'Gimnasio')
  const nombreServicioElegido = todosLosServicios.find((s) => s.id === servicioElegido)?.nombre || ''

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ------------------ BANNER ------------------ */}
      <div className="relative bg-ink text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1470&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <p className="font-mono text-brand text-xs uppercase tracking-widest mb-1">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display font-semibold text-3xl uppercase tracking-wide">
            Hola, {usuario.nombre}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* ------------------ ANUNCIOS ------------------ */}
        {anuncios.length > 0 && (
          <div className="flex flex-col gap-2">
            {anuncios.map((a) => (
              <div key={a.id} className="bg-brand-light border border-brand/30 rounded-xl p-4 text-sm text-ink flex gap-2 items-start">
                <span>📣</span>
                <span>{a.mensaje}</span>
              </div>
            ))}
          </div>
        )}

        {/* ------------------ RUTINA (solo si el plan incluye Gimnasio) ------------------ */}
        {tieneGimnasio && (
          <Card>
            <Eyebrow>Plan de entrenamiento</Eyebrow>
            <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-4">Tu rutina</h2>

            {!rutina && (
              <p className="text-sm text-concrete">Todavía no tenés una rutina cargada. Consultá en el gimnasio.</p>
            )}
            {rutina && ejercicios.length === 0 && (
              <p className="text-sm text-concrete">Tu rutina "{rutina.nombre}" todavía no tiene ejercicios cargados.</p>
            )}
            {rutina && ejercicios.length > 0 && (
              <div>
                <p className="text-sm text-concrete mb-4">{rutina.nombre}</p>
                <div className="flex flex-col gap-4">
                  {DIAS_ORDEN.filter((dia) => agruparPorDia(ejercicios)[dia]).map((dia) => (
                    <div key={dia}>
                      <span className="font-mono text-xs text-brand uppercase tracking-widest font-semibold">
                        {dia}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {agruparPorDia(ejercicios)[dia].map((e) => (
                          <div
                            key={e.id}
                            className="bg-ink text-white rounded-xl p-4 flex items-center justify-between gap-3"
                          >
                            <span className="font-semibold text-sm leading-tight">{e.nombre}</span>
                            <div className="text-right shrink-0">
                              <span className="font-display font-semibold text-lg text-brand">
                                {e.series}×{e.repeticiones}
                              </span>
                              {e.peso_sugerido && (
                                <span className="block font-mono text-xs text-white/80 font-semibold mt-0.5">{e.peso_sugerido}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ------------------ RESERVAR TURNO ------------------ */}
        <Card>
          <Eyebrow>Cupos limitados</Eyebrow>
          <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-1">Reservar turno</h2>

          {todosLosServicios.length === 0 && (
            <p className="text-sm text-concrete mt-3">Todavía no hay actividades cargadas.</p>
          )}

          {/* Pestañas SIEMPRE visibles (aunque el socio solo tenga una
              actividad incluida en su plan), para que nunca quede
              ambiguo qué está reservando. */}
          {todosLosServicios.length > 0 && (
            <div className="flex gap-2 my-3">
              {todosLosServicios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServicioElegido(s.id)}
                  className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-lg border-2 transition ${
                    servicioElegido === s.id
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-concrete border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {s.nombre}
                  {!servicioIncluido(s.id) && (
                    <span className="ml-1.5 text-[10px] font-normal normal-case opacity-70">(no anotado)</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {servicioElegido && !servicioIncluido(servicioElegido) && (
            <p className="text-sm text-concrete bg-gray-50 rounded-xl p-4">
              No estás anotado a <strong>{nombreServicioElegido}</strong> todavía. Si te interesa sumarla a tu plan, consultá en recepción.
            </p>
          )}

          {servicioElegido && servicioIncluido(servicioElegido) && (
            <>
              <p className="text-xs text-gray-400 mb-2">
                Reservando en: <strong className="text-ink">{nombreServicioElegido}</strong>
              </p>

              <label className="block text-xs font-mono font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Elegí una fecha
              </label>
              <input
                type="date"
                value={fechaElegida}
                min={hoyISO()}
                onChange={(e) => setFechaElegida(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
              />

              {cargandoHorarios && <p className="text-sm text-concrete mt-4">Buscando horarios...</p>}
              {!cargandoHorarios && horarios.length === 0 && !proximoDisponible && (
                <p className="text-sm text-concrete mt-4">No hay horarios de {nombreServicioElegido} configurados para ese día.</p>
              )}

              {!cargandoHorarios && proximoDisponible && (
                <div className="bg-brand-light border border-brand/30 rounded-xl p-4 mt-4 text-sm flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    No hay lugar para {nombreServicioElegido} ese día. El próximo turno con cupo es el{' '}
                    <strong>{proximoDisponible.fecha}</strong> de{' '}
                    <strong>{proximoDisponible.hora_inicio.slice(0, 5)} a {proximoDisponible.hora_fin.slice(0, 5)}</strong>.
                  </span>
                  <Button
                    variant="primary"
                    className="text-xs py-2 px-4 uppercase tracking-wide shrink-0"
                    onClick={() => setFechaElegida(proximoDisponible.fecha)}
                  >
                    Ir a esa fecha
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-4">
                {horarios.map((h) => {
                  const casiLleno = h.disponible && h.capacidad_maxima - h.ocupados <= 2
                  return (
                    <div
                      key={h.id}
                      className={`rounded-xl p-4 w-40 border-2 transition ${
                        !h.disponible
                          ? 'border-gray-100 bg-gray-50'
                          : casiLleno
                          ? 'border-brand/30 bg-brand-light'
                          : 'border-gray-100'
                      }`}
                    >
                      <strong className="block font-mono text-sm">{h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)}</strong>
                      <p className={`text-2xl font-display font-semibold mt-1 ${casiLleno ? 'text-brand' : 'text-ink'}`}>
                        {h.capacidad_maxima - h.ocupados}
                        <span className="text-xs text-gray-400 font-sans font-normal"> lugares</span>
                      </p>
                      <Button
                        onClick={() => reservar(h.id)}
                        disabled={!h.disponible}
                        variant="primary"
                        className="mt-3 w-full text-sm py-2 uppercase tracking-wide text-xs"
                      >
                        {h.disponible ? `Reservar ${nombreServicioElegido}` : 'Completo'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {mensaje && <p className="text-sm mt-4 font-medium">{mensaje}</p>}
        </Card>

        {/* ------------------ MIS RESERVAS ------------------ */}
        <Card>
          <Eyebrow>Tu agenda</Eyebrow>
          <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-4">Mis turnos reservados</h2>

          {misReservas.length === 0 && (
            <p className="text-sm text-concrete">Todavía no reservaste ningún turno. Arriba podés elegir actividad, día y horario.</p>
          )}
          {misReservas.map((r) => (
            <div key={r.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-brand rounded-full" />
                <span className="text-sm font-mono">
                  {r.fecha} — {r.horarios.hora_inicio.slice(0, 5)} a {r.horarios.hora_fin.slice(0, 5)}
                </span>
              </div>
              <Button variant="secondary" onClick={() => cancelar(r.id)}>Cancelar</Button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}