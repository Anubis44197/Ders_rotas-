import React from 'react';

interface ParentWorkspaceFrameBadge {
  label: string;
  tone?: 'neutral' | 'danger' | 'warning' | 'info';
}

interface ParentWorkspaceFrameProps {
  title: string;
  description: string;
  badges?: ParentWorkspaceFrameBadge[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  spacing?: 'normal' | 'wide';
}

const badgeToneClass: Record<NonNullable<ParentWorkspaceFrameBadge['tone']>, string> = {
  neutral: 'dr-status-pill text-slate-700',
  danger: 'dr-status-pill dr-status-pill-critical',
  warning: 'dr-status-pill dr-status-pill-warning',
  info: 'dr-status-pill dr-status-pill-success',
};

const ParentWorkspaceFrame: React.FC<ParentWorkspaceFrameProps> = ({
  title,
  description,
  badges = [],
  actions,
  children,
  spacing = 'normal',
}) => (
  <div className={spacing === 'wide' ? 'space-y-8' : 'space-y-6'}>
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="dr-hig-large-title text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-1.5 dr-hig-caption text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {actions ? (
        actions
      ) : badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide ${badgeToneClass[badge.tone || 'neutral']}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
    {children}
  </div>
);

export default ParentWorkspaceFrame;
