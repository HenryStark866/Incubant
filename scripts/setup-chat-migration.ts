import fs from 'fs';
import path from 'path';

/**
 * Script para ejecutar las migraciones de chat en Supabase SQL Editor
 * Instrucciones:
 * 1. Abre https://supabase.com/dashboard/project/uhbtivaepyhwfdvtpfjq/sql/new
 * 2. Copia todo el SQL abajo
 * 3. Pégalo en el SQL Editor
 * 4. Ejecuta (Ctrl+Enter)
 * 5. Refresh la aplicación
 */

async function generateChatMigrationInstructions() {
    const sqlFilePath = path.join(__dirname, '../prisma/migrations/9999_add_chat_system.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf-8');

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     INSTRUCCIONES: Sistema de Chat en Supabase           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');

    console.log('📋 PASOS A SEGUIR:\n');
    console.log('1️⃣  Ve a: https://supabase.com/dashboard/project/uhbtivaepyhwfdvtpfjq/sql/new');
    console.log('   (O click en SQL Editor → Nueva Query)\n');

    console.log('2️⃣  COPIA TODO EL SQL SIGUIENTE:\n');
    console.log('─'.repeat(64));
    console.log(sql);
    console.log('─'.repeat(64));
    console.log('\n');

    console.log('3️⃣  PÉGALO en el SQL Editor de Supabase\n');

    console.log('4️⃣  Presiona CTRL+ENTER (o el botón RUN)\n');

    console.log('5️⃣  ¡Listo! Las tablas de chat están creadas\n');

    console.log('✅ VALIDACIÓN:');
    console.log('   Después de ejecutar, deberías ver estas tablas en tu proyecto:');
    console.log('   • Conversation');
    console.log('   • ConversationParticipant');
    console.log('   • Message\n');

    console.log('⚠️  NOTA IMPORTANTE:');
    console.log('   • Este script es SOLO para desarrollo local');
    console.log('   • En producción (Render/Vercel) Prisma migrará automáticamente\n');

    process.exit(0);
}

generateChatMigrationInstructions().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
