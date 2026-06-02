import React, { useState } from 'react';
import { Reward } from '../../types';
import { Trash2, Trophy } from '../icons';
import ContextHelp from '../shared/ContextHelp';

interface ParentRewardWorkspaceProps {
  rewards: Reward[];
  successPoints: number;
  addReward: (reward: Omit<Reward, 'id'>) => void;
  deleteReward: (rewardId: string) => void;
  loading?: boolean;
}

const ParentRewardWorkspace: React.FC<ParentRewardWorkspaceProps> = ({
  rewards,
  successPoints,
  addReward,
  deleteReward,
  loading,
}) => {
  const [rewardName, setRewardName] = useState('');
  const [rewardCost, setRewardCost] = useState('100');
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [showAllRewards, setShowAllRewards] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showActionMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    window.setTimeout(() => {
      setActionMessage((prev) => (prev?.text === text ? null : prev));
    }, 2200);
  };

  const availablePoints = successPoints;
  const numericRewardCost = Number(rewardCost);
  const rewardButtonTone = !Number.isFinite(numericRewardCost) || numericRewardCost <= 0
    ? 'ios-button text-slate-500 border border-transparent'
    : numericRewardCost < 150
      ? 'border border-emerald-400/40 text-slate-900 dark:text-white bg-emerald-500/10 hover:bg-emerald-500/20'
      : numericRewardCost < 350
        ? 'border border-amber-400/40 text-slate-900 dark:text-white bg-amber-500/10 hover:bg-amber-500/20'
        : 'border border-rose-400/40 text-slate-900 dark:text-white bg-rose-500/10 hover:bg-rose-500/20';

  const handleAddReward = (event: React.FormEvent) => {
    event.preventDefault();
    if (isAddingReward) return;

    const nextRewardName = rewardName.trim();
    const nextRewardCost = Number(rewardCost);
    if (!nextRewardName || !rewardCost) {
      showActionMessage('error', 'Ödül adı ve puan alanı zorunludur.');
      return;
    }

    if (!Number.isFinite(nextRewardCost) || nextRewardCost <= 0) {
      showActionMessage('error', 'Ödül puanı sıfırdan büyük bir sayı olmalı.');
      return;
    }

    const hasDuplicateReward = rewards.some(
      (reward) => reward.name.toLocaleLowerCase('tr-TR') === nextRewardName.toLocaleLowerCase('tr-TR') && reward.cost === nextRewardCost,
    );
    if (hasDuplicateReward) {
      showActionMessage('error', 'Aynı ad ve puandaki ödül zaten tanımlı.');
      return;
    }

    setIsAddingReward(true);
    try {
      addReward({ name: nextRewardName, cost: nextRewardCost, icon: 'Trophy' });
      setRewardName('');
      setRewardCost('100');
      showActionMessage('success', `'${nextRewardName}' ödülü eklendi.`);
    } finally {
      window.setTimeout(() => setIsAddingReward(false), 250);
    }
  };

  return (
    <section className="ios-card rounded-[28px] p-5">
      {actionMessage && (
        <div className={`mb-4 rounded-[18px] px-4 py-3 text-sm font-semibold ${actionMessage.type === 'success' ? 'ios-mint text-emerald-900' : 'ios-coral text-rose-900'}`}>
          {actionMessage.text}
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Ebeveyn kontrol merkezi</div>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Ödül Tanımla</h3>
            <ContextHelp title="Ödül Mağazası" tone="blue">
              Çocuğunuz kazandığı Başarı Puanlarını (BP) burada belirlediğiniz ödülleri satın almak için kullanabilir. Ödüller ve puan maliyetleri veli kontrolündedir.
            </ContextHelp>
          </div>
        </div>
        <form onSubmit={handleAddReward} className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_100px_auto] lg:max-w-2xl">
          <input
            value={rewardName}
            onChange={(e) => setRewardName(e.target.value)}
            placeholder="Ödül adı (örn. 30 dk Bilgisayar Süresi)"
            className="dr-form-field rounded-xl px-3 py-2 text-xs font-semibold outline-none"
          />
          <input
            value={rewardCost}
            onChange={(e) => setRewardCost(e.target.value)}
            placeholder="Puan"
            type="number"
            min="1"
            className="dr-form-field rounded-xl px-3 py-2 text-xs font-semibold outline-none"
          />
          <button
            type="submit"
            disabled={isAddingReward}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition duration-300 ${isAddingReward ? 'cursor-not-allowed opacity-50' : rewardButtonTone}`}
          >
            <span className="block">{isAddingReward ? 'Ekleniyor...' : 'Ödülü Ata'}</span>
            <span className="mt-0.5 block text-[10px] font-semibold opacity-70">Mevcut: {availablePoints} BP</span>
          </button>
        </form>
      </div>
      {rewards.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
          {(showAllRewards ? rewards : rewards.slice(0, 8)).map((reward) => {
            const isAffordable = reward.cost <= availablePoints;
            const badgeTone = isAffordable
              ? 'border-emerald-400/40 text-slate-900 dark:text-white bg-emerald-500/10 shadow-sm shadow-emerald-500/5'
              : 'border-amber-400/30 text-slate-900 dark:text-white bg-amber-500/10';

            return (
              <div
                key={reward.id}
                className={`inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition duration-300 hover:scale-[1.03] ${badgeTone}`}
              >
                <Trophy className={`h-3.5 w-3.5 ${isAffordable ? 'text-amber-500 dark:text-amber-400 animate-pulse' : 'text-slate-400'}`} />
                <span>{reward.name}</span>
                <span className="opacity-40">•</span>
                <span className="font-bold">{reward.cost} BP</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  isAffordable
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                }`}>
                  {isAffordable ? 'Ulaşılabilir' : 'Birikiyor'}
                </span>
                <button
                  onClick={() => deleteReward(reward.id)}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-rose-500/25 hover:text-rose-600 transition duration-200"
                  type="button"
                  aria-label={`${reward.name} ödülünü sil`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          {rewards.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllRewards((prev) => !prev)}
              className="ios-button rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              {showAllRewards ? 'Daha az göster' : `Tümünü göster (${rewards.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default ParentRewardWorkspace;

