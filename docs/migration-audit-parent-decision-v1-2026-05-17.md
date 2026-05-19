# Migration Audit - Parent Decision V1 - 2026-05-17

## Kapsam

Bu audit, mevcut yerel veri yapisinin `Ebeveyn Karar Ekrani V1` ile uyumunu ve migration risklerini ozetler.

## Veri Kaynaklari

- `courses`
- `tasks`
- `curriculum`
- `weeklySchedule`
- `examScheduleEntries`
- `examRecords`
- `compositeExamResults`
- `studyPlans`
- `planningEngineSnapshot`
- `performanceData`
- `rewards`
- `successPoints`
- `badges`

## Mapping Ozetleri

### 1) Gorev kayitlari -> Analiz session

- Kaynak: `tasks`
- Hedef: `deriveAnalysisSnapshot(...).sessions`
- Not:
  - `isCompletedTask` filtresi tamamlanan kayitlari normalize ediyor.
  - `taskType`, `questionCount`, `correct/incorrect`, `actualDuration`, `breakTime`, `pauseTime` alanlari session metriklerine akiyor.

### 2) Ders + mufredat -> Konu/ders metrikleri

- Kaynak: `courses`, `curriculum`
- Hedef: `topics`, `courses` metrik setleri
- Not:
  - Ders pasif/aktif durumu normalize akisi icinde korunuyor.
  - Konu adlarinda uzun metinler analiz katmaninda korunuyor; UI'da sade gosterim uygulanmali.

### 3) Sinav kayitlari -> Okul uyumu + deneme trendi

- Kaynak: `examRecords`, `compositeExamResults`
- Hedef: `school.coursePerformance`, `school.latestStateExam`, deneme trendleri
- Not:
  - Tek deneme kaydinda trend icin "az veri" dili kullanilmali.
  - Iki ve ustu deneme kaydinda degisim/trend aktif.

### 4) Plan verisi -> Plan uyumu

- Kaynak: `studyPlans`, `planningEngineSnapshot`
- Hedef: plan adherence ve plan bazli karar sinyalleri
- Not:
  - `planTaskId` baglantili tasklar plan tamamlama metriklerine dahil.

## Guvenli Fallback Durumu

- `deriveAnalysisSnapshotSafe(...)` eklendi.
- Hesaplama hatasi olursa:
  - Uygulama cokmez.
  - Bos task fallback snapshot uretilir.
  - Runtime hata mesaji UI hata kartina aktarilir.

## Idempotency Kontrolu

- Hedef/deneme aksiyonundan uretilen "15 soru" gorevi:
  - Ayni ders + ayni gun + ayni baslik + bekliyor durumunda duplicate olusmaz.

## 2026-05-17 Ek Kapanislar

- Rollout modu:
  - `stable/beta` secimi eklendi.
  - `stable` modda sadece V1 varsayilan kurallar calisir.
  - `beta` modda tuning override devreye girer.
- Threshold migration guard:
  - `thresholdVersion` degistiginde eski tuning override otomatik sifirlanir.
  - Eski ayarlarin yeni kural setini bozma riski dusurulur.
- Edge-case karar sinyalleri:
  - Deneme verisi eksikligi karar sinyaline yazilir.
  - Hedef/plansiz durum karar sinyaline yazilir.
  - Supheli veri tespiti karar sinyaline yazilir.

## Bilinen Riskler

1. Bazi legacy metinlerde mojibake kalintilari var.
2. Observability su an localStorage event seviyesinde; merkezi telemetry yok.
3. Feature flag rollout su an local cihaz ayari (sticky state); ortama gore merkezi yonetim yok.

## Dogrulama

- `npm run typecheck`: gecti
- `npm run smoke`: gecti
- `npm run test:matrix`: gecti
- `npm run test:heavy`: gecti
- `npm run build`: gecti

## Sonuc

Parent Decision V1 icin migration katmani guvenli calisiyor. Veri kaybi veya ekran cokusu riski temel senaryolarda dusuruldu. V1.5 kapanisi icin merkezi rollout + merkezi observability sonraki adimdir.
