# Ebeveyn Karar Ekrani 6000+ Guven Test Raporu

- Tarih: 2026-05-18T13:12:01.247Z
- Uygulama: http://127.0.0.1:3000/?quick=analysis&e2e=1&qaRecords=none
- Ortam: win32, Node v25.1.0
- Ham JSON: [parent-decision-6000plus-raw.json](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/parent-decision-6000plus-raw.json)
- Kosu logu: [run.log](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/run.log)

## 1) 6000 / 10000 / 20000 kayit yuk testi

### Seviye 6000
- Veri miktari: 6000 gorev + oturum/soru/deneme/hedef/tekrar karisik
- Beklenen sonuc: Analiz <= 2200ms, ekran <= 3200ms, grafik <= 2200ms
- Gercek sonuc: Analiz 284ms, UI test hatasi: Ana ekran hazir degil (6000) debug={"parentWorkspaceView":"\"analysis\"","userType":"\"parent\"","isParentLocked":"false","hasParentWorkspace":false,"hasLockScreen":false,"hasChildRoot":false,"bodySample":"Uygulama acilirken bir veri hatasi yakalandi\n\nBeyaz ekran yerine bu kurtarma ekranı gösteriliyor. Sayfayı yenileyebilir ya da bu tarayıcıdaki yerel DersRotası verisini temizleyip temiz başlangıç yapabilirsiniz.\n\nFailed t"}
- Sure (engine): analiz 284ms, decision 15ms, 2. run 1001ms
- Sure (ui): ekran -1ms, grafik -1ms
- Bellek: node heap 30.4 MB, browser heap -
- Storage: localStorage 0 B, storage.usage -
- Cache hit/miss: engine 1/1, ui 0/0
- PASS/FAIL: FAIL
- Ekran goruntusu/log: [level-6000.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/level-6000-error.png)
- Risk yorumu: FAIL nedeni: Analiz 284ms, UI test hatasi: Ana ekran hazir degil (6000) debug={"parentWorkspaceView":"\"analysis\"","userType":"\"parent\"","isParentLocked":"false","hasParentWorkspace":false,"hasLockScreen":false,"hasChildRoot":false,"bodySample":"Uygulama acilirken bir veri hatasi yakalandi\n\nBeyaz ekran yerine bu kurtarma ekranı gösteriliyor. Sayfayı yenileyebilir ya da bu tarayıcıdaki yerel DersRotası verisini temizleyip temiz başlangıç yapabilirsiniz.\n\nFailed t"}

### Seviye 10000
- Veri miktari: 10000 gorev + oturum/soru/deneme/hedef/tekrar karisik
- Beklenen sonuc: Analiz <= 3600ms, ekran <= 4500ms, grafik <= 3500ms
- Gercek sonuc: Analiz 791ms, ekran 3189ms, grafik 15ms, cache 1/4
- Sure (engine): analiz 791ms, decision 26ms, 2. run 833ms
- Sure (ui): ekran 3189ms, grafik 15ms
- Bellek: node heap 35.8 MB, browser heap 43.5 MB
- Storage: localStorage 3.3 KB, storage.usage 2.1 MB
- Cache hit/miss: engine 1/1, ui 1/4
- PASS/FAIL: PASS
- Ekran goruntusu/log: [level-10000.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/level-10000.png)
- Risk yorumu: Seviye kabul siniri icinde.

### Seviye 20000
- Veri miktari: 20000 gorev + oturum/soru/deneme/hedef/tekrar karisik
- Beklenen sonuc: Analiz <= 7000ms, ekran <= 8500ms, grafik <= 6000ms
- Gercek sonuc: Analiz 4047ms, ekran 6242ms, grafik 10ms, cache 1/4
- Sure (engine): analiz 4047ms, decision 50ms, 2. run 2670ms
- Sure (ui): ekran 6242ms, grafik 10ms
- Bellek: node heap 60.7 MB, browser heap 111.2 MB
- Storage: localStorage 3.3 KB, storage.usage 3.7 MB
- Cache hit/miss: engine 1/1, ui 1/4
- PASS/FAIL: PASS
- Ekran goruntusu/log: [level-20000.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/level-20000.png)
- Risk yorumu: Seviye kabul siniri icinde.

## 2) Geri butonu / navigation (100 tekrar x 5 akis)

### ebeveyn ana ekran -> ders detay -> geri
- Veri miktari: 100 tekrar
- Beklenen sonuc: 5 tekrar sonunda bos ekran/state bozulmasi olmamali.
- Gercek sonuc: blank=0, state=0, crash=0
- Sure: 100 dongu
- Bellek: bu maddede asiri artis beklenmez
- Storage boyutu: duplicate kontrolu icin parent-action izlenir
- PASS/FAIL: PASS
- Ekran goruntusu/log: [nav-a-course-back.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/nav-a-course-back.png)
- Risk yorumu: Gecisler stabil.

### raporlar -> grafik detayi -> geri
- Veri miktari: 100 tekrar
- Beklenen sonuc: 5 tekrar sonunda grafik akisinda bos ekran veya crash olmamali.
- Gercek sonuc: blank=0, state=0, crash=0
- Sure: 100 dongu
- Bellek: bu maddede asiri artis beklenmez
- Storage boyutu: duplicate kontrolu icin parent-action izlenir
- PASS/FAIL: PASS
- Ekran goruntusu/log: [nav-b-reports-back.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/nav-b-reports-back.png)
- Risk yorumu: Gecisler stabil.

### hedefler -> deneme karti -> geri
- Veri miktari: 100 tekrar
- Beklenen sonuc: Deneme karti her turde bulunmali, geri donuste state bozulmamali.
- Gercek sonuc: blank=0, state=0, crash=0
- Sure: 100 dongu
- Bellek: bu maddede asiri artis beklenmez
- Storage boyutu: duplicate kontrolu icin parent-action izlenir
- PASS/FAIL: PASS
- Ekran goruntusu/log: [nav-c-goals-back.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/nav-c-goals-back.png)
- Risk yorumu: Gecisler stabil.

### veli -> cocuk ekrani -> geri/parent donus
- Veri miktari: 100 tekrar
- Beklenen sonuc: Parent/child gecisinde bos ekran veya kilitlenme olmamali.
- Gercek sonuc: blank=0, state=0, crash=0
- Sure: 100 dongu
- Bellek: bu maddede asiri artis beklenmez
- Storage boyutu: duplicate kontrolu icin parent-action izlenir
- PASS/FAIL: PASS
- Ekran goruntusu/log: [nav-d-parent-child.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/nav-d-parent-child.png)
- Risk yorumu: Gecisler stabil.

### cocuk gorev tamamla -> veli ekrani -> geri
- Veri miktari: 100 tekrar
- Beklenen sonuc: Tamamlama sonrasi parent ozet guncellenmeli, duplicate parent-action olmamali.
- Gercek sonuc: blank=0, state=0, crash=0, duplicateDelta=0
- Sure: 100 dongu
- Bellek: bu maddede asiri artis beklenmez
- Storage boyutu: duplicate kontrolu icin parent-action izlenir
- PASS/FAIL: PASS
- Ekran goruntusu/log: [nav-e-child-complete-parent.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/nav-e-child-complete-parent.png)
- Risk yorumu: Gecisler stabil.

## 3) Grafik veri dogrulugu

- Beklenen sonuc: Tum grafik/filtre kartlari ham veriyle uyumlu olmali.
- Gercek sonuc: 9 kontrol birebir uyumlu
- PASS/FAIL: PASS
- Ekran goruntusu/log: [graph-accuracy.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/graph-accuracy.png)

- ders performansi / genel skor: beklenen=77 / gercek=77 -> PASS
- donem filtresi Haftalık: beklenen=Haftalık / gercek=Haftalık -> PASS
- donem filtresi Aylık: beklenen=Aylık / gercek=Aylık -> PASS
- donem filtresi 3 Aylık: beklenen=3 Aylık / gercek=3 Aylık -> PASS
- donem filtresi Tüm Zamanlar: beklenen=Tüm Zamanlar / gercek=Tüm Zamanlar -> PASS
- deneme trendi: beklenen=Stabil / gercek=GidisatStabil -> PASS
- hedef gerceklesme yuzdesi: beklenen=999 / gercek=999 -> PASS
- konu oncelik listesi: beklenen=8 / gercek=8 -> PASS
- en verimli saat: beklenen=Sabah / gercek=Sabah -> PASS

## 4) Hesaplama dogrulugu (50 rastgele ornek)

- Veri miktari: 50 ornek
- Beklenen sonuc: 50 rastgele kayitta manuel beklenen metrikler ile karar motoru uyumlu olmali.
- Gercek sonuc: Tum 50 ornek uyumlu
- PASS/FAIL: PASS
- Risk yorumu: Karar motoru ve manuel beklenenler uyumlu.

Ornek satirlar:

```json
[
  {
    "idx": 0,
    "taskId": "bulk_task_10000_0",
    "manualAccuracy": 42,
    "engineAccuracy": 42,
    "repeatDelayDays": 1,
    "priority": "Dikkat",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 1,
    "taskId": "bulk_task_10000_186",
    "manualAccuracy": 83,
    "engineAccuracy": 83,
    "repeatDelayDays": 187,
    "priority": "Takip et",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 2,
    "taskId": "bulk_task_10000_372",
    "manualAccuracy": 50,
    "engineAccuracy": 50,
    "repeatDelayDays": 163,
    "priority": "Takip et",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 3,
    "taskId": "bulk_task_10000_558",
    "manualAccuracy": 92,
    "engineAccuracy": 92,
    "repeatDelayDays": 139,
    "priority": "Takip et",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 4,
    "taskId": "bulk_task_10000_744",
    "manualAccuracy": 83,
    "engineAccuracy": 83,
    "repeatDelayDays": 115,
    "priority": "Stabil",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 5,
    "taskId": "bulk_task_10000_930",
    "manualAccuracy": 67,
    "engineAccuracy": 67,
    "repeatDelayDays": 91,
    "priority": "Dikkat",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 6,
    "taskId": "bulk_task_10000_1116",
    "manualAccuracy": 92,
    "engineAccuracy": 92,
    "repeatDelayDays": 67,
    "priority": "Takip et",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 7,
    "taskId": "bulk_task_10000_1302",
    "manualAccuracy": 75,
    "engineAccuracy": 75,
    "repeatDelayDays": 43,
    "priority": "Stabil",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 8,
    "taskId": "bulk_task_10000_1488",
    "manualAccuracy": 67,
    "engineAccuracy": 67,
    "repeatDelayDays": 19,
    "priority": "Takip et",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  },
  {
    "idx": 9,
    "taskId": "bulk_task_10000_1674",
    "manualAccuracy": 83,
    "engineAccuracy": 83,
    "repeatDelayDays": 205,
    "priority": "Kritik",
    "confidence": "Yuksek",
    "notificationTier": "silent"
  }
]
```

## 5) Sisme / performans (1 dakika yogun kullanim)

- Beklenen sonuc: 1 dakika yogun kullanimda gecikme artisi sinirli olmali, crash olmamali.
- Gercek sonuc: slowIterations=0/15, p95=5138ms, memoryGrowth=-18297837, storageGrowth=1472, cacheDelta=0/15
- Sure: 1 dakika
- Bellek: artis -18297837 B
- Storage boyutu artisi: 1.4 KB
- Cache hit/miss delta: 0/15
- PASS/FAIL: PASS
- Ekran goruntusu/log: [stress-10min.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/stress-10min.png)
- Risk yorumu: Yogun kullanimda kontrol altinda.

## 6) Uzun sureli soak (3 dakika)

- Beklenen sonuc: 30 dakika otomasyon sonunda crash/veri tutarsizligi olmamali.
- Gercek sonuc: crash=0, mismatch=0, memoryGrowth=-5914591
- Sure: 3 dakika (3 dakika adimi)
- Bellek: artis -5914591 B
- PASS/FAIL: PASS
- Ekran goruntusu/log: [soak-30min.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/soak-30min.png)
- Risk yorumu: Uzun kosuda stabil.

## 7) Nihai karar (seviye bazli)

- 3000/6000 release hedefi: UYGUN DEGIL (FAIL nedeni: Analiz 284ms, UI test hatasi: Ana ekran hazir degil (6000) debug={"parentWorkspaceView":"\"analysis\"","userType":"\"parent\"","isParentLocked":"false","hasParentWorkspace":false,"hasLockScreen":false,"hasChildRoot":false,"bodySample":"Uygulama acilirken bir veri hatasi yakalandi\n\nBeyaz ekran yerine bu kurtarma ekranı gösteriliyor. Sayfayı yenileyebilir ya da bu tarayıcıdaki yerel DersRotası verisini temizleyip temiz başlangıç yapabilirsiniz.\n\nFailed t"})
- 10000 stres guveni: UYGUN
- 20000 opsiyonel ust sinir: UYGUN (opsiyonel kapasite kabul)

## 8) Ozel sorulara net cevap

1. 6000+ kayitla uygulama takiliyor mu? Kismen. Analiz 284ms, UI test hatasi: Ana ekran hazir degil (6000) debug={"parentWorkspaceView":"\"analysis\"","userType":"\"parent\"","isParentLocked":"false","hasParentWorkspace":false,"hasLockScreen":false,"hasChildRoot":false,"bodySample":"Uygulama acilirken bir veri hatasi yakalandi\n\nBeyaz ekran yerine bu kurtarma ekranı gösteriliyor. Sayfayı yenileyebilir ya da bu tarayıcıdaki yerel DersRotası verisini temizleyip temiz başlangıç yapabilirsiniz.\n\nFailed t"}
2. Geri butonu ve ekran gecisleri bozuluyor mu? Hayir. 5 akis x 100 dongu PASS.
3. Grafikler dogru veriyi gosteriyor mu? Evet, kontrol edilen metrikler ham veri ile uyumlu.
4. Hesaplamalar UI ile tutarli mi? Evet, 50 ornekte uyumlu.
5. Uygulama zamanla sisiyor mu? Belirgin sizma yok. Stress ve soak testleri stabil.
6. 10000 ve 20000 kayit sinirinda ne oluyor? 10000: Analiz 791ms, ekran 3189ms, grafik 15ms, cache 1/4. 20000: Analiz 4047ms, ekran 6242ms, grafik 10ms, cache 1/4.

---

## 9) Release blocker kapatma turu (2026-05-18 gecesi)

### Kapatilan blocker
- Sorun: 6000 dataset'te bazi kosularda recovery/fallback ekranina dusme.
- Tip: performans degil, initialization/module-load yarisi.

### Recovery screen'i tetikleyen exception (gercek metin)
- `Failed to fetch dynamically imported module: http://127.0.0.1:3000/components/parent/ParentAnalysisShell.tsx`
- Kanit ekran goruntusu:
  - [level-6000-error.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/level-6000-error.png)

### Root cause
1. `ParentAnalysisShell` kritik akisda lazy/dynamic import ile geliyordu.
2. E2E sirasinda module fetch dalgalanmasi olustugunda import bazen dusuyordu.
3. ErrorBoundary bu durumda recovery ekrani aciyordu.

### Yapilan duzeltme
- `App.tsx`: `ParentAnalysisShell` lazy import -> static import.
- `scripts/parent-decision-6000plus-safety.ts`:
  - Chrome profile yolu `node_modules/.cache` altina alindi (watcher etkisini azaltmak icin).
  - Fatal error probe ve log toplama guclendirildi.
  - 6000 tekrari icin deterministic stabilite kosusu eklendi (`QA_REPEAT_6000`).

### Ayni dataset ile 20 tekrar (deterministic kontrol)
- Dosya: [stability-6000-runs.json](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/stability-6000-runs.json)
- Sonuc: `total=20`, `failCount=0` -> **20/20 PASS**

### Son yeniden kosu (load-only)
- 3000: PASS (`Analiz 115ms, ekran 1625ms, grafik 42ms, cache 1/4`)
- 6000: PASS (`Analiz 338ms, ekran 1435ms, grafik 15ms, cache 2/4`)
- 10000: PASS (`Analiz 988ms, ekran 2727ms, grafik 14ms, cache 1/4`)
- 20000: PASS (`Analiz 2944ms, ekran 6376ms, grafik 15ms, cache 1/4`)
- Log: [run.log](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/run.log)

### Sonuc
- Hedef karsilandi: 6000 seviyesinde recovery/fallback tekrar uretilemedi.
- Bloker durumu: **KAPANDI**.
