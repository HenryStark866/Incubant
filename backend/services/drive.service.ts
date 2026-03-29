import { google } from 'googleapis';
import { Readable } from 'stream';

const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'); 

// Autenticación S2S usando tokens de servicio
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Uploads a file (image or PDF) to Google Drive.
 * @param buffer - File data in memory
 * @param filename - Name for the file
 * @param mimeType - Mime type of the file
 * @param folderId - Target Google Drive folder ID
 * @returns Object with the file id and public view link
 */
export async function uploadToDrive(buffer: Buffer, filename: string, mimeType: string, folderId: string) {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    console.warn('[Drive Service] Credenciales de Drive ausentes. Saltando carga...');
    // Para entornos locales sin credenciales devolvemos un mock.
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
