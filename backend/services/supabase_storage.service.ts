import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Obtiene la hora actual en Colombia (UTC-5)
 */
function getBogotaDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 5 * 60 * 60 * 1000);
}

/**
 * Limpia nombre de usuario para archivo
 */
function cleanUserName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

/**
 * Sube un archivo a Supabase Storage
 */
export async function uploadToSupabase(
  buffer: Buffer,
  userName: string,
  folder: 'photos' | 'reports' | 'closing',
  mimeType: string
): Promise<{ id: string; publicUrl: string; fileName: string }> {
  const bogotaDate = getBogotaDate();
  const cleanName = cleanUserName(userName);
  const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';

  const y = bogotaDate.getFullYear();
  const m = (bogotaDate.getMonth() + 1).toString().padStart(2, '0');
  const d = bogotaDate.getDate().toString().padStart(2, '0');
  const h = bogotaDate.getHours().toString().padStart(2, '0');
  const min = bogotaDate.getMinutes().toString().padStart(2, '0');
  const s = bogotaDate.getSeconds().toString().padStart(2, '0');
  
  const fileName = `${y}-${m}-${d}/${h}-${min}-${s}_${cleanName}.${ext}`;
  const bucketName = 'incubant-storage';

  console.log(`[Supabase Storage] Subiendo a ${bucketName}/${folder}/${fileName}...`);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(`${folder}/${fileName}`, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error('[Supabase Storage] Error:', error.message);
    throw new Error(`Fallo en Supabase Storage: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(`${folder}/${fileName}`);

  return {
    id: data.path,
    publicUrl: publicUrl,
    fileName: fileName,
  };
}
