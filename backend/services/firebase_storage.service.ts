import admin from 'firebase-admin';

function getAdminApp(): admin.app.App {
  try {
    const apps = admin.apps || [];
    if (apps.length === 0) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : undefined;

      if (serviceAccount) {
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
          storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'incubant-db.firebasestorage.app',
        });
      } else {
        return admin.initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'incubant-db',
          storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'incubant-db.firebasestorage.app',
        });
      }
    }
  } catch (e) {
    console.error('[Firebase Storage] Init error:', e);
  }
  return admin.app();
}

export function getBogotaDate(): Date {
  return new Date(Date.now() - 5 * 60 * 60 * 1000);
}

function cleanUserName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

export function normalizeMachineFolder(machineId: string): string {
  const m = machineId.match(/(inc|nac)[_\-]?(\d+)/i);
  if (!m) return machineId.toUpperCase().replace(/\s+/g, '-');
  const prefix = m[1].toUpperCase();
  const num = m[2].padStart(2, '0');
  return `${prefix}-${num}`;
}

export async function uploadToFirebase(
  buffer: Buffer,
  userName: string,
  folder: 'photos' | 'reports' | 'closing',
  mimeType: string,
  machineId?: string
): Promise<{ id: string; publicUrl: string; fileName: string }> {
  const app = getAdminApp();
  const storage = admin.storage(app);
  const bogotaDate = getBogotaDate();
  const cleanName = cleanUserName(userName);
  const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';

  const y = bogotaDate.getUTCFullYear();
  const mo = (bogotaDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = bogotaDate.getUTCDate().toString().padStart(2, '0');
  const h = bogotaDate.getUTCHours().toString().padStart(2, '0');
  const min = bogotaDate.getUTCMinutes().toString().padStart(2, '0');
  const s = bogotaDate.getUTCSeconds().toString().padStart(2, '0');

  const dateSegment = `${y}-${mo}-${d}`;
  const fileSegment = `${h}-${min}-${s}_${cleanName}.${ext}`;

  let storagePath: string;
  if (machineId && folder === 'photos') {
    const machineFolder = normalizeMachineFolder(machineId);
    storagePath = `evidencias/${folder}/${machineFolder}/${dateSegment}/${fileSegment}`;
  } else {
    storagePath = `evidencias/${folder}/${dateSegment}/${fileSegment}`;
  }

  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
  });

  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  return {
    id: storagePath,
    publicUrl,
    fileName: fileSegment,
  };
}

export async function listMachinePhotos(
  machineId: string,
  maxResults = 50
): Promise<{ name: string; publicUrl: string; createdAt: string }[]> {
  const app = getAdminApp();
  const storage = admin.storage(app);
  const machineFolder = normalizeMachineFolder(machineId);
  const prefix = `evidencias/photos/${machineFolder}/`;
  const bucket = storage.bucket();

  const [files] = await bucket.getFiles({ prefix, maxResults });

  return files
    .sort((a, b) => b.metadata.updated!.localeCompare(a.metadata.updated!))
    .slice(0, maxResults)
    .map(file => ({
      name: file.name.split('/').pop() || file.name,
      publicUrl: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
      createdAt: file.metadata.updated || '',
    }));
}

export const collections = {
  users: 'users',
  machines: 'machines',
  hourlyLogs: 'hourly_logs',
  incidents: 'incidents',
  shifts: 'shifts',
  scheduleAssignments: 'schedule_assignments',
  sessions: 'sessions',
  reports: 'reports',
  leaveRequests: 'leave_requests',
};
