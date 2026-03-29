-- ============================================
-- Supabase Storage Setup
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- para configurar el bucket de evidencias

-- ============================================
-- 1. Crear bucket 'evidencias' (si no existe)
-- ============================================
-- Nota: Si el bucket ya existe, esto fallará.
-- También puedes crearlo desde la UI: Storage > Create bucket

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidencias',
    'evidencias',
    true,
    10485760, -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Políticas de seguridad (RLS)
-- ============================================

-- Permitir lectura pública (cualquiera puede ver las fotos)
CREATE POLICY "Permitir lectura pública de evidencias"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias');

-- Permitir subida autenticada (usuarios logueados pueden subir)
CREATE POLICY "Permitir subida a usuarios autenticados"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'evidencias'
    AND auth.role() = 'authenticated'
);

-- Permitir actualización solo al dueño del archivo
CREATE POLICY "Permitir actualización al dueño"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'evidencias'
    AND auth.uid() = owner
);

-- Permitir eliminación solo al dueño o admin
CREATE POLICY "Permitir eliminación al dueño"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'evidencias'
    AND (auth.uid() = owner OR auth.jwt()->>'role' = 'JEFE')
);

-- ============================================
-- 3. Trigger para limpiar archivos huérfanos
-- ============================================
-- Opcional: Cuando se elimina un log, eliminar su foto también

CREATE OR REPLACE FUNCTION delete_evidence_file()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.photo_url IS NOT NULL THEN
        -- Extraer el path del URL de Supabase
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
