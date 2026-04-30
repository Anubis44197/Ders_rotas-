import React, { useMemo, useState } from 'react';
import { ParentDashboardProps } from '../../types';
import { deriveAnalysisSnapshot } from '../../utils/analysisEngine';
import ParentTaskWorkspace from './ParentTaskWorkspace';
import ParentAnalysisWorkspace from './ParentAnalysisWorkspace';
import ParentRewardWorkspace from './ParentRewardWorkspace';
import ParentBriefingWorkspace from './ParentBriefingWorkspace';

const ParentDashboard: React.FC<ParentDashboardProps> = ({
  courses,
  tasks,
  rewards,
  successPoints,
  studyPlans = [],
  curriculum,
  addTask,
  deleteTask,
  addReward,
  deleteReward,
  generateReport,
  onExportData,
  onDeleteAllData,
  onImportData,
  examRecords = [],
  compositeExamResults = [],
  onChangeExamRecords,
  onChangeCompositeExamResults,
  loading,
  error,
  viewMode = 'all',
}) => {
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const analysis = useMemo(
    () => deriveAnalysisSnapshot(tasks, courses, studyPlans, examRecords, compositeExamResults),
    [tasks, courses, studyPlans, examRecords, compositeExamResults],
  );

  const showTasks = viewMode === 'all' || viewMode === 'tasks';
  const showRewards = viewMode === 'all';
  const containerClassName = viewMode === 'all' ? 'space-y-6 px-4 pb-8' : 'space-y-6 pb-8';

  const showActionMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    window.setTimeout(() => {
      setActionMessage((prev) => (prev?.text === text ? null : prev));
    }, 2200);
  };

  return (
    <div className={containerClassName}>
      {actionMessage && (
        <div className={`rounded-[20px] px-4 py-3 text-sm font-semibold ${actionMessage.type === 'success' ? 'ios-mint text-emerald-900' : 'ios-coral text-rose-900'}`}>
          {actionMessage.text}
        </div>
      )}

      <ParentBriefingWorkspace analysis={analysis} loading={loading} error={error} />

      {showRewards && (
        <ParentRewardWorkspace
          rewards={rewards}
          successPoints={successPoints}
          addReward={addReward}
          deleteReward={deleteReward}
          loading={loading}
        />
      )}

      <ParentAnalysisWorkspace
        tasks={tasks}
        courses={courses}
        curriculum={curriculum}
        analysis={analysis}
        examRecords={examRecords}
        compositeExamResults={compositeExamResults}
        generateReport={generateReport}
        loading={loading}
        error={error}
        viewMode={viewMode}
      />

      {showTasks && (
        <ParentTaskWorkspace
          courses={courses}
          tasks={tasks}
          curriculum={curriculum}
          analysis={analysis}
          examRecords={examRecords}
          compositeExamResults={compositeExamResults}
          addTask={addTask}
          deleteTask={deleteTask}
          onExportData={onExportData}
          onDeleteAllData={onDeleteAllData}
          onImportData={onImportData}
          onChangeExamRecords={onChangeExamRecords}
          onChangeCompositeExamResults={onChangeCompositeExamResults}
          onActionMessage={showActionMessage}
          viewMode={viewMode}
        />
      )}
    </div>
  );
};

export default ParentDashboard;
