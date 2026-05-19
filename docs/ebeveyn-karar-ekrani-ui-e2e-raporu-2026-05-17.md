# Ebeveyn Karar Ekrani UI/E2E Raporu (2026-05-17)

## Test ortami
- Uygulama URL: `http://127.0.0.1:3000/?quick=analysis&qaRecords=manual&analysisTab=goals&e2e=1`
- Kanit klasoru: [e2e-artifacts-2026-05-17-stabilization](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization)
- Ham JSON: [ui-e2e-result.json](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/ui-e2e-result.json)
- Kosu logu: [ui-e2e.log](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/ui-e2e.log)
- Vite logu: [vite.log](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/vite.log)

## 1) Ebeveyn ana ekran karar sinyalleri
- test adi: `Ebeveyn ana ekran karar sinyalleri`
- kullanilan veri: `qaRecords=manual, analysisTab=overview, e2e=1`
- kullanilan selector/test-id: `[data-testid^="decision-signal-"]`, `[data-testid="parent-analysis-workspace"]`
- beklenen sonuc: Ana karar sinyal kartlari gorunmeli.
- gercek sonuc: Karar sinyal sayisi: 4, workspace: hazir
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx
- screenshot/log: [01-main-signals.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/01-main-signals.png)
- ham JSON sonucu:
```json
{
  "id": 1,
  "name": "Ebeveyn ana ekran karar sinyalleri",
  "selectors": [
    "[data-testid^=\"decision-signal-\"]",
    "[data-testid=\"parent-analysis-workspace\"]"
  ],
  "expected": "Ana karar sinyal kartlari gorunmeli.",
  "actual": {
    "signalCount": 4,
    "workspaceReady": true
  },
  "pass": true,
  "elapsedMs": 6488,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\01-main-signals.png"
  ]
}
```

## 2) Ders karti -> ders detay akisi
- test adi: `Ders karti -> ders detay akisi`
- kullanilan veri: `qaRecords=manual, analysisTab=overview, e2e=1`
- kullanilan selector/test-id: `[data-testid^="course-summary-btn-"]`, `[data-testid="course-detail-panel"]`
- beklenen sonuc: Ders kartina tiklaninca ilgili ders detayi acilmali.
- gercek sonuc: Secilen ders: course_fen_bilgisi, detay paneli: course_fen_bilgisi
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx
- screenshot/log: [02-course-detail-flow.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/02-course-detail-flow.png)
- ham JSON sonucu:
```json
{
  "id": 2,
  "name": "Ders karti -> ders detay akisi",
  "selectors": [
    "[data-testid^=\"course-summary-btn-\"]",
    "[data-testid=\"course-detail-panel\"]"
  ],
  "expected": "Ders kartina tiklaninca ilgili ders detayi acilmali.",
  "actual": {
    "firstButton": "course-summary-btn-course_fen_bilgisi",
    "clicked": {
      "clicked": true
    },
    "selectedCourseId": "course_fen_bilgisi",
    "detailCourseId": "course_fen_bilgisi"
  },
  "pass": true,
  "elapsedMs": 4962,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\02-course-detail-flow.png"
  ]
}
```

## 3) Zaman filtreleri
- test adi: `Zaman filtreleri`
- kullanilan veri: `qaRecords=manual, analysisTab=reports, e2e=1`
- kullanilan selector/test-id: `[data-testid="report-period-select"]`, `[data-testid="analysis-reports-section"]`
- beklenen sonuc: Haftalik/Aylik/3 Aylik/Tum Zamanlar secimleri statei dogru guncellemeli.
- gercek sonuc: Filtre dogrulama: Haftalık:ok, Aylık:ok, 3 Aylık:ok, Tüm Zamanlar:ok
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx, App.tsx
- screenshot/log: [03-time-filters.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/03-time-filters.png)
- ham JSON sonucu:
```json
{
  "id": 3,
  "name": "Zaman filtreleri",
  "selectors": [
    "[data-testid=\"report-period-select\"]",
    "[data-testid=\"analysis-reports-section\"]"
  ],
  "expected": "Haftalik/Aylik/3 Aylik/Tum Zamanlar secimleri statei dogru guncellemeli.",
  "actual": [
    {
      "period": "Haftalık",
      "change": {
        "ok": true,
        "value": "Haftalık"
      },
      "state": "Haftalık",
      "ok": true
    },
    {
      "period": "Aylık",
      "change": {
        "ok": true,
        "value": "Aylık"
      },
      "state": "Aylık",
      "ok": true
    },
    {
      "period": "3 Aylık",
      "change": {
        "ok": true,
        "value": "3 Aylık"
      },
      "state": "3 Aylık",
      "ok": true
    },
    {
      "period": "Tüm Zamanlar",
      "change": {
        "ok": true,
        "value": "Tüm Zamanlar"
      },
      "state": "Tüm Zamanlar",
      "ok": true
    }
  ],
  "pass": true,
  "elapsedMs": 5134,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\03-time-filters.png"
  ]
}
```

## 4) Uzun ders/konu adlari UI stabilitesi
- test adi: `Uzun ders/konu adlari UI stabilitesi`
- kullanilan veri: `qaRecords=manual, analysisTab=insights, e2e=1`
- kullanilan selector/test-id: `[data-testid^="weak-topic-card-"]`
- beklenen sonuc: Uzun adlar yatay tasma olusturmamali.
- gercek sonuc: Root overflow: -15, kart sayisi: 5
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx
- screenshot/log: [04-long-name-overflow.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/04-long-name-overflow.png)
- ham JSON sonucu:
```json
{
  "id": 4,
  "name": "Uzun ders/konu adlari UI stabilitesi",
  "selectors": [
    "[data-testid^=\"weak-topic-card-\"]"
  ],
  "expected": "Uzun adlar yatay tasma olusturmamali.",
  "actual": {
    "rootOverflow": -15,
    "cardOverflow": [
      0,
      0,
      0,
      0,
      0
    ],
    "cardCount": 5
  },
  "pass": true,
  "elapsedMs": 11629,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\04-long-name-overflow.png"
  ]
}
```

## 5) Bos veri / az veri state
- test adi: `Bos veri / az veri state`
- kullanilan veri: `qaRecords=empty + qaRecords=low, analysisTab=overview, e2e=1`
- kullanilan selector/test-id: `[data-testid="analysis-state-card-overview"]`, `[data-testid="analysis-state-text-overview"]`
- beklenen sonuc: Bos ve az veri durumunda low-data mesajlari gelmeli.
- gercek sonuc: empty=low-data, low=low-data
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx, App.tsx
- screenshot/log: [05-empty-state.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/05-empty-state.png), [05-low-state.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/05-low-state.png)
- ham JSON sonucu:
```json
{
  "id": 5,
  "name": "Bos veri / az veri state",
  "selectors": [
    "[data-testid=\"analysis-state-card-overview\"]",
    "[data-testid=\"analysis-state-text-overview\"]"
  ],
  "expected": "Bos ve az veri durumunda low-data mesajlari gelmeli.",
  "actual": {
    "emptyState": "low-data",
    "lowState": "low-data",
    "emptyText": "Ilk analiz icin en az 3 tamamlanan calisma gerekli. Bu hafta veri olustukca karar onerileri netlesecek.",
    "lowText": "Ilk analiz icin en az 3 tamamlanan calisma gerekli. Bu hafta veri olustukca karar onerileri netlesecek."
  },
  "pass": true,
  "elapsedMs": 4523,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\05-empty-state.png",
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\05-low-state.png"
  ]
}
```

## 6) Hata/cache/sync guard
- test adi: `Hata/cache/sync guard`
- kullanilan veri: `bozuk localStorage + qaRecords=none, e2e=1`
- kullanilan selector/test-id: `[data-testid="parent-analysis-workspace"]`
- beklenen sonuc: Bozuk cache durumunda ekran cokmeden acilmali.
- gercek sonuc: root=true, loading=true, fatalError=false
- PASS/FAIL: `PASS`
- ilgili dosya: App.tsx
- screenshot/log: [06-error-guard.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/06-error-guard.png)
- ham JSON sonucu:
```json
{
  "id": 6,
  "name": "Hata/cache/sync guard",
  "selectors": [
    "[data-testid=\"parent-analysis-workspace\"]"
  ],
  "expected": "Bozuk cache durumunda ekran cokmeden acilmali.",
  "actual": {
    "rootVisible": true,
    "loadingVisible": true,
    "fatalErrorVisible": false,
    "surface": {
      "workspace": false,
      "heading": true,
      "loading": true,
      "stateCard": false,
      "fatal": false
    }
  },
  "pass": true,
  "elapsedMs": 1571,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\06-error-guard.png"
  ]
}
```

## 7) Hedef karti
- test adi: `Hedef karti`
- kullanilan veri: `qaRecords=manual, analysisTab=goals, e2e=1`
- kullanilan selector/test-id: `[data-testid="analysis-goals-section"]`, `[data-testid="top-goal-alert-level"]`
- beklenen sonuc: Hedef karar alani gorunmeli ve ust uyari etiketi olmali.
- gercek sonuc: section=true, topLevel=Stabil
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx
- screenshot/log: [07-goal-panel.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/07-goal-panel.png)
- ham JSON sonucu:
```json
{
  "id": 7,
  "name": "Hedef karti",
  "selectors": [
    "[data-testid=\"analysis-goals-section\"]",
    "[data-testid=\"top-goal-alert-level\"]"
  ],
  "expected": "Hedef karar alani gorunmeli ve ust uyari etiketi olmali.",
  "actual": {
    "hasSection": true,
    "topLevel": "Stabil"
  },
  "pass": true,
  "elapsedMs": 1717,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\07-goal-panel.png"
  ]
}
```

## 8) Deneme/LGS karti
- test adi: `Deneme/LGS karti`
- kullanilan veri: `qaRecords=manual, analysisTab=goals, e2e=1`
- kullanilan selector/test-id: `[data-testid="exam-card-school"]`, `[data-testid="exam-card-mock"]`, `[data-testid="exam-card-trend"]`
- beklenen sonuc: Deneme/LGS ozet kartlari gorunmeli.
- gercek sonuc: school=true, mock=true, trend=true
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx
- screenshot/log: [08-exam-cards.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/08-exam-cards.png)
- ham JSON sonucu:
```json
{
  "id": 8,
  "name": "Deneme/LGS karti",
  "selectors": [
    "[data-testid=\"exam-card-school\"]",
    "[data-testid=\"exam-card-mock\"]",
    "[data-testid=\"exam-card-trend\"]"
  ],
  "expected": "Deneme/LGS ozet kartlari gorunmeli.",
  "actual": {
    "school": true,
    "mock": true,
    "trend": true
  },
  "pass": true,
  "elapsedMs": 1674,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\08-exam-cards.png"
  ]
}
```

## 9) Uyari seviyeleri
- test adi: `Uyari seviyeleri`
- kullanilan veri: `qaRecords=manual, analysisTab=goals, e2e=1`
- kullanilan selector/test-id: `[data-testid="top-goal-alert-level"]`, `[data-testid^="goal-alert-"]`
- beklenen sonuc: Uyari etiketleri sadece izinli seviye setinde olmali.
- gercek sonuc: etiketler=Stabil, Takip et
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx
- screenshot/log: [09-alert-levels.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/09-alert-levels.png)
- ham JSON sonucu:
```json
{
  "id": 9,
  "name": "Uyari seviyeleri",
  "selectors": [
    "[data-testid=\"top-goal-alert-level\"]",
    "[data-testid^=\"goal-alert-\"]"
  ],
  "expected": "Uyari etiketleri sadece izinli seviye setinde olmali.",
  "actual": {
    "topLevel": "Stabil",
    "levels": [
      "Takip et"
    ],
    "allowed": [
      "Kritik",
      "Dikkat",
      "Takip et",
      "Stabil"
    ]
  },
  "pass": true,
  "elapsedMs": 1620,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\09-alert-levels.png"
  ]
}
```

## 10) Veli aksiyonu -> ogrenci gorev zinciri
- test adi: `Veli aksiyonu -> ogrenci gorev zinciri`
- kullanilan veri: `qaRecords=manual, analysisTab=goals, e2e=1`
- kullanilan selector/test-id: `[data-testid="track-topic-btn"]`, `[data-testid="switch-child-mode-btn"]`, `[data-plan-task-id^="parent-action-"]`
- beklenen sonuc: Veli aksiyonundan sonra cocuk ekraninda parent-action gorevi olusmali.
- gercek sonuc: pending 0 -> 1, childReady=true, childTask=1
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx, components/child/ChildDashboard.tsx, App.tsx
- screenshot/log: [10-parent-to-child-task.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/10-parent-to-child-task.png)
- ham JSON sonucu:
```json
{
  "id": 10,
  "name": "Veli aksiyonu -> ogrenci gorev zinciri",
  "selectors": [
    "[data-testid=\"track-topic-btn\"]",
    "[data-testid=\"switch-child-mode-btn\"]",
    "[data-plan-task-id^=\"parent-action-\"]"
  ],
  "expected": "Veli aksiyonundan sonra cocuk ekraninda parent-action gorevi olusmali.",
  "actual": {
    "beforePending": 0,
    "afterPending": 1,
    "childReady": true,
    "childCount": 1,
    "clicked": {
      "clicked": true
    }
  },
  "pass": true,
  "elapsedMs": 3552,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\10-parent-to-child-task.png"
  ]
}
```

## 11) Child complete -> parent refresh
- test adi: `Child complete -> parent refresh`
- kullanilan veri: `qaRecords=manual, analysisTab=goals, e2e=1`
- kullanilan selector/test-id: `[data-testid^="child-quick-complete-task-"]`, `[data-testid="switch-parent-mode-btn"]`, `[data-testid="parent-action-completed-count"]`
- beklenen sonuc: Cocukta tamamlanan parent-action gorevi ebeveyn ozetine yansimali.
- gercek sonuc: childReady=true, pending 1 -> 0, done 0 -> 1
- PASS/FAIL: `PASS`
- ilgili dosya: components/child/ChildDashboard.tsx, components/parent/ParentAnalysisWorkspace.tsx, App.tsx
- screenshot/log: [11-child-complete-parent.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/11-child-complete-parent.png)
- ham JSON sonucu:
```json
{
  "id": 11,
  "name": "Child complete -> parent refresh",
  "selectors": [
    "[data-testid^=\"child-quick-complete-task-\"]",
    "[data-testid=\"switch-parent-mode-btn\"]",
    "[data-testid=\"parent-action-completed-count\"]"
  ],
  "expected": "Cocukta tamamlanan parent-action gorevi ebeveyn ozetine yansimali.",
  "actual": {
    "childReady": true,
    "quickDone": {
      "clicked": true
    },
    "beforePending": 1,
    "afterPending": 0,
    "beforeDone": 0,
    "afterDone": 1
  },
  "pass": true,
  "elapsedMs": 5324,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\11-child-complete-parent.png"
  ]
}
```

## 12) 6000 kayit performans testi
- test adi: `6000 kayit performans testi`
- kullanilan veri: `npm run test:heavy`
- kullanilan selector/test-id: `scripts/heavy-real-data-tests.ts`
- beklenen sonuc: Ağir veri analizi hata vermeden tamamlanmali.
- gercek sonuc: heavyPassed=true, analysisElapsedMs=333
- PASS/FAIL: `PASS`
- ilgili dosya: scripts/heavy-real-data-tests.ts
- screenshot/log: [12-performance-context.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/12-performance-context.png), [test-heavy.log](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/test-heavy.log)
- ham JSON sonucu:
```json
{
  "id": 12,
  "name": "6000 kayit performans testi",
  "selectors": [
    "scripts/heavy-real-data-tests.ts"
  ],
  "expected": "Ağir veri analizi hata vermeden tamamlanmali.",
  "actual": {
    "heavyPassed": true,
    "analysisElapsedMs": 333,
    "logPath": "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\test-heavy.log"
  },
  "pass": true,
  "elapsedMs": 3501,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\12-performance-context.png",
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\test-heavy.log"
  ]
}
```

## 13) Duplicate event idempotency
- test adi: `Duplicate event idempotency`
- kullanilan veri: `qaRecords=manual, track-topic iki kez, e2e=1`
- kullanilan selector/test-id: `[data-testid="track-topic-btn"]`, `task.planTaskId^="parent-action-"`
- beklenen sonuc: Ayni parent aksiyonu duplicate gorev olusturmamali.
- gercek sonuc: pending 0->0 (delta=0), total=1, unique=1, duplicate=0
- PASS/FAIL: `PASS`
- ilgili dosya: components/parent/ParentAnalysisWorkspace.tsx, App.tsx
- screenshot/log: [13-idempotency.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/13-idempotency.png)
- ham JSON sonucu:
```json
{
  "id": 13,
  "name": "Duplicate event idempotency",
  "selectors": [
    "[data-testid=\"track-topic-btn\"]",
    "task.planTaskId^=\"parent-action-\""
  ],
  "expected": "Ayni parent aksiyonu duplicate gorev olusturmamali.",
  "actual": {
    "beforePending": 0,
    "afterPending": 0,
    "pendingDelta": 0,
    "total": 1,
    "unique": 1,
    "duplicateCount": 0,
    "atLeastOneCreated": true
  },
  "pass": true,
  "elapsedMs": 5303,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\13-idempotency.png"
  ]
}
```

## 14) Notification cooldown UI
- test adi: `Notification cooldown UI`
- kullanilan veri: `qaRecords=low, notifications interaction, e2e=1`
- kullanilan selector/test-id: `[data-testid="topbar-notifications-toggle"]`, `[data-testid^="notification-item-"]`, `[data-cooldown-group]`
- beklenen sonuc: Ayni cooldown grubundaki bildirim aksiyon sonrasi tekrar listelenmemeli.
- gercek sonuc: group=weak, remaining=0, cooldown=1779164508510
- PASS/FAIL: `PASS`
- ilgili dosya: App.tsx
- screenshot/log: [14-notification-cooldown.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/14-notification-cooldown.png)
- ham JSON sonucu:
```json
{
  "id": 14,
  "name": "Notification cooldown UI",
  "selectors": [
    "[data-testid=\"topbar-notifications-toggle\"]",
    "[data-testid^=\"notification-item-\"]",
    "[data-cooldown-group]"
  ],
  "expected": "Ayni cooldown grubundaki bildirim aksiyon sonrasi tekrar listelenmemeli.",
  "actual": {
    "firstItem": {
      "key": "weak:1",
      "group": "weak"
    },
    "remainingCount": 0,
    "cooldownValue": 1779164508510
  },
  "pass": true,
  "elapsedMs": 3655,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\14-notification-cooldown.png"
  ]
}
```

## E2E-only izolasyon kontrolleri

### E1) e2e=1 olmadan quick complete butonu gorunmuyor
- test adi: `e2e=1 olmadan quick complete butonu gorunmuyor`
- kullanilan veri: `qaRecords=manual, e2e parametresi yok`
- kullanilan selector/test-id: `[data-testid="switch-child-mode-btn"]`, `[data-testid^="child-quick-complete-task-"]`
- beklenen sonuc: Test-only quick complete butonu normal modda render edilmemeli.
- gercek sonuc: childRoot=true, quickButtons=0
- PASS/FAIL: `PASS`
- screenshot/log: [e1-no-e2e-quick-complete.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/e1-no-e2e-quick-complete.png)
- ham JSON sonucu:
```json
{
  "id": "E1",
  "name": "e2e=1 olmadan quick complete butonu gorunmuyor",
  "selectors": [
    "[data-testid=\"switch-child-mode-btn\"]",
    "[data-testid^=\"child-quick-complete-task-\"]"
  ],
  "expected": "Test-only quick complete butonu normal modda render edilmemeli.",
  "actual": {
    "childRoot": true,
    "quickButtons": 0
  },
  "pass": true,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\e1-no-e2e-quick-complete.png"
  ]
}
```

### E2) e2e=1 olmadan test-seed akisi calismiyor
- test adi: `e2e=1 olmadan test-seed akisi calismiyor`
- kullanilan veri: `qaRecords=manual, e2e parametresi yok, localStorage temiz baslangic`
- kullanilan selector/test-id: `localStorage.__qa_manual_records_seeded_at`, `task.id^="qa_manual_"`
- beklenen sonuc: qa seed timestamp yazilmamali ve qa_manual tasklari uretilmemeli.
- gercek sonuc: seedMarker=null, qaTaskCount=0
- PASS/FAIL: `PASS`
- screenshot/log: [e2-no-e2e-seed.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/e2-no-e2e-seed.png)
- ham JSON sonucu:
```json
{
  "id": "E2",
  "name": "e2e=1 olmadan test-seed akisi calismiyor",
  "selectors": [
    "localStorage.__qa_manual_records_seeded_at",
    "task.id^=\"qa_manual_\""
  ],
  "expected": "qa seed timestamp yazilmamali ve qa_manual tasklari uretilmemeli.",
  "actual": {
    "seedMarker": null,
    "qaTaskCount": 0
  },
  "pass": true,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\e2-no-e2e-seed.png"
  ]
}
```

### E3) Normal parent/child akisi e2e olmadan bozuk degil
- test adi: `Normal parent/child akisi e2e olmadan bozuk degil`
- kullanilan veri: `qaRecords=none, e2e parametresi yok`
- kullanilan selector/test-id: `[data-testid="switch-child-mode-btn"]`, `[data-testid="switch-parent-mode-btn"]`, `[data-testid="parent-lock-screen"]`
- beklenen sonuc: Childe gecis ve parenta donuste lock screen gorunmeli; akista kirilma olmamali.
- gercek sonuc: childRoot=true, lockScreen=true, passwordInput=true
- PASS/FAIL: `PASS`
- screenshot/log: [e3-no-e2e-parent-child.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-17-stabilization/e3-no-e2e-parent-child.png)
- ham JSON sonucu:
```json
{
  "id": "E3",
  "name": "Normal parent/child akisi e2e olmadan bozuk degil",
  "selectors": [
    "[data-testid=\"switch-child-mode-btn\"]",
    "[data-testid=\"switch-parent-mode-btn\"]",
    "[data-testid=\"parent-lock-screen\"]"
  ],
  "expected": "Childe gecis ve parenta donuste lock screen gorunmeli; akista kirilma olmamali.",
  "actual": {
    "childRoot": true,
    "lockScreen": true,
    "passwordInput": true
  },
  "pass": true,
  "evidence": [
    "C:\\Users\\90535\\Desktop\\DersRotası\\docs\\e2e-artifacts-2026-05-17-stabilization\\e3-no-e2e-parent-child.png"
  ]
}
```

---

## Ozet
- PASS: `14`
- FAIL: `0`
- Hedef: `PASS: 14 / FAIL: 0`
- E2E-only izolasyon PASS: `3` / `3`

