import { google } from 'googleapis';
import { Readable } from 'stream';

const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// IDs de carpetas de Google Drive configuradas (provienen de las URLs compartidas en la barra lateral del Dashboard)
const FOLDER_IDS: Record<string, string> = {
  photos: process.env.DRIVE_PHOTOS_FOLDER || '1LSI9hpfQiYD0w0U79Noh6tI1BDgnHwqn',
  reports: process.env.DRIVE_REPORTS_FOLDER || '15NhdznwFJycDOFsQs9dZwTS6vR_srfXi',
  shifts: process.env.DRIVE_SHIFTS_FOLDER || '1tI5ROHJ_RxeSWE2Q38BXxAVk82TYrdtG',
};

export async function uploadToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folderKey: 'photos' | 'reports' | 'shifts' = 'photos'
): Promise<{ id: string | null; publicUrl: string; downloadUrl?: string }> {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    console.warn('[Drive Service] Credenciales de Google Drive ausentes. Usando mock URL.');
    return { id: null, publicUrl: `https://mock.drive.local/${filename}` };
  }

  try {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const folderId = FOLDER_IDS[folderKey];

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: { mimeType, body: stream },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = response.data.id;

    // Hacer el archivo públicamente accesible (solo lectura)
    if (fileId) {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    }

    return {
      id: fileId || null,
      publicUrl: response.data.webViewLink || '',
      downloadUrl: response.data.webContentLink || '',
    };
  } catch (error) {
    console.error('[Drive Service] Error subiendo a Google Drive:', error);
    throw new Error('No se pudo subir el archivo a Google Drive.');
  }
}
