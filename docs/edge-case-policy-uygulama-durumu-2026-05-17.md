# Edge-Case Policy Uygulama Durumu - 2026-05-17

Bu dosya, karar ekrani icin edge-case policy maddelerinin uygulama seviyesindeki durumunu listeler.

## Tamamlananlar

1. Az veri fallback:
   - `<3 oturum` durumunda kesin yorum yerine `low-data` karti.
2. Runtime analiz hatasi fallback:
   - `deriveAnalysisSnapshotSafe(...)` ile ekran cokesi engellenir.
3. Idempotent gorev olusturma:
   - Ayni ders + ayni gun + ayni `15 soru` gorevi duplicate olusmaz.
4. Notification cooldown:
   - Ayni sinyalin kisa aralikta spam dusmesi sinirlandi.
5. Deterministic tekrar hesaplama:
   - Ayni girdide ayni analiz sonucunu koruma kontrolu.
6. Az veri sinyali genisletme:
   - Deneme sayisi 0 ise karar sinyallerine `Deneme verisi az` karti eklenir.
   - Hedef/plansiz durumda `Hedef verisi eksik` karti eklenir.
7. Supheli veri sinyali:
   - Supheli kayit oranina gore `Veri guvenilirligi` uyarisi eklenir.
   - Bu sinyal karar dilinde yumusak etiket (Takip et/Dikkat) ile gosterilir.

## Matrix Testine Eklenen Edge-Case Senaryolari

- `SUPHELI_VERI_UC_DURUM`
  - cok uzun acik oturum
  - asiri kisa surede yuksek soru sayisi
  - eksik soru payload
  - Beklenti: NaN/Infinity yok, skor 0-100 araliginda.

- `TEKRAR_CALISTIRMA_IDEMPOTENT_SONUC`
  - Ayni dataset iki kez islenir.
  - Beklenti: Snapshot birebir ayni.

## Kismi / Bekleyen

1. Merkezi feature flag dagitimi:
   - Su an local sticky state ile yonetiliyor.
2. Supheli veri agirliklandirma:
   - V1'de supheli veri sinyali eklendi.
   - V2'de explicit agirlik katsayisi ve ders bazli agirlik farki hedefleniyor.
3. Event replay / duplicate kaynak korumasi:
   - UI aksiyon seviyesinde var, pipeline seviyesinde daha ileri idempotency V2.

## Kapanis Kriteri

- `npm run test:matrix`
- `npm run test:heavy`
- `npm run smoke`
- `npm run typecheck`
- `npm run build`

hepsi gectiginde edge-case policy V1 kabul edilir.
