import { useState } from 'react'
import { useRouter } from 'next/router'
import Logo from '../components/Logo'
import { NOMBRE_GIMNASIO } from '../lib/config'

export default function Login() {
  const [dni, setDni] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'No se pudo iniciar sesión')
      return
    }

    router.push(data.rol === 'admin' ? '/admin' : '/dashboard')
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 overflow-hidden">
      {/* Foto de fondo con overlay oscuro, mismo recurso visual que la
          landing de referencia: intensidad y ambiente de entrenamiento
          real, no un fondo de color plano. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1740&auto=format&fit=crop')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/90 via-ink/85 to-ink" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-20 h-10 text-brand mb-4" />
          <h1 className="text-white font-display font-semibold text-2xl sm:text-3xl uppercase tracking-wide text-center leading-tight">
            {NOMBRE_GIMNASIO}
          </h1>
          <p className="text-white/50 text-xs font-mono uppercase tracking-widest mt-2">
            Entrená sin límites
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl border-t-4 border-brand">
          <h2 className="font-display font-semibold text-lg uppercase tracking-wide">Ingresar</h2>
          <p className="text-sm text-concrete mb-6 mt-1">Ingresá tu DNI para ver tu rutina y tus turnos</p>

          <form onSubmit={handleSubmit}>
            <label className="block text-xs font-mono font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              DNI
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 30123456"
              autoFocus
              className="w-full px-3.5 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-base font-mono"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-ink text-white rounded-lg py-3 font-display font-semibold uppercase tracking-wide hover:bg-brand transition disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {error && (
            <p className="text-brand text-sm mt-3 font-medium">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}