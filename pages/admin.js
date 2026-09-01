import { useEffect, useState } from 'react'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '../lib/session'
import Navbar from '../components/Navbar'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Eyebrow from '../components/ui/Eyebrow'
import { ADMIN_NAV_LINKS } from '../lib/adminNav'

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

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export default function Admin({ usuario }) {
  const [socios, setSocios] = useState([])
  const [mes, setMes] = useState(null)
  const [anio, setAnio] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarSocios()
  }, [])

  function cargarSocios() {
    setCargando(true)
    fetch('/api/admin/socios')
      .then((r) => r.json())
      .then((data) => {
        setSocios(data.socios || [])
        setMes(data.mes)
        setAnio(data.anio)
        setCargando(false)
      })
  }

  async function togglePago(socio) {
    setSocios((prev) =>
      prev.map((s) => (s.id === socio.id ? { ...s, pagado: !s.pagado } : s))
    )

    const res = await fetch('/api/admin/marcar-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: socio.id, pagado: !socio.pagado }),
    })

    if (!res.ok) {
      setSocios((prev) =>
        prev.map((s) => (s.id === socio.id ? { ...s, pagado: socio.pagado } : s))
      )
    }
  }

  const sociosFiltrados = socios.filter((s) => {
    const texto = `${s.nombre} ${s.apellido} ${s.dni}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  const cantidadAlDia = socios.filter((s) => s.pagado).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar links={ADMIN_NAV_LINKS} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Eyebrow>Panel de administración</Eyebrow>
        <h1 className="font-display font-semibold text-2xl uppercase tracking-wide">Hola, {usuario.nombre}</h1>

        <Card className="mt-6">
          <div className="flex justify-between items-baseline mb-4 flex-wrap gap-2">
            <h2 className="font-display font-semibold text-lg uppercase tracking-wide capitalize">
              Cuota — {mes ? NOMBRES_MES[mes - 1] : ''} {anio}
            </h2>
            {!cargando && (
              <span className="font-mono text-sm text-concrete">
                <strong className="text-ink">{cantidadAlDia}</strong> / {socios.length} al día
              </span>
            )}
          </div>

          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand"
          />

          {cargando && <p className="text-sm text-concrete">Cargando socios...</p>}
          {!cargando && sociosFiltrados.length === 0 && (
            <p className="text-sm text-concrete">No se encontraron socios.</p>
          )}

          {!cargando &&
            sociosFiltrados.map((s) => (
              <div key={s.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                <div>
                  <strong className="text-sm">{s.nombre} {s.apellido}</strong>
                  <div className="text-xs text-concrete font-mono">DNI {s.dni}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={s.pagado ? 'success' : 'danger'}>{s.pagado ? 'Al día' : 'Debe'}</Badge>
                  <Button variant="secondary" onClick={() => togglePago(s)}>
                    {s.pagado ? 'Marcar pendiente' : 'Marcar pagado'}
                  </Button>
                </div>
              </div>
            ))}
        </Card>
      </div>
    </div>
  )
}