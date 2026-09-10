// Utilidad para obtener la fecha/hora "de pared" de Argentina sin
// depender de en qué huso horario esté corriendo el servidor. Los
// serverless de Vercel corren en UTC por default (salvo que se
// configure la variable de entorno TZ), así que un simple
// `new Date().getHours()` puede darte la hora de Londres, no la de
// Paraná. Acá le pedimos a Intl directamente los campos ya
// convertidos a America/Argentina/Buenos_Aires, sin importar dónde
// esté físicamente corriendo el proceso.
const ZONA = 'America/Argentina/Buenos_Aires'

const DIAS_EN_A_ES = {
  Sunday: 'domingo',
  Monday: 'lunes',
  Tuesday: 'martes',
  Wednesday: 'miercoles',
  Thursday: 'jueves',
  Friday: 'viernes',
  Saturday: 'sabado',
}

export function ahoraEnArgentina() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  }).formatToParts(new Date())

  const obtener = (tipo) => partes.find((p) => p.type === tipo)?.value

  // Algunos entornos devuelven "24" para la medianoche con hour12:false.
  const hora = obtener('hour') === '24' ? '00' : obtener('hour')

  return {
    fecha: `${obtener('year')}-${obtener('month')}-${obtener('day')}`, // YYYY-MM-DD
    horaHHMMSS: `${hora}:${obtener('minute')}:${obtener('second')}`,
    diaSemana: DIAS_EN_A_ES[obtener('weekday')],
  }
}