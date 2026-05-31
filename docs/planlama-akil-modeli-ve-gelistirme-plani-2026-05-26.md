# Planlama Akil Modeli ve Gelistirme Plani - 2026-05-26

Bu dokuman, Planlama sayfasinin sadece takvim/gorev ekleme ekrani degil, cocugun gercek durumuna gore akilli haftalik plan ureten merkezi karar katmani olmasi icin hazirlandi.

Kod degisikligi yapilmadi. Bu dosya sonraki uygulama ve sayfa duzeni calismasi icin referans alinacak.

## Ana Hedef

Planlama su soruya cevap vermeli:

> Bu cocuk bu hafta, hangi derste, hangi konuda, hangi tur calismayi, hangi gun ve hangi sureyle yapmali?

Bu cevabin dayanagi sadece veli tarafindan girilen haftalik ders programi olmamali. Plan su veri katmanlarini birlikte okumali:

- mufredat: ders, unite, konu sirasi
- haftalik okul programi: okulda hangi gun hangi ders var
- ev calisma penceresi: cocugun hangi gun hangi saat calisabilecegi
- sinav takvimi: yaklasan okul sinavi / deneme / LGS baskisi
- gorev gecmisi: planli ve plansiz calismalar
- cocuk performansi: dogruluk, odak, sure, mola, duraklama, tamamlama
- konu durumu: yeni, calisiliyor, tekrar gerekli, riskli, stabil
- plan uyumu: planlandi mi, yapildi mi, zamaninda mi, ertelendi mi
- serbest calisma: plansiz ama faydali ek calismalar

## Mevcut Durum

Bugunku sistemin iyi taraflari:

1. Planlama ebeveyn tarafinda duruyor; cocuk sadece kendine dusen gorevleri goruyor.
2. Haftalik okul programi ve ev calisma penceresi ayrilmis durumda.
3. Plan olusunca gercek `Task` kaydi aciliyor ve cocuk paneline dusuyor.
4. `planTaskId`, `planWeek`, `planSource`, `planLabel` baglantilari var.
5. Cocuk gorevi tamamlayinca plan icindeki gorev tamamlanma bilgisi senkronlanabiliyor.
6. Analiz motoru plan gorevlerini ve tamamlanma oranini okuyabiliyor.

Bugunku sistemin eksik tarafi:

1. Plan motoru karar sayfasi kadar derin metrik kullanmiyor.
2. Haftalik plan tarih modeli zayif; hafta numarasi gercek takvim haftasina yeterince bagli degil.
3. Ilk plan dogrudan aktiflesiyor; on izleme/onay akisi sadece sonraki replan onerilerinde var.
4. Planin "neden bu gorev" aciklamasi veliye yeterince kanitli gosterilmiyor.
5. Cocuk durumuna gore sure, zorluk, tekrar, soru sayisi ve dinlenme dengesi yeterince kisilesmiyor.

## Dogru Planlama Mantigi

Planlama dort ana karar vermeli:

1. Hangi konu?
2. Hangi calisma turu?
3. Hangi gun/saat?
4. Hangi yogunluk?

Bu kararlar birbirinden bagimsiz alinmamali.

Ornek:

- Matematik / Kesirler konusu son 3 soru calismasinda dusukse: tekrar + soru cozme gerekir.
- Cocuk Cuma gunleri odak kaybediyorsa: Cuma derin ogrenme degil, hafif tekrar verilmeli.
- Fen sinavi 5 gun sonra ve son test ortalamasi dusukse: yeni konu yerine sinav hazirlik ve olcme blogu verilmeli.
- Planli gorevler tamamlanmamis ama serbest calisma yapilmissa: plan uyumu dusuk, calisma niyeti var; daha kisa ve net plan verilmeli.

## Veri Katmanlari

### 1. Mufredat Katmani

Kullanildigi yer:

- konu havuzu
- konu sirasi
- tamamlanan / acik konu ayrimi
- ders-unite-konu baglami

Plan etkisi:

- hic calisilmamis konu: `new_learning`
- calisilmis ama olculmemis konu: `assessment`
- tamamlanmis ama uzun sure tekrar edilmemis konu: `revision`
- riskli konu: `revision + question_practice`

### 2. Haftalik Okul Programi

Kullanildigi yer:

- o gun okulda hangi ders var
- okul dersinden sonra ayni ders icin tekrar firsati
- okul yogunlugu

Plan etkisi:

- okulda ayni ders varsa: evde kisa pekistirme veya soru cozme onerilebilir.
- okul gunu cok yogunsa: daha kisa/hafif blok verilmeli.
- okul olmayan gunlerde: derin ogrenme veya telafi blogu daha uygun olabilir.

### 3. Ev Calisma Penceresi

Kullanildigi yer:

- plan blogunun saatlenmesi
- calisma kalitesi: light / medium / deep

Plan etkisi:

- `deep`: yeni ogrenme, sinav hazirlik
- `medium`: soru cozme, konu tekrari
- `light`: hafif tekrar, okuma, kisa pekistirme

### 4. Gorev ve Oturum Verisi

Kullanildigi yer:

- tamamlandi mi
- sure hedefe uydu mu
- mola/duraklama fazla mi
- dogruluk nasil
- cocuk kendini nasil degerlendirdi

Plan etkisi:

- dusuk dogruluk: konu tekrar + olcme
- dusuk odak: daha kisa blok + daha erken saat
- sure asimi: konu zorlugu veya blok uzunlugu dusurme
- cok mola/duraklama: hafifletilmis plan
- iyi skor: yeni konu veya ileri soru

### 5. Sinav Takvimi

Kullanildigi yer:

- yaklasan sinav
- ders bazli aciliyet
- sinav oncesi olcme ihtiyaci

Plan etkisi:

- 0-3 gun kala: yeni konu azalt, tekrar ve olcme artir.
- 4-10 gun kala: sinav hazirlik + soru cozme dagit.
- ilgili derste son skor dusukse: oncelik yukselt.

### 6. Plan Uyumu

Kullanildigi yer:

- planli gorevlerin tamamlanma orani
- geciken gorevler
- plan disi serbest calisma
- hafta ici erken uyari

Plan etkisi:

- plan uyumu dusukse: daha az blok, daha net hedef, telafi.
- plan uyumu iyi ama basari dusukse: cocuk calisiyor ama yontem yanlis; tekrar/olcme degismeli.
- plan uyumu dusuk ama serbest calisma yuksekse: cocuk motivasyonu var, plan saatleri veya blok tipi yanlis olabilir.

## Skor Modeli

Plan motoru her konu icin karar oncesi puan uretmeli.

### Topic Priority Score

Konunun bu hafta plana girme onceligi.

Ana girdiler:

- risk durumu
- son dogruluk ortalamasi
- sinav yakinligi
- tekrar gecikmesi
- konu sirasi
- plan gecikmesi

Yorum:

- 80-100: bu hafta kesin girer
- 60-79: yuksek oncelik
- 40-59: orta oncelik
- 0-39: uygunluk varsa girer

### Topic Mastery Score

Konunun ogrenilme guveni.

Ana girdiler:

- son soru dogrulugu
- rolling average
- son 3 oturum trendi
- tekrar sonrasi gelisim
- olcme sonucu

Yorum:

- 0-49: riskli
- 50-69: takip/tekrar
- 70-84: stabil
- 85-100: guclu

### Plan Adherence Score

Cocugun plana uyma guveni.

Ana girdiler:

- planli gorev tamamlama
- zamaninda tamamlama
- erteleme
- plan disi serbest calisma
- hafta ici aksama

Yorum:

- dusukse plan hafifletilmeli
- orta ise bloklar daha net parcalanmali
- yuksekse yeni konu veya yogun tempo verilebilir

### Load Capacity Score

Bu hafta cocuga ne kadar yuk verilebilir?

Ana girdiler:

- gecen haftaki tamamlanma
- odak ortalamasi
- mola/duraklama orani
- okul programi yogunlugu
- sinav baskisi
- veli tarafindan secilen tempo

Yorum:

- dusuk kapasite: az blok, kisa sure, daha cok tekrar
- orta kapasite: dengeli plan
- yuksek kapasite: yeni konu + olcme + soru

## Plan Karar Tablosu

| Veri Durumu | Plan Karari | Gorev Tipi | Not |
| --- | --- | --- | --- |
| Konu hic calisilmamis | Yeni ogrenme | ders calisma | Deep pencere tercih edilir |
| Konu calisilmis ama olculmemis | Olcme | soru cozme | Kisa mini test |
| Dogruluk dusuk | Tekrar + soru | ders calisma / soru cozme | Once tekrar, sonra olcme |
| Odak dusuk | Kisa blok | ders calisma | Sure azaltilir |
| Sure hedefi surekli asiliyor | Konu zor veya blok uzun | ders calisma | Blok bolunur |
| Soru dogrulugu yuksek | Yeni konu / ileri soru | ders calisma / soru cozme | Zorluk artabilir |
| Sinav 3 gun icinde | Tekrar + olcme | soru cozme | Yeni konu azalt |
| Plan gorevi gecikmis | Telafi | compensation | Hafta sonu veya bos pencere |
| Plan uyumu dusuk | Hafif plan | light_review | Daha az blok |
| Serbest calisma cok, plan uyumu dusuk | Saat/blok yanlis | yeniden plan | Calisma niyeti var |

## Haftalik Plan Uretim Akisi

1. Veri kontrolu
   - aktif ders var mi
   - mufredat var mi
   - okul programi var mi
   - ev calisma penceresi var mi
   - plan icin yeterli konu var mi

2. Cocuk durumunu hesapla
   - konu hakimiyeti
   - plan uyumu
   - yuk kapasitesi
   - sinav baskisi
   - riskli konular

3. Konu adaylarini sec
   - zorunlu risk konulari
   - sinav konulari
   - yeni konu sirasi
   - tekrar gecikmeleri

4. Blok turunu sec
   - new_learning
   - revision
   - question_practice
   - assessment
   - exam_prep
   - compensation
   - light_review

5. Gun ve saat sec
   - okul programi ile uyum
   - ev calisma penceresi kalitesi
   - gunluk yuk limiti
   - ayni ders yigilmasi
   - sinav yakinligi

6. Veli on izleme
   - neden bu konu?
   - neden bu gun?
   - beklenen etki ne?
   - cocuk icin agir mi hafif mi?

7. Veli onayi
   - onaylaninca aktif plan olur
   - cocuk gorevleri olusur
   - eski plan arsivlenir

8. Uygulama ve geri besleme
   - cocuk gorevi yapar
   - sonuclar analiz snapshot'ina girer
   - karar sayfasi ve planlama ayni veriye bakar

## Veliye Gosterilecek Aciklama Modeli

Planlama sayfasi sadece "Matematik - Kesirler" yazmamali. Veliye gerekce gostermeli.

Ornek aciklama:

- "Kesirler konusu bu hafta plana alindi, cunku son 3 soru calismasinda dogruluk %58 ve tekrar gecikmesi 9 gun."
- "Persembe gunu yeni konu yerine hafif tekrar verildi, cunku okul programi yogun."
- "Fen sinavi 5 gun sonra oldugu icin yeni konu azaltilip olcme blogu eklendi."
- "Cocuk planli gorevleri geciktirdi ama serbest calisma yapti; bu hafta plan daha kisa bloklara bolundu."

## Karar Sayfasi ile Baglanti

Karar sayfasi ile planlama ayni gercege bakmali.

Karar sayfasinin veliyi dogru yonlendirmesi icin planlama sunlari uretmeli:

- hangi konular planlandi
- neden planlandi
- hangi konular riskli kaldi
- hangi plan gorevleri tamamlandi
- hangi plan gorevleri gecikti
- plan degisikligi onerisi var mi
- sinav baskisi plan hedefini degistirdi mi

Karar sayfasi da bunlari soylemeli:

- "Plan uygulanabilir."
- "Plan hafifletilmeli."
- "Su konu acil tekrar istiyor."
- "Bu hafta yeni konu yerine telafi daha dogru."
- "Veli onayi gereken plan guncellemesi var."

## Gelistirme Fazlari

### Faz 1 - Plan Veri Sozlesmesi

Amac:

- planin tarih, hafta, konu, gorev, neden ve durum verisini saglamlastirmak

Yapilacaklar:

1. Hafta baslangic tarihi ekle.
2. Plan gorevlerinin dueDate hesabini gercek hafta tarihine bagla.
3. Plan task ile child task arasindaki alanlari tam senkron yap.
4. Plan duzenleme validasyonunu sertlestir.
5. Ilk plan icin on izleme/onay akisi ekle.

### Faz 2 - Akilli Skor Katmani

Amac:

- plan motorunun konu ve yuk kararlarini cocugun gercek durumuna gore vermesi

Yapilacaklar:

1. Topic Priority Score.
2. Topic Mastery Score.
3. Plan Adherence Score.
4. Load Capacity Score.
5. Exam Pressure Score.

### Faz 3 - Plan Uretim Kurallari

Amac:

- yukaridaki skorlarin gercek plan bloklarina donusmesi

Yapilacaklar:

1. Riskli konu zorunlu bloklari.
2. Sinav oncesi tekrar/olcme bloklari.
3. Dusuk odak icin kisa blok.
4. Plan kirilmasi icin telafi blogu.
5. Serbest calisma etkisini plana katma.

### Faz 4 - Veli Onizleme ve Gerekce

Amac:

- veli planin neden boyle yapildigini anlayabilsin

Yapilacaklar:

1. Plan onizleme kartlari.
2. "Neden bu konu?" aciklamasi.
3. "Beklenen etki" etiketi.
4. Risk ve agirlik uyarisi.
5. Onay / duzenle / reddet akisi.

### Faz 5 - Sayfa Duzeni

Amac:

- planlama sayfasini uzun blok yerine adim adim kullanilabilir komuta merkezine cevirmek

Onerilen ekran sirasi:

1. Plan zemini
2. Veri durumu
3. Plan onerisi
4. Aktif plan
5. Gecmis / replan

## Degistirilmeyecek Ilkeler

- Cocuk tarafinda plan kurma yok.
- Cocuk sadece aktif ve kendine dusen gorevleri gorur.
- Veli onayi olmadan yeni plan aktiflesmez.
- Planlama, karar sayfasindan kopuk hesap yapmaz.
- Plan verisi analiz ve karar motorunun girdisi olarak kabul edilir.
- Firebase bu fazda kapsam disi.

## Sonuc

Planlama sayfasi, uygulamanin akilli omurgasi olmali. Karar sayfasinin dogru karar vermesi, cocuk panelinin dogru gorev gostermesi ve analizlerin gercekci cikmasi icin plan motoru sadece takvim doldurmamali; cocugun akademik durumunu okuyarak, gerekceli, onayli ve olculebilir plan uretmeli.

Sonraki adim:

1. Bu akil modeli onaylanacak.
2. Faz 1 veri sozlesmesi kodda uygulanacak.
3. Ardindan sayfa duzeni planlanacak.
