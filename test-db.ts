import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const url = "postgresql://postgres:Espartano300$.@db.uhbtivaepyhwfdvtpfjq.supabase.co:5432/postgres";
console.log('Probando conexión HARDCODED...');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres:pass@google.com:5432/db",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conexión exitosa a la base de datos PostgreSQL.');
    
    const res = await client.query('SELECT NOW()');
    console.log('Hora del servidor:', res.rows[0].now);

    const users = await client.query('SELECT id, nombre, rol FROM "User" LIMIT 5');
    console.log('Usuarios encontrados:', users.rows.length);
    console.table(users.rows);

    // Intentar insertar un dato de prueba (logger horario parcial)
    // Buscamos un usuario y una maquina existente
    const user = users.rows[0];
    const machines = await client.query('SELECT id FROM "Machine" LIMIT 1');
    
    if (user && machines.rows[0]) {
      console.log('Insertando registro de prueba...');
      await client.query(
        'INSERT INTO "HourlyLog" (user_id, machine_id, temp_principal_actual, temp_principal_consigna, co2_actual, co2_consigna, fan_speed, temp_secundaria_actual, temp_secundaria_consigna, is_na) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [user.id, machines.rows[0].id, 37.5, 37.5, 0.5, 0.5, 50, 37.2, 37.2, false]
      );
      console.log('✅ Registro de prueba insertado correctamente.');
    } else {
      console.warn('⚠️ No hay usuarios o máquinas suficientes para insertar un log de prueba.');
    }

  } catch (err: any) {
    console.error('❌ Error de conexión:', err.message);
    if (err.code === 'ETIMEDOUT') {
      console.error('Sugerencia: Revisa que tu firewall permita conexiones al puerto 6543/5432 de Supabase.');
    }
  } finally {
    await client.end();
  }
}

main();
