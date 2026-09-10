// Un solo lugar con los links de navegación del admin. Todas las
// pantallas de /admin/* importan esta misma lista, así la barra de
// navegación (y ahora también el menú hamburguesa) se ven siempre
// igual sin importar en qué pantalla estés parado.
export const ADMIN_NAV_LINKS = [
  { href: '/admin', label: 'Pagos', icon: '💰' },
  { href: '/admin/socios', label: 'Socios', icon: '👥' },
  { href: '/admin/anuncios', label: 'Anuncios', icon: '📣' },
  { href: '/admin/rutinas', label: 'Rutinas', icon: '🏋️' },
  { href: '/admin/horarios', label: 'Horarios', icon: '📅' },
]