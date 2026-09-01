import { createClient } from '@supabase/supabase-js'

// Este cliente usa la "service role key", que puede leer y escribir
// sin restricciones. Por eso SOLO se debe usar en código que corre
// en el servidor (páginas API, getServerSideProps) y nunca en el
// navegador. Lo necesitamos porque, al momento de hacer login,
// todavía no existe una sesión que autorice al usuario a leer su
// propio registro.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
