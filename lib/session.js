// Configuración de la sesión. La cookie que se genera está firmada
// y encriptada con SESSION_SECRET, así que aunque alguien la copie
// no puede modificarla para hacerse pasar por otro usuario o admin.
export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'gym-app-session',
  cookieOptions: {
    // "secure" exige HTTPS, pero en desarrollo local (http://localhost)
    // lo desactivamos para poder probar sin certificado.
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // la sesión dura 30 días
  },
}

// Forma esperada de session.usuario en todo el proyecto:
// { id, nombre, apellido, rol }
