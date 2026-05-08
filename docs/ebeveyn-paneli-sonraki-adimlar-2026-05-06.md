# Ebeveyn Paneli Sonraki Adimlar ve Backlog (6 Mayis 2026)

## Amac
Bu belge, son ebeveyn paneli refactorundan sonra kalan isleri adim adim takip etmek icin olusturuldu.

Ana hedef:
- mevcut degisiklikleri once gorsel ve davranissal olarak dogrulamak
- sonra kucuk stil/UX temizliklerini bitirmek
- daha sonra buyuk mimari islere kontrollu gecmek

Bu belge, `DESIGN.md`, `ebeveyn-paneli-modul-mimari-ve-ux-refactor-plani-2026-04-16.md`, `planlama-motoru-mvp-ve-organizasyonu-2026-04-15.md` ve `okul-sinavi-ve-donemsel-performans-modeli-2026-04-14.md` belgelerinin uygulanabilir takip listesi olarak kullanilacak.

## Mevcut Durum
- Parent workspace ayrimi basladi:
  - Genel Bakis
  - Planlama
  - Gorevler
  - Sinavlar
  - Analiz
- Planlama icinde:
  - haftalik program okunur ozet + modal editor akisi var
  - plan uretimi modal akisa tasindi
  - sinav takvimi ekleme modal akisa tasindi
  - gorev atama Planlama icinde ayrildi
- Gorevler icinde:
  - atanmis gorevleri takip etme akisi ayrildi
- Sinavlar icinde:
  - okul sinavi ve deneme/genel sinav kaydi ayrildi
- Analiz icinde:
  - analiz ve rapor katmani veri girisinden ayrilmaya basladi
- `DESIGN.md` guncellendi ve yeni iOS/cam yuzey tasarim dili kayit altina alindi.

## Son Dogrulama Durumu
- `npm run typecheck`: gecti
- `npm run smoke`: gecti (`SMOKE_TESTS_OK`)
- `npm run build`: gecti
- `git diff --check`: temiz, sadece LF/CRLF uyarilari var

Ek Faz 1 notu (6 Mayis 2026):
- Tarayici QA sirasinda Recharts kaynakli `Maximum update depth exceeded` hatasi bulundu.
- `Legend` kullanimi kaldirildi; ayrica Recharts `Line`, `Bar`, `Pie` ve `Scatter` primitive'lerinde `legendType="none"` kullanilarak `SetLegendPayload` render dongusu engellendi.
- Temiz origin uzerinden Cocuk paneli, Ebeveyn Genel Bakis, Planlama, Gorevler, Sinavlar, Analiz ve Analiz > Raporlar/Grafik merkezi DOM olarak dogrulandi.
- In-app browser screenshot yakalama komutu CDP zaman asimina dustu; DOM ve komut dogrulamalari gecerli.

Ek Faz 1 modal QA notu (6 Mayis 2026):
- Temiz QA portu `http://127.0.0.1:3002/` uzerinden Planlama, Sinavlar ve Ayarlar akislari tekrar gezildi.
- Haftalik ders programi editoru `dialog` olarak aciliyor; `Vazgec`/kapat akisi dogrulandi.
- Plan uretim ayarlari `dialog` olarak aciliyor; ESC/kapat akisi dogrulandi.
- Sinav takvimi ekleme `dialog` olarak aciliyor; `Vazgec`/kapat akisi dogrulandi.
- Sinav sonucu ekleme `dialog` olarak aciliyor; `Vazgec`/kapat akisi dogrulandi.
- Tum veriyi sil onayi ikinci bir onay `dialog`u aciyor; `SIL` yazilmadan kalici silme butonu disabled kaliyor.
- Tema toggle akisi koyu/acik/koyu olarak DOM seviyesinde dogrulandi.
- In-app browser viewport API'sinde explicit dar genislik ayari bulunamadi; mevcut gorunum mobil kontrol menusu (`Moduller`, kontrol merkezi) uzerinden dogrulandi.
- QA sonunda son 20 dakikada yeni console error/warn kaydi gorulmedi.

Ek Faz 2 stil standardizasyon notu (6 Mayis 2026):
- `CurriculumManagerPanel` ana yuzeyi, ders listesi, sayaç kartlari, bos durumlar, ekleme inputlari ve silme aksiyonlari `ios-card`, `ios-widget`, `ios-button`, `ios-button-active`, `dr-form-field` ve `dr-destructive-button` primitive'lerine tasindi.
- `PlanningPanel` icindeki aktif plan gorev duzenleme inline formu `dr-form-field` ve `ios-*` buton diliyle tema guvenli hale getirildi.
- `PlanningPanel` icinde baska eski `bg-white` / `border-slate` yuzeyler hâlâ var; bunlar Faz 2'nin ikinci turuna birakildi.
- Ara dogrulama: `npm run typecheck` gecti, `git diff --check` temiz; sadece LF/CRLF uyarilari var.
- Bu turda `npm run build` ve `npm run smoke` sandbox icinde `spawn EPERM` verdi; izinli tekrar denemesi sistem kullanim limiti nedeniyle calistirilamadi. Bir sonraki turda ilk is olarak tekrar kosulacak.

Ek Faz 2 ikinci tur notu (6 Mayis 2026):
- `PlanningPanel` icinde kalan plan uretim konu secimi, sinav takvimi listesi, pending plan karti, plan gecmisi, risk merkezi, aktif plan ozeti ve gun kartlari `ios-widget`, `ios-button`, `ios-button-active` ve `dr-destructive-button` primitive'leriyle standardize edildi.
- Kalan `bg-*` eslesmeleri yalniz durum rozeti, disabled state veya bilincli uyari tonu olarak birakildi.
- Ara dogrulama: `npm run typecheck` gecti, `git diff --check` temiz; sadece LF/CRLF uyarilari var. `npm run build` ve `npm run smoke` halen sandbox `spawn EPERM` nedeniyle calismiyor.
- Tarayici QA: `http://127.0.0.1:3002/?quick=planning` reload edildi; `Plan Uretimini Ac` ve `Sinav Ekle` modallari DOM seviyesinde acilip kapandi. Bu dogrulama zaman araliginda yeni console error/warn olusmadi.

Ek Faz 3 ilk ayrim notu (6 Mayis 2026):
- `ParentDashboard` incelendi; bilesenin zaten ince bir kompozisyon kabugu oldugu, asil render sorumlulugunun `App.tsx` icindeki `renderParentWorkspace` fonksiyonunda toplandigi goruldu.
- Tek seferde buyuk workspace tasimak yerine `ParentWorkspaceFrame` eklendi. Genel Bakis, Gorev Takibi, Sinavlar ve Analiz workspace basligi/rozet/action kabugu bu ortak bilesene tasindi.
- `quick=overview` QA rotasi da desteklenecek sekilde hizli rota listesine eklendi.
- Tarayici QA: `quick=overview`, `quick=tasks`, `quick=exams`, `quick=analysis` rotalarinda beklenen basliklar DOM seviyesinde gorundu; bu dogrulama zaman araliginda yeni console error/warn olusmadi.
- Ara dogrulama: `npm run typecheck` gecti, `git diff --check` temiz; sadece LF/CRLF uyarilari var. `npm run build` ve `npm run smoke` sandbox icinde `spawn EPERM` ile calismiyor.

Ek analiz grafik karti duzeltme notu (6 Mayis 2026):
- `AnalysisGraphCenter` icindeki Ust Panel / Genel skor trendi metinleri Turkce karakterlerle duzeltildi.
- Ayni alandaki ic ozet kartlari renkli dolgu yerine notr `ios-widget` kart + ince renk aksani diline alindi.
- Tarayici QA: `quick=analysis` > `Raporlar` sekmesinde `Tekil analiz gorunumu`, `Ust Panel`, `Ilk Deneme Dogrulugu`, `Altin Saat`, `Hata Tipi Dagilimi`, `Akademik Ozguven` metinleri DOM seviyesinde dogrulandi; bozuk karakter parcasi ve yeni console error/warn gorulmedi.

## Uygulama Sirasi

### Faz 1 - Canli Gorsel QA ve Kucuk Regresyon Avlama
Oncelik: P0

Amac:
- mevcut refactorun tarayicida gercekten kullanilabilir oldugunu dogrulamak
- masaustu, mobil ve dark mode kirilmalarini buyuk mimari ise gecmeden yakalamak

Yapilacaklar:
1. Uygulamayi dev server ile ac.
2. Masaustu genislikte ebeveyn panelini kontrol et.
3. Mobil dar genislikte ebeveyn panelini kontrol et.
4. Dark mode acik halde ayni ana akislari kontrol et.
5. Asagidaki ekranlari tek tek gez:
   - Genel Bakis
   - Planlama
   - Gorevler
   - Sinavlar
   - Analiz
6. Asagidaki modallari ac/kapat/kaydet/vazgec akislariyla test et:
   - Haftalik ders programi editoru
   - Plan uretim ayarlari
   - Sinav takvimi ekleme
   - Sinav sonucu ekleme
   - Tum veriyi sil onayi
7. Gozlenen P0/P1 hatalari once duzelt.

Kabul kriterleri:
- Ana moduller acilirken runtime hata olmamali.
- Modallar tasma/arkada kalma/kapayamama sorunu yasamamali.
- Dark mode form alanlari okunabilir olmali.
- Mobilde buton ve metinler ust uste binmemeli.

### Faz 2 - Stil Standardizasyonu
Oncelik: P1

Amac:
- yeni `DESIGN.md` kurallarina gore eski form ve kart kalintilarini temizlemek

Yapilacaklar:
1. `CurriculumManagerPanel` icindeki eski input/select stillerini `dr-form-field` veya uygun `.ios-*` primitive'lerine tasima.
2. `PlanningPanel` plan gecmisi inline edit inputlarini tema guvenli hale getirme.
3. Eski `rounded-2xl border border-slate-300 bg-white` form kaliplarini tarama.
4. Destructive aksiyonlarda `dr-destructive-button` kullanimi tutarliligini kontrol etme.
5. Empty state metinlerini yeni modullerle uyumlu hale getirme.

Kabul kriterleri:
- Yeni form alanlari light/dark mode'da okunabilir.
- Bir ekranda ayni islevde iki farkli form dili kalmaz.
- `git diff --check`, `typecheck`, `build`, `smoke` gecer.

### Faz 3 - ParentDashboard Sorumluluk Ayrimi
Oncelik: P1

Amac:
- buyuyen `ParentDashboard` ve `App.tsx` render mantigini daha net workspace container'larina ayirmak

Yapilacaklar:
1. `ParentOverviewWorkspace` icin aday ayirma plani cikar.
2. `ParentPlanningWorkspace` icin schedule/curriculum/plan/gorev-atama orkestrasyonunu ayir.
3. `ParentTasksWorkspace` icin gorev takip yuzeyini netlestir.
4. `ParentExamsWorkspace` icin sinav kayit yuzeyini ayir.
5. `ParentAnalysisWorkspace` mevcut yapisini veri girisinden tamamen bagimsiz tut.
6. Ortak prop setleri icin shared tip veya adapter olustur.

Kabul kriterleri:
- Her workspace tek ana is akisini tasir.
- ParentDashboard sadece kompozisyon/orkestrasyon sorumlulugu tasir.
- Mevcut kullanici davranisi bozulmaz.

### Faz 4 - Tek Ders Merkezi
Oncelik: P1

Amac:
- ders ekleme/duzenleme/silme/pasiflestirme icin tek kaynak olusturmak

Yapilacaklar:
1. Course model sozlesmesini netlestir:
   - `id`
   - `name`
   - `active`
   - `order`
   - `icon?`
2. Ders ekleme noktalarini envantere al.
3. Diger modullerin sadece aktif ders listesini kullanmasini sagla.
4. Mufredat anahtari ile ders adi arasindaki normalize eslesmeyi gecici uyumluluk katmani olarak tut.
5. Ders silme/pasiflestirme politikasini belirle:
   - gecmis veri korunacak mi?
   - bagli gorevler ne olacak?
   - sinav kayitlari nasil gorunecek?
6. Hayalet ders ve kirik referans taramasi ekle.

Kabul kriterleri:
- Kullanici bir dersi nerede ekleyecegini 3 saniye icinde anlar.
- Gorev, sinav, planlama ve analiz ayni aktif ders kaynagini kullanir.
- Ders silme/pasiflestirme kirik ekran uretmez.

### Faz 5 - Sinav Analizi Derinlestirme
Oncelik: P2

Amac:
- okul sinavi ve deneme verisini analiz katmaninda daha anlamli hale getirmek

Yapilacaklar:
1. Ders bazli `studyScore` ve `schoolScore` karsilastirmasini netlestir.
2. `predictedSchoolScore` hesaplamasini ekle veya mevcut analizden turet.
3. `alignmentGap` ve yorum motorunu ebeveyn analizine bagla.
4. Deneme/genel sinav icin ders bazli risk ozetini ekle.
5. Genel Bakis'ta yaklasan sinav ve son sinav sonucunu daha karar odakli goster.

Uygulama notu 2026-05-07:
- B-006 basladi. `PeriodCoursePerformance` artik `alignmentDirection` ve `alignmentComment` uretir.
- Okul/ev performansi bolumu fark yonunu ve kisa yorumunu gosterir; veri yoksa guvenli fallback metni korunur.
- Deneme/genel sinav icin son kaydin en riskli dersleri Okul Uyumu icinde kompakt ozet olarak gosterilir.
- Genel Bakis yaklasan sinavi gun sayisi, son deneme riski ve planlama aksiyonu ile karar odakli gosterir.

Kabul kriterleri:
- Analiz, sinav verisini yalniz listelemekle kalmaz; yorum uretir.
- Veri yoksa guvenli ve net fallback metinleri gorunur.
- Sadece ayni ders icinde karsilastirma yapilir.

### Faz 6 - Plan Gecmisi ve Replan Deneyimi
Oncelik: P2

Amac:
- ebeveyne planin neden degistigini ve ne onerildigini gostermek

Yapilacaklar:
1. Plan gecmisi kartlarinda neden/versiyon bilgisini daha okunur hale getir.
2. Risk veya schedule degisimi sonucunda onerilen plan akisini netlestir.
3. Aktif plan ve pending plan ayrimini UI'da guclendir.
4. Compensation/revision bloklarinin neden eklendigini metinle acikla.

Uygulama notu 2026-05-07:
- B-007 basladi. Aktif plan karti artik durum, versiyon, neden, olusturma/onay tarihi ve neden aciklamasini gosterir.
- Bekleyen plan karti, onaylanana kadar cocuk tarafinda aktif planin degismeyecegini aciklar.
- Ayni haftadaki plan surumleri kompakt `Plan gecmisi` satirinda listelenir.
- Telafi, sinav, risk/tekrar ve manuel kaynakli plan bloklari gorev satirinda kisa neden aciklamasi gosterir.
- Replan akisi `Oneri -> Bekleyen -> Aktif` adimlariyla ve kaynak sayaclariyla gosterilir; bekleyen surum mevcut/yeni/ek blok sayisini aciklar.
- Replan tetik hesaplari sadece `active` plan uzerinden calisir; `pending-approval` plan aktif plan gibi kullanilmaz.

Kabul kriterleri:
- Ebeveyn aktif planin neden olustugunu anlayabilir.
- Yeni plan onayi, mevcut planla karistirilmaz.
- Cocuk tarafinda sadece aktif plan gorunur.

### Faz 7 - Performans ve Buyuyen Veri Optimizasyonu
Oncelik: P3

Amac:
- veri buyudukce ekranlari hafif tutmak

Yapilacaklar:
1. Uzun listelerde dilimleme veya sanallastirma ihtiyacini degerlendir.
2. Pahali analiz hesaplarini merkezi selector/memo yapisina tasima ihtiyacini belirle.
3. Grafiklerin varsayilan render maliyetini azalt.
4. Sadece gorunen workspace'i agir hesaplarla besle.

Uygulama notu 2026-05-07:
- B-008/Faz 7 basladi. Genel Bakis disindaki workspace'lerde donemsel `overviewAnalysis` tekrar uretilmez; mevcut `parentAnalysis` sonucu yeniden kullanilir.
- Determinism icin ikinci analiz kosusu sadece Analiz workspace'i acikken calisir.
- Artik render edilmeyen net performans/hedef/soru dagilimi hesaplari ve ilgili olu kod kaldirildi.
- Grafik merkezi secili olmayan grafiklerin veri setlerini hazirlamaz; yalniz aktif grafik ve ona bagli kisa icgoru hesaplari calisir.
- Cocuk gorev panosu, ebeveyn gorev listesi ve haftalik plan gun kartlarinda buyuyen listeler varsayilan olarak kisaltilir; kullanici istediginde "daha fazla" ile acabilir.

Kabul kriterleri:
- Buyuk veri setinde ilk acilis gereksiz yavaslamaz.
- Gizli moduller pahali grafik/hitap hesaplarini tetiklemez.

## Sonraki Isler Backlog

### B-010 - Kapanis ve saglamlastirma plani
- Modul: Tum uygulama
- Tip: Kapanis / QA / paketleme
- Oncelik: P0
- Durum: Basladi.
- Not: `docs/kapanis-ve-saglamlastirma-plani-2026-05-07.md` eklendi. Ilk uygulama turunda smoke testlerine gercek akademik plan zinciri eklendi: mufredat, okul programi, ev calisma penceresi, sinav takvimi, plan uretimi, cocuk gorevi, tamamlanma ve analiz yansimasi.
- Ek Not: Analiz ekranindaki gorunen Turkce metin kacaklari ve ust arama/kontrol merkezi polish izleri temizlendi.
- Ek Not: Cocuk paneli, mufredat editoru, gorev/veri alanlari, sinav kayit penceresi, bildirimler ve paylasilan istatistik/oneri bilesenlerinde gorunen Turkce metin polish'i yapildi.
- Ek Not: Son metin turunda odul merkezi, yedekleme/silme akisi, gorev listesi filtresi, zaman filtresi, cocuk zamanlayicilari ve plan/replan mesajlari temizlendi.
- Ek Dogrulama: Son metin turundan sonra `npm run typecheck`, `git diff --check` ve gorunen ASCII Turkce kacak taramasi temiz gecti. `npm run build` ve `npm run smoke` sandbox icinde yine `spawn EPERM` verdi; izinli tekrar sistem kullanim limiti nedeniyle bu turda baslatilamadi.
- Ek Dogrulama 2026-05-08: Limit acildiktan sonra `npm run build` ve `npm run smoke` izinli ortamda tekrar calisti; build gecti, smoke `SMOKE_TESTS_OK` dondu.
- Ek Tarayici QA 2026-05-08: `http://127.0.0.1:3003/` uzerinden `quick=overview`, `quick=planning`, `quick=analysis`, eski `quick=tasks` ve `quick=exams` rotalari kontrol edildi. Tasks/exams Planlama'ya dustu; Analiz > Raporlar icinde Grafik Merkezi gorundu; Cocuk paneli metinleri dogru gorundu; console hata/uyari uretmedi.
- Ek Paketleme 2026-05-08: Kalan `Gelismis Istatistikler` metni duzeltildi. Degisiklikler planlama IA, analiz/grafik, cocuk paneli, veri guvenligi/performans ve dokumantasyon/QA gruplari olarak paketlenebilir. Sonraki kalite kapilari tekrar gecti: `typecheck`, `git diff --check`, `build`, `smoke`.
- Dogrulama: `npm run typecheck`, `npm run build`, `npm run smoke`, `git diff --check` gecti. Build/smoke sandbox icinde `spawn EPERM` verdi; sandbox disinda build ve `SMOKE_TESTS_OK` dogrulandi. Canli `quick=analysis` ve Cocuk paneli QA'da eski ASCII/mojibake terimleri gorunmedi.

### B-001 - Browser QA kontrol raporu
- Modul: Tum uygulama
- Tip: QA
- Oncelik: P0
- Durum: Tamamlandi.
- Not: Temiz origin ile ana moduller, grafik merkezi, tema toggle ve ana modal akislari DOM seviyesinde dogrulandi. Screenshot komutu CDP timeout verdigi icin gorsel piksel kaniti alinamadi; bu yalnizca arac kisiti olarak kaydedildi.

### B-002 - CurriculumManagerPanel form dili temizligi
- Modul: Mufredat
- Tip: UI standardizasyon
- Oncelik: P1
- Durum: Tamamlandi.
- Not: Ana kart, ders listesi, ekleme inputlari, destructive aksiyonlar ve bos durumlar `dr-form-field`, `ios-button`, `ios-button-active`, `ios-widget` ve `dr-destructive-button` primitive'lerine tasindi.

### B-003 - Plan gecmisi inline edit form dili
- Modul: Planlama
- Tip: UI standardizasyon
- Oncelik: P1
- Durum: Tamamlandi.
- Not: Aktif plan icindeki gorev duzenleme inline inputlari dark mode uyumlu hale getirildi.

### B-009 - PlanningPanel kalan eski yuzey temizligi
- Modul: Planlama
- Tip: UI standardizasyon
- Oncelik: P1
- Durum: Tamamlandi.
- Not: Plan tipi konu secimi, sinav takvimi listesi, pending/active plan kartlari ve haftalik plan gun kartlarinda kalan eski `bg-white`, `bg-slate-50`, `border-slate` kaliplari `ios-widget` / `ios-button` diline alindi. Durum rozetleri ve disabled state siniflari bilincli olarak korundu.

### B-004 - Parent workspace container ayrimi
- Modul: Ebeveyn Paneli
- Tip: Refactor
- Oncelik: P1
- Durum: Basladi.
- Not: Prop haritasi cikarildi. Ilk guvenli adim olarak `ParentWorkspaceFrame` eklendi ve Genel Bakis/Gorevler/Sinavlar/Analiz baslik kabugu ortak bilesene alindi. Sonraki adim: `ParentPlanningWorkspace` veya `ParentOverviewWorkspace` icin daha derin ayirma.
- Ek Not: `ParentOverviewWorkspace` eklendi; Genel Bakis kartlari, bugunun ders akisi, kisa analiz sinyali, siradaki adim, son aktivite, yaklasan sinav ve odak konulari App icinden ayrildi. App artik bu yuzeye yalniz veri ve Planlama yonlendirme callback'i verir.
- Ek Not: `ParentPlanningWorkspace` eklendi; mufredat ozeti, haftalik okul/ev programi ve plan uretim orkestrasyonu App icinden ayrildi. App bu yuzeye yalniz veri, state guncelleme callback'leri ve mufredat editoru acma aksiyonu verir.
- Ek Not: `tasks` ve `exams` artik ana ebeveyn workspace tipi degil; eski kayitli/quick/search/bildirim yonlendirmeleri Planlama'ya normalize ediliyor. Gorev takibi ve sinav takvimi Planlama merkezi icinde kalacak.
- Dogrulama: `typecheck`, `build`, `smoke` ve `git diff --check` gecti. Tarayici QA'da `quick=tasks`, `quick=exams` ve `quick=planning` Planlama ekranina; `quick=overview` Genel Bakis ekranina dustu. Yeni console error/warn gorulmedi.
- Ek Not: `ParentAnalysisShell` eklendi; Analiz workspace basligi, rozetleri ve mevcut `ParentAnalysisWorkspace` icerik bilesenini saran kabuk App icinden ayrildi.
- Dogrulama: `quick=analysis` tarayici QA'da Analiz ve Destek Takibi kabugu, analiz icerigi ve brifing icerigi gorundu. Yeni console error/warn gorulmedi.
- Ek Not: `ParentDashboard` ortak prop seti `parentDashboardProps` altinda toplandi. App icindeki dashboard cagrilari artik tek veri sozlesmesi uzerinden `viewMode` veriyor.

### B-005 - Course Center karar dosyasi
- Modul: Ders Merkezi
- Tip: Mimari karar
- Oncelik: P1
- Durum: Tamamlandi.
- Not: `docs/ders-merkezi-karar-dosyasi-2026-05-07.md` eklendi. Varsayilan ders aksiyonu pasiflestirme olacak; bagli verisi olan ders kalici silinmeyecek. Yeni ders olusturma yalnizca Ders Merkezi'nde kalacak.
- Ek Not: `Course` sozlesmesine `active` ve `order` eklendi. Eski localStorage/import dersleri otomatik `active: true` ve sira bilgisiyle normalize ediliyor. Yeni veri girislerinde okul programi, sinav takvimi ve gorev/sinav formlari yalniz aktif dersleri seciyor.
- Ek Not: Ders silme akisi veri silme yerine pasiflestirmeye cevrildi; gecmis gorev, sinav, mufredat, plan ve analiz kayitlari korunuyor.
- Dogrulama: `typecheck`, `build`, `smoke` ve `git diff --check` gecti. Tarayici QA'da Planlama ekrani, mufredat ozeti, haftalik program ve haftalik calisma plani icerigi gorundu. Yeni console error/warn gorulmedi.
- Ek Not: Planlama mufredat ozetinde pasif dersler gorunur hale getirildi ve her pasif ders icin "tekrar aktif et" aksiyonu eklendi.
- Dogrulama: Planlama tarayici QA'da `Akademik Planlama`, `Aktif ders` ve mufredat ozeti gorundu. Yeni console error/warn gorulmedi.
- Ek Not: Kirik ders referansi taramasi eklendi. Gorev, okul sinavi, deneme satiri, sinav takvimi, performans ve okul programi bloklarinda mevcut dersle eslesmeyen baglanti varsa Planlama ustunde uyarı olarak gosterilecek.
- Dogrulama: Planlama tarayici QA tekrarlandi; temiz veride kirik referans uyarisi gorunmedi, yeni console error/warn olusmadi.

### B-006 - Sinav alignment hesaplari
- Modul: Analiz / Sinavlar
- Tip: Analiz motoru
- Oncelik: P2
- Not: `studyScore`, `schoolScore`, `predictedSchoolScore`, `alignmentGap`.

### B-007 - Replan onay deneyimi
- Modul: Planlama
- Tip: Urun akisi
- Oncelik: P2
- Not: Pending plan, aktif plan ve neden degisti bilgisi ayrilacak.

### B-008 - Buyuk veri performans turu
- Modul: Tum uygulama
- Tip: Performans
- Oncelik: P3
- Durum: Tamamlandi.
- Not: Gizli workspace analiz tekrar kosulari azaltildi, grafik merkezi yalniz secili grafigin verisini hazirliyor, gorev/plan listelerinde varsayilan kisa liste akisi eklendi.

## Her Faz Sonu Standart Kontrol
Her faz sonunda su komutlar calistirilacak:

```bash
npm run typecheck
npm run smoke
npm run build
git diff --check
```

Tarayici QA yapildiysa sonuc bu belgeye veya yeni tarihli QA raporuna eklenecek.

## Notlar
- Buyuk mimari refactorlara baslamadan once Faz 1 ve Faz 2 bitirilmeli.
- P0/P1 hata cikarsa backlog sirasi durur, once hata kapatilir.
- UI degisikliklerinde `DESIGN.md` kaynak kabul edilecek.

## Dis Kaynak Inceleme Notu - claude-code-templates
Kaynak: https://github.com/davila7/claude-code-templates

Karar:
- Depo Claude Code ajan/komut/hook/settings katalogu oldugu icin DersRotasi projesine paket olarak kurmak simdilik gerekli degil.
- Ancak workflow yaklasimi alinacak: kucuk fazlar, net kabul kriterleri, deterministic kalite kapilari ve tarayici dogrulamasi.

Uygulanacak fikirler:
1. Her Faz 1/Faz 2 turunda once kapsam, sonra tarayici QA, sonra `typecheck`, `smoke`, `build`, `git diff --check` sirasi korunacak.
2. Buyuk UI degisikliginden sonra review bakisi `code-reviewer` mantigiyla yapilacak: bulgular once, risk ve dosya referansi ile.
3. Tekrarlanan isler icin ileride proje ici komut/checklist dosyalari dusunulebilir:
   - `qa-parent-workspace`
   - `qa-modal-flows`
   - `review-ui-regression`
4. `loki-mode` gibi tam otonom/izin atlayan yaklasimlar bu projede kullanilmayacak; DersRotasi icin kontrollu ve adim adim ilerleme daha uygun.
