# Kritik Arka Plan Duzeltme Gunlugu - 2026-05-26

Bu dosya, ebeveyn karar ekrani tamam kabul edildikten sonra diger sayfalar gelistirilirken karar ekranini bozabilecek altyapi riskleri icin yapilan duzeltmeleri takip eder.

## Kapsam

- Firebase bu fazda kapsam disi.
- Hedef: karar ekraninin veri kaynagini, analiz tutarliligini, gorev/sinav veri sozlesmesini ve buyuk liste davranisini korumak.
- Kod degisiklikleri kullanici onayi ile baslatildi.

## Yapilanlar

1. Tek karar kaynagi icin `ParentAnalysisWorkspace` icindeki ikinci `buildParentDecision` hesabi kaldirildi.
   - Karar ozeti artik `App.tsx` icinde hesaplanan `parentDecisionSummary` olarak `ParentDashboard` ve `ParentAnalysisWorkspace` zincirine aktariliyor.
   - Amac: ust karar seviyesi ile karar sayfasi icindeki karar metinlerinin farkli hesaplanmasini engellemek.

2. Gorev veri sozlesmesi normalizasyonu guclendirildi.
   - `normalizeSafeTasks` artik kayitlari sadece filtrelemiyor, `normalizeTask` uzerinden geciriyor.
   - `taskType`, `plannedDuration`, `questionCount`, `correctCount`, `incorrectCount`, `emptyCount`, `actualDuration`, `breakTime`, `pauseTime` alanlari sayisal ve guvenli araliga cekiliyor.
   - Amac: cocuk ekrani, planlama veya import tarafindan gelen bozuk gorevlerin karar motorunu kirletmesini azaltmak.

3. Composite sinav ortalamasi icin guvenli hesaplayici eklendi.
   - Bos veya bozuk `courses` listesi karar ozeti ve hedef/deneme gorunumlerinde `NaN` uretmeyecek.

4. `components/shared/VirtualScroll.tsx` bos dosya olmaktan cikarildi.
   - Genel amacli sanal liste bileseni eklendi.
   - Parent gorev listesinde 150 ustu kayit ve "tumunu goster" durumunda sanal liste devreye alindi.

5. Analiz snapshot tekrar hesaplari azaltildi.
   - `ParentDashboard` artik fallback olarak tekrar `deriveAnalysisSnapshot` calistirmiyor; `App.tsx` icinden gelen tek snapshot kullaniliyor.
   - `ChildDashboard` da ayni snapshot'i prop olarak aliyor; sadece prop verilmezse kendi guvenli fallback hesabini calistiriyor.
   - Amac: karar, ebeveyn analiz ve cocuk istatistiklerinde ayni veri kesitinin kullanilmasi.

6. Cocuk serbest calisma veri dogrulamasi sertlestirildi.
   - Gecerli ders, 5-240 dakika sure, soru cozmede 1-500 soru ve kitap okumada kitap adi zorunlu hale getirildi.
   - Ders calisma / soru cozme icin mufredat varsa unite ve konu secimi zorunlu tutuldu.
   - Amac: serbest calisma kayitlarinin analiz motoruna konu/ders baglami zayif veri olarak dusmesini engellemek.

7. Bildirim cooldown anahtari duzeltildi.
   - UI `data-cooldown-group` ve localStorage cooldown map artik ayni iki parcali grup anahtarini kullaniyor (`parent:drop`, `child:today` gibi).
   - Amac: bir bildirime aksiyon verildikten sonra ayni cooldown grubunun listede tekrar gorunmesini engellemek.

## Dogrulama

- `npm run typecheck`: PASS
- `npm run smoke`: PASS
- `npm run test:acceptance`: PASS (`PARENT_DECISION_ACCEPTANCE_OK`, 6000 gorev / 6000 session)
- `npm run build`: PASS
- `npm run test:ui-e2e`: PASS (`summary pass=14 fail=0 isolation=3/3`)

## Siradaki Kontrol

- Planlama ekrani kullanici tarafindan ayrica kontrol edilecek.
- Sanal gorev listesi gorsel davranisi kullanici tarafindan tarayici uzerinden kontrol edilecek.
