# 📸 FIX: Sincronización de Fotos - Supabase Storage

## ¿Cuál es el problema?

Las fotos se toman en la app pero no aparecen en el panel de admin porque:
- El backend intenta subir a Supabase Storage
- Las políticas RLS del bucket `evidencias` no permiten las subidas
- O el bucket no existe

## ✅ Solución paso a paso

### Paso 1: Ve a Supabase Dashboard
1. Abre https://supabase.com/dashboard
2. Selecciona el proyecto `uhbtivaepyhwfdvtpfjq`
3. Ve a **Storage** en el menú izquierdo

### Paso 2: Crear el bucket (si no existe)
Si no ves un bucket llamado `evidencias`:
1. Haz clic en **Create new bucket**
2. Nombre: `evidencias`
3. Privacy: **Private** (selecciona esto)
4. Haz clic en **Create bucket**

### Paso 3: Aplicar las políticas RLS
1. Ve a **SQL Editor** en Supabase Dashboard
2. Haz clic en **New query**
3. Abre el archivo `supabase/storage-policies.sql` de este proyecto
4. Copia TODO el contenido (excepto los comentarios con `--`)
5. Pégalos en el SQL Editor
6. Haz clic en **Run**

Esto permitirá que:
- ✅ Cualquiera LEA las fotos (públicamente)
- ✅ Usuarios autenticados SUBAN fotos
- ✅ El backend cree carpetas automáticamente

### Paso 4: Reiniciar el servidor
En tu terminal:
```bash
# Para el servidor actual (Ctrl+C)
cd c:\Users\tabor\Incubant
npm run dev
```

### Paso 5: Prueba
1. Abre la app
2. Toma una foto
3. Confirma
4. Ve al panel de admin (supervisor)
5. ¡La foto debería aparecer! 📸

## 🔧 Variables de entorno (ya configuradas)

```env
VITE_SUPABASE_URL=https://uhbtivaepyhwfdvtpfjq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoYnRpdmFlcHlod2ZkdnRwZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODU0MTMsImV4cCI6MjA4OTg2MTQxM30.YaJzau2pASUSLmL7OVwqqTnp5M9Q6s3lQsXCbGw_W5M
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoYnRpdmFlcHlod2ZkdnRwZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODU0MTMsImV4cCI6MjA4OTg2MTQxM30.YaJzau2pASUSLmL7OVwqqTnp5M9Q6s3lQsXCbGw_W5M
```

✅ Listo. Las fotos fluirán desde el operario al admin panel.
