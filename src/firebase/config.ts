// Firebase konfigürasyon dosyası
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { enableNetwork, disableNetwork } from 'firebase/firestore';

// Firebase konfigürasyonu - Environment variables'dan alınıyor
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase uygulamasını başlat
const app = initializeApp(firebaseConfig);

// Firebase servislerini yapılandır
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Timeout ve offline destek ayarları
const FIREBASE_TIMEOUT = 10000; // 10 saniye

// Connection helper fonksiyonları
export const enableFirebaseNetwork = () => enableNetwork(db);
export const disableFirebaseNetwork = () => disableNetwork(db);

// Connection state checker
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    // Basit bir test sorgusu ile bağlantıyı kontrol et
    const testTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firebase connection timeout')), FIREBASE_TIMEOUT)
    );
    
    // İki Promise'i yarış halinde çalıştır
    await Promise.race([
      import('firebase/firestore').then(({ collection, getDocs, limit, query }) => 
        getDocs(query(collection(db, 'test'), limit(1)))
      ),
      testTimeout
    ]);
    
    return true;
  } catch (error) {
    console.warn('Firebase bağlantısı kontrol edilemiyor:', error);
    return false;
  }
};

export default app;