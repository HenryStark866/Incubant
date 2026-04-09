import * as dotenv from 'dotenv';

dotenv.config();

const policiesSql = `
-- 1. Lectura pública
CREATE POLICY IF NOT EXISTS "public_read_evidencias"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias');

-- 2. Subida autenticada
CREATE POLICY IF NOT EXISTS "auth_insert_evidencias"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evidencias');

-- 3. Actualización autenticada
CREATE POLICY IF NOT EXISTS "auth_update_evidencias"
ON storage.objects FOR UPDATE
USING (bucket_id = 'evidencias')
WITH CHECK (bucket_id = 'evidencias');

-- 4. Eliminación autenticada
CREATE POLICY IF NOT EXISTS "auth_delete_evidencias"
ON storage.objects FOR DELETE
USING (bucket_id = 'evidencias');
`;

function setupRLS() {
    console.log('\n🔧 CONFIGURACIÓN RÁPIDA DE FOTOS EN SUPABASE\n');
    console.log('═══════════════════════════════════════════════\n');

    console.log('✅ Tu proyecto está listo. Solo necesitas activar RLS:\n');

    console.log('📝 PASO 1: Abre Supabase Dashboard');
    console.log('  👉 https://supabase.com/dashboard/project/uhbtivaepyhwfdvtpfjq/sql/new\n');

    console.log('📝 PASO 2: Copia este código SQL:\n');
    console.log('───────────────────────────────────────────────\n');
    console.log(policiesSql);
    console.log('───────────────────────────────────────────────\n');

    console.log('📝 PASO 3: Pégalo en el SQL Editor en Supabase\n');

    console.log('📝 PASO 4: Haz clic en ▶️ RUN\n');

    console.log('✅ PASO 5: En tu terminal local, ejecuta:\n');
    console.log('  npm run dev\n');

    console.log('✅ PASO 6: ¡Toma una foto en la app!\n');

    console.log('═══════════════════════════════════════════════\n');
    console.log('¿Necesitas ayuda? Las fotos se mostrarán en:\n');
    console.log('  • Panel Admin > Dashboard');
    console.log('  • Panel Admin > Historial\n');
}

setupRLS();
