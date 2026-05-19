export type DecisionLevel = 'Kritik' | 'Dikkat' | 'Takip et' | 'Stabil';
export type TrendDirection = 'Yukseliyor' | 'Stabil' | 'Dusuyor' | 'Hizli dusuyor';
export type NotificationTier = 'silent' | 'normal' | 'critical';

export interface DecisionThresholds {
  lowDataSessionCount: number;
  noStudyDaysCritical: number;
  weakTopicCountWarning: number;
  riskWarningMin: number;
  riskCriticalMin: number;
}

export interface DecisionWeights {
  noStudy: number;
  trendDrop: number;
  weakTopics: number;
  risk: number;
  lowDataPenalty: number;
}

export interface DecisionRuleConfig {
  scoringVersion: string;
  rulesVersion: string;
  thresholdVersion: string;
  thresholds: DecisionThresholds;
  weights: DecisionWeights;
}

export interface DecisionRuleOverrides {
  thresholds?: Partial<DecisionThresholds>;
  weights?: Partial<DecisionWeights>;
}

export interface ParentDecisionInput {
  sessionsCount: number;
  weeklyCompletedCount: number;
  weakTopicCount: number;
  averageRisk: number;
  latestCompositeAverage: number | null;
  previousCompositeAverage: number | null;
  parentActionPendingCount?: number;
  parentActionCompletedCount?: number;
  parentActionCompletedTodayCount?: number;
}

export interface DecisionAlert {
  level: DecisionLevel;
  text: string;
  action: string;
  severityScore: number;
  urgency: number;
  confidence: 'Yuksek' | 'Orta' | 'Dusuk';
  tier: NotificationTier;
}

export interface ParentDecisionResult {
  trend: TrendDirection;
  alerts: DecisionAlert[];
  topAlert: DecisionAlert;
  diagnostics: {
    scoringVersion: string;
    rulesVersion: string;
    thresholdVersion: string;
    thresholds: DecisionThresholds;
    weights: DecisionWeights;
  };
}

export const PARENT_DECISION_RULES_V1: DecisionRuleConfig = {
  scoringVersion: 'parent-decision-v1',
  rulesVersion: 'decision-rules-v1',
  thresholdVersion: 'thresholds-v1',
  thresholds: {
    lowDataSessionCount: 3,
    noStudyDaysCritical: 3,
    weakTopicCountWarning: 4,
    riskWarningMin: 45,
    riskCriticalMin: 65,
  },
  weights: {
    noStudy: 42,
    trendDrop: 26,
    weakTopics: 22,
    risk: 18,
    lowDataPenalty: 14,
  },
};

export const PARENT_DECISION_RULES_V2: DecisionRuleConfig = {
  scoringVersion: 'parent-decision-v2',
  rulesVersion: 'decision-rules-v2',
  thresholdVersion: 'thresholds-v2',
  thresholds: {
    lowDataSessionCount: 4,
    noStudyDaysCritical: 3,
    weakTopicCountWarning: 3,
    riskWarningMin: 42,
    riskCriticalMin: 62,
  },
  weights: {
    noStudy: 46,
    trendDrop: 30,
    weakTopics: 24,
    risk: 20,
    lowDataPenalty: 16,
  },
};

export const resolveDecisionRuleConfig = (
  overrides?: DecisionRuleOverrides | null,
): DecisionRuleConfig => ({
  ...PARENT_DECISION_RULES_V1,
  thresholds: {
    ...PARENT_DECISION_RULES_V1.thresholds,
    ...(overrides?.thresholds || {}),
  },
  weights: {
    ...PARENT_DECISION_RULES_V1.weights,
    ...(overrides?.weights || {}),
  },
});

export const getParentDecisionVersionMeta = () => ({
  scoringVersion: PARENT_DECISION_RULES_V2.scoringVersion,
  rulesVersion: PARENT_DECISION_RULES_V2.rulesVersion,
  thresholdVersion: PARENT_DECISION_RULES_V2.thresholdVersion,
});

export const getNotificationTierFromLevel = (level: DecisionLevel): NotificationTier => {
  if (level === 'Kritik') return 'critical';
  if (level === 'Dikkat') return 'normal';
  return 'silent';
};

export const getNotificationCooldownMs = (tier: NotificationTier): number => {
  if (tier === 'critical') return 24 * 60 * 60 * 1000;
  if (tier === 'normal') return 48 * 60 * 60 * 1000;
  return 72 * 60 * 60 * 1000;
};

const getConfidence = (sessionsCount: number): DecisionAlert['confidence'] => {
  if (sessionsCount >= 24) return 'Yuksek';
  if (sessionsCount >= 8) return 'Orta';
  return 'Dusuk';
};

const getTrend = (latest: number | null, previous: number | null): TrendDirection => {
  if (latest === null || previous === null) return 'Stabil';
  const diff = latest - previous;
  if (diff <= -15) return 'Hizli dusuyor';
  if (diff <= -8) return 'Dusuyor';
  if (diff >= 8) return 'Yukseliyor';
  return 'Stabil';
};

const toLevel = (severityScore: number): DecisionLevel => {
  if (severityScore >= 70) return 'Kritik';
  if (severityScore >= 45) return 'Dikkat';
  if (severityScore >= 25) return 'Takip et';
  return 'Stabil';
};

const withTier = (alert: Omit<DecisionAlert, 'tier'>): DecisionAlert => ({
  ...alert,
  tier: getNotificationTierFromLevel(alert.level),
});

const getAdaptiveConfig = (
  input: ParentDecisionInput,
  base: DecisionRuleConfig,
): DecisionRuleConfig => {
  const sessionCount = input.sessionsCount || 0;
  const hasParentActionFlow = (input.parentActionPendingCount || 0) + (input.parentActionCompletedCount || 0) > 0;
  const lowData = sessionCount < base.thresholds.lowDataSessionCount;
  const highData = sessionCount >= 40;

  const riskCriticalMin = lowData
    ? base.thresholds.riskCriticalMin + 4
    : highData
      ? Math.max(50, base.thresholds.riskCriticalMin - 2)
      : base.thresholds.riskCriticalMin;
  const riskWarningMin = lowData
    ? base.thresholds.riskWarningMin + 3
    : highData
      ? Math.max(35, base.thresholds.riskWarningMin - 2)
      : base.thresholds.riskWarningMin;
  const weakTopicCountWarning = highData
    ? Math.max(2, base.thresholds.weakTopicCountWarning - 1)
    : base.thresholds.weakTopicCountWarning;

  return {
    ...base,
    thresholds: {
      ...base.thresholds,
      riskCriticalMin,
      riskWarningMin,
      weakTopicCountWarning,
    },
    weights: {
      ...base.weights,
      noStudy: hasParentActionFlow ? Math.max(24, base.weights.noStudy - 4) : base.weights.noStudy,
      lowDataPenalty: lowData ? base.weights.lowDataPenalty + 2 : base.weights.lowDataPenalty,
      trendDrop: highData ? base.weights.trendDrop + 2 : base.weights.trendDrop,
    },
  };
};

export const getTopicDecisionLevel = (
  riskScore: number,
  config: DecisionRuleConfig = PARENT_DECISION_RULES_V1,
): DecisionLevel => {
  if (riskScore >= config.thresholds.riskCriticalMin) return 'Kritik';
  if (riskScore >= config.thresholds.riskWarningMin) return 'Dikkat';
  if (riskScore >= 30) return 'Takip et';
  return 'Stabil';
};

export const buildParentDecision = (
  input: ParentDecisionInput,
  config: DecisionRuleConfig = PARENT_DECISION_RULES_V2,
): ParentDecisionResult => {
  const adaptiveConfig = getAdaptiveConfig(input, config);
  const trend = getTrend(input.latestCompositeAverage, input.previousCompositeAverage);
  const confidence = getConfidence(input.sessionsCount);
  const alerts: DecisionAlert[] = [];

  if (input.sessionsCount < adaptiveConfig.thresholds.lowDataSessionCount) {
    alerts.push(withTier({
      level: 'Takip et',
      text: 'Ilk analiz icin 3 calisma daha gerekli.',
      action: 'Plani koru',
      severityScore: adaptiveConfig.weights.lowDataPenalty,
      urgency: 20,
      confidence,
    }));
  }

  if (input.weeklyCompletedCount === 0) {
    const parentActionActive = (input.parentActionPendingCount || 0) > 0;
    alerts.push(withTier({
      level: parentActionActive ? 'Dikkat' : 'Kritik',
      text: parentActionActive
        ? 'Son 7 gunde tamamlanan calisma yok, ancak veli aksiyonu acik durumda.'
        : 'Son 7 gunde tamamlanan calisma yok.',
      action: parentActionActive ? 'Acilan gorevi bugun tamamla' : 'Bugune 1 gorev ekle',
      severityScore: (adaptiveConfig.weights.noStudy + (input.averageRisk >= adaptiveConfig.thresholds.riskCriticalMin ? 20 : 0)) - (parentActionActive ? 14 : 0),
      urgency: parentActionActive ? 62 : 85,
      confidence,
    }));
  }

  if ((input.parentActionPendingCount || 0) > 0) {
    alerts.push(withTier({
      level: 'Takip et',
      text: `Veliden atanan bekleyen gorev: ${input.parentActionPendingCount}.`,
      action: 'Bugunun planinda onceliklendir',
      severityScore: 30,
      urgency: 40,
      confidence,
    }));
  }

  if ((input.parentActionCompletedTodayCount || 0) > 0) {
    alerts.push(withTier({
      level: 'Stabil',
      text: `Bugun veliden gelen ${input.parentActionCompletedTodayCount} gorev tamamlandi.`,
      action: 'Ayni ritmi koru',
      severityScore: 6,
      urgency: 12,
      confidence,
    }));
  }

  if (trend === 'Dusuyor' || trend === 'Hizli dusuyor') {
    alerts.push(withTier({
      level: trend === 'Hizli dusuyor' ? 'Kritik' : 'Dikkat',
      text: 'Son deneme ortalamasi bir onceki denemeye gore dusuyor.',
      action: '15 soru hedefi ver',
      severityScore: adaptiveConfig.weights.trendDrop + (trend === 'Hizli dusuyor' ? 18 : 6),
      urgency: trend === 'Hizli dusuyor' ? 80 : 60,
      confidence,
    }));
  }

  if (input.weakTopicCount >= adaptiveConfig.thresholds.weakTopicCountWarning) {
    alerts.push(withTier({
      level: 'Dikkat',
      text: `Odak bekleyen konu sayisi: ${input.weakTopicCount}.`,
      action: 'Tekrar gorevi ac',
      severityScore: adaptiveConfig.weights.weakTopics + Math.min(18, input.weakTopicCount * 2),
      urgency: 55,
      confidence,
    }));
  }

  if (input.averageRisk >= adaptiveConfig.thresholds.riskWarningMin) {
    const severe = input.averageRisk >= adaptiveConfig.thresholds.riskCriticalMin;
    alerts.push(withTier({
      level: severe ? 'Kritik' : 'Dikkat',
      text: severe ? 'Genel risk seviyesi kritik esige yaklasti.' : 'Genel risk seviyesi izleme gerektiriyor.',
      action: severe ? 'Bugunun planina tekrar ekle' : 'Dusen dersleri takip et',
      severityScore: adaptiveConfig.weights.risk + (severe ? 24 : 8),
      urgency: severe ? 78 : 44,
      confidence,
    }));
  }

  const normalizedAlerts: DecisionAlert[] = alerts
    .map((alert) => {
      if (confidence === 'Dusuk' && (alert.level === 'Kritik' || alert.level === 'Dikkat')) {
        const softenedLevel = alert.level === 'Kritik' ? 'Dikkat' : 'Takip et';
        return withTier({
          ...alert,
          level: softenedLevel,
          text: `${alert.text} (On yorum)`,
        });
      }
      return alert;
    })
    .sort((a, b) => b.severityScore - a.severityScore);

  const fallback: DecisionAlert = withTier({
    level: 'Stabil',
    text: 'Su an kritik uyari yok.',
    action: 'Mevcut ritmi koru',
    severityScore: 0,
    urgency: 0,
    confidence,
  });

  const topAlert = normalizedAlerts[0] || fallback;
  const alignedTop = withTier({ ...topAlert, level: toLevel(topAlert.severityScore) });
  return {
    trend,
    alerts: normalizedAlerts,
    topAlert: alignedTop,
    diagnostics: {
      scoringVersion: adaptiveConfig.scoringVersion,
      rulesVersion: adaptiveConfig.rulesVersion,
      thresholdVersion: adaptiveConfig.thresholdVersion,
      thresholds: adaptiveConfig.thresholds,
      weights: adaptiveConfig.weights,
    },
  };
};
