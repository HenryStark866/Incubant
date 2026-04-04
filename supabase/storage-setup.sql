-- ============================================
-- Supabase Storage Setup
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- para configurar el bucket de evidencias
-- ============================================

-- ============================================
-- 1. Crear bucket 'evidencias' (si no existe)
-- ============================================
-- Nota: También puedes crearlo desde la UI: Storage > Create bucket > "evidencias" (público)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidencias',
    'evidencias',
    true,
    52428800, -- 50MB (para soportar PDFs y fotos)
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

-- ============================================
-- 2. Políticas de seguridad (RLS)
-- ============================================

-- Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura pública de evidencias" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización al dueño" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación al dueño" ON storage.objects;

-- Política: Lectura pública (cualquiera puede ver archivos)
CREATE POLICY "Permitir lectura pública de evidencias"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias');

-- Política: Subida para usuarios autenticados (Supabase Auth)
CREATE POLICY "Permitir subida a usuarios autenticados"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evidencias');

-- Política: Subida para servicio backend (sin auth de Supabase - usa service role key)
-- Esta política permite que el backend Express suba archivos sin pasar por Supabase Auth
CREATE POLICY "Permitir subida desde backend"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evidencias');

-- Política: Actualización
CREATE POLICY "Permitir actualización de evidencias"
ON storage.objects FOR UPDATE
USING (bucket_id = 'evidencias');

-- Política: Eliminación
CREATE POLICY "Permitir eliminación de evidencias"
ON storage.objects FOR DELETE
USING (bucket_id = 'evidencias');

-- ============================================
-- 3. Trigger para limpiar archivos huérfanos
-- ============================================

CREATE OR REPLACE FUNCTION delete_evidence_file()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.photo_url IS NOT NULL THEN
        DELETE FROM storage.objects
        WHERE bucket_id = 'evidencias'
        AND name = substring(OLD.photo_url from '.*/evidencias/(.*)');
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Descomentar si se desea activar la limpieza automática:
-- CREATE TRIGGER trigger_delete_evidence_file
--     AFTER DELETE ON "HourlyLog"
--     FOR EACH ROW
--     EXECUTE FUNCTION delete_evidence_file();
