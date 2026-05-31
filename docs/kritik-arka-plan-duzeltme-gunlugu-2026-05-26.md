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

8. Planlama akil modeli ve gelistirme plani dokumante edildi.
   - Yeni referans dosya: `docs/planlama-akil-modeli-ve-gelistirme-plani-2026-05-26.md`
   - Planlamanin sadece haftalik programdan degil; mufredat, okul programi, ev calisma penceresi, sinav takvimi, gorev gecmisi, cocuk performansi, konu durumu, plan uyumu ve serbest calisma verilerinden beslenmesi gerektigi netlestirildi.
   - Kod degisikligi yapilmadi; bu dokuman sonraki veri sozlesmesi ve sayfa duzeni gelistirmesi icin referans olacak.

9. Planlama veri sozlesmesi Faz 1 uygulandi.
   - `StoredStudyPlan` kayitlarina `weekStartDate` ve `weekEndDate` eklendi; plan gorev tarihleri artik bugune gore kayan tarih degil, plan haftasina bagli tarih uretiyor.
   - Ilk plan uretimi artik cocuk gorevlerini hemen yazmiyor; once `pending-approval` taslak olarak veli onayina dusuyor.
   - Veli onayi verilince plan `active` oluyor, ayni haftadaki eski aktif surumler arsive aliniyor ve cocuk gorevleri bu anda olusuyor.
   - Onay bekleyen ilk plan icin aktif plan olmasa bile onay karti gorunur hale getirildi.
   - Plan blok duzenleme ve manuel gorev atama sure/soru sayisi araliklari guclendirildi; plan etiketi ve soru sayisi cocuk gorevine dogru sekilde senkronlanacak.

10. Aktif / bekleyen / arsiv plan ayrimi analiz hesaplarina uygulandi.
   - `deriveAnalysisSnapshot` icindeki planli konu gorevi sayaci artik sadece `active` veya eski veriden gelen statussuz planlari sayiyor.
   - `pending-approval` taslaklar ve `archived` gecmis planlar guncel plan uyumu metriklerini sisirmeyecek.
   - Planlama snapshot'indaki atanmis plan bloklari sadece aktif plan kaydindan uretiliyor; bekleyen taslaklar onay kartinda kalacak, karar/analiz hesaplarina aktif plan gibi girmeyecek.
   - Smoke test icine pending ve archived planlarin `totalPlannedTopicTasks` degerini artirmadigini dogrulayan regression kontrolu eklendi.

11. Bekleyen plan kilidi ve hafta bazli plan blok kimligi eklendi.
   - Yeni plan taslaklarindaki `planTaskId` artik hafta bilgisiyle uretiliyor (`week_2_...` gibi); ayni konu baska hafta tekrar planlandiginda cocuk gorevi idempotency kontrolune takilmayacak.
   - Herhangi bir `pending-approval` plan varken yeni hafta plani uretimi kilitlendi; kullanici once bekleyen plani onaylamali veya iptal etmeli.
   - Bekleyen plan iptal akisi mevcut `Reddet` butonlariyla hem ilk plan taslaginda hem aktif plan guncelleme taslaginda gorunur kalacak.
   - UI aktif plan secimi arsiv planlari aktif gibi gostermeyecek sekilde daraltildi.
   - Smoke test icine farkli haftalarda ayni draft id icin farkli `planTaskId` uretilmesi kontrolu eklendi.

## Dogrulama

- `npm run typecheck`: PASS
- `npm run smoke`: PASS
- `npm run test:acceptance`: PASS (`PARENT_DECISION_ACCEPTANCE_OK`, 6000 gorev / 6000 session)
- `npm run build`: PASS
- `npm run test:ui-e2e`: PASS (`summary pass=14 fail=0 isolation=3/3`)

## Son Faz Dogrulama - Planlama Veri Sozlesmesi

- `npm run typecheck`: PASS
- `npm run smoke`: PASS (`SMOKE_TESTS_OK`)
- `npm run test:acceptance`: PASS (`PARENT_DECISION_ACCEPTANCE_OK`, 6000 gorev / 6000 session)
- `npm run build`: PASS
- `npm run test:ui-e2e`: BLOCKED - testin kendi Chrome CDP baslaticisi iki denemede zaman asimina dustu (`Page.enable`, sonra `Chrome CDP endpoint did not become ready`).
- Canli tarayici kontrolu: PASS - `http://127.0.0.1:3000/?quick=planning&qa=live` planlama ekranini yukledi, `fatal-error-screen` gorunmedi, baslik `Planlama Modu`.

## Son Faz Dogrulama - Aktif Plan Ayrimi

- Hizli veri sozlesmesi kontrolu: PASS (`pending-approval=0`, `active=1`, `archived=0` planli konu gorevi)

## Son Faz Dogrulama - Bekleyen Plan Kilidi

- Bekleyen plan varken yeni plan uretimi kullanici mesajiyla durdurulacak.
- Hafta bazli `planTaskId` regression kontrolu smoke test kapsaminda.

## Siradaki Kontrol

- UI E2E Chrome CDP baslaticisi ayrica temizlenecek veya yeniden denenip rapora PASS olarak islenecek.
- Planlama sayfa duzeni bu akil modeli onayindan sonra ayrica planlanacak.
- Sanal gorev listesi gorsel davranisi kullanici tarafindan tarayici uzerinden kontrol edilecek.
