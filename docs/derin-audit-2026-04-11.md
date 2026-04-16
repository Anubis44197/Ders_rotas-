# DersRotasi Derin Audit

## Ozet
Bu audit, mevcut `DersRotasi` uygulamasini iki kaynak depo ile karsilastirir:
- `ders-tak-p2-source`
- `mufredat-y-neti-mi-source`

Mevcut durumda temel problem sadece bozuk karakter veya tekil bug degil. Ana problem, iki deponun bilgi mimarisi ve kullanim akisinin tek bir dogru sistem halinde korunmadan ust uste bindirilmis olmasi.

## Kritik Bulgular

### 1. Ebeveyn akisi moduler yapidan cikmis, tek uzun sayfaya donmus
Dosyalar:
- `App.tsx:634`
- `App.tsx:635`
- `App.tsx:636`
- `App.tsx:648`
- `ders-tak-p2-source/components/parent/ParentDashboard.tsx:1583`
- `ders-tak-p2-source/components/parent/ParentDashboard.tsx:1605`

Sorun:
Kaynak `ders-tak-p2` tarafinda ebeveyn paneli moduler bir yan menu ve gorunum degistiren bir yapiyla kuruluydu. Mevcut uygulamada haftalik program, mufredat, plan, analiz, gorev ve veri islemleri ayni uzun akista arka arkaya duruyor.

Etkisi:
- Bilissel yuk cok yuksek.
- Kullanici hangi bolumde oldugunu anlayamiyor.
- Veri girisi ile analiz ayni blokta karisiyor.
- Akis profesyonel panel hissi vermiyor.

### 2. Mufredat giris akisi, orijinal sayfa mantigini kaybetmis
Dosyalar:
- `components/parent/CurriculumManagerPanel.tsx:12`
- `mufredat-y-neti-mi-source/pages/CurriculumPage.tsx:110`

Sorun:
`mufredat-y-neti-mi` tarafinda ders secimi, unite bazli bloklar, modal ile ekleme, sticky kaydet davranisi ve daha net bir bilgi hiyerarsisi vardi. Mevcut panel, teknik olarak veri tutsa da deneyim olarak geri dusuyor.

Etkisi:
- Unite ve konu ekleme akisinda ritim yok.
- Kaydet davranisi gorunsel olarak zayif.
- Ebeveyn tarafinda hizli ve guven veren yonetim hissi yok.

### 3. Haftalik planlama akisi dogru katmanlara ayrilmamis
Dosyalar:
- `components/parent/PlanningPanel.tsx:78`
- `mufredat-y-neti-mi-source/pages/PlanPage.tsx:231`
- `mufredat-y-neti-mi-source/pages/PlanPage.tsx:282`
- `mufredat-y-neti-mi-source/pages/PlanPage.tsx:609`

Sorun:
Kaynak plan sayfasinda plan turu secimi, modal step mantigi, gun sekmeleri, plan goruntuleme ve gorev duzenleme daha ayrik katmanlardaydi. Mevcut panelde bunlar tek blok icinde daha sikisik ve daha az anlasilir.

Etkisi:
- Plan olusturma ile plan okuma ayni alan icinde carpismakta.
- Hafta bazli ilerleme profesyonel bir planlayici gibi hissettirmiyor.
- Cocuk tarafina aktarian mantik teknik olarak var ama UX olarak guven vermiyor.

### 4. Cocuk paneli, kaynak paneldeki net gorev panosu duzenini kaybetmis
Dosyalar:
- `components/child/ChildDashboard.tsx:157`
- `components/child/ChildDashboard.tsx:184`
- `components/child/ChildDashboard.tsx:246`
- `ders-tak-p2-source/components/child/ChildDashboard.tsx:857`
- `ders-tak-p2-source/components/child/ChildDashboard.tsx:1099`
- `ders-tak-p2-source/components/child/ChildDashboard.tsx:1100`
- `ders-tak-p2-source/components/child/ChildDashboard.tsx:1108`

Sorun:
Kaynak cocuk panelinde gorev panosu, kutuphane, haftalik puan grafikleri, basarilar ve daha zengin sag kolon mantigi vardi. Mevcut panel daha sade ama su anda fazla bos, dengesiz ve eksik hissettiriyor.

Etkisi:
- Ekranda bosluk fazla ama bilgi degerli degil.
- Rozet kutusu gibi alanlar hem kucuk hem sorunlu.
- Sag kolon bilgi yogunlugu yetersiz.
- Panel ne oyunlastirilmis ne de net calisma panosu; arada kalmis durumda.

### 5. Rozet ve eski veri temizligi hala tam guvenilir degil
Dosyalar:
- `components/child/ChildDashboard.tsx:246`
- `App.tsx` normalizasyon katmani

Sorun:
Kullanici ekran goruntusu, eski bozuk badge verisinin hala arayuze sizdigini gosteriyor. Kod tarafinda savunma eklense de veri migrasyonu net ve merkezi degil.

Etkisi:
- Kullanici güveni dusuyor.
- Arayuz profesyonellik algisini kaybediyor.
- Bozuk veri bir daha farkli alanlarda da patlayabilir.

### 6. Tasarim dili tek bir sistem olarak tanimlanmamis
Dosyalar:
- `components/child/ChildDashboard.tsx`
- `components/parent/ParentDashboard.tsx`
- `components/parent/CurriculumManagerPanel.tsx`
- `components/parent/PlanningPanel.tsx`
- `components/parent/WeeklySchedulePanel.tsx`

Sorun:
Renk, bosluk, kart davranisi, ikon agirlari ve bolum hiyerarsisi her modulde ayri ayri olusmus gorunuyor. Kullaniciya bir tasarim sistemi hissi vermiyor.

Etkisi:
- Panel parcali gorunuyor.
- Modern ama tutarli bir arayuz cikmiyor.
- Senin istedigin profesyonel urun hissi yok.

### 7. Kaynak depolardaki bazi onemli senaryolar eksilmis veya geriye itilmis
Dosyalar:
- `ders-tak-p2-source/components/child/ChildDashboard.tsx`
- `ders-tak-p2-source/components/parent/ParentDashboard.tsx`
- `components/child/ChildDashboard.tsx`
- `components/parent/ParentDashboard.tsx`

Eksik/Geri itilen alanlar:
- Cocuk tarafi kutuphane/okuma odagi
- Haftalik puan veya ilerleme kartlari
- Ebeveyn tarafinda moduler gorev yonetimi
- Ayrik analiz sayfalari ile giris ekranlari arasindaki sinir
- Kaynak depolardaki daha zengin panel ayrimi

## Tasarim Acisindan Net Hatalar
- Haftalik ders programi, sade ama fazla formsal. Profesyonel planner hissi vermiyor.
- Mufredat paneli veri giriyor ama urun kalitesinde bir editor gibi davranmiyor.
- Plan ekraninda odak noktasi kaymis: plan olusturma, plan duzenleme ve hafta gezme ayni seviyede sunuluyor.
- Cocuk ekraninda ust alan ve kartlar guzel sadelesmis olsa da sag kolon ve gorev deneyimi hala zayif.
- Uygulama genelinde tipografi ve renk sistemi tek elden tanimlanmamis.

## Calismayan veya Riskli Alanlar
- Eski bozuk localStorage verisi yeni arayuze sizabiliyor.
- Parent tarafinda cok fazla alan ayni sayfada oldugu icin test kapsami zorlasiyor.
- Bazi legacy analiz bilesenleri kodda duruyor ama aktif urun mimarisi ile birebir uyumlu degil.
- Entegrasyon teknik olarak calissa bile kullanici akisi hala kopuk oldugu icin 'calisiyor' hissi vermiyor.

## Dogru Toparlama Sirasi
1. Bilgi mimarisini yeniden kur
2. Parent paneli modulerlestir
3. Mufredat ve haftalik program ekranlarini `mufredat-y-neti-mi` mantigina daha yakin yeniden tasarla
4. Plan ekranini step bazli ve hafta odakli hale getir
5. Cocuk panelini tekrar gorev panosu mantigina oturt
6. Eski veri migrasyon katmanini merkezilestir
7. Sonra analiz ekranlarini yeniden yerlestir

## Sonuc
Mevcut sistem teknik olarak parcali bicimde calisiyor; fakat kaynak depolardaki dogru akis korunmamis. Bundan sonraki asama, tek tek bug kovalamak degil; once bilgi mimarisini ve ekran hiyerarsisini eski depolarla uyumlu sekilde yeniden kurmak olmali.
