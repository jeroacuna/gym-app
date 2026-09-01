// Etiqueta chica en mayúsculas que va arriba de un título de sección
// (ej: "TU RUTINA" antes de "Rutina de hoy"). Le da ese aire de
// panel/ficha técnica en vez de un título pelado.
export default function Eyebrow({ children }) {
  return (
    <span className="block text-brand font-mono text-xs font-semibold tracking-widest uppercase mb-1">
      {children}
    </span>
  )
}