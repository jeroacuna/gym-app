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

// Mapeo directo de Date.getDay() (0 = domingo, 6 = sábado) al mismo
// formato de texto que usamos en ejercicios.dia_semana. Así, sin
// tocar la base de datos, podemos saber "qué día de rutina le toca
// hoy" al socio con solo mirar el reloj del navegador.
const DIAS_SEMANA_JS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

// Accesos directos que se muestran en el menú hamburguesa del
// socio. Como el dashboard es una sola pantalla larga con todo
// adentro, acá no navegamos a otra URL: hacemos scroll a la
// sección correspondiente (ver HamburgerMenu.js).
const ACCESOS_SOCIO = [
  { href: '#cuota', label: 'Mi cuota', icon: '💳' },
  { href: '#rutina', label: 'Mi rutina', icon: '🏋️' },
  { href: '#reservar', label: 'Reservar turno', icon: '📅' },
  { href: '#mis-turnos', label: 'Mis turnos', icon: '🗓️' },
]

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
  const [todosLosServicios, setTodosLosServicios] = useState([])
  const [misServicios, setMisServicios] = useState([])
  const [servicioElegido, setServicioElegido] = useState(null)
  const [fechaElegida, setFechaElegida] = useState(hoyISO())
  const [horarios, setHorarios] = useState([])
  const [misReservas, setMisReservas] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [miPago, setMiPago] = useState(null) // null = cargando, true/false = pagado o no
  const [generandoLinkDePago, setGenerandoLinkDePago] = useState(false)

  // Estados para el calendario interactivo y la ventana modal
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [turnosDisponibles, setTurnosDisponibles] = useState([])
  const [cargandoModal, setCargandoModal] = useState(false)
  const [servicioModal, setServicioModal] = useState(null) // qué actividad se está reservando en el modal
  const [proximoDisponibleModal, setProximoDisponibleModal] = useState(null)

  // Si false, la rutina muestra SOLO el día de hoy. Si true, muestra
  // la semana completa (como funcionaba antes de este cambio).
  const [verSemanaCompleta, setVerSemanaCompleta] = useState(false)

  // Día de hoy en el mismo formato que usa la base para dia_semana.
  const diaDeHoy = DIAS_SEMANA_JS[new Date().getDay()]

  // Carga inicial de datos al abrir el dashboard
  useEffect(() => {
    fetch('/api/mi-rutina')
      .then((r) => r.json())
      .then((data) => {
        setRutina(data.rutina)
        setEjercicios(data.ejercicios)
      })

    fetch('/api/mi-pago')
      .then((r) => r.json())
      .then((data) => setMiPago(data.pagado))

    fetch('/api/servicios')
      .then((r) => r.json())
      .then((data) => {
        const servicios = data.servicios || []
        setTodosLosServicios(servicios)
        setServicioElegido((prev) => prev || (servicios[0] && servicios[0].id))
      })

    fetch('/api/mi-plan')
      .then((r) => r.json())
      .then((data) => {
        const servicios = data.servicios || []
        setMisServicios(servicios)
        setServicioModal((prev) => prev || (servicios[0] && servicios[0].id))
      })

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
  // 1. Agregamos un segundo parámetro a iniciarReserva para forzar la búsqueda con el ID correcto al instante
  // Modificamos iniciarReserva para que acepte un ID forzado y busque el Gimnasio por defecto
// Modificamos iniciarReserva con validaciones estrictas de tipos de datos
  const iniciarReserva = async (fechaSeleccionadaPorCalendario, idServicioForzado = null) => {
    const fechaReal = fechaSeleccionadaPorCalendario instanceof Date 
      ? fechaSeleccionadaPorCalendario 
      : new Date();

    setFechaSeleccionada(fechaReal);
    setIsModalOpen(true);

    // 1. Limpiamos y aseguramos el ID del servicio (evita errores si entra un objeto Event)
    let servicioIdAUsar = null;
    if (idServicioForzado !== null && typeof idServicioForzado !== 'object') {
      servicioIdAUsar = idServicioForzado;
    } else if (servicioModal !== null && typeof servicioModal !== 'object') {
      servicioIdAUsar = servicioModal;
    }

    // 2. Selección automática de 'Gimnasio' si la variable está vacía
    if (!servicioIdAUsar && misServicios.length > 0) {
      // Usamos .includes para evitar problemas con mayúsculas/minúsculas o espacios extra
      const gimnasio = misServicios.find(s => s.nombre.toLowerCase().includes('gimnasio'));
      servicioIdAUsar = gimnasio ? gimnasio.id : misServicios[0].id;
    }

    // 3. Guardamos el ID final validado en el estado
    if (servicioIdAUsar) {
      setServicioModal(servicioIdAUsar);
    }

    if (miPago === false) {
      setTurnosDisponibles([]);
      setProximoDisponibleModal(null);
      return; 
    }

    setCargandoModal(true);
    setProximoDisponibleModal(null);
    setTurnosDisponibles([]); 

    if (!servicioIdAUsar) {
      setCargandoModal(false);
      return;
    }

    // 4. Ejecución del fetch con el ID correcto garantizado
    try {
      const anio = fechaReal.getFullYear();
      const mes = String(fechaReal.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaReal.getDate()).padStart(2, '0');
      const fechaFormateada = `${anio}-${mes}-${dia}`;

      const respuesta = await fetch(`/api/horarios-disponibles?fecha=${fechaFormateada}&servicio_id=${servicioIdAUsar}`);
      const datos = await respuesta.json();

      if (respuesta.ok) {
        setTurnosDisponibles(datos.horarios || []);
        setProximoDisponibleModal(datos.proximoDisponible || null);
      } else {
        setTurnosDisponibles([]);
      }
    } catch (error) {
      console.error("Error al cargar horarios:", error);
      setTurnosDisponibles([]);
    } finally {
      setCargandoModal(false);
    }
  }

  // 2. Modificamos cambiarServicio para que le pase el ID directo a la búsqueda
  function cambiarServicioModal(servicioId) {
    const idReal = typeof servicioId === 'object' && servicioId !== null ? servicioId.id : servicioId
    setServicioModal(idReal)
    // Le pasamos idReal como segundo parámetro para que busque "de una"
    iniciarReserva(fechaSeleccionada, idReal)
  }

  // 3. NUEVA FUNCIÓN: Cambiar de día desde las flechas
  function cambiarDiaModal(diasDiferencia) {
    const nuevaFecha = new Date(fechaSeleccionada)
    nuevaFecha.setDate(nuevaFecha.getDate() + diasDiferencia)

    // Validación para no buscar en el pasado
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (nuevaFecha < hoy) return

    // Llamamos a la reserva pasándole la nueva fecha y el servicio actual
    iniciarReserva(nuevaFecha, servicioModal)
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

  async function pagarCuota() {
    setGenerandoLinkDePago(true)
    const res = await fetch('/api/pagos/crear-preferencia', { method: 'POST' })
    const data = await res.json()
    setGenerandoLinkDePago(false)

    if (!res.ok) {
      alert(data.error || 'No se pudo generar el link de pago')
      return
    }

    window.location.href = data.url // manda al socio a pagar a Mercado Pago
  }

  const tieneGimnasio = misServicios.some((s) => s.nombre === 'Gimnasio')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar accesos={ACCESOS_SOCIO} />

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
        
        {/* ------------------ CUOTA ------------------ */}
        <Card id="cuota">
          <Eyebrow>Cuota</Eyebrow>
          <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-3">Tu cuota de este mes</h2>

          {miPago === null && <p className="text-sm text-concrete">Consultando...</p>}

          {miPago === true && (
            <p className="text-sm text-green-700 bg-green-50 rounded-xl p-4 font-medium">✅ Cuota al día</p>
          )}

          {miPago === false && (
            <div className="bg-brand-light border border-brand/30 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm">Todavía no registramos el pago de este mes.</span>
              <Button variant="primary" onClick={pagarCuota} disabled={generandoLinkDePago} className="text-xs py-2 px-4 uppercase tracking-wide">
                {generandoLinkDePago ? 'Generando link...' : 'Pagar con Mercado Pago'}
              </Button>
            </div>
          )}
        </Card>

        {/* ------------------ RUTINA DE ENTRENAMIENTO ------------------ */}
        {tieneGimnasio && (
          <Card id="rutina">
            <Eyebrow>Plan de entrenamiento</Eyebrow>
            <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-4">Tu rutina</h2>

            {!rutina && (
              <p className="text-sm text-concrete">Todavía no tenés una rutina cargada. Consultá en el gimnasio.</p>
            )}
            {rutina && ejercicios.length === 0 && (
              <p className="text-sm text-concrete">Tu rutina "{rutina.nombre}" todavía no tiene ejercicios cargados.</p>
            )}
            {rutina && ejercicios.length > 0 && (() => {
              // Agrupamos una sola vez y decidimos, según el toggle
              // "Hoy" / "Semana completa", qué días efectivamente
              // vamos a pintar en la tabla de abajo.
              const gruposPorDia = agruparPorDia(ejercicios)
              const diasConEjercicios = DIAS_ORDEN.filter((dia) => gruposPorDia[dia])
              const hayRutinaHoy = Boolean(gruposPorDia[diaDeHoy])
              const diasAMostrar = verSemanaCompleta
                ? diasConEjercicios
                : (hayRutinaHoy ? [diaDeHoy] : [])

              return (
                <div>
                  <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
                    <p className="text-sm text-concrete">{rutina.nombre}</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setVerSemanaCompleta(false)}
                        className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition ${
                          !verSemanaCompleta
                            ? 'bg-ink text-white border-ink'
                            : 'bg-white text-concrete border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Hoy
                      </button>
                      <button
                        onClick={() => setVerSemanaCompleta(true)}
                        className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition ${
                          verSemanaCompleta
                            ? 'bg-ink text-white border-ink'
                            : 'bg-white text-concrete border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Semana completa
                      </button>
                    </div>
                  </div>

                  {!verSemanaCompleta && !hayRutinaHoy && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 text-sm text-concrete">
                      Hoy no tenés ejercicios cargados para tu rutina.
                      {diasConEjercicios.length > 0 && (
                        <>
                          {' '}Tu rutina tiene días cargados para:{' '}
                          <strong className="text-ink capitalize">{diasConEjercicios.join(', ')}</strong>.{' '}
                          <button
                            onClick={() => setVerSemanaCompleta(true)}
                            className="text-brand font-semibold hover:underline"
                          >
                            Ver semana completa
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-7">
                    {diasAMostrar.map((dia) => {
                      const porBloque = agruparPorBloque(gruposPorDia[dia])
                      return (
                        <div key={dia}>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-display font-semibold text-sm uppercase tracking-wide text-ink flex items-center gap-2">
                              {dia}
                              {dia === diaDeHoy && (
                                <span className="text-[10px] font-mono bg-brand text-white px-2 py-0.5 rounded-full normal-case tracking-normal">
                                  Hoy
                                </span>
                              )}
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
              )
            })()}
          </Card>
        )}

        {/* ------------------ CALENDARIO INTERACTIVO RESTAURADO ------------------ */}
        <Card id="reservar">
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
        <Card id="mis-turnos">
          <Eyebrow>Tu agenda</Eyebrow>
          <h2 className="font-display font-semibold text-xl uppercase tracking-wide mb-4 text-black">
            Mis turnos reservados
          </h2>

          {misReservas.length === 0 && (
            <p className="text-sm text-concrete">
              Todavía no reservaste ningún turno. Hacé clic en el calendario de arriba para elegir fecha.
            </p>
          )}

          {misReservas.map((r) => {
            // Formateamos la fecha de manera limpia y compacta (Ej: "lun. 14/9")
            const fechaFormateada = r.fecha 
              ? new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'numeric',
                })
              : '';

            return (
              <div key={r.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-brand rounded-full" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                      {r.servicio_nombre || 'Gimnasio'}
                      {r.es_fijo && (
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-1.5 py-0.5 rounded-full normal-case">
                          Fijo
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-mono text-gray-800">
                      {fechaFormateada} — {r.horarios?.hora_inicio?.slice(0, 5)} a {r.horarios?.hora_fin?.slice(0, 5)}
                    </span>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => cancelar(r.id)}>
                  Cancelar
                </Button>
              </div>
            );
          })}
        </Card>
      </div>

{/* ------------------ MODAL FLOTANTE DE HORARIOS ------------------ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold text-black mb-4">
              Seleccionar Horario
            </h3>
            
            {/* INICIO NUEVO ENCABEZADO CON FLECHAS */}
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-4 border border-gray-200">
              <button 
                onClick={() => cambiarDiaModal(-1)} 
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              
              <p className="text-red-600 font-semibold capitalize text-center text-sm m-0">
                {fechaSeleccionada.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })}
              </p>
              
              <button 
                onClick={() => cambiarDiaModal(1)} 
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            {/* FIN NUEVO ENCABEZADO CON FLECHAS */}

{misServicios.length > 1 && (
              <div className="flex gap-2 mb-4">
                {misServicios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => cambiarServicioModal(s.id)}
                    // Convertimos ambos valores a String para asegurar una comparación idéntica
                    className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg border-2 transition ${
                      String(servicioModal) === String(s.id)
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
            )}

            {/* Mensajes de validación inicial para orientar al usuario */}
            {!servicioModal && misServicios.length > 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-700 text-center font-semibold">
                  👆 Seleccioná una disciplina arriba (Gimnasio o Pilates) para cargar los horarios disponibles.
                </p>
              </div>
            ) : !servicioModal && misServicios.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No tenés ningún plan asignado todavía.
              </p>
            ) : null}

            {/* Renderizamos los horarios ÚNICAMENTE si ya hay un servicio seleccionado */}
            {servicioModal && (
              <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
                {cargandoModal ? (
                  <p className="text-sm text-gray-500 text-center py-4">Buscando horarios disponibles...</p>
                ) : turnosDisponibles.length === 0 && !proximoDisponibleModal ? (
                  <p className="text-sm text-gray-500 text-center py-4">No hay turnos disponibles para esta disciplina en esta fecha.</p>
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
            )}

            {!cargandoModal && proximoDisponibleModal && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm">
                <p className="text-gray-700 mb-2">
                  No hay lugar ese día. El próximo turno con cupo es el{' '}
                  <strong>{proximoDisponibleModal.fecha}</strong> de{' '}
                  <strong>{proximoDisponibleModal.hora_inicio.slice(0, 5)} a {proximoDisponibleModal.hora_fin.slice(0, 5)}</strong>.
                </p>
                <Button
                  variant="primary"
                  className="text-xs py-1.5 px-3 uppercase tracking-wide"
                  onClick={() => iniciarReserva(new Date(`${proximoDisponibleModal.fecha}T00:00:00`), servicioModal)}
                >
                  Ir a esa fecha
                </Button>
              </div>
            )}

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