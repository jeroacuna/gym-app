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
        <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${socio.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {socio.activo ? 'Activo' : 'Inactivo'}
        </span>

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