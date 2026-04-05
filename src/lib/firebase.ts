import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, type FirebaseStorage } from 'firebase/storage';

export { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp };
export type { QuerySnapshot, DocumentData };

export function normalizeMachineFolder(machineId: string): string {
  const m = machineId.match(/(inc|nac)[_\-]?(\d+)/i);
  if (!m) return machineId.toUpperCase().replace(/\s+/g, '-');
  const prefix = m[1].toUpperCase();
  const num = m[2].padStart(2, '0');
  return `${prefix}-${num}`;
}

function getBogotaDate(): Date {
  return new Date(Date.now() - 5 * 60 * 60 * 1000);
}

export async function uploadEvidenceImage(base64Image: string, machineId: string, storage: FirebaseStorage): Promise<string | null> {
  try {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const byteCharacters = atob(base64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    const blob = new Blob(byteArrays, { type: 'image/jpeg' });
    const machineFolder = normalizeMachineFolder(machineId);
    const bogota = getBogotaDate();
    const dateSeg = `${bogota.getUTCFullYear()}-${(bogota.getUTCMonth()+1).toString().padStart(2,'0')}-${bogota.getUTCDate().toString().padStart(2,'0')}`;
    const fileName = `${machineFolder}/${dateSeg}/${Date.now()}.jpg`;
    const storageRef = ref(storage, `evidencias/${fileName}`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading image to Firebase:', error);
    return base64Image;
  }
}

export async function uploadEvidencePDF(pdfBlob: Blob, operario: string, storage: FirebaseStorage): Promise<string | null> {
  try {
    const fileName = `reportes/Reporte_${operario.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const storageRef = ref(storage, `evidencias/${fileName}`);
    await uploadBytes(storageRef, pdfBlob, { contentType: 'application/pdf' });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading PDF to Firebase:', error);
    return null;
  }
}

export async function listEvidences(folder: string, storage: FirebaseStorage) {
  try {
    const folderRef = ref(storage, `evidencias/${folder}`);
    const result = await listAll(folderRef);
    const files = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return { name: itemRef.name, publicUrl: url };
      })
    );
    return files;
  } catch (error) {
    console.error('Error listing evidences:', error);
    return [];
  }
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
