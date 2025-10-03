import React, { useState, useEffect, useRef } from 'react';
import FloatingNotification from './components/shared/FloatingNotification';
import ParentDashboard from './components/parent/ParentDashboard';
import ChildDashboard from './components/child/ChildDashboard';
import ParentLockScreen from './components/parent/ParentLockScreen';
import { UserType, Course, Task, PerformanceData, TaskCompletionData, Reward, Badge, ReportData } from './types';
import { GraduationCap, User, Users, Trash2, CheckCircle, XCircle, BadgeCheck } from './components/icons';
import { ALL_ICONS } from './constants';
import { calculateTaskPoints } from './utils/scoringAlgorithm';
import { GoogleGenAI, Type } from "@google/genai";


const Modal: React.FC<{ show: boolean, onClose: () => void, title: string, children: React.ReactNode }> = ({ show, onClose, title, children }) => {
    if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Kapat" title="Kapat" className="text-slate-500 hover:text-slate-800 text-3xl font-light">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

// useStickyState hook for localStorage persistence
function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
}

const App: React.FC = () => {
  // Bildirime tıklanınca ilgili göreve yönlendirme
  const handleContinueTask = (taskId: string) => {
    // İlgili görevi bul ve ana ekranda öne çıkar (örnek: ParentDashboard'a prop ile iletebilir)
    // Burada sadece alert ile gösteriyorum, gerçek uygulamada görev detayına yönlendirme yapılabilir
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      alert(`Görev: ${task.title} - Devam et!`);
      // TODO: Görev detayına veya devam ekranına yönlendirme
    }
  };
  // Ders silme onay modalı
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  // Export/Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Export all app data as JSON
  const handleExportData = async (): Promise<void> => {
    try {
      const data = {
        courses,
        tasks,

        performanceData,
        rewards,
        badges,
        successPoints,
        exportDate: new Date().toISOString(),
        version: '1.1' // Sürüm güncellendi
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `egitim-asistani-yedek-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Veriler başarıyla dışa aktarıldı.', 'success');
    } catch (error) {
      console.error('Export error:', error);
      addToast('Veri dışa aktarım işlemi sırasında bir hata oluştu.', 'error');
      throw error;
    }
  };

  // Delete all data
  const handleDeleteAllData = async (): Promise<void> => {
    try {
      setCourses([]);
      setTasks([]);

      setPerformanceData([]);
      setRewards([]);
      setBadges([{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }]);
      setSuccessPoints(0);
      setIsParentLocked(true);
      setLoginError(null);
      addToast('Tüm veriler başarıyla silindi.', 'success');
    } catch (error) {
      console.error('Delete all data error:', error);
      addToast('Veri silme işlemi sırasında bir hata oluştu.', 'error');
      throw error;
    }
  };

  // Import app data from JSON - New Promise-based version
  const handleImportDataNew = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      // Enhanced validation
      if (!json.courses || !Array.isArray(json.courses) ||
          !json.tasks || !Array.isArray(json.tasks) ||

          !json.performanceData || !Array.isArray(json.performanceData) ||
          !json.rewards || !Array.isArray(json.rewards) ||
          !json.badges || !Array.isArray(json.badges) ||
          typeof json.successPoints !== 'number') {
        return false;
      }

      setCourses(json.courses);
      setTasks(json.tasks);
      setPerformanceData(json.performanceData);
      setRewards(json.rewards);
      setBadges(json.badges);
      setSuccessPoints(json.successPoints);
      
      addToast('Veriler başarıyla içe aktarıldı ve geri yüklendi.', 'success');
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  };

  // Import app data from JSON - Legacy version for modal
  const handleImportData = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Basit validasyon
        if (!json.courses || !json.tasks || !json.performanceData || !json.rewards || !json.badges || typeof json.successPoints !== 'number') {
          setImportError('Yedek dosyası eksik veya bozuk.');
          return;
        }
        setCourses(json.courses);
        setTasks(json.tasks);

        setPerformanceData(json.performanceData);
        setRewards(json.rewards);
        setBadges(json.badges);
        setSuccessPoints(json.successPoints);
        setShowImportModal(false);
        addToast('Veriler başarıyla içe aktarıldı.', 'success');
      } catch (err) {
        setImportError('Yedek dosyası okunamadı. Lütfen geçerli bir dosya seçin.');
      }
    };
    reader.readAsText(file);
  };

  // Import butonuna tıklanınca dosya seçtir
  const triggerImportFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };
  const [userType, setUserType] = useStickyState<UserType>(UserType.Parent, 'userType');
  const [courses, setCourses] = useStickyState<Course[]>([], 'courses');
  const [tasks, setTasks] = useStickyState<Task[]>([], 'tasks');

  const [performanceData, setPerformanceData] = useStickyState<PerformanceData[]>([], 'performanceData');
  const [rewards, setRewards] = useStickyState<Reward[]>([], 'rewards');
  const [successPoints, setSuccessPoints] = useStickyState<number>(0, 'successPoints');
  const [badges, setBadges] = useStickyState<Badge[]>([{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }], 'badges');
  const [isParentLocked, setIsParentLocked] = useStickyState<boolean>(true, 'isParentLocked');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
 
  const prevTasksRef = useRef<Task[]>(tasks);


  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI({ apiKey: 'dummy-key' });
 
  const addToast = (message: string, type: ToastMessage['type']) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  };

  const handleUnlockParentDashboard = (password: string) => {
    if (password === '1234') {
        setIsParentLocked(false);
        setLoginError(null);
    } else {
        setLoginError('Hatalı şifre. Lütfen tekrar deneyin.');
    }
  };

  const handleUserTypeChange = (newUserType: UserType) => {
      if (newUserType === UserType.Child) {
          setIsParentLocked(true); // Re-lock parent dashboard when switching to child view
          setLoginError(null);
      } else if (newUserType === UserType.Parent) {
          setIsParentLocked(true); // Always require password when switching to parent view
          setLoginError(null);
      }
      setUserType(newUserType);
  };


  const generateReport = async (period: 'Haftalık' | 'Aylık' | 'Yıllık' | 'Tüm Zamanlar'): Promise<ReportData | null> => {
  // Rapor fonksiyonu henüz uygulanmadıysa null döndür
  return null;
  };


  // Course Handlers
  // Otomatik bildirimler
  // (Ana return içinde veya uygun bir yerde render edilmeli)
  // ...
  // return (
  //   <>
  //     <FloatingNotification tasks={tasks} onContinueTask={handleContinueTask} />
  //     ...
  //   </>
  // )
  const addCourse = (courseName: string) => {
    const randomIcon = ALL_ICONS[courses.length % ALL_ICONS.length];
    const newCourse: Course = {
      id: `course_${Date.now()}`,
      name: courseName,
      icon: randomIcon
    };
    setCourses(prev => [newCourse, ...prev]);
    setPerformanceData(prev => [...prev, { courseId: newCourse.id, courseName, correct: 0, incorrect: 0, timeSpent: 0 }]);
  };

  const handleDeleteCourseRequest = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setCourseToDelete(course);
      setShowDeleteCourseModal(true);
    }
  };

  const confirmDeleteCourse = () => {
  if (!courseToDelete) return;
  setCourses(prev => prev.filter(c => c.id !== courseToDelete.id));
  setTasks(prev => prev.filter(t => t.courseId !== courseToDelete.id));
  setPerformanceData(prev => prev.filter(p => p.courseId !== courseToDelete.id));
  setCourseToDelete(null);
  setShowDeleteCourseModal(false);
  addToast(`'${courseToDelete.name}' dersi ve ilişkili veriler silindi.`, 'success');
  };

  // Task Handlers
  const addTask = async (task: Omit<Task, 'id' | 'status'>): Promise<Task> => {
    const newTask: Task = { ...task, id: `task_${Date.now()}`, status: 'bekliyor' };
    setTasks(prev => [newTask, ...prev]);
    return newTask;
  };



  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const startTask = (taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === taskId ? { ...t, startTimestamp: Date.now() } : t
      )
    );
  };
 
 useEffect(() => {
    // ... (existing useEffect)
 }, [tasks, courses]);


 const completeTask = (taskId: string, data: TaskCompletionData) => {
    setTasks(prevTasks => {
        const task = prevTasks.find(t => t.id === taskId);
        if (!task) {
            console.error("Tamamlanacak görev bulunamadı:", taskId);
            return prevTasks;
        }
     
        const today = new Date().toISOString().split('T')[0];
     
        let correctAnswers = 0;
        let incorrectAnswers = 0;

        if (task.taskType === 'soru çözme' && data.correctCount !== undefined && data.incorrectCount !== undefined) {
          correctAnswers = data.correctCount;
          incorrectAnswers = data.incorrectCount;
        }

        let successScore: number | undefined = undefined;
        let focusScore: number | undefined = undefined;
       
        const plannedSeconds = task.plannedDuration * 60;
        const { actualDuration, breakTime, pauseTime } = data;

        const totalSessionTime = actualDuration + breakTime + pauseTime;
        if (totalSessionTime > 0) {
            let score = 100;
            const distractionRatio = (breakTime + pauseTime) / totalSessionTime;
            score -= distractionRatio * 50;
            if (actualDuration > plannedSeconds) {
                const overtimeRatio = (actualDuration - plannedSeconds) / plannedSeconds;
                score -= overtimeRatio * 50;
            }
            focusScore = Math.max(0, Math.min(100, score));
        } else {
          focusScore = 100;
        }

        if (task.taskType === 'soru çözme' && task.questionCount && task.questionCount > 0) {
            const baseAccuracy = (correctAnswers / task.questionCount) * 100;
            const timeRatio = actualDuration / plannedSeconds;
            let timeModifier = 1.0;
            if (timeRatio < 1.0) {
                timeModifier = 1 + ((1 - timeRatio) * 0.1);
            } else {
                timeModifier = 1 - ((timeRatio - 1) * 0.2);
            }
            successScore = Math.max(0, Math.min(100, baseAccuracy * timeModifier));
        } else {
          successScore = focusScore;
        }

        // Use balanced scoring algorithm
        const scoringResult = calculateTaskPoints(task, data, successScore, focusScore);
        const pointsAwarded = scoringResult.pointsAwarded;
       
        setSuccessPoints(prev => prev + pointsAwarded);

        if (task.taskType !== 'kitap okuma') {
            setPerformanceData(prevData => {
                return prevData.map(p => {
                    if (p.courseId === task.courseId) {
                        const newTimeSpent = Math.round(data.actualDuration / 60);
                        return {
                            ...p,
                            correct: p.correct + correctAnswers,
                            incorrect: p.incorrect + incorrectAnswers,
                            timeSpent: p.timeSpent + newTimeSpent
                        };
                    }
                    return p;
                });
            });
        }

        return prevTasks.map(t => {
            if (t.id !== taskId) return t;
            return {
                ...t,
                status: 'tamamlandı',
                ...data,
                pagesRead: data.pagesRead,
                completionDate: today,
                completionTimestamp: Date.now(),
                correctCount: correctAnswers,
                incorrectCount: incorrectAnswers,
                successScore: successScore ? Math.round(successScore) : undefined,
                focusScore: focusScore ? Math.round(focusScore) : undefined,
                pointsAwarded
            };
        });
    });
 };

  const updateTaskStatus = (taskId: string, status: 'bekliyor' | 'tamamlandı') => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, status } : t)));
  };

  // Reward Handlers
  const addReward = (reward: Omit<Reward, 'id'>) => {
    const newReward: Reward = { ...reward, id: `reward_${Date.now()}`};
    setRewards(prev => [newReward, ...prev]);
  };

  const deleteReward = (rewardId: string) => {
    setRewards(prev => prev.filter(r => r.id !== rewardId));
  }

  const claimReward = (rewardId: string) => {
      const reward = rewards.find(r => r.id === rewardId);
      if (reward && successPoints >= reward.cost) {
          setSuccessPoints(prev => prev - reward.cost);
          addToast(`'${reward.name}' ödül talebiniz iletildi!`, 'success');
      } else {
          addToast('Bu ödülü almak için yeterli puanınız yok!', 'error');
      }
  };


  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Otomatik bildirimler */}
      <FloatingNotification tasks={tasks} onContinueTask={handleContinueTask} />
      {/* Toasts ve modallar burada */}
      <header className="w-full bg-white shadow-sm py-4 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <GraduationCap className="h-8 w-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-slate-800">Eğitim Asistanı</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-slate-500">Görünüm:</span>
          <div className="relative inline-flex bg-slate-200 rounded-full p-1">
            <button
              onClick={() => handleUserTypeChange(UserType.Parent)}
              className={`relative z-10 flex items-center justify-center w-28 h-8 rounded-full text-sm font-semibold transition-colors duration-300 ${userType === UserType.Parent ? 'bg-primary-600 text-white' : 'text-slate-600'}`}
            >
              <Users className="w-4 h-4 mr-2" /> Ebeveyn
            </button>
            <button
              onClick={() => handleUserTypeChange(UserType.Child)}
              className={`relative z-10 flex items-center justify-center w-28 h-8 rounded-full text-sm font-semibold transition-colors duration-300 ${userType === UserType.Child ? 'bg-primary-600 text-white' : 'text-slate-600'}`}
            >
              <User className="w-4 h-4 mr-2" /> Çocuk
            </button>
            <span
              className={`absolute top-1 left-1 w-28 h-8 bg-primary-600 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${userType === UserType.Child ? 'translate-x-full' : 'translate-x-0'}`}
            />
          </div>
        </div>
      </header>
      <main>
        {userType === UserType.Parent ? (
          isParentLocked ? (
            <ParentLockScreen onUnlock={handleUnlockParentDashboard} error={loginError} />
          ) : (
            <>
              <ParentDashboard 
                courses={courses}
                tasks={tasks}

                performanceData={performanceData}
                rewards={rewards}
                ai={ai}
                addCourse={addCourse}
                deleteCourse={handleDeleteCourseRequest}
                addTask={addTask}

                deleteTask={deleteTask}
                addReward={addReward}
                deleteReward={deleteReward}
                generateReport={generateReport}
                onExportData={handleExportData}
                onDeleteAllData={handleDeleteAllData}
                onImportData={handleImportDataNew}
                loading={false}
                error={null}
              />
              {/* Ders silme onay modalı */}
              <Modal show={showDeleteCourseModal} onClose={() => setShowDeleteCourseModal(false)} title="Dersi Sil">
                <div className="space-y-4">
                  <p className="text-slate-700">'{courseToDelete?.name}' dersini ve ilişkili tüm görevleri, analizleri silmek istediğinize emin misiniz?</p>
                  <div className="flex justify-end space-x-3">
                    <button className="bg-slate-200 px-4 py-2 rounded-lg" onClick={() => setShowDeleteCourseModal(false)}>Vazgeç</button>
                    <button className="bg-red-600 text-white px-4 py-2 rounded-lg" onClick={confirmDeleteCourse}>Evet, Sil</button>
                  </div>
                </div>
              </Modal>
              {/* ... (import modal) ... */}
            </>
          )
        ) : (
          <ChildDashboard 
            tasks={tasks}
            courses={courses}

            performanceData={performanceData}
            rewards={rewards}
            badges={badges}
            successPoints={successPoints}
            startTask={startTask}

            updateTaskStatus={updateTaskStatus}
            completeTask={completeTask}

            claimReward={claimReward}
            addTask={addTask}
            ai={ai}
          />
        )}
      </main>
    </div>
  );
};

export default App;