import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from './config';
import { Course, Task, PerformanceData, Reward, Badge, PracticeExam } from '../../types';

// Koleksiyon referansları
const coursesRef = collection(db, 'courses');
const tasksRef = collection(db, 'tasks');
const performanceRef = collection(db, 'performance');
const rewardsRef = collection(db, 'rewards');
const badgesRef = collection(db, 'badges');
const userDataRef = collection(db, 'userData');
const practiceExamsRef = collection(db, 'practiceExams'); // Yeni koleksiyon referansı

// Kurs işlemleri
export const addCourseToFirebase = async (course: Course) => {
  try {
    const docRef = await addDoc(coursesRef, course);
    return docRef.id;
  } catch (error) {
    console.error('Kurs ekleme hatası:', error);
    throw error;
  }
};

export const updateCourseInFirebase = async (courseId: string, course: Partial<Course>) => {
  try {
    const courseDoc = doc(db, 'courses', courseId);
    await updateDoc(courseDoc, course);
  } catch (error) {
    console.error('Kurs güncelleme hatası:', error);
    throw error;
  }
};

export const deleteCourseFromFirebase = async (courseId: string) => {
  try {
    const courseDoc = doc(db, 'courses', courseId);
    await deleteDoc(courseDoc);
  } catch (error) {
    console.error('Kurs silme hatası:', error);
    throw error;
  }
};

export const getCoursesFromFirebase = async () => {
  try {
    const snapshot = await getDocs(coursesRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
  } catch (error) {
    console.error('Kursları getirme hatası:', error);
    throw error;
  }
};

// Görev işlemleri
export const addTaskToFirebase = async (task: Task) => {
  try {
    const docRef = await addDoc(tasksRef, task);
    return docRef.id;
  } catch (error) {
    console.error('Görev ekleme hatası:', error);
    throw error;
  }
};

// Deneme Sınavı işlemleri (YENİ)
export const addPracticeExamToFirebase = async (exam: Omit<PracticeExam, 'id'>) => {
  try {
    const docRef = await addDoc(practiceExamsRef, exam);
    return docRef.id;
  } catch (error) {
    console.error('Deneme sınavı ekleme hatası:', error);
    throw error;
  }
};

export const updateTaskInFirebase = async (taskId: string, task: Partial<Task>) => {
  try {
    const taskDoc = doc(db, 'tasks', taskId);
    await updateDoc(taskDoc, task);
  } catch (error) {
    console.error('Görev güncelleme hatası:', error);
    throw error;
  }
};

export const deleteTaskFromFirebase = async (taskId: string) => {
  try {
    const taskDoc = doc(db, 'tasks', taskId);
    await deleteDoc(taskDoc);
  } catch (error) {
    console.error('Görev silme hatası:', error);
    throw error;
  }
};

export const getTasksFromFirebase = async () => {
  try {
    const q = query(tasksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
  } catch (error) {
    console.error('Görevleri getirme hatası:', error);
    throw error;
  }
};

// Performans verileri işlemleri
export const updatePerformanceInFirebase = async (performanceId: string, data: Partial<PerformanceData>) => {
  try {
    const performanceDoc = doc(db, 'performance', performanceId);
    await updateDoc(performanceDoc, data);
  } catch (error) {
    console.error('Performans güncelleme hatası:', error);
    throw error;
  }
};

export const getPerformanceFromFirebase = async () => {
  try {
    const snapshot = await getDocs(performanceRef);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        courseId: data.courseId || '',
        courseName: data.courseName || '',
        correct: typeof data.correct === 'number' ? data.correct : 0,
        incorrect: typeof data.incorrect === 'number' ? data.incorrect : 0,
        timeSpent: typeof data.timeSpent === 'number' ? data.timeSpent : 0
      } as PerformanceData;
    });
  } catch (error) {
    console.error('Performans verilerini getirme hatası:', error);
    throw error;
  }
};

// Ödül işlemleri
export const addRewardToFirebase = async (reward: Reward) => {
  try {
    const docRef = await addDoc(rewardsRef, reward);
    return docRef.id;
  } catch (error) {
    console.error('Ödül ekleme hatası:', error);
    throw error;
  }
};

export const deleteRewardFromFirebase = async (rewardId: string) => {
  try {
    const rewardDoc = doc(db, 'rewards', rewardId);
    await deleteDoc(rewardDoc);
  } catch (error) {
    console.error('Ödül silme hatası:', error);
    throw error;
  }
};

export const getRewardsFromFirebase = async () => {
  try {
    const snapshot = await getDocs(rewardsRef);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Firebase'den gelen bozuk verileri düzelt
      return {
        id: doc.id,
        name: data.name || 'Ödül',
        cost: typeof data.cost === 'number' ? data.cost : 10,
        icon: typeof data.icon === 'string' ? data.icon : 'Gift'
      } as Reward;
    });
  } catch (error) {
    console.error('Ödülleri getirme hatası:', error);
    throw error;
  }
};

// Rozet işlemleri
export const updateBadgesInFirebase = async (badges: Badge[]) => {
  try {
    // Mevcut rozetleri temizle ve yenilerini ekle
    const snapshot = await getDocs(badgesRef);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Yeni rozetleri ekle
    const addPromises = badges.map(badge => addDoc(badgesRef, badge));
    await Promise.all(addPromises);
  } catch (error) {
    console.error('Rozet güncelleme hatası:', error);
    throw error;
  }
};

export const getBadgesFromFirebase = async () => {
  try {
    const snapshot = await getDocs(badgesRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Badge));
  } catch (error) {
    console.error('Rozetleri getirme hatası:', error);
    throw error;
  }
};

// Kullanıcı verileri (puan vb.)
export const updateUserDataInFirebase = async (userId: string, data: { successPoints: number }) => {
  try {
    const userDoc = doc(db, 'userData', userId);
    await updateDoc(userDoc, data);
  } catch (error) {
    console.error('Kullanıcı verisi güncelleme hatası:', error);
    throw error;
  }
};

export const getUserDataFromFirebase = async (userId: string) => {
  try {
    const userDoc = doc(db, 'userData', userId);
    const snapshot = await getDocs(query(collection(db, 'userData'), where('userId', '==', userId)));
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    console.error('Kullanıcı verisi getirme hatası:', error);
    throw error;
  }
};

// Gerçek zamanlı veri dinleyicileri
export const listenToCourses = (callback: (courses: Course[]) => void) => {
  return onSnapshot(coursesRef, (snapshot) => {
    const courses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
    callback(courses);
  });
};

export const listenToTasks = (callback: (tasks: Task[]) => void) => {
  const q = query(tasksRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
    callback(tasks);
  });
};

export const listenToRewards = (callback: (rewards: Reward[]) => void) => {
  return onSnapshot(rewardsRef, (snapshot) => {
    const rewards = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Reward));
    callback(rewards);
  });
};

export const listenToPerformance = (callback: (performance: PerformanceData[]) => void) => {
  return onSnapshot(performanceRef, (snapshot) => {
    const performance = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        courseId: data.courseId || '',
        courseName: data.courseName || '',
        correct: typeof data.correct === 'number' ? data.correct : 0,
        incorrect: typeof data.incorrect === 'number' ? data.incorrect : 0,
        timeSpent: typeof data.timeSpent === 'number' ? data.timeSpent : 0
      } as PerformanceData;
    });
    callback(performance);
  });
};