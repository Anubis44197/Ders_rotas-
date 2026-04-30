import React, { useState } from 'react';
import { Reward } from '../../types';
import { Trash2, Trophy } from '../icons';

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
    ? 'ios-button text-slate-500'
    : numericRewardCost < 150
      ? 'ios-mint text-emerald-950'
      : numericRewardCost < 350
        ? 'ios-yellow text-amber-950'
        : 'ios-coral text-rose-950';

  const handleAddReward = (event: React.FormEvent) => {
    event.preventDefault();
    if (isAddingReward) return;

    const nextRewardName = rewardName.trim();
    const nextRewardCost = Number(rewardCost);
    if (!nextRewardName || !rewardCost) {
      showActionMessage('error', 'Odul adi ve puan alani zorunludur.');
      return;
    }

    if (!Number.isFinite(nextRewardCost) || nextRewardCost <= 0) {
      showActionMessage('error', 'Odul puani sifirdan buyuk bir sayi olmali.');
      return;
    }

    const hasDuplicateReward = rewards.some(
      (reward) => reward.name.toLocaleLowerCase('tr-TR') === nextRewardName.toLocaleLowerCase('tr-TR') && reward.cost === nextRewardCost,
    );
    if (hasDuplicateReward) {
      showActionMessage('error', 'Ayni ad ve puandaki odul zaten tanimli.');
      return;
    }

    setIsAddingReward(true);
    try {
      addReward({ name: nextRewardName, cost: nextRewardCost, icon: 'Gift' });
      setRewardName('');
      setRewardCost('100');
      showActionMessage('success', `'${nextRewardName}' odulu eklendi.`);
    } finally {
      window.setTimeout(() => setIsAddingReward(false), 250);
    }
  };

  return (
    <section className="ios-card rounded-[30px] p-5">
      {actionMessage && (
        <div className={`mb-4 rounded-[20px] px-4 py-3 text-sm font-semibold ${actionMessage.type === 'success' ? 'ios-mint text-emerald-900' : 'ios-coral text-rose-900'}`}>
          {actionMessage.text}
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Ebeveyn kontrol merkezi</div>
          <h3 className="mt-1 text-xl font-black text-slate-900">Odul Tanimla</h3>
        </div>
        <form onSubmit={handleAddReward} className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto] lg:max-w-2xl">
          <input value={rewardName} onChange={(e) => setRewardName(e.target.value)} placeholder="Odul adi" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
          <input value={rewardCost} onChange={(e) => setRewardCost(e.target.value)} placeholder="Puan" type="number" min="1" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
          <button type="submit" disabled={isAddingReward} className={`rounded-[18px] px-3 py-2 text-sm font-bold transition ${isAddingReward ? 'cursor-not-allowed opacity-50' : rewardButtonTone}`}>
            <span className="block">{isAddingReward ? 'Ekleniyor...' : 'Odulu Ata'}</span>
            <span className="mt-0.5 block text-[11px] font-semibold opacity-80">Mevcut: {availablePoints} BP</span>
          </button>
        </form>
      </div>
      {rewards.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(showAllRewards ? rewards : rewards.slice(0, 8)).map((reward) => (
            <div key={reward.id} className="ios-widget inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-slate-700">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-semibold">{reward.name}</span>
              <span>{reward.cost} BP</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${reward.cost <= availablePoints ? 'ios-mint text-emerald-800' : 'ios-yellow text-amber-800'}`}>
                {reward.cost <= availablePoints ? 'Ulasilabilir' : 'Birikiyor'}
              </span>
              <button onClick={() => deleteReward(reward.id)} className="text-rose-600" type="button" aria-label={`${reward.name} odulunu sil`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {rewards.length > 8 && (
            <button type="button" onClick={() => setShowAllRewards((prev) => !prev)} className="ios-button rounded-full px-3 py-1 text-xs font-bold text-slate-700">
              {showAllRewards ? 'Daha az goster' : `Tumunu goster (${rewards.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default ParentRewardWorkspace;
