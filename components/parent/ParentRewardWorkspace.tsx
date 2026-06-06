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
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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
    : 'border border-[#FF4F18]/45 text-[#FF4F18] bg-[#FF4F18]/10 hover:bg-[#FF4F18]/20 hover:shadow-md hover:shadow-[#FF4F18]/5';

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
    <>
    <section className="rounded-[24px] p-6 bg-white dark:bg-[#111112] border border-slate-200/60 dark:border-[#1e2230] shadow-xl dark:shadow-2xl dark:shadow-black/60 transition duration-300">
      {actionMessage && (
        <div className={`mb-5 rounded-xl px-4 py-3 text-xs font-bold border transition-all duration-300 ${
          actionMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        }`}>
          {actionMessage.type === 'success' ? '✓' : '✕'} {actionMessage.text}
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A08C6C]">
            🏆 REWARDS SYSTEM / Ebeveyn kontrol merkezi
          </div>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Ödül Tanımla</h3>
            <ContextHelp title="Ödül Mağazası" tone="blue">
              Çocuğunuz kazandığı Başarı Puanlarını (BP) burada belirlediğiniz ödülleri satın almak için kullanabilir. Ödüller ve puan maliyetleri veli kontrolündedir.
            </ContextHelp>
          </div>
        </div>
        <form onSubmit={handleAddReward} className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_100px_auto] lg:max-w-2xl">
          <input
            value={rewardName}
            onChange={(e) => setRewardName(e.target.value)}
            placeholder="Ödül adı (örn. 30 dk Bilgisayar Süresi)"
            className="w-full bg-slate-50 dark:bg-[#18181f] border border-slate-200 dark:border-[#2e2e38] text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-[#FF4F18] focus:ring-1 focus:ring-[#FF4F18] placeholder:text-slate-500 transition duration-200"
          />
          <input
            value={rewardCost}
            onChange={(e) => setRewardCost(e.target.value)}
            placeholder="Puan"
            type="number"
            min="1"
            className="w-full bg-slate-50 dark:bg-[#18181f] border border-slate-200 dark:border-[#2e2e38] text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-[#FF4F18] focus:ring-1 focus:ring-[#FF4F18] placeholder:text-slate-500 transition duration-200"
          />
          <button
            type="submit"
            disabled={isAddingReward}
            className={`rounded-xl px-5 py-2.5 text-xs font-black transition duration-300 shadow-md ${
              isAddingReward
                ? 'cursor-not-allowed opacity-50 bg-slate-300 text-slate-500'
                : 'bg-[#FF4F18] text-[#111827] hover:bg-[#ff6c3b] active:scale-95 shadow-[#FF4F18]/15'
            }`}
          >
            <span className="block">{isAddingReward ? 'Ekleniyor...' : 'Ödülü Ata'}</span>
            <span className="mt-0.5 block text-[9px] font-bold opacity-80">Mevcut: {availablePoints} BP</span>
          </button>
        </form>
      </div>
      {rewards.length > 0 && (
        <div className="mt-6 border-t border-slate-100 dark:border-white/5 pt-5">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A08C6C] mb-4">
            📐 ACTIVE REWARDS / AKTİF ÖDÜLLER
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(showAllRewards ? rewards : rewards.slice(0, 8)).map((reward) => {
              const isAffordable = reward.cost <= availablePoints;
              const badgeTone = isAffordable
                ? 'border-[#FF4F18]/40 text-[#FF4F18] bg-[#FF4F18]/5 shadow-sm shadow-[#FF4F18]/5'
                : 'border-[#A08C6C]/30 text-slate-700 dark:text-[#A08C6C] bg-[#A08C6C]/5';

              return (
                <div
                  key={reward.id}
                  className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-semibold backdrop-blur-md transition duration-300 hover:scale-[1.03] ${badgeTone}`}
                >
                  <Trophy className={`h-3.5 w-3.5 ${isAffordable ? 'text-[#FF4F18] animate-pulse' : 'text-[#A08C6C]/70'}`} />
                  <span className="text-slate-900 dark:text-slate-100">{reward.name}</span>
                  <span className="opacity-40">•</span>
                  <span className="font-bold">{reward.cost} BP</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    isAffordable
                      ? 'bg-[#FF4F18]/15 text-[#FF4F18]'
                      : 'bg-[#A08C6C]/15 text-slate-500 dark:text-[#A08C6C]'
                  }`}>
                    {isAffordable ? 'Ulaşılabilir' : 'Birikiyor'}
                  </span>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        title: 'Ödülü Sil',
                        message: `"${reward.name}" ödülünü silmek istediğinize emin misiniz? Çocuğunuz artık bu ödülü talep edemeyecektir.`,
                        onConfirm: () => deleteReward(reward.id),
                      });
                    }}
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
                className="ios-button rounded-full px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2e2e38]"
              >
                {showAllRewards ? 'Daha az göster' : `Tümünü göster (${rewards.length})`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4">
          <div className="ios-card w-full max-w-sm p-6 space-y-4 border border-[var(--dr-std-border-strong)]/20 shadow-2xl bg-white dark:bg-[#1c1c1e] text-[var(--dr-text-primary)] animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{confirmModal.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{confirmModal.message}</p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 ios-button rounded-xl py-2.5 text-xs font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2e2e38] transition active:scale-[0.96] cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 dr-destructive-button rounded-xl py-2.5 text-xs font-black text-white transition active:scale-[0.96] cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ParentRewardWorkspace;

