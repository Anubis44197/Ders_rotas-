import React, { useState, useEffect, useRef } from 'react';
import ParentDashboard from './components/parent/ParentDashboard';
import ChildDashboard from './components/child/ChildDashboard';
import ParentLockScreen from './components/parent/ParentLockScreen';
import { UserType, Course, Task, PerformanceData, TaskCompletionData, Reward, Badge, ReportData } from './types';
import { GraduationCap, User, Users, Trash2, CheckCircle, XCircle, BadgeCheck } from './components/icons';
import { ALL_ICONS } from './constants';
import { GoogleGenAI, Type } from "@google/genai";
import { calculateTaskPoints } from './utils/scoringAlgorithm';


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
        version: '1.0'
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


  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_AI_API_KEY });
 
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
      }
      setUserType(newUserType);
  };


  const generateReport = async (period: 'Haftalık' | 'Aylık' | 'Yıllık' | 'Tüm Zamanlar'): Promise<ReportData | null> => {
    // Dönem gün sayılarını tanımla
    let days = 9999;
    if (period === 'Haftalık') days = 7;
    else if (period === 'Aylık') days = 30;
    else if (period === 'Yıllık') days = 365;
    // Tüm Zamanlar: 9999 gün
    let relevantTasks: Task[];
    if (period === 'Tüm Zamanlar') {
      relevantTasks = tasks.filter(t => t.status === 'tamamlandı' && t.completionDate);
    } else {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      relevantTasks = tasks.filter(t => t.status === 'tamamlandı' && t.completionDate && new Date(t.completionDate) >= cutoffDate);
    }

    if (relevantTasks.length === 0) {
      return null;
    }

    const simplifiedTasks = relevantTasks.map(task => ({
      course: courses.find(c => c.id === task.courseId)?.name,
      successScore: task.successScore,
      focusScore: task.focusScore,
      timeSpentMinutes: Math.round((task.actualDuration || 0) / 60),
      plannedTimeMinutes: task.plannedDuration
    }));

    const prompt = `Bir ebeveyn için çocuğunun eğitim performansını analiz ediyorsun. Aşağıdaki JSON verilerini kullanarak Türkçe bir rapor oluştur.
    Veri: ${JSON.stringify(simplifiedTasks)}
   
    Raporun şu alanları içermeli:
    - summary: Genel performansı özetleyen kısa, pozitif ve cesaretlendirici bir metin.
    - mostImprovedCourse: Başarı puanı ortalaması en yüksek veya son zamanlarda en çok artış gösteren dersin adı.
    - needsFocusCourse: Başarı veya odaklanma puanı ortalaması en düşük olan dersin adı.
    - suggestion: 'needsFocusCourse' olarak belirlenen ders için ebeveynin uygulayabileceği somut, pratik ve eğitici bir tavsiye.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    mostImprovedCourse: { type: Type.STRING },
                    needsFocusCourse: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                },
                required: ['summary', 'mostImprovedCourse', 'needsFocusCourse', 'suggestion'],
            },
        },
      });

      let reportJson: any = null;
      try {
        reportJson = JSON.parse(response.text || '{}');
      } catch (e) {
        console.error("AI yanıtı JSON.parse hatası:", e, response.text);
        return {
          period,
          aiSummary: "Yapay zeka yanıtı beklenen formatta değil. Lütfen tekrar deneyin.",
          highlights: { mostImproved: "N/A", needsFocus: "N/A" },
          aiSuggestion: "Veri analizi yapılamadı."
        };
      }
      // Alan kontrolü
      if (!reportJson.summary || !reportJson.mostImprovedCourse || !reportJson.needsFocusCourse || !reportJson.suggestion) {
        return {
          period,
          aiSummary: "Yapay zeka yanıtı eksik alanlar içeriyor. Lütfen tekrar deneyin.",
          highlights: { mostImproved: "N/A", needsFocus: "N/A" },
          aiSuggestion: "Veri analizi yapılamadı."
        };
      }
      return {
          period,
          aiSummary: reportJson.summary,
          highlights: {
              mostImproved: reportJson.mostImprovedCourse,
              needsFocus: reportJson.needsFocusCourse
          },
          aiSuggestion: reportJson.suggestion
      };
    } catch (error) {
      console.error("AI report generation failed:", error);
      return {
          period,
          aiSummary: "Rapor oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          highlights: { mostImproved: "N/A", needsFocus: "N/A" },
          aiSuggestion: "Veri analizi yapılamadı."
      };
    }
  };


  // Course Handlers
  const addCourse = (courseName: string) => {
    const randomIcon = ALL_ICONS[courses.length % ALL_ICONS.length];
    const newCourse: Course = {
      id: `course_${Date.now()}`,
      name: courseName,
      icon: randomIcon
    };
    setCourses(prev => [newCourse, ...prev]);
    // Data Integrity Fix: Add performance data using the unique course ID
    setPerformanceData(prev => [...prev, { courseId: newCourse.id, courseName, correct: 0, incorrect: 0, timeSpent: 0 }]);
  };

  const handleDeleteCourseRequest = (courseId: string) => {
      const course = courses.find(c => c.id === courseId);
      if (course) {
          setCourseToDelete(course);
      }
  };

  const confirmDeleteCourse = () => {
      if (!courseToDelete) return;

      // Data Integrity Fix: Filter all related data using the unique course ID
      setCourses(prev => prev.filter(c => c.id !== courseToDelete.id));
      setTasks(prev => prev.filter(t => t.courseId !== courseToDelete.id));
      setPerformanceData(prev => prev.filter(p => p.courseId !== courseToDelete.id));
     
      setCourseToDelete(null);
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
 
 // Architectural Fix: Decouple badge checking from the task completion logic.
 // This useEffect now observes changes in tasks and triggers badge checks precisely when needed.
 useEffect(() => {
    const newlyCompletedTasks = tasks.filter(task => {
        const prevTask = prevTasksRef.current.find(pt => pt.id === task.id);
        return task.status === 'tamamlandı' && prevTask?.status !== 'tamamlandı';
    });

    if (newlyCompletedTasks.length > 0) {
        const checkAndAwardBadges = () => {
            const completedTasks = tasks.filter(t => t.status === 'tamamlandı');
           
            setBadges(prevBadges => {
                let currentBadges = [...prevBadges];
                const newBadgesToAward: Badge[] = [];
       
                const hasBadge = (badgeId: string) => currentBadges.some(b => b.id === badgeId);
       
                // Hardworking Bee: 3 tasks completed in one day
                if (!hasBadge('b2')) {
                    const tasksByDay: { [key: string]: number } = {};
                    completedTasks.forEach(task => {
                        if (task.completionDate) {
                            const day = new Date(task.completionDate).toISOString().split('T')[0];
                            tasksByDay[day] = (tasksByDay[day] || 0) + 1;
                        }
                    });
                    if (Object.values(tasksByDay).some(count => count >= 3)) {
                        newBadgesToAward.push({ id: 'b2', name: 'Çalışkan Arı', description: 'Bir günde 3 görev tamamladın.', icon: BadgeCheck });
                    }
                }
       
                // Math Monster: 10 Math tasks completed
                if (!hasBadge('b3')) {
                    // Logic Fix: Use live `courses` state instead of stale `MOCK_COURSES`.
                    const mathCourse = courses.find(c => c.name === 'Matematik');
                    if (mathCourse) {
                        const mathTasksCompleted = completedTasks.filter(t => t.courseId === mathCourse.id).length;
                        if (mathTasksCompleted >= 10) {
                            newBadgesToAward.push({ id: 'b3', name: 'Matematik Canavarı', description: '10 Matematik görevini tamamladın.', icon: BadgeCheck });
                        }
                    }
                }
               
                if (newBadgesToAward.length > 0) {
                    const badgeNames = newBadgesToAward.map(b => b.name).join(', ');
                    addToast(`Yeni rozet kazandın: ${badgeNames}`, 'success');
                    return [...currentBadges, ...newBadgesToAward];
                }
       
                return currentBadges; // Return original array if no new badges
            });
        };

        checkAndAwardBadges();
    }

    // Update the ref for the next render comparison.
    prevTasksRef.current = tasks;
 }, [tasks, courses]);


 const completeTask = (taskId: string, data: TaskCompletionData) => {
    // Use a functional update for the primary state to prevent race conditions.
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
       
        // Atomically update other states within this event handler. React 18 batches these.
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

        const updatedTasks = prevTasks.map(t => {
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
              } as Task;
        });

        // Architectural Fix: Badge checking is no longer called from here.
        // It will be triggered by the useEffect hook after this state update is committed.
       
        return updatedTasks;
    });
};

  const updateTaskStatus = (taskId: string, status: 'bekliyor' | 'tamamlandı') => {
    // This is now simplified, main completion logic is in completeTask
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
          // In a real app, this would send a notification to the parent.
          addToast(`'${reward.name}' ödül talebiniz iletildi!`, 'success');
      } else {
          addToast('Bu ödülü almak için yeterli puanınız yok!', 'error');
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <div className="fixed top-20 right-4 z-[100] w-full max-w-sm space-y-3">
        {toasts.map(toast => {
            const isSuccess = toast.type === 'success';
            return (
                <div 
                    key={toast.id} 
                    className="bg-white rounded-xl shadow-lg p-4 flex items-start space-x-3 animate-fade-in-right"
                    role="alert"
                    aria-live="assertive"
                >
                    {isSuccess ? 
                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" /> : 
                        <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                    }
                    <p className={`text-sm font-semibold ${isSuccess ? 'text-slate-800' : 'text-red-800'}`}>{toast.message}</p>
                </div>
            );
        })}
         <style>{`
            @keyframes fade-in-right {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            .animate-fade-in-right {
                animation: fade-in-right 0.5s ease-out forwards;
            }
        `}</style>
      </div>

      <Modal 
          show={!!courseToDelete} 
          onClose={() => setCourseToDelete(null)}
          title="Dersi Silmeyi Onayla"
      >
          {courseToDelete && (
              <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                      <Trash2 className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <p className="text-lg font-semibold text-slate-800">'{courseToDelete.name}' dersini silmek istediğinizden emin misiniz?</p>
                  <p className="mt-2 text-sm text-slate-500">
                      Bu işlem geri alınamaz. Bu dersle birlikte atanmış <strong>{tasks.filter(t => t.courseId === courseToDelete.id).length} adet görev</strong> de kalıcı olarak silinecektir.
                  </p>
                  <div className="mt-6 flex justify-center space-x-4">
                      <button onClick={() => setCourseToDelete(null)} className="px-6 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
                          İptal
                      </button>
                      <button onClick={confirmDeleteCourse} className="px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">
                          Evet, Sil
                      </button>
                  </div>
              </div>
          )}
      </Modal>

      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-slate-800">Eğitim Asistanı</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-slate-500">Görünüm:</span>
              <div className="relative inline-flex bg-slate-200 rounded-full p-1">
                <button
                  onClick={() => handleUserTypeChange(UserType.Parent)}
                  className={`relative z-10 flex items-center justify-center w-28 h-8 rounded-full text-sm font-semibold transition-colors duration-300 ${
                    userType === UserType.Parent ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  <Users className="w-4 h-4 mr-2" /> Ebeveyn
                </button>
                <button
                  onClick={() => handleUserTypeChange(UserType.Child)}
                  className={`relative z-10 flex items-center justify-center w-28 h-8 rounded-full text-sm font-semibold transition-colors duration-300 ${
                    userType === UserType.Child ? 'text-white' : 'text-slate-600'
                  }`}
                >
                   <User className="w-4 h-4 mr-2" /> Çocuk
                </button>
                <span
                  className={`absolute top-1 left-1 w-28 h-8 bg-primary-600 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                    userType === UserType.Child ? 'translate-x-full' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
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
                  />
                  {/* Import Modal */}
                  <Modal show={showImportModal} onClose={() => setShowImportModal(false)} title="Veri Yedeğini Geri Yükle">
                    <div className="space-y-4">
                      <p className="text-slate-700">Daha önce dışa aktardığınız yedek dosyasını seçerek tüm verilerinizi geri yükleyebilirsiniz. Bu işlem mevcut verilerinizi <span className="font-bold text-red-600">tamamen değiştirir</span>.</p>
                      <input
                        type="file"
                        accept="application/json"
                        ref={fileInputRef}
                        className="hidden"
                        title="Yedek JSON dosyası seçin"
                        placeholder="Yedek dosyası"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImportData(file);
                        }}
                      />
                      <button
                        onClick={triggerImportFile}
                        className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                      >
                        Yedek Dosyası Seç
                      </button>
                      {importError && <p className="text-red-600 font-semibold">{importError}</p>}
                    </div>
                  </Modal>
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
              ai={null as any}
            />
        )}
      </main>
    </div>
  );
};

export default App;