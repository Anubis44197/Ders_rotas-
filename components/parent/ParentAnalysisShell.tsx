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
}) => (
  <ParentWorkspaceFrame
    title="Analiz ve Destek Takibi"
    description="Tamamlanan oturumlardan üretilen performans ve odak konusu sinyallerini incele."
    badges={[
      { label: `Analiz oturumu ${analyzedSessionCount}` },
      { label: `Odak konusu ${weakTopicCount}`, tone: 'warning' },
    ]}
  >
    {children}
  </ParentWorkspaceFrame>
);

export default ParentAnalysisShell;
