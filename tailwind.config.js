/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta con nombres propios en vez de "red-600" genérico de
        // Tailwind — así queda claro qué rol cumple cada color, y si
        // el día de mañana cambia el tono exacto, se toca en un solo
        // lugar (acá) y se propaga a toda la app.
        ink: '#0a0a0a', // negro profundo para fondos oscuros
        brand: {
          DEFAULT: '#e11d2e', // rojo intenso, el acento principal
          dark: '#a3121f',
          light: '#fdecec',
        },
        steel: '#27272a', // gris oscuro para bordes sobre fondo negro
        concrete: '#71717a', // gris medio para texto secundario
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'], // títulos grandes, en mayúscula
        sans: ['Inter', 'sans-serif'], // texto de lectura
        mono: ['"JetBrains Mono"', 'monospace'], // números y datos
      },
    },
  },
  plugins: [],
}