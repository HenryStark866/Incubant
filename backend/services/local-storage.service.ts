import fs from 'fs';
import path from 'path';

const EVIDENCIAS_DIR = path.join(process.cwd(), 'evidencias');

/**
 * Asegura que exista la carpeta evidencias y subcarpetas por fecha
 */
function ensureDateFolder(): string {
  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bogotaDate = new Date(utc - 5 * 60 * 60 * 1000);

  const day = bogotaDate.getDate().toString().padStart(2, '0');
  const month = (bogotaDate.getMonth() + 1).toString().padStart(2, '0');
  const year = bogotaDate.getFullYear();

  const dateFolder = path.join(EVIDENCIAS_DIR, `${day}-${month}-${year}`);
  if (!fs.existsSync(dateFolder)) {
    fs.mkdirSync(dateFolder, { recursive: true });
  }

  return dateFolder;
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
 * Guarda una foto desde base64 data URL
 */
export function savePhotoFromBase64(
  base64DataUrl: string,
  userName: string,
  machineId: string
): { relativePath: string; fileName: string } {
  const dateFolder = ensureDateFolder();

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bogotaDate = new Date(utc - 5 * 60 * 60 * 1000);

  const h = bogotaDate.getHours().toString().padStart(2, '0');
  const min = bogotaDate.getMinutes().toString().padStart(2, '0');
  const s = bogotaDate.getSeconds().toString().padStart(2, '0');

  const cleanName = cleanUserName(userName);
  const ext = base64DataUrl.includes('png') ? 'png' : base64DataUrl.includes('webp') ? 'webp' : 'jpg';
  const fileName = `${h}${min}${s}_${machineId.replace(/[^a-zA-Z0-9-]/g, '')}_${cleanName}.${ext}`;
  const localPath = path.join(dateFolder, fileName);

  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(localPath, buffer);

  const dateFolderName = path.basename(dateFolder);
  const relativePath = `evidencias/${dateFolderName}/${fileName}`;
  console.log(`[Local Storage] Foto guardada: ${relativePath} (${buffer.length} bytes)`);

  return { relativePath, fileName };
}

/**
 * Guarda una foto localmente en la carpeta evidencias
 */
export function savePhotoLocally(
  buffer: Buffer,
  userName: string,
  machineId: string,
  mimeType: string
): { localPath: string; relativePath: string; fileName: string } {
  const dateFolder = ensureDateFolder();

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bogotaDate = new Date(utc - 5 * 60 * 60 * 1000);

  const h = bogotaDate.getHours().toString().padStart(2, '0');
  const min = bogotaDate.getMinutes().toString().padStart(2, '0');
  const s = bogotaDate.getSeconds().toString().padStart(2, '0');

  const cleanName = cleanUserName(userName);
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';

  const fileName = `${h}${min}${s}_${machineId.replace(/[^a-zA-Z0-9-]/g, '')}_${cleanName}.${ext}`;
  const localPath = path.join(dateFolder, fileName);

  fs.writeFileSync(localPath, buffer);

  const dateFolderName = path.basename(dateFolder);
  const relativePath = `evidencias/${dateFolderName}/${fileName}`;

  console.log(`[Local Storage] Foto guardada: ${relativePath}`);

  return { localPath, relativePath, fileName };
}

/**
 * Guarda un PDF localmente en la carpeta evidencias/reportes
 */
export function savePdfLocally(
  buffer: Buffer,
  userName: string,
  machineId: string
): { localPath: string; relativePath: string; fileName: string } {
  const dateFolder = ensureDateFolder();
  const reportFolder = path.join(dateFolder, 'reportes');

  if (!fs.existsSync(reportFolder)) {
    fs.mkdirSync(reportFolder, { recursive: true });
  }

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bogotaDate = new Date(utc - 5 * 60 * 60 * 1000);

  const h = bogotaDate.getHours().toString().padStart(2, '0');
  const min = bogotaDate.getMinutes().toString().padStart(2, '0');
  const s = bogotaDate.getSeconds().toString().padStart(2, '0');

  const cleanName = cleanUserName(userName);
  const fileName = `${h}${min}${s}_${machineId.replace(/[^a-zA-Z0-9-]/g, '')}_${cleanName}.pdf`;
  const localPath = path.join(reportFolder, fileName);

  fs.writeFileSync(localPath, buffer);

  const dateFolderName = path.basename(dateFolder);
  const relativePath = `evidencias/${dateFolderName}/reportes/${fileName}`;

  console.log(`[Local Storage] PDF guardado: ${relativePath}`);

  return { localPath, relativePath, fileName };
}
