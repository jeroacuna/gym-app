// Logo de la marca. Antes era una mancuerna dibujada en SVG; ahora
// es la imagen que nos pasó el gimnasio (fondo rojo, "J.U" en
// blanco). Al ser una imagen cuadrada, el className que se le pasa
// desde afuera debería mantener proporción 1:1.
export default function Logo({ className = 'w-8 h-8' }) {
  return (
    <img
      src="/logo.png"
      alt="Logo del gimnasio"
      className={`${className} object-contain rounded-md`}
    />
  )
}