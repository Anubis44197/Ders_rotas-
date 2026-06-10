import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

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

async function run() {
  console.log("Signing in anonymously...");
  await signInAnonymously(auth);
  console.log("Signed in successfully. Fetching tasks from chunks...");
  
  const querySnapshot = await getDocs(collection(db, 'families', familyId, 'taskChunks'));
  const docs = querySnapshot.docs.map(d => ({ id: d.id, data: d.data() }));
  
  console.log(`Found ${docs.length} chunk docs.`);
  for (const doc of docs) {
    if (doc.id === 'task_order') {
      console.log(`\nDoc ID: ${doc.id} (Contains task order list, length: ${doc.data.value?.length})`);
      continue;
    }
    console.log(`\nDoc ID: ${doc.id}`);
    const val = doc.data.value;
    if (Array.isArray(val)) {
      console.log(`Contains ${val.length} tasks/items.`);
      val.forEach((task: any, idx) => {
        if (task && typeof task === 'object') {
          console.log(`  [${idx}] JSON:`, JSON.stringify(task, null, 2));
        } else {
          console.log(`  [${idx}] Non-object:`, task);
        }
      });
    } else {
      console.log("Value is not an array:", val);
    }
  }
}

run().catch(console.error);
