// Ícono de mancuerna dibujado a mano en SVG. Al ser código nuestro
// (no una imagen bajada de algún lado), no hay ningún tema de
// derechos de autor, y se ve nítido a cualquier tamaño.
export default function Logo({ className = 'w-8 h-8', color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 48 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="6" width="6" height="12" rx="1.5" fill={color} />
      <rect x="0" y="9" width="3" height="6" rx="1" fill={color} />
      <rect x="40" y="6" width="6" height="12" rx="1.5" fill={color} />
      <rect x="45" y="9" width="3" height="6" rx="1" fill={color} />
      <rect x="8" y="10.5" width="32" height="3" rx="1" fill={color} />
    </svg>
  )
}