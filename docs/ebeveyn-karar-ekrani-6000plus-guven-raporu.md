# Ebeveyn Karar Ekrani 6000+ Guven Test Raporu

- Tarih: 2026-05-18T13:16:08.227Z
- Uygulama: http://127.0.0.1:3000/?quick=analysis&e2e=1&qaRecords=none
- Ortam: win32, Node v25.1.0
- Ham JSON: [parent-decision-6000plus-raw.json](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/parent-decision-6000plus-raw.json)
- Kosu logu: [run.log](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/run.log)

## 1) 6000 / 10000 / 20000 kayit yuk testi

### Seviye 6000
- Veri miktari: 6000 gorev + oturum/soru/deneme/hedef/tekrar karisik
- Beklenen sonuc: Analiz <= 2200ms, ekran <= 3200ms, grafik <= 2200ms
- Gercek sonuc: Analiz 369ms, ekran 1563ms, grafik 19ms, cache 2/4
- Sure (engine): analiz 369ms, decision 17ms, 2. run 362ms
- Sure (ui): ekran 1563ms, grafik 19ms
- Bellek: node heap 23.3 MB, browser heap 38.1 MB
- Storage: localStorage 3.4 KB, storage.usage 2.7 MB
- Cache hit/miss: engine 1/1, ui 2/4
- PASS/FAIL: PASS
- Ekran goruntusu/log: [level-6000.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/level-6000.png)
- Risk yorumu: Seviye kabul siniri icinde.

### Seviye 10000
- Veri miktari: 10000 gorev + oturum/soru/deneme/hedef/tekrar karisik
- Beklenen sonuc: Analiz <= 3600ms, ekran <= 4500ms, grafik <= 3500ms
- Gercek sonuc: Analiz 1370ms, ekran 2918ms, grafik 16ms, cache 2/4
- Sure (engine): analiz 1370ms, decision 25ms, 2. run 901ms
- Sure (ui): ekran 2918ms, grafik 16ms
- Bellek: node heap 38.2 MB, browser heap 48.5 MB
- Storage: localStorage 3.4 KB, storage.usage 3.7 MB
- Cache hit/miss: engine 1/1, ui 2/4
- PASS/FAIL: PASS
- Ekran goruntusu/log: [level-10000.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/level-10000.png)
- Risk yorumu: Seviye kabul siniri icinde.

### Seviye 20000
- Veri miktari: 20000 gorev + oturum/soru/deneme/hedef/tekrar karisik
- Beklenen sonuc: Analiz <= 7000ms, ekran <= 8500ms, grafik <= 6000ms
- Gercek sonuc: Analiz 3769ms, ekran 7145ms, grafik 16ms, cache 2/4
- Sure (engine): analiz 3769ms, decision 51ms, 2. run 2692ms
- Sure (ui): ekran 7145ms, grafik 16ms
- Bellek: node heap 50.8 MB, browser heap 125.4 MB
- Storage: localStorage 3.4 KB, storage.usage 5.3 MB
- Cache hit/miss: engine 1/1, ui 2/4
- PASS/FAIL: PASS
- Ekran goruntusu/log: [level-20000.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/level-20000.png)
- Risk yorumu: Seviye kabul siniri icinde.

## 2) Geri butonu / navigation (100 tekrar x 5 akis)

### ebeveyn ana ekran -> ders detay -> geri
- Veri miktari: 100 tekrar
- Beklenen sonuc: 100 tekrar sonunda bos ekran/state bozulmasi olmamali.
- Gercek sonuc: blank=0, state=0, crash=0
- Sure: 100 dongu
- Bellek: bu maddede asiri artis beklenmez
- Storage boyutu: duplicate kontrolu icin parent-action izlenir
- PASS/FAIL: PASS
- Ekran goruntusu/log: [nav-a-course-back.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/nav-a-course-back.png)
- Risk yorumu: Gecisler stabil.

### raporlar -> grafik detayi -> geri
- Veri miktari: 100 tekrar
- Beklenen sonuc: 100 tekrar sonunda grafik akisinda bos ekran veya crash olmamali.
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

## 5) Sisme / performans (10 dakika yogun kullanim)

- Beklenen sonuc: 10 dakika yogun kullanimda gecikme artisi sinirli olmali, crash olmamali.
- Gercek sonuc: slowIterations=0/148, p95=4893ms, memoryGrowth=35145749, storageGrowth=13474, cacheDelta=0/148
- Sure: 10 dakika
- Bellek: artis 33.5 MB
- Storage boyutu artisi: 13.2 KB
- Cache hit/miss delta: 0/148
- PASS/FAIL: PASS
- Ekran goruntusu/log: [stress-10min.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/stress-10min.png)
- Risk yorumu: Yogun kullanimda kontrol altinda.

## 6) Uzun sureli soak (30 dakika)

- Beklenen sonuc: 30 dakika otomasyon sonunda crash/veri tutarsizligi olmamali.
- Gercek sonuc: crash=0, mismatch=0, memoryGrowth=-5068908
- Sure: 30 dakika (30 dakika adimi)
- Bellek: artis -5068908 B
- PASS/FAIL: PASS
- Ekran goruntusu/log: [soak-30min.png](C:/Users/90535/Desktop/DersRotası/docs/e2e-artifacts-2026-05-18-6000plus/soak-30min.png)
- Risk yorumu: Uzun kosuda stabil.

## 7) Ozel sorulara net cevap

1. 6000+ kayitla uygulama takiliyor mu? Hayir. Ekran 1563ms, grafik 19ms.
2. Geri butonu ve ekran gecisleri bozuluyor mu? Hayir. 5 akis x 100 dongu PASS.
3. Grafikler dogru veriyi gosteriyor mu? Evet, kontrol edilen metrikler ham veri ile uyumlu.
4. Hesaplamalar UI ile tutarli mi? Evet, 50 ornekte uyumlu.
5. Uygulama zamanla sisiyor mu? Belirgin sizma yok. Stress ve soak testleri stabil.
6. 10000 ve 20000 kayit sinirinda ne oluyor? 10000: Analiz 1370ms, ekran 2918ms, grafik 16ms, cache 2/4. 20000: Analiz 3769ms, ekran 7145ms, grafik 16ms, cache 2/4.
