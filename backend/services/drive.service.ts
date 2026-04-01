import { google } from 'googleapis';
import { Readable } from 'stream';

const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim()
  : undefined;

console.log('[Drive Service] CLIENT_EMAIL:', CLIENT_EMAIL);
console.log('[Drive Service] PRIVATE_KEY length:', PRIVATE_KEY?.length);
console.log('[Drive Service] PRIVATE_KEY starts with:', PRIVATE_KEY?.substring(0, 27)); 

// Autenticación S2S usando tokens de servicio
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Obtiene la hora actual en Colombia (UTC-5)
 */
function getBogotaDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 5 * 60 * 60 * 1000);
}

/**
 * Formatea fecha como DD/MM/YYYY para nombres de carpetas
 */
function formatDateFolder(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Formatea hora como HH:MM para nombres de archivo
 */
function formatTimeFile(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * Busca o crea una carpeta con el nombre dado dentro de una carpeta padre
 */
export async function getOrCreateFolder(folderName: string, parentFolderId: string): Promise<string> {
  try {
    // Buscar carpeta existente
    const existing = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (existing.data.files && existing.data.files.length > 0) {
      return existing.data.files[0].id!;
    }

    // Crear carpeta nueva
    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id, name',
    });

    return created.data.id!;
  } catch (error) {
    console.error('[Drive] Error creando/buscar carpeta:', error);
    // Fallback: usar carpeta padre directamente
    return parentFolderId;
  }
}

/**
 * Limpia nombre de usuario para archivo: minúsculas, sin espacios, sin caracteres especiales
 */
export function cleanUserName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

/**
 * Genera el nombre de archivo en formato: DD/MM/YYYY/HH:MM.nombreoperario.ext
 * Crea la estructura de carpetas por fecha en Drive
 */
export async function uploadWithDateStructure(
  buffer: Buffer,
  userName: string,
  machineId: string,
  mimeType: string,
  baseFolderId: string,
  fileType: 'photo' | 'pdf' | 'closing'
): Promise<{ id: string; publicUrl: string; fileName: string }> {
  const bogotaDate = getBogotaDate();
  const dateFolder = formatDateFolder(bogotaDate); // "31/03/2026"
  const timeStr = formatTimeFile(bogotaDate); // "22:56"
  const cleanName = cleanUserName(userName); // "henrytaborda"
  const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';

  // Nombre del archivo: 22:56.henrytaborda.jpg
  const fileName = `${timeStr}.${cleanName}.${ext}`;

  // Estructura de carpetas: baseFolderId → "31/03/2026" → (opcional) subcarpetas
  let targetFolderId = baseFolderId;

  // Crear carpeta de fecha si existe base folder
  try {
    targetFolderId = await getOrCreateFolder(dateFolder, baseFolderId);
  } catch {
    // Si falla, usar carpeta base directamente
  }

  // Para PDFs de cierre, subcarpeta adicional
  if (fileType === 'closing') {
    try {
      targetFolderId = await getOrCreateFolder('Cierres', targetFolderId);
    } catch {
      // Continuar sin subcarpeta
    }
  }

  // Subir archivo
  const result = await uploadToDrive(buffer, fileName, mimeType, targetFolderId);

  return {
    id: result.id,
    publicUrl: result.publicUrl,
    fileName: `${dateFolder}/${fileName}`,
  };
}

/**
 * Uploads a file (image or PDF) to Google Drive.
 * @param buffer - File data in memory
 * @param filename - Name for the file
 * @param mimeType - Mime type of the file
 * @param folderId - Target Google Drive folder ID
 * @returns Object with the file id and public view link
 */
export async function uploadToDrive(buffer: Buffer, filename: string, mimeType: string, folderId: string) {
  console.log('[Drive Service] Attempting upload...');
  console.log('[Drive Service] CLIENT_EMAIL present:', !!CLIENT_EMAIL);
  console.log('[Drive Service] PRIVATE_KEY present:', !!PRIVATE_KEY);
  console.log('[Drive Service] PRIVATE_KEY length:', PRIVATE_KEY?.length);
  console.log('[Drive Service] PRIVATE_KEY starts with:', PRIVATE_KEY?.substring(0, 30));
  console.log('[Drive Service] Folder ID:', folderId);
  console.log('[Drive Service] Filename:', filename);
  
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    console.warn('[Drive Service] Credenciales de Drive ausentes. Saltando carga...');
    return {
      id: 'local_id_' + Date.now(),
      publicUrl: 'http://localhost/mock-url/' + filename
    };
  }

  try {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: filename,
      parents: [folderId],
    };

    const media = {
      mimeType,
      body: stream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = response.data.id;
    
    // Asegurarse de que el archivo tenga permisos públicos para lecturas (opcional pero común en reportes)
    if (fileId) {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    }

    return {
      id: fileId,
      publicUrl: response.data.webViewLink,
      downloadUrl: response.data.webContentLink,
    };
  } catch (error) {
    console.error('[Drive Service] Error subiendo archivo:', error);
    throw new Error('Fallo crítico subiendo evidencia a Google Drive.');
  }
}
