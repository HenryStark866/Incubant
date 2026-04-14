import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Inicializamos Firebase Admin.
// Buscar credenciales locales o parsear de variables de entorno (FIREBASE_SERVICE_ACCOUNT)

function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      let credential;
      
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
         credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
      } else {
         // Fallback local
         const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
         if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            credential = admin.credential.cert(serviceAccount);
         }
      }

      admin.initializeApp({
        credential,
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || 'https://incubant-db-default-rtdb.firebaseio.com' 
      });
      
      console.log('✅ Firebase Admin inicializado exitosamente.');

    } catch (error) {
      console.error('❌ Error inicializando Firebase Admin:', error);
    }
  }
}

initializeFirebaseAdmin();

export const db = admin.database();
export const fAuth = admin.auth();
export const fStorage = admin.storage();
