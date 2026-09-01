# Gym App

## Cómo correrlo por primera vez

1. Instalar dependencias:
   ```
   npm install
   ```

2. Copiar el archivo de variables de entorno y completarlo con tus
   datos reales de Supabase (Project Settings > API):
   ```
   cp .env.local.example .env.local
   ```

3. Levantar el servidor de desarrollo:
   ```
   npm run dev
   ```

4. Abrir http://localhost:3000 — te va a redirigir directo al login.

## Cómo probar el login

Como todavía no hay una pantalla para dar de alta socios, tenés que
cargar un usuario de prueba directo desde Supabase:

1. Andá al **Table Editor** de Supabase, tabla `usuarios`.
2. Insertá una fila manualmente con un DNI de prueba (ej: `11111111`),
   nombre, apellido, y `rol` = `admin` (para poder ver el panel de
   administrador) o `socio`.
3. Andá a `http://localhost:3000/login` e ingresá ese DNI.

## Estructura del proyecto

- `lib/supabaseClient.js` — conexión a la base de datos (server-side).
- `lib/session.js` — configuración de las cookies de sesión.
- `pages/api/login.js` — busca el DNI y crea la sesión.
- `pages/api/logout.js` — destruye la sesión.
- `pages/login.js` — pantalla de ingreso.
- `pages/dashboard.js` — pantalla del socio (protegida).
- `pages/admin.js` — pantalla del dueño (protegida, solo rol admin).
