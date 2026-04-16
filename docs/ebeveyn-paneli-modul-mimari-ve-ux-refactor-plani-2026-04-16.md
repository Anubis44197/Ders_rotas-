# Ebeveyn Paneli Modul Mimari ve UX Refactor Plani

## Belgenin Amaci

Bu belge, DersRotasi icindeki ebeveyn panelini buyuyen veri ve ozellik yukune gore yeniden organize etmek icin hazirlanmistir.

Bu belge dogrudan kod degisikligi degildir.
Bu belge, kodlamaya gecmeden once su 6 soruya net cevap vermek icin hazirlanmistir:

1. Ders, gorev, sinav ve analiz katmanlari tek bir urun mantigi icinde nasil baglanacak?
2. Hangi alanlarda duplicate veri kaynagi riski var?
3. Tek merkezden ders tanimlama kurali nasil uygulanacak?
4. Ebeveyn panelindeki ekran yogunlugu nasil azaltilecek?
5. Ust seviye navigasyon ile alt moduller nasil sade ve olceklenecek hale getirilecek?
6. Refactor hangi sira ile, hangi riskleri kontrol ederek yapilacak?

Bu belge sonraki gelistirmeler icin ana referans olacaktir.

## Ana Karar

Ebeveyn paneli bundan sonraki gelisimde su 3 sabit ilkeyle ilerlemelidir:

1. Ders tek yerde tanimlanir.
2. Her ekran tek bir ana is akisina odaklanir.
3. Buyuyen veri, ayni sayfaya yeni kart eklenerek degil; modul, sekme ve acilir panel mantigiyla yonetilir.

Bu 3 ilke bozulursa:

- ayni veri farkli yerlerde tekrar uretilecektir
- ekranlar zamanla fazla agirlasacaktir
- kullanici hangi islemi nerede yapacagini kaybedecektir
- analiz ve planlama katmanlari birbirine karisacaktir

## Bugunku Durum Ozeti

Mevcut sistemde ilerleme gucludur ama asagidaki yapisal baskilar birikmeye baslamistir:

1. Ders bilgisi tek merkez mantigina yaklasmis olsa da mimari olarak tamamen tek kaynak degildir.
2. ParentDashboard, birden fazla buyuk sorumlulugu ayni bilesende tasimaktadir.
3. Analiz kismi task verisini guclu isler, ancak okul sinavi katmani henuz tum alt ekranlara esit derinlikte dagilmamistir.
4. Kart sayisi artikca sayfa agirlasma riski vardir.
5. Ust navigasyon dogru yonde kurulmustur ama moduller icindeki alt akislar henuz yeterince ayrismamis durumdadir.

Bu nedenle sonraki asama yeni ozellik eklemekten once, urun yapisini duzenlemeye odaklanmalidir.

## Cekirdek Problem Listesi

### 1. Tek Kaynak Problemi

Su an ders verisi davranis olarak merkezilesmis gibi gorunse de uygulama mantiginda ders ile iliskili veriler birden fazla katmanda anlam uretmektedir:

- ders listesi
- mufredat anahtarlari
- gorev baglantilari
- sinav baglantilari
- analiz ciktilari

Bu alanlar tek bir ana kaynaktan beslenmezse ileride su sorunlar ortaya cikar:

- ders adi degistiginde her alan esit guncellenmez
- silinen ders artik verilerde hayalet olarak kalabilir
- sinav merkezi ve gorev merkezi farkli ders listeleri gosterebilir
- analizde bir ders varmis gibi gorunurken planlamada o ders eksik olabilir

### 2. Modul Yogunlugu Problemi

Ozellikle ebeveyn tarafinda cok sayida kart tek bir akista toplanmaya baslamistir:

- analiz kartlari
- sinav merkezi
- son kayitlar
- gorev atama
- gorev listesi
- rapor
- veri islemleri

Bu yaklasim kisa vadede hizli gelisim saglar ama orta vadede sunlari bozar:

- ekranin ilk odak noktasi kaybolur
- kullanici yuksek zihinsel yuke maruz kalir
- mobil/tablet deneyimi zayiflar
- render maliyeti artar
- yeni moduller eklendikce kartlar birbirini iter

### 3. Analiz ve Sunum Arasi Derinlik Farki

Okul sinavlari analiz motoruna baglanmaya baslamistir.
Ancak ayni derinlikte su alanlara dagilmasi gerekecektir:

- ust ozet skorlari
- risk merkezi
- ders bazli grafikler
- okul vs ev uyum raporu
- genel sinav / deneme trendi

Bu yayilim tamamlanmadan analiz deneyimi parcali kalir.

## Hedef Bilgi Mimarisi

Ebeveyn paneli 4 ana modulle kalmalidir:

1. Genel Bakis
2. Planlama
3. Dersler ve Gorevler
4. Analiz

Bu ana yapi korunmali, ancak her modulin kendi ic yapisi ikinci seviye navigasyonla ayrilmalidir.

### 1. Genel Bakis

Amac:
- karar verdirmek
- bugunun kritik durumunu gostermek
- kullaniciyi dogru modula yonlendirmek

Icerik:

- bugunun ozet durumu
- geciken gorevler
- en riskli ders veya konu
- son genel sinav ozeti
- hizli aksiyonlar

Burasi islem yapilan ekran degil, kontrol merkezi olmalidir.

### 2. Planlama

Alt moduller:

- Haftalik Program
- Mufredat
- Plan Motoru
- Plan Gecmisi

Kurallar:

- hepsi ayni anda gorunmemeli
- sekme veya acilir panel mantigi olmali
- her alt modul kendi baglaminda calismali

### 3. Dersler ve Gorevler

Alt moduller:

- Ders Merkezi
- Gorev Ata
- Gorev Listesi
- Sinav Merkezi

Ana karar:

Sinav Merkezi, bilgi mimarisi acisindan Analiz yerine buraya daha uygun oturur.
Sebep:

- sinav verisi once veri girisidir
- analiz onun sonraki katmanidir
- kullanici icin once kayit, sonra yorum daha dogal akistir

### 4. Analiz

Alt moduller:

- Genel Performans
- Ders Bazli Analiz
- Okul vs Ev Uyumu
- Risk Merkezi
- Raporlar

Kurallar:

- analiz veri giris yeri olmamali
- analiz, yorum ve karar cikarimi katmani olmali

## Tek Merkezden Ders Girisi Kurali

Bu urunde en sert mimari kural su olmalidir:

`Ders sadece tek yerde olusturulur, duzenlenir ve silinir.`

Bu tek yer:

`Ders Merkezi`

Bu modulin uretmesi gereken cekirdek sonuc su olmalidir:

```ts
Course {
  id: string;
  name: string;
  active: boolean;
  order: number;
  icon?: string;
}
```

Bu noktadan sonra diger tum alanlar yalnizca `courseId` ile calismalidir:

- mufredat
- gorev
- sinav kaydi
- genel sinav ders skoru
- analiz
- rapor
- planlama

### Yasaklanacak Mantik

Asagidaki yaklasimlar sonraki gelistirmede yasaklanmalidir:

1. Ekran icinde yeni ders tanimlamak
2. Sinav eklerken serbest ders adi yazmak
3. Gorev formunda merkezi ders listesinden kopuk bir ders listesi uretmek
4. Mufredat anahtarini fiili ders kaynagi gibi kullanmak

### Izin Verilecek Mantik

1. Ders merkezi yeni ders olusturur
2. Diger butun moduller aktif dersleri otomatik listeler
3. Ders silinirse bagli alanlar icin kontrollu migrate / temizleme calisir
4. Ders pasife alinabilir ama veri gecmisi korunur

## Hedef Bilesen Ayrimi

Mevcut ParentDashboard fazla yuk tasidigi icin su hedef ayrim uygulanmalidir:

### Ust Duzey Containerlar

- ParentOverviewWorkspace
- ParentPlanningWorkspace
- ParentTasksWorkspace
- ParentAnalysisWorkspace

### Alt Modul Bilesenleri

Planlama:
- PlanningScheduleModule
- PlanningCurriculumModule
- PlanningEngineModule
- PlanningHistoryModule

Dersler ve Gorevler:
- CourseCenterModule
- TaskAssignmentModule
- TaskListModule
- ExamCenterModule

Analiz:
- AnalysisSummaryModule
- AnalysisCourseModule
- AnalysisSchoolAlignmentModule
- AnalysisRiskModule
- AnalysisReportsModule

Bu ayrim su faydalari saglar:

- her ekran tek sorumluluk tasir
- veri gerektikce lazy render uygulanabilir
- test ve hata ayiklama kolaylasir
- ayni bilesen tekrar tekrar buyumek yerine kontrollu parcalanir

## UX ve Arayuz Ilkeleri

Bu refactor sadece teknik degil, ayni zamanda UX sadeleştirme hareketidir.

### 1. Bir Ekran = Bir Ana Is

Her ana modulde kullaniciya tek ana niyet hissettirilmelidir.

Yanlis ornek:
- ayni ekranda veri girisi + analiz + rapor + gecmis + ayarlar

Dogru ornek:
- veri girisi ayri alt sekmede
- yorum ayri alt sekmede
- ayarlar ayri acilir blokta

### 2. Kart Yiginini Azalt

Kartlar urunun dili olmaya devam edebilir.
Ama kart her yeni bilgi icin yeni katman olmamalidir.

Kurallar:

- ayni sayfada esdeger oneme sahip 2-4 ana kart olur
- alt detaylar accordion veya tab icinde acilir
- uzun kayit listeleri ilk etapta kisitli gosterilir
- grafikler varsayilan kapali veya secime bagli olabilir

### 3. Ust Bar + Alt Sekme Modeli

Kullanici deneyimi su mantikla ilerlemelidir:

Ust seviye:
- DersRotasi
- Ebeveyn Paneli
- Genel Bakis
- Planlama
- Dersler ve Gorevler
- Analiz

Alt seviye:
- secili module gore yatay sekmeler

Bu model sayesinde:

- kullanici baglam kaybetmez
- yeni ozellik eklemek kolaylasir
- sayfa ici asiri kartlasma azalir

### 4. Buyuyen Veri Icin Kontrollu Yukleme

Veri buyudukce tum kartlari ayni anda acmak yerine su yapi uygulanmalidir:

- ilk ekranda sadece ozetler
- detay istenirse acilir panel
- uzun listelerde sanallastirma veya dilimleme
- grafiklerde secime bagli render
- ayni analiz verisini birden fazla yerde tekrar hesaplamamaya dikkat

## Refactor Fazlari

Bu is bir kerede degil, kontrollu fazlarla yapilmalidir.

### Faz 1: Bilgi Mimarisi Sabitleme

Amaç:
- ana modulleri ve alt modulleri kesinlestirmek
- ekranlarin sorumluluk sinirlarini dondurmek

Teslim:

- kesin ekran haritasi
- alt sekme haritasi
- hangi veri hangi modulde girilir listesi

Kod hedefi:
- cok dusuk

Risk:
- urun kapsami dagilirsa sonra refactor pahalanir

### Faz 2: Tek Ders Merkezi Kurulumu

Amaç:
- ders icin tek kaynak olusturmak

Teslim:

- CourseCenterModule
- courseId bazli tum baglantilar
- ders ekleme/silme/pasiflestirme politikasi

Kurallar:

- yeni ders sadece burada eklenir
- diger moduller buradan gelen aktif listeyi kullanir

### Faz 3: ParentDashboard Ayrisma Refactoru

Amaç:
- dev parent bilesenini modullere ayirmak

Teslim:

- tasks workspace
- analysis workspace
- planning workspace
- overview workspace

Beklenen sonuc:

- daha okunur dosya yapisi
- daha hizli hata ayiklama
- daha kolay performans optimizasyonu

### Faz 4: Sinav ve Analiz Ayrimi

Amaç:
- veri girisi ile yorum katmanini ayirmak

Karar:

- Sinav Merkezi, Dersler ve Gorevler altina tasinir
- Analiz altinda sadece yorum, risk ve rapor kalir

### Faz 5: Analiz Motoru Birlestirme

Amaç:
- okul verisini genel skor, risk ve grafiklere esit duzeyde dagitmak

Teslim:

- schoolScore etkili genel skor
- alignmentGap etkili risk yorumlari
- okul vs ev uyum grafigi
- genel sinav trendi

### Faz 6: Performans ve Yuk Optimizasyonu

Amaç:
- veri buyudugunde deneyimi korumak

Uygulama yonleri:

- lazy mount
- gorunur alan odakli render
- uzun listelerde parcali gosteri
- grafiklerde secmeli yukleme
- pahali hesaplar icin merkezilesmis selector mantigi

## Teknik Kabul Kriterleri

Refactor tamamlandi denebilmesi icin su kosullar saglanmalidir:

1. Ders ekleme yalnizca tek modulde yapiliyor olmali.
2. Sinav merkezi, gorev atama ve analiz ayni aktif ders listesini kullaniyor olmali.
3. Bir ders silindiginde bagli ekranlarda kirik referans kalmamali.
4. ParentDashboard benzeri asiri buyuk bilesenler modullere ayrilmis olmali.
5. Her ana modulde en fazla bir ana is akisi hissedilmeli.
6. Ekran yuklenmesinde gereksiz tekrar kartlar olmamali.
7. Analiz veri girisinden ayri bir yorum katmani olarak algilanmali.
8. Ust bar ve alt sekme mantigi baglam kaybina neden olmamali.

## UX Kabul Kriterleri

1. Kullanici bir dersi nerede ekledigini 3 saniye icinde anlayabilmeli.
2. Kullanici bir sinavi nerede kaydedecegini dusunmeden bulabilmeli.
3. Kullanici ayni bilginin farkli yerlerde tekrarlandigi hissine kapilmamali.
4. Ilk acilan ekran kullaniciyi kart yiginina bogmamali.
5. Veri buyudukce sayfa daha uzun degil, daha filtrelenmis hale gelmeli.

## Riskler

### 1. Erken Kodlama Riski

Bilgi mimarisi sabitlenmeden kod refactoruna girilirse daha sonra ayni bolgeler ikinci kez tasinmak zorunda kalir.

### 2. Cift Kaynak Riski

Ders modeli tam tek merkezli hale gelmeden yeni ozellik eklenirse hata ureten baglanti sayisi artar.

### 3. Gorsel Toplama Riski

Kartlar sadece birlestirilip sorumluluk ayrilmazsa sayfa daha az kartli ama hala mantik olarak karisik kalir.

## Onerilen Sonraki Adim

Kod yazmaya baslamadan once su 3 belge / karar netlesmelidir:

1. Kesin ekran haritasi
2. Ders merkezi veri sozlesmesi
3. Modul bazli refactor sirasi

Bu belge, o 3 karar icin ana iskeleti vermektedir.

## Uygulama Sirasi Onerisi

En guvenli gelisim sirasi sunlardir:

1. Bilgi mimarisini kesinlestir
2. Tek ders merkezi sozlesmesini dondur
3. ParentDashboard parcala
4. Sinav merkezini dogru modula tasi
5. Analiz ekranini alt sekmelere ayir
6. Okul vs ev analizini tum skor katmanina bagla
7. Lazy render ve liste optimizasyonlarini uygula

Bu sira korunursa hem arka plan hem urun akisi daha kusursuz ilerler.

## Not

Bu belge onayli refactor referans dosyasi olarak kullanilabilir.
Kodlama baslangicinda bu belgeye gore faz bazli ilerlenmeli, her faz sonunda build, davranis ve veri baglantisi dogrulamasi yapilmalidir.