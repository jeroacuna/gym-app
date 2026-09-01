// Un solo lugar con los links de navegación del admin. Todas las
// pantallas de /admin/* importan esta misma lista, así la barra de
// navegación se ve siempre igual sin importar en qué pantalla estés
// parado (antes cada pantalla armaba su propia lista y por eso
// cambiaba de una a otra).
export const ADMIN_NAV_LINKS = [
  { href: '/admin', label: 'Pagos' },
  { href: '/admin/socios', label: 'Socios' },
  { href: '/admin/rutinas', label: 'Rutinas' },
  { href: '/admin/horarios', label: 'Horarios' },
]