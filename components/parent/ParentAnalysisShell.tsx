import React from 'react';
import ParentWorkspaceFrame from './ParentWorkspaceFrame';

interface ParentAnalysisShellProps {
  analyzedSessionCount: number;
  weakTopicCount: number;
  children: React.ReactNode;
}

const ParentAnalysisShell: React.FC<ParentAnalysisShellProps> = ({
  analyzedSessionCount,
  weakTopicCount,
  children,
}) => {
  const statusLabel = weakTopicCount > 0 ? 'Takipte' : 'Stabil';
  const statusTone = weakTopicCount > 0 ? 'warning' : 'info';
  return (
    <ParentWorkspaceFrame
      title="Ebeveyn Karar Ekrani"
      description="Ders, konu, hedef ve deneme sinyallerini sade analizlerle takip et."
      badges={[
        { label: `Analiz oturumu ${analyzedSessionCount}` },
        { label: `Odak konusu ${weakTopicCount}`, tone: 'warning' },
        { label: `Durum ${statusLabel}`, tone: statusTone },
      ]}
    >
      {children}
    </ParentWorkspaceFrame>
  );
};

export default ParentAnalysisShell;
