-- ============================================================
-- Supabase Storage RLS Policies para Bucket "evidencias"
-- ============================================================
-- Ejecuta esto en Supabase SQL Editor (Dashboard > SQL)
-- ============================================================

-- 1. Permitir que CUALQUIERA lea archivos públicamente del bucket "evidencias"
CREATE POLICY "Permitir lectura pública de evidencias"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias');

-- 2. Permitir que roles autenticados suban archivos al bucket "evidencias"
CREATE POLICY "Permitir subida de evidencias autenticado"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evidencias');

-- 3. Permitir que roles autenticados actualicen sus propios archivos
CREATE POLICY "Permitir actualización de evidencias autenticado"
ON storage.objects FOR UPDATE
USING (bucket_id = 'evidencias')
WITH CHECK (bucket_id = 'evidencias');

-- 4. Permitir que roles autenticados eliminen sus propios archivos
CREATE POLICY "Permitir eliminación de evidencias autenticado"
ON storage.objects FOR DELETE
USING (bucket_id = 'evidencias');

-- ============================================================
-- Nota: Si el bucket "evidencias" no existe, créalo primero:
-- 1. Ve a Supabase Dashboard > Storage
-- 2. Haz clic en "Create new bucket"
-- 3. Nombre: evidencias
-- 4. Privacy: Private (luego las políticas RLS lo hacen público para lectura)
-- ============================================================
