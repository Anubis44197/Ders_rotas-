import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDnolB5eGB4YtZBEklbVpQsJ7qhsQsSQeI',
  authDomain: 'ders-tak.firebaseapp.com',
  projectId: 'ders-tak',
  storageBucket: 'ders-tak.firebasestorage.app',
  messagingSenderId: '1017687251305',
  appId: '1:1017687251305:web:8bdbe9daebe6b1366685f8',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const familyId = 'ders-tak-main';

async function main() {
  console.log('Firebase\'e anonim giriş yapılıyor...');
  const credential = await signInAnonymously(auth);
  const uid = credential.user.uid;
  console.log(`Anonim giriş başarılı. UID: ${uid}`);

  // 1. state/tasks temizlenmesi
  console.log('state/tasks dokümanı temizleniyor...');
  const tasksRef = doc(db, 'families', familyId, 'state', 'tasks');
  await setDoc(tasksRef, {
    schemaVersion: 2,
    syncVersion: 3,
    value: [],
    updatedAt: serverTimestamp(),
    updatedBy: uid
  }, { merge: false });
  console.log('state/tasks sıfırlandı.');

  // 2. taskChunks koleksiyonunun temizlenmesi
  console.log('taskChunks koleksiyonu temizleniyor...');
  const chunksRef = collection(db, 'families', familyId, 'taskChunks');
  const chunksSnap = await getDocs(chunksRef);
  
  if (!chunksSnap.empty) {
    console.log(`${chunksSnap.size} adet chunk bulundu, siliniyor...`);
    const deletePromises = chunksSnap.docs.map((chunkDoc) => {
      console.log(`Siliniyor: taskChunks/${chunkDoc.id}`);
      return deleteDoc(doc(db, 'families', familyId, 'taskChunks', chunkDoc.id));
    });
    await Promise.all(deletePromises);
    console.log('Tüm taskChunks temizlendi.');
  } else {
    console.log('Silinecek taskChunks bulunamadı.');
  }

  console.log('Veritabanı temizleme işlemi başarıyla tamamlandı!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Hata oluştu:', error);
  process.exit(1);
});
