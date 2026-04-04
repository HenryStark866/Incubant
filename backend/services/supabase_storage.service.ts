import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[Storage] FALTAN credenciales de Supabase. VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_ANON_KEY) son requeridas.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getBogotaDate(): Date {
  const now = new Date();
  return new Date(now.getTime() - 5 * 60 * 60 * 1000);
}

function cleanUserName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

/**
 * Normaliza un machineId del frontend (e.g. "inc-3", "INC-03", "nac-12")
 * al formato de carpeta estandarizado: "INC-03", "NAC-12".
 */
export function normalizeMachineFolder(machineId: string): string {
  const m = machineId.match(/(inc|nac)[_\-]?(\d+)/i);
  if (!m) return machineId.toUpperCase().replace(/\s+/g, '-');
  const prefix = m[1].toUpperCase();
  const num = m[2].padStart(2, '0');
  return `${prefix}-${num}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Upload
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Sube un archivo a Supabase Storage.
 *
 * Estructura de rutas en el bucket `evidencias`:
 *
 * FOTOS DE MÁQUINA (machineId proporcionado):
 *   photos/INC-01/2026-04-04/08-30-00_luiscortes.jpg
 *
 * OTROS ARCHIVOS (sin machineId — fallback plano):
 *   photos/2026-04-04/08-30-00_luiscortes.jpg
 *   reports/2026-04-04/08-30-00_luiscortes.pdf
 */
export async function uploadToSupabase(
  buffer: Buffer,
  userName: string,
  folder: 'photos' | 'reports' | 'closing',
  mimeType: string,
  machineId?: string   // ← NEW: opcional, organiza en subcarpeta de máquina
): Promise<{ id: string; publicUrl: string; fileName: string }> {
  const bogotaDate = getBogotaDate();
  const cleanName = cleanUserName(userName);
  const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';

  const y   = bogotaDate.getUTCFullYear();
  const mo  = (bogotaDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const d   = bogotaDate.getUTCDate().toString().padStart(2, '0');
  const h   = bogotaDate.getUTCHours().toString().padStart(2, '0');
  const min = bogotaDate.getUTCMinutes().toString().padStart(2, '0');
  const s   = bogotaDate.getUTCSeconds().toString().padStart(2, '0');

  const dateSegment = `${y}-${mo}-${d}`;
  const fileSegment = `${h}-${min}-${s}_${cleanName}.${ext}`;

  // Ruta organizada por máquina si se proporciona machineId
  let storagePath: string;
  if (machineId && folder === 'photos') {
    const machineFolder = normalizeMachineFolder(machineId);
    storagePath = `${folder}/${machineFolder}/${dateSegment}/${fileSegment}`;
  } else {
    storagePath = `${folder}/${dateSegment}/${fileSegment}`;
  }

  const bucketName = 'evidencias';
  console.log(`[Storage] Subiendo → ${bucketName}/${storagePath}`);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error('[Storage] Error:', error.message);
    throw new Error(`Fallo en Supabase Storage: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  return {
    id: data.path,
    publicUrl,
    fileName: fileSegment,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// List files in a machine's folder (used by /api/evidence/machine/:id)
// ──────────────────────────────────────────────────────────────────────────────

export async function listMachinePhotos(
  machineId: string,
  limit = 50
): Promise<{ name: string; publicUrl: string; createdAt: string }[]> {
  const machineFolder = normalizeMachineFolder(machineId);
  const prefix = `photos/${machineFolder}/`;
  const bucketName = 'evidencias';

  // List all date-subfolders
  const { data: folders, error: foldersError } = await supabase.storage
    .from(bucketName)
    .list(prefix.replace(/\/$/, ''), { limit: 365, sortBy: { column: 'name', order: 'desc' } });

  if (foldersError || !folders) return [];

  const allFiles: { name: string; publicUrl: string; createdAt: string }[] = [];

  for (const folder of folders.slice(0, 10)) { // máx 10 días de carpetas
    if (allFiles.length >= limit) break;
    const dayPath = `photos/${machineFolder}/${folder.name}`;
    const { data: files, error: filesError } = await supabase.storage
      .from(bucketName)
      .list(dayPath, { limit: 50, sortBy: { column: 'name', order: 'desc' } });

    if (filesError || !files) continue;

    for (const file of files) {
      if (allFiles.length >= limit) break;
      const filePath = `${dayPath}/${file.name}`;
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      allFiles.push({
        name: file.name,
        publicUrl,
        createdAt: file.created_at || folder.name,
      });
    }
  }

  return allFiles;
}
