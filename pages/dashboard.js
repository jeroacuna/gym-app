import { useEffect, useState } from 'react'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '../lib/session'
import Navbar from '../components/Navbar'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Eyebrow from '../components/ui/Eyebrow'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// Función para obtener la fecha actual en formato ISO (YYYY-MM-DD)
function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const BLOQUES_ORDEN = ['activacion', 'fuerza_1', 'fuerza_2', 'finalizador']
const BLOQUES_INFO = {
  activacion: { label: 'Activación', color: '#0ea5e9' },
  fuerza_1: { label: 'Fuerza 1', color: '#e11d2e' },
  fuerza_2: { label: 'Fuerza 2', color: '#a3121f' },
  finalizador: { label: 'Finalizador', color: '#111827' },
}

function agruparPorDia(ejercicios) {
  const grupos = {}
  ejercicios.forEach((e) => {
    const dia = e.dia_semana || 'sin día'
    if (!grupos[dia]) grupos[dia] = []
    grupos[dia].push(e)
  })
  return grupos
}

function agruparPorBloque(ejercicios) {
  const grupos = {}
  ejercicios.forEach((e) => {
    const bloque = e.bloque || 'fuerza_1'
    if (!grupos[bloque]) grupos[bloque] = []
    grupos[bloque].push(e)
  })
  return grupos
}

// ------------------ AUTORIZACIÓN DEL SERVIDOR ------------------
export async function getServerSideProps({ req, res }) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: { usuario: session.usuario } }
}

// ------------------ COMPONENTE PRINCIPAL ------------------
export default function Dashboard({ usuario }) {
  // Estados originales de rutinas, anuncios y servicios
  const [rutina, setRutina] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [anuncios, setAnuncios] = useState([])
  const [todosLosServicios, setTodosLosServicios] = useState([])
  const [misServicios, setMisServicios] = useState([])
  const [servicioElegido, setServicioElegido] = useState(null)
  const [fechaElegida, setFechaElegida] = useState(hoyISO())
  const [horarios, setHorarios] = useState([])
  const [misReservas, setMisReservas] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [cargandoHorarios, setCargandoHorarios] = useState(false)

  // Estados para el calendario interactivo y la ventana modal
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [turnosDisponibles, setTurnosDisponibles] = useState([])
  const [cargandoModal, setCargandoModal] = useState(false)

  // Carga inicial de datos al abrir el dashboard
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

  // Cargar horarios al cambiar la fecha o servicio en el selector clásico
  useEffect(() => {
    if (!servicioElegido || !servicioIncluido(servicioElegido)) {
      setHorarios([])
      return
    }
    setCargandoHorarios(true)
    fetch(`/api/horarios-disponibles?fecha=${fechaElegida}&servicio_id=${servicioElegido}`)
      .then((r) => r.json())
      .then((data) => {
        setHorarios(data.horarios || [])
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
      .then((data) => setHorarios(data.horarios || []))
  }

  // Función que se ejecuta al hacer clic en un día del Calendario interactivo
  const iniciarReserva = async (fecha) => {
    setFechaSeleccionada(fecha)
    setIsModalOpen(true)
    setCargandoModal(true)

    try {
      // Ajustamos para tomar la fecha local exacta y evitar desfases horarios
      const anio = fecha.getFullYear()
      const mes = String(fecha.getMonth() + 1).padStart(2, '0')
      const dia = String(fecha.getDate()).padStart(2, '0')
      const fechaFormateada = `${anio}-${mes}-${dia}`

      console.log("Fecha consultada desde el calendario:", fechaFormateada); // <-- Esto te mostrará la fecha en la consola

      const respuesta = await fetch(`/api/horarios-disponibles?fecha=${fechaFormateada}`)
      const datos = await respuesta.json()

      console.log("Datos recibidos de la API:", datos); // <-- Esto te mostrará si la API devuelve turnos o un array vacío

      if (respuesta.ok) {
        setTurnosDisponibles(datos.horarios || [])
      } else {
        setTurnosDisponibles([])
      }
    } catch (error) {
      console.error("Error al cargar horarios:", error)
      setTurnosDisponibles([])
    } finally {
      setCargandoModal(false)
    }
  }

  // Función para confirmar la reserva desde el Modal interactivo conectada a Supabase
  async function reservarDesdeModal(horarioId) {
    setMensaje('')
    
    const anio = fechaSeleccionada.getFullYear()
    const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0')
    const dia = String(fechaSeleccionada.getDate()).padStart(2, '0')
    const fechaFormateada = `${anio}-${mes}-${dia}`

    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horario_id: horarioId, fecha: fechaFormateada }),
    })
    const data = await res.json()

    if (!res.ok) {
      alert(`❌ Error al reservar: ${data.error}`)
      return
    }

    if (data.ajustada) {
      alert(`⚠️ Ese horario ya pasó por hoy — te reservamos para el ${data.fecha_final}`)
    } else {
      alert('✅ ¡Turno reservado con éxito!')
    }

    setIsModalOpen(false)
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
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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

        {/* ------------------ RUTINA DE ENTRENAMIENTO ------------------ */}
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
                <p className="text-sm text-concrete mb-5">{rutina.nombre}</p>
                <div className="flex flex-col gap-7">
                  {DIAS_ORDEN.filter((dia) => agruparPorDia(ejercicios)[dia]).map((dia) => {
                    const porBloque = agruparPorBloque(agruparPorDia(ejercicios)[dia])
                    return (
                      <div key={dia}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="font-display font-semibold text-sm uppercase tracking-wide text-ink">
                            {dia}
                          </span>
                          <div className="h-px flex-1 bg-gray-200" />
                        </div>

                        <div className="flex flex-col gap-4">
                          {BLOQUES_ORDEN.filter((b) => porBloque[b]).map((bloque) => {
                            const info = BLOQUES_INFO[bloque]
                            return (
                              <div key={bloque} className="rounded-xl border border-gray-100 overflow-hidden">
                                <div
                                  className="flex items-center gap-2 px-4 py-2"
                                  style={{ backgroundColor: info.color }}
                                >
                                  <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-white">
                                    {info.label}
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-gray-50">
                                        <th className="text-left font-mono text-[10px] uppercase tracking-wide text-gray-500 font-semibold px-4 py-2 border-b border-gray-200">
                                          Ejercicio
                                        </th>
                                        <th className="text-center font-mono text-[10px] uppercase tracking-wide text-gray-500 font-semibold px-3 py-2 border-b border-l border-gray-200 w-16">
                                          Series
                                        </th>
                                        <th className="text-center font-mono text-[10px] uppercase tracking-wide text-gray-500 font-semibold px-3 py-2 border-b border-l border-gray-200 w-20">
                                          Reps
                                        </th>
                                        <th className="text-center font-mono text-[10px] uppercase tracking-wide text-gray-500 font-semibold px-3 py-2 border-b border-l border-gray-200 w-24">
                                          Peso
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {porBloque[bloque].map((e, i) => (
                                        <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                                          <td className="px-4 py-2.5 border-b border-gray-100 font-medium text-ink">
                                            {e.nombre}
                                          </td>
                                          <td className="px-3 py-2.5 border-b border-l border-gray-100 text-center font-mono font-semibold text-ink">
                                            {e.series}
                                          </td>
                                          <td className="px-3 py-2.5 border-b border-l border-gray-100 text-center font-mono font-semibold text-ink">
                                            {e.repeticiones}
                                          </td>
                                          <td className="px-3 py-2.5 border-b border-l border-gray-100 text-center font-mono text-concrete">
                                            {e.peso_sugerido || '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ------------------ CALENDARIO INTERACTIVO RESTAURADO ------------------ */}
        <Card>
          <Eyebrow>Elige un día</Eyebrow>
          <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-4 text-black">
            Reservar nuevo turno
          </h2>
          
          <div className="flex justify-center p-4">
            <Calendar 
              onChange={setFechaSeleccionada} 
              value={fechaSeleccionada}
              onClickDay={iniciarReserva}
              minDate={new Date()} 
              locale="es-AR"
              className="border-0 shadow-sm rounded-lg"
            />
          </div>
        </Card>

        {/* ------------------ MIS TURNOS RESERVADOS ------------------ */}
        <Card>
          <Eyebrow>Tu agenda</Eyebrow>
          <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-4 text-black">
            Mis turnos reservados
          </h2>

          {misReservas.length === 0 && (
            <p className="text-sm text-concrete">
              Todavía no reservaste ningún turno. Hacé clic en el calendario de arriba para elegir fecha.
            </p>
          )}

          {misReservas.map((r) => (
            <div key={r.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-brand rounded-full" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider mb-0.5">
                    {r.horarios?.actividad || r.actividad || 'Gimnasio'}
                  </span>
                  <span className="text-sm font-mono text-gray-800">
                    {r.fecha} — {r.horarios?.hora_inicio?.slice(0, 5)} a {r.horarios?.hora_fin?.slice(0, 5)}
                  </span>
                </div>
              </div>
              <Button variant="secondary" onClick={() => cancelar(r.id)}>
                Cancelar
              </Button>
            </div>
          ))}
        </Card>
      </div>

      {/* ------------------ MODAL FLOTANTE DE HORARIOS ------------------ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold text-black mb-2">
              Seleccionar Horario
            </h3>
            
            <p className="text-gray-600 mb-4 font-medium">
              Día: <span className="text-red-600">{fechaSeleccionada.toLocaleDateString('es-AR')}</span>
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
              {cargandoModal ? (
                <p className="text-sm text-gray-500 text-center py-4">Buscando horarios disponibles...</p>
              ) : turnosDisponibles.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No hay turnos disponibles para esta fecha.</p>
              ) : (
                turnosDisponibles.map((turno) => {
                  // Buscamos el nombre real de la actividad comparando los IDs
                  const servicioDelTurno = todosLosServicios.find((s) => s.id === turno.servicio_id);
                  const nombreActividad = servicioDelTurno ? servicioDelTurno.nombre : 'Gimnasio';

                  return (
                    <div 
                      key={turno.id} 
                      className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:border-red-600 transition-colors"
                    >
                      <div>
                        {/* Imprimimos el nombre dinámico que acabamos de evaluar */}
                        <span className="block text-xs font-bold text-red-600 uppercase">
                          {nombreActividad}
                        </span>
                        <span className="text-sm font-mono text-gray-800">
                          {turno.hora_inicio.slice(0, 5)} a {turno.hora_fin.slice(0, 5)}
                        </span>
                      </div>
                      
                      <Button 
                        variant="primary"
                        className="text-sm uppercase tracking-wide"
                        onClick={() => reservarDesdeModal(turno.id)}
                      >
                        Reservar
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end">
              <Button 
                variant="secondary" 
                onClick={() => setIsModalOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}