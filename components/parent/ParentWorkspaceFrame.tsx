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
  neutral: 'ios-button text-slate-700',
  danger: 'bg-rose-50 text-rose-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-indigo-50 text-indigo-700',
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
        <h2 className="text-3xl font-black tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
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
