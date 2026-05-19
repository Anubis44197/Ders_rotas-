import React from 'react';
import ParentWorkspaceFrame from './ParentWorkspaceFrame';

interface ParentAnalysisShellProps {
  analyzedSessionCount: number;
  weakTopicCount: number;
  decisionLevel?: 'Kritik' | 'Dikkat' | 'Takip et' | 'Stabil';
  children: React.ReactNode;
}

const ParentAnalysisShell: React.FC<ParentAnalysisShellProps> = ({
  analyzedSessionCount,
  weakTopicCount,
  decisionLevel = 'Takip et',
  children,
}) => (
  <ParentWorkspaceFrame
    title="Ebeveyn Karar Ekrani"
    description="Ders, konu, hedef ve deneme sinyallerini sade karar kartlariyla takip et."
    badges={[
      { label: `Analiz oturumu ${analyzedSessionCount}` },
      { label: `Odak konusu ${weakTopicCount}`, tone: 'warning' },
      { label: `Durum ${decisionLevel}`, tone: decisionLevel === 'Kritik' ? 'danger' : decisionLevel === 'Dikkat' ? 'warning' : 'info' },
    ]}
  >
    {children}
  </ParentWorkspaceFrame>
);

export default ParentAnalysisShell;
