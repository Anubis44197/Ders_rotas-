import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { INITIAL_REAL_COURSES, INITIAL_REAL_CURRICULUM } from '../initialRealCurriculum';

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

const validDays = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar'
];

async function main() {
  console.log('Firebase\'e anonim giriş yapılıyor...');
  const credential = await signInAnonymously(auth);
  const uid = credential.user.uid;
  console.log(`Anonim giriş başarılı. UID: ${uid}`);

  // 1. weeklySchedule Temizliği
  console.log('weeklySchedule dokümanı alınıyor...');
  const weeklyScheduleRef = doc(db, 'families', familyId, 'state', 'weeklySchedule');
  const weeklyScheduleSnap = await getDoc(weeklyScheduleRef);

  if (weeklyScheduleSnap.exists()) {
    const data = weeklyScheduleSnap.data();
    const rawValue = data.value || {};
    const cleanValue: Record<string, any> = {};

    // Sadece geçerli günleri koru
    for (const day of validDays) {
      if (rawValue[day]) {
        cleanValue[day] = rawValue[day];
      }
    }

    console.log('Temizlenmiş weeklySchedule yazılıyor...', Object.keys(cleanValue));
    await setDoc(weeklyScheduleRef, {
      schemaVersion: 2,
      syncVersion: 3,
      value: cleanValue,
      updatedAt: serverTimestamp(),
      updatedBy: uid
    }, { merge: false });
    console.log('weeklySchedule temizlendi.');
  } else {
    console.log('weeklySchedule dokümanı bulunamadı, işlem atlanıyor.');
  }

  // 2. courses ve curriculum Güncellemesi
  console.log('Temiz courses verisi yazılıyor...');
  const coursesRef = doc(db, 'families', familyId, 'state', 'courses');
  await setDoc(coursesRef, {
    schemaVersion: 2,
    syncVersion: 3,
    value: INITIAL_REAL_COURSES,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  }, { merge: false });
  console.log('courses güncellendi.');

  console.log('Temiz curriculum verisi yazılıyor...');
  const curriculumRef = doc(db, 'families', familyId, 'state', 'curriculum');
  await setDoc(curriculumRef, {
    schemaVersion: 2,
    syncVersion: 3,
    value: INITIAL_REAL_CURRICULUM,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  }, { merge: false });
  console.log('curriculum güncellendi.');

  // 3. tasks Sıfırlanması
  console.log('state/tasks dokümanı temizleniyor...');
  const tasksRef = doc(db, 'families', familyId, 'state', 'tasks');
  await setDoc(tasksRef, {
    schemaVersion: 2,
    syncVersion: 3,
    value: [],
    updatedAt: serverTimestamp(),
    updatedBy: uid
  }, { merge: false });
  console.log('tasks sıfırlandı.');

  console.log('Veritabanı onarım ve temizleme işlemi başarıyla tamamlandı!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Hata oluştu:', error);
  process.exit(1);
});
