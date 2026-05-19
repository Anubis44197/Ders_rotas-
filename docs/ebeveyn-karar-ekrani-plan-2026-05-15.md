# Ebeveyn Karar Ekrani Plani - 2026-05-15

## Uygulama Yol Haritasi

Bu dosya detayli master plan olarak kalir. Uygulama sirasinda kisa katmanli yol haritasi takip edilecek:

- [Ebeveyn Karar Ekrani Uygulama Yol Haritasi](./ebeveyn-karar-ekrani-uygulama-yol-haritasi-2026-05-15.md)

## Amac

Ebeveyn panelindeki analiz ve raporlama bolumu, teknik bir analiz merkezi gibi degil, velinin hizli karar alabildigi sade bir karar ekrani gibi calismali.

Arka planda guclu hesaplama motoru kalacak; ekranda ise veliye net, kisa ve eyleme donuk sonuclar gosterilecek.

Temel soru:

- Cocuk genel olarak nasil gidiyor?
- Hangi dersler iyi?
- Hangi dersler destek istiyor?
- Hangi konular tekrar edilmeli?
- Hangi gun ve saatlerde daha verimli?
- Bugun veya bu hafta ne yapmaliyiz?

## Degismeyecek Ilkeler

- Mevcut uygulama yapisi bozulmayacak.
- iPhone / iOS hissi korunacak.
- Karanlik, yuvarlak, yumusak, cam hissi veren mevcut UI dili devam edecek.
- Mevcut renk paleti, kart sekilleri, radius, golge, cam yuzey ve buton dili korunacak; karar ekrani yeni bir tasarim dili yaratmayacak.
- Yeni ekranlar pazarlama sayfasi gibi degil, uygulama ici kontrol paneli gibi kalacak.
- Kart icinde kart kalabaligi azaltilacak.
- Gereksiz teknik metrikler veliye direkt gosterilmeyecek.
- Hesaplamalar arka planda kalacak; veliye sade yorum ve karar ciktisi verilecek.
- Kod degisikligine grafik turleri ve ekran akisi netlesmeden baslanmayacak.

## Mevcut Sorunlar

- Grafikler veri gosterse bile veli ne anlamasi gerektigini hemen anlayamiyor.
- Grafikler buyuk alan kapliyor ve ekrani agirlastiriyor.
- Bazi metrik adlari teknik: EMA, kalibrasyon, yorgunluk endeksi, deep work, verimlilik korelasyonu.
- Ayni anlam farkli yerlerde tekrar ediyor: genel skor, hakimiyet, odak, verim.
- Ders bazli performans ve ders detayina inme akisi yeterince net degil.
- Veli icin karar cumlesi eksik: "ne oldu?" ve "sirada ne yapilmali?" sorulari ayni anda cevaplanmiyor.
- Deneme sinavi, hedef, uyari, olculebilir calisma sinyalleri, LGS modu ve aksiyon butonlari henuz karar ekranina bagli degil.

## Hedef Bilgi Mimarisi

### 1. Ebeveyn Karar Ozeti

Ilk ekranda en fazla 5-6 ana sinyal olmali:

- Genel durum: Iyi / Dikkat / Destek gerekiyor
- Bu hafta tamamlanan calisma
- Cozulen soru sayisi
- Ortalama basari
- En guclu ders
- En cok destek isteyen ders
- Bugun veya bu hafta onerilen sonraki adim

Ornek veli dili:

> Bu hafta genel durum iyi. Ingilizce guclu ilerliyor. Matematikte Carpanlar ve Katlar konusu tekrar istiyor. Bugun 25 dakika tekrar ve 15 soru onerilir.

### 2. Ders Bazli Performans

Veli tum dersleri karsilastirmali gorebilmeli.

Gorunmesi gerekenler:

- Ders adi
- Basari durumu
- Calisma miktari
- Soru cozme durumu
- Konu ilerleme durumu
- Durum etiketi: Guclu / Dengeli / Dikkat / Destek gerekiyor

Zaman filtreleri:

- Haftalik
- Aylik
- 3 aylik
- Tum zamanlar

Veli bir derse tiklayinca ders detayina inmeli.

### 3. Ders Detay Ekrani

Bir ders secildiginde veli o dersin durumunu net gormeli.

Gorunmesi gerekenler:

- Ders genel durumu
- Haftalik / aylik / 3 aylik degisim
- Cozulen soru sayisi
- Dogru / yanlis orani
- Tamamlanan calisma sayisi
- En iyi konu
- Tekrar isteyen konu
- Riskli konu
- Onerilen sonraki calisma

Ornek veli dili:

> Matematikte genel basari dengeli. Uslu ifadelerde ilerleme iyi, Carpanlar ve Katlar konusu tekrar istiyor. Son 7 gunde 96 soru cozuldu.

### 4. Odak ve Calisma Kalitesi

Odak bilgisi sade performans gostergesi olarak verilmeli.

Gorunmesi gerekenler:

- Ortalama oturum suresi
- Tamamlanan calisma orani
- Yarim kalan calisma sayisi
- Planlanan sure / tamamlanan sure
- En verimli gun
- En verimli saat araligi
- Kisa ve uzun oturumlarda basari karsilastirmasi

Ornek veli dili:

> En verimli saat araligi 19:00-20:00. 25-35 dakikalik oturumlarda dogruluk orani daha yuksek.

### 4.1 Sayac ve Oturum Metrikleri Koruma Karari

Cocuk ders calismaya basladiginda aktif olan sayac verileri kaldirilmayacak. Bu veriler karar motorunun ana ham girdileri olarak korunacak.

Korunacak ham metrikler:

- Gercek calisma suresi
- Planlanan sure
- Mola suresi
- Duraklatma suresi
- Oturumun tamamlanip tamamlanmadigi
- Yarim kalan calisma sayisi
- Soru dogrulugu
- Tekrar yapilip yapilmadigi

Bu metrikler arka planda su hesaplama alanlarini beslemeye devam edecek:

- Calisma kalitesi
- Sure uyumu
- Odak / oturum dengesi
- Verimlilik
- Tamamlama duzeni
- Veri guvenilirligi
- Ders ve konu bazli performans

UI karari:

- Veliye teknik "focus score", "efficiency norm" gibi isimler gosterilmeyecek.
- Bu metrikler sade karar sinyallerine cevrilecek.
- Normal planli mola cezalandirilmamali.
- Asiri duraklatma, acik unutulan sayac, cok kisa/cok uzun anormal oturum ve surekli yarim kalan calismalar "oturum kalitesi" ve "veri guvenilirligi" sinyali olarak islenecek.

Ornek veli dili:

> Bu hafta calisma sureleri plana yakin. Iki oturumda duraklatma suresi yuksek oldugu icin analiz guveni orta seviyede.

### 5. Konu Takibi

Ders detayinda konu durumlari basit etiketlerle gosterilmeli.

Durumlar:

- Ogrenildi
- Pekisiyor
- Tekrar istiyor
- Riskli
- Henuz veri yok

Her konu icin gosterilebilecek bilgiler:

- Son calisma tarihi
- Son basari durumu
- Cozulen soru sayisi
- Onerilen eylem

### 6. Onerilen Sonraki Adimlar

Veli icin en degerli alan burasi olacak.

En fazla 3 net oneriden olusmali:

- Bugun yapilacak oneri
- Bu hafta tekrar edilecek konu
- Soru cozme onerisi

Ornek:

- Matematik: Carpanlar ve Katlar icin 20 dakika tekrar
- Fen Bilgisi: Basinc konusunda 15 soru
- Ingilizce: Unit 3 kelime tekrari

### 7. Deneme Sinavi Analizi

LGS odakli kullanim icin deneme sinavi analizi karar ekraninin kritik parcasi olmali.

Gorunmesi gerekenler:

- Son deneme neti
- Bir onceki denemeye gore net artisi / azalisi
- Ders bazli deneme performansi
- Ders bazli net degisimi
- Hedef nete gore durum
- Hedefe yakin / geride / iyi etiketi
- Deneme trendi
- En cok net kaybettiren ders veya konu

Ornek veli dili:

> Son denemede toplam net 6,25 artti. Matematik hedefe gore geride, Turkce hedefe yakin. Fen Bilgisi son iki denemede yukselis gosteriyor.

### 8. Hedef Sistemi

Veli karar ekraninda hedefler sadece ayar degil, takip edilen canli gosterge olmali.

Hedef turleri:

- Haftalik soru hedefi
- Ders bazli soru hedefi
- Ders bazli calisma suresi hedefi
- Konu bitirme hedefi
- Deneme net hedefi
- LGS hazirlik hedefi

Gorunmesi gerekenler:

- Hedef
- Gerceklesen
- Kalan
- Hedef gerceklesme yuzdesi
- Hedef durumu: iyi gidiyor / dikkat / geride

Ornek veli dili:

> Matematik haftalik soru hedefinin %62'si tamamlandi. Hedefe ulasmak icin bu hafta 38 soru daha gerekli.

### 9. Veli Uyari Sistemi

Karar ekrani sadece rapor gostermemeli; sorun buyumeden uyarmali.

Uyari kurallari:

- 3 gun calisma yoksa uyar.
- Bir derste basari dusuyorsa uyar.
- Cok yanlis yapilan konu varsa uyar.
- Soru cozumu azaldiysa uyar.
- Hedef gerceklesmesi gerideyse uyar.
- Deneme neti hedefin altinda kalirsa uyar.
- Ayni konu tekrar tekrar yanlis yapiliyorsa uyar.

Uyari dili kisa ve eylem odakli olmali:

- 3 gundur calisma kaydi yok.
- Matematik basarisi son 3 calismada dusuyor.
- Fen Bilgisi soru cozumu bu hafta azaldi.
- Carpanlar ve Katlar konusu acil tekrar istiyor.

### 10. Olculebilir Calisma Sinyalleri

Veliye motivasyon veya karakter yorumu degil, olculebilir calisma sinyalleri gosterilmeli.

Gosterilecek sinyaller:

- Son 7 gun calisma sayisi
- Tamamlanan calisma orani
- Ortalama oturum suresi
- Son 14 gun tekrar sikligi
- Soru cozum duzeni
- Yarim kalan calisma sayisi
- Haftalik hedefe gore kalan calisma

Bu alan yorum uretmeyecek; veriyi sade etiket ve kisa aciklama ile gosterecek.

Ornek veli dili:

> Son 7 gunde 4 calisma tamamlandi. Tekrar sikligi hedefin altinda.

### 11. Konu Oncelik Siralamasi

Sadece "riskli konu" demek yeterli degil. Konular oncelik amacina gore ayrilmali.

Oncelik durumlari:

- Acil tekrar
- Pekistirme
- Yeni konu
- Izleme al
- Henuz veri yok

Siralamada dikkate alinacak sinyaller:

- Son basari
- Yanlis sayisi
- Son calisma tarihi
- Deneme etkisi
- Hedefe katkisi
- Tekrar gecikmesi

Ornek veli dili:

> 1. Acil tekrar: Carpanlar ve Katlar
> 2. Pekistirme: Uslu ifadeler
> 3. Yeni konu: Karekoklu ifadeler

### 12. Bos / Az Veri Durumu

Yeni kullanicida veya az kayitta ekran bos ya da yaniltici gorunmemeli.

Bos veri mesajlari:

- Henuz yeterli veri yok.
- Ilk analiz icin 3 calisma gerekli.
- Bu hafta veri olusunca oneriler gosterilecek.
- Ders analizi icin en az 1 tamamlanan calisma gerekli.
- Deneme trendi icin en az 2 deneme gerekli.

Az veri halinde sistem kesin hukum vermemeli:

- Son 1 calismaya gore on yorum.
- Veri az oldugu icin oneriler tahmini.
- Daha guvenilir analiz icin birkac calisma daha gerekli.

### 13. LGS / Sinav Hedef Modu

Uygulama LGS odakli kullanilacaksa ayrica sinav hedef modu olmali.

Gorunmesi gerekenler:

- LGS'ye kalan sure
- Ders bazli hazir olma durumu
- Unite tamamlama yuzdesi
- Deneme net trendi
- Hedef nete kalan fark
- En kritik LGS konulari
- Haftalik LGS calisma onerisi

Ornek veli dili:

> LGS hedef modunda Matematik hazirligi geride, Ingilizce hedefe yakin. Bu hafta Matematikte 2 konu tekrari ve 60 soru onerilir.

### 14. Veli Aksiyon Butonlari

Oneriler sadece yazi olarak kalmamali. Veli tek tikla aksiyon alabilmeli.

Butonlar:

- Bugunun planina ekle
- Tekrar gorevi olustur
- 15 soru hedefi ver
- Bu konuyu takip et
- Ders hedefini guncelle
- Deneme hedefi ekle

Butona basilinca ogrenci ekraninda gorev veya hedef olarak gorunmeli.

### 15. Ogrenci Ekrani ile Baglanti

Ebeveyn karar ekranindaki oneriler ogrenci tarafina uygulanabilir gorev olarak dusmeli.

Baglanti kurallari:

- Veli tekrar gorevi olusturursa ogrenci gorev listesinde gorur.
- Veli soru hedefi verirse ogrenci hedef olarak gorur.
- Veli konuyu takip ederse konu ogrenci ekraninda oncelikli gorunur.
- Ogrenci gorevi tamamladikca veli ekraninda hedef gerceklesmesi guncellenir.

### 16. Veri Guvenilirligi Aciklamasi

Her yorumun kucuk ve sade bir veri dayanak aciklamasi olmali.

Ornek dayanak metinleri:

- Son 7 gun verisine gore.
- Son 3 calismaya gore.
- Son 2 denemeye gore.
- Yeterli veri yok, tahmini oneri.
- Hedef bilgisi girilmedigi icin genel performansa gore hesaplandi.

### 17. Oncelik Motoru

Oneriler sadece listelenmemeli; sistem kendi icinde hangi onerinin daha kritik oldugunu hesaplamali.

Arka plan hesaplama sinyalleri:

- Basari dusuklugu
- Tekrar gecikmesi
- Denemeye etkisi
- Hedefe etkisi
- Yanlis yogunlugu
- Son trend yonu
- Veri guven seviyesi

Teknik katmanda kullanilabilecek kavramlar:

- severity score
- urgency
- confidence

Bu teknik kavramlar UI'da gosterilmeyecek. Veli tarafinda sade etiketler kullanilacak:

- Kritik
- Dikkat
- Takip et
- Stabil

Ornek karar:

> Dusuk basari + uzun tekrar gecikmesi + denemeye etkisi yuksek ise konu otomatik Kritik oncelige alinir.

### 18. Trend Yonu

Sistem sadece anlik durumu degil, gidisati da gostermeli.

Trend etiketleri:

- Yukseliyor
- Stabil
- Dusuyor
- Hizli dusuyor

Veli dili:

> Matematik su an orta seviyede ama son 3 calismada dusus var.

Bu sayede veli anlik kotu durum ile giderek kotulesen durumu ayirt edebilir.

### 19. Konu Bagimliligi

Ilk surumde konu bagimliligi kisa ve olculebilir tutulacak. Derin graph motoru kurulmayacak.

Kapsam:

- On kosul konu iliskisi
- Once ogrenilmesi gereken konu
- Sonraki konuya etkisi

Ornek:

- Uslu ifadeler <- Carpanlar ve Katlar
- Karekoklu ifadeler <- Uslu ifadeler

Veliye teknik bagimlilik grafigi degil, sade karar cumlesi gosterilir.

Ornek veli dili:

> Karekoklu ifadelere gecmeden once Uslu ifadeler kisa tekrar istiyor.

### 20. Tahmin Guven Katmani

Veri guvenilirligi ile sistemin tahmin guveni ayrilmali.

Tahmin guven etiketleri:

- Yuksek guven
- Orta guven
- Dusuk guven

Mantik:

- 3 calisma ile uretilen oneri dusuk/orta guvenli olabilir.
- 90 calisma sonrasi uretilen oneri yuksek guvenli olabilir.
- Az veri varsa karar cumlesi kesin hukum icermemeli.

Veli dili:

> Son 3 calismaya gore on yorum.
> Daha guvenilir analiz icin birkac calisma daha gerekli.

### 21. Sessiz Arka Plan Otomasyonlari

Veri buyudukce tum analizlerin ekranda anlik hesaplanmasi performans riski olusturabilir. Bu yuzden sessiz arka plan hesaplama stratejisi olmalidir.

Planlanan otomasyonlar:

- Gece analiz ozeti olusturma
- Haftalik ozet hazirlama
- Riskleri yeniden hesaplama
- Konu onceliklerini yeniden siralama
- Hedef gerceklesme durumunu guncelleme
- Deneme trendlerini yeniden hesaplama

Bu otomasyonlar kullaniciya gereksiz bildirim uretmeden veriyi hazir tutmali.

### 22. Bildirim Stratejisi

Uyari sistemi bildirim stratejisi olmadan spam uretir. Bildirimler onem seviyesine gore ayrilmali.

Bildirim katmanlari:

- Sessiz oneri
- Normal uyari
- Kritik uyari

Kurallar:

- Ayni konu icin surekli tekrar bildirim gonderilmemeli.
- Kritik olmayan oneriler ekranda sessiz kalabilir.
- Kritik uyarilar az sayida ve eylemli olmali.
- Bildirimde mutlaka aksiyon bulunmali.

Ornek:

- Sessiz oneri: Bu hafta Fen icin 15 soru iyi olur.
- Normal uyari: Matematik soru cozumu bu hafta azaldi.
- Kritik uyari: 3 gundur calisma yok; bugune kisa plan ekleyin.

### 23. Veri Kaynagi Dogrulama

Analiz kalitesi, girilen verinin guvenilirligine baglidir. Sistem supheli calisma kayitlarini ayirt edebilmelidir.

Calisma guven siniflari:

- Guvenilir calisma
- Eksik calisma
- Supheli calisma

Supheli durum ornekleri:

- 3 saat acik kalan ama etkilesim olmayan oturum
- 10 saniyede 100 soru isaretleme
- Surekli ayni cevap paterni
- Sure girilmis ama soru/konu verisi eksik
- Baslatilip hic ilerlemeyen oturum

Bu kayitlar analizi tamamen bozmayacak sekilde dusuk agirlikla hesaba katilmali veya veliye veri eksikligi olarak yansitilmali.

### 24. Sistem Yorum Siniri

Sistem teshis, karakter yargisi veya psikolojik sonuc uretmemeli.

Yasaklanacak yorum tipi:

- Dikkat eksikligi var.
- Motivasyonu dusuk.
- Calismayi sevmiyor.
- Tembel davraniyor.

Kabul edilebilir yorum tipi:

- Son calismalarda odak suresi azaldi.
- Yarim birakilan calisma sayisi artti.
- Tekrar yapilmadiginda dogruluk dusuyor.
- Soru cozumu var ama basari henuz artmiyor.

Ilke:

> Sistem olculebilir calisma sinyali gosterir; teshis veya karakter yorumu yapmaz.

### 25. Veri Yasam Dongusu

Eski verinin etkisi net tanimlanmali. Aksi halde 3 ay onceki iyi performans, son haftadaki dususu maskeleyebilir.

Belirlenecek kurallar:

- 7 gun onceki calisma ne kadar etkili?
- 30 gun onceki calisma ne kadar etkili?
- 3 ay onceki veri agirligini kaybediyor mu?
- Trend hangi zaman penceresine gore hesaplanacak?
- Eski basari yeni dususu ne kadar maskeliyor?

Gerekli yapi:

- rolling windows
- decay logic
- recent-weight priority

Baslangic varsayimi:

- Son 14 gun: karar motorunda yuksek agirlik
- 15-90 gun: destekleyici agirlik
- 90+ gun: uzun vadeli referans, kritik karar agirligi dusuk

Ornek:

> Son 14 gun verisi karar onceliginde daha agir kullanilir; eski veri sadece genel gecmis seviyeyi anlamak icin destek olur.

### 26. Hesaplama ve Cache Stratejisi

Veri buyudukce tum analizler ekranda canli hesaplanmamali. Trend, risk, hedef ve oncelik gibi pahali hesaplamalar onceden hazirlanmali.

Hesaplama tipleri:

- Canli hesap: ekranda anlik kucuk ozetler
- Cache hesap: trend, risk, hedef ilerleme, konu onceligi
- Batch hesap: gece/haftalik ozet, deneme trendleri, LGS hazirlik durumu

Cache'lenmesi gereken alanlar:

- Ders trendleri
- Konu riskleri
- Priority engine sonuclari
- Hedef ilerleme yuzdeleri
- Deneme analizi
- Veri guven skorlari
- Grafik icin toplanmis seriler

Cache tetikleyicileri:

- Calisma tamamlandi
- Hedef guncellendi
- Deneme eklendi
- Tekrar gecikti
- Ders/konu guncellendi
- Haftalik ozet zamani geldi

### 27. Sinyal Agirliklandirma Sistemi

Tum sinyaller ayni onemde degil. Oncelik motoru sinyalleri agirliklandirmali.

Agirliklandirilacak sinyaller:

- Deneme etkisi
- Yanlis yogunlugu
- Tekrar gecikmesi
- Hedefe etkisi
- Trend yonu
- Son veri agirligi
- Veri guveni

Ilke:

- Deneme ve hedef etkisi yuksekse oncelik artabilir.
- Az veri varsa agirlik dusurulur.
- Supheli veri varsa karar etkisi azaltilir.
- Son dusus, eski yuksek basariyla tamamen maskelenmemeli.

Agirliklar UI'da gosterilmeyecek; veli sadece sade sonuc etiketi gorecek.

### 28. Cakisan Sinyal Cozumu

Bazi sinyaller celisebilir. Sistem bu durumda hangi sinyalin baskin oldugunu tanimlamali.

Ornek celiskiler:

- Soru cozumu artiyor ama dogruluk dusuyor.
- Basari artiyor ama tekrar gecikmesi kotu.
- Calisma suresi artiyor ama hedef ilerlemiyor.
- Deneme neti artiyor ama bir ders hizli dusuyor.

Cozum ilkeleri:

- Dusuk guvenli veri agresif karar uretmez.
- Dogruluk dususu, sadece soru sayisi artisiyla gizlenmez.
- Denemeye etkisi yuksek konu, daha yuksek oncelik alir.
- Tekrar gecikmesi varsa ve basari stabilse sonuc Kritik degil, Takip et olabilir.

Veli dili:

> Soru sayisi artti fakat dogruluk dustu; bu nedenle konu pekistirme onceligine alindi.

### 29. Guvenli Fallback ve On Yorum Modu

Veri eksik, celiskili veya dusuk guvenliyse sistem kesin karar uretmemeli.

Fallback durumlari:

- Az veri
- Eksik kayit
- Supheli calisma
- Celiskili sinyal
- Hedef bilgisi yok
- Deneme sayisi yetersiz

Cikti davranisi:

- Daha yumusak oneri
- Daha dusuk oncelik
- On yorum etiketi
- Veri eksigi aciklamasi
- Aksiyon yerine veri toplama onerisi

Ornek veli dili:

> Bu oneri az veriyle olusturuldu. Daha net analiz icin bu derste 2 calisma daha gerekli.

### 30. Veri Normalizasyonu

Dersler ve konu tipleri ayni davranmaz. Bu nedenle ham sayilar dogrudan karsilastirilmamali.

Ornek:

- Matematikte 40 soru normal olabilir.
- Ingilizcede 40 soru farkli anlam tasiyabilir.
- Turkce okuma/anlama verisi soru sayisindan daha onemli olabilir.

Gerekli normalizasyon:

- Ders bazli normalization
- Konu bazli normalization
- Gorev turu bazli normalization
- Deneme neti ile gunluk calisma verisini ayri degerlendirme

Ilke:

> Karsilastirma ham sayiya degil, dersin beklenen calisma davranisina gore yapilir.

### 31. Threshold Sistemi

Kritik, Dikkat, Dusuyor, Riskli gibi etiketlerin sinirlari net tabloyla tanimlanmali.

Threshold ornekleri:

- Kac gun tekrar yoksa konu Takip et olur?
- Kac gun tekrar yoksa konu Kritik olur?
- Kac puan dusus Dusuyor sayilir?
- Kac puan dusus Hizli dusuyor sayilir?
- Hangi dogruluk orani Riskli sayilir?
- Hedef yuzdesi kacin altinda Geride olur?

Ilke:

- Threshold degerleri kod icine dagitilmamali.
- Tek bir tablo/model uzerinden yonetilmeli.
- Ders bazli veya konu bazli farklilasma gerekebilir.

### 32. Event Sistemi

Sistem sadece ekran acildiginda degil, olay olustugunda analiz tetiklemeli.

Temel eventler:

- Calisma tamamlandi
- Calisma yarim kaldi
- Hedef guncellendi
- Deneme eklendi
- Konu tekrar gecikti
- Yeni ders/konu eklendi
- Veli aksiyon butonuna basti

Event sonucu:

- Ilgili cache gecersiz kilinir.
- Gerekli analiz yeniden hesaplanir.
- Kritikse bildirim kurali kontrol edilir.
- Ogrenci ekranina gorev/hedef aktarimi yapilir.

### 33. Audit ve Aciklanabilirlik

Veli karar sonucunun kisa nedenini gorebilmeli. Sistem "neden kritik?" sorusuna sade cevap vermeli.

Gosterilebilecek aciklama:

> Konu son 14 gundur tekrar edilmedi ve son 3 calismada dogruluk dustu.

Ic kayitta tutulacak izler:

- Hangi sinyaller kullanildi?
- Hangi zaman penceresi kullanildi?
- Veri guveni neydi?
- Hangi threshold tetiklendi?
- Hangi event analizi tetikledi?

UI'da teknik detay gosterilmeyecek; sadece kisa ve guven veren neden metni olacak.

### 34. Grafik Veri Yogunlugu Yonetimi

Cok fazla konu, deneme veya zaman verisi grafik okunurlugunu bozabilir.

Gerekli stratejiler:

- aggregation
- grouping
- adaptive simplification
- top-risk gosterimi
- eski veriyi sikistirma
- uzun konu adlarini liste/tooltipte tutma

Ornekler:

- Gunluk veri cok uzunsa haftalik birlestirme kullan.
- 100 konu varsa sadece ilk 5 oncelikli konuyu goster.
- Eski denemeleri trend cizgisinde sikistir, son denemeleri daha belirgin tut.



### 35. Implementation-Level V1 Kurallari

Bu bolum uygulamaya gecis sirasinda baslangic kurallari olarak kullanilacak. Degerler ilk surum varsayimidir; test verisi ve gercek kullanimla ayarlanabilir.

#### Veri Yaslanma / Decay V1

Karar motorunda son veri daha baskin olmali.

Baslangic agirliklari:

| Zaman penceresi | Karar agirligi | Kullanim amaci |
| --- | ---: | --- |
| Son 7 gun | %45 | Guncel durum ve hizli dusus/yukselis |
| 8-30 gun | %35 | Kisa/orta vade aliskanlik |
| 31-90 gun | %15 | Genel seviye referansi |
| 90+ gun | %5 | Tarihsel arka plan, kritik karar icin dusuk etki |

Priority engine icin ozel kural:

- Son 14 gun toplam karar etkisinin en az %70'ini tasir.
- 15-90 gun arasi destekleyici veri olarak kullanilir.
- 90+ gun eski basari, yeni dususu maskeleyemez.

Deneme analizi icin:

- Son 3 deneme ana trendi belirler.
- Son 6 deneme genel yonu destekler.
- Daha eski denemeler sadece gecmis referans olur.

#### Threshold V1

Etiketler tek bir threshold tablosundan gelmeli; kod icine dagilmamali.

| Etiket | Baslangic kurali |
| --- | --- |
| Guclu | Basari >= %85 |
| Dengeli | Basari %70-84 |
| Dikkat | Basari %55-69 |
| Destek gerekiyor | Basari < %55 |
| Yukseliyor | Son pencere onceki pencereye gore +8 puan veya daha fazla |
| Dusuyor | Son pencere onceki pencereye gore -8 puan veya daha fazla |
| Hizli dusuyor | Son pencere onceki pencereye gore -15 puan veya daha fazla |
| Soru cozumu azaldi | Son 7 gun soru sayisi onceki 7 gune gore %30+ dusus |
| Calisma yok uyarisi | 3 gun calisma yok |
| Kritik calisma yok | 5 gun calisma yok |
| Tekrar takip | Konu 14 gun tekrar edilmedi |
| Tekrar dikkat | Konu 21 gun tekrar edilmedi |
| Kritik tekrar | Konu 30 gun tekrar edilmedi ve basari < %70 |
| Hedef iyi | Donem ilerlemesine gore hedef >= %90 |
| Hedef dikkat | Donem ilerlemesine gore hedef %70-89 |
| Hedef geride | Donem ilerlemesine gore hedef < %70 |

Notlar:

- Ders ve konu tipine gore threshold ileride ozellestirilebilir.
- Az veri durumunda etiketler kesin hukum olarak degil, on yorum olarak uretilir.

#### Conflict Resolution V1

Cakisan sinyallerde baskin karar kurallari:

| Durum | Baskin karar |
| --- | --- |
| Soru sayisi artiyor, dogruluk dusuyor | Pekistirme / Dikkat; sadece calisma artisi olumlu sayilmaz |
| Basari artiyor, tekrar gecikmesi kotu | Takip et; kritik degil ama tekrar onerilir |
| Deneme neti artiyor, bir ders hizli dusuyor | Ders bazli Dikkat; genel net artisiyla gizlenmez |
| Calisma suresi artiyor, hedef ilerlemiyor | Plan verimi dusuk; hedefe donuk gorev onerilir |
| Veri guveni dusuk, risk sinyali yuksek | Kritik yerine Dikkat veya On yorum |
| Supheli kayit cok, basari yuksek | Basari dusuk guvenle isaretlenir; agresif olumlu yorum verilmez |

Genel ilke:

- Dogruluk dususu soru sayisi artisiyla maskelenmez.
- Deneme/LGS etkisi yuksek konu oncelikte yukari cikar.
- Dusuk confidence olan kararlar daha yumusak dille verilir.

#### Rule ve Version Yonetimi

Scoring ve karar kurallari versionlanmali.

Tutulacak alanlar:

- scoring_version
- rules_version
- threshold_version
- generated_at
- source_event_id

Neden gerekli:

- Eski analiz ile yeni analiz farkli kurallarla uretilebilir.
- Testlerde hangi karar motorunun sonucu urettigi izlenebilir.
- Gelecekte threshold degisince eski raporlar aciklanabilir kalir.

Baslangic:

- scoring_version: parent-decision-v1
- rules_version: decision-rules-v1
- threshold_version: thresholds-v1

#### Notification Cooldown V1

Spam onlemek icin ayni uyarinin tekrar gonderim araligi sinirlanmali.

| Bildirim tipi | Cooldown |
| --- | ---: |
| Ayni kritik konu uyarisi | 24 saat |
| Ayni ders basari dususu uyarisi | 48 saat |
| Calisma yok uyarisi | 24 saat |
| Hedef geride uyarisi | 48 saat |
| Deneme hedef geride uyarisi | Yeni deneme eklenene kadar tekrar yok |
| Sessiz oneri | Bildirim yok, sadece ekranda goster |

Kural:

- Kritik uyarilar az ve eylemli olmali.
- Normal uyarilar tekrar tekrar ayni metinle gonderilmemeli.
- Veli aksiyon aldiysa ilgili uyarinin tekrar zamani sifirlanabilir.

#### Event Trigger Pipeline V1

Analiz ekran acilisina bagli kalmamali; olaylar analiz pipeline'ini tetiklemeli.

| Event | Tetiklenecek isler |
| --- | --- |
| Calisma tamamlandi | Ders trendi, konu durumu, hedef ilerleme, priority cache |
| Calisma yarim kaldi | Calisma sinyalleri, veri guveni, hedef ilerleme |
| Deneme eklendi | Deneme trendi, ders bazli deneme analizi, LGS hedef durumu |
| Hedef guncellendi | Hedef gerceklesme, uyarilar, aksiyon onerileri |
| Konu tekrar gecikti | Konu onceligi, bildirim kurali |
| Veli aksiyon butonu | Ogrenci gorevi/hedefi olusturma, ilgili uyarinin kapanmasi |
| Ders/konu guncellendi | Curriculum cache, konu mapping, grafik veri serileri |

Pipeline sirasi:

1. Event kaydi olustur.
2. Etkilenen cache alanlarini gecersiz kil.
3. Gerekli analizleri yeniden hesapla.
4. Threshold ve conflict resolution uygula.
5. Bildirim cooldown kontrolu yap.
6. UI icin karar ozeti/cache guncelle.

#### Grafik Veri Yogunlugu V1

Grafikler veri buyudukce sade kalmali.

Kurallar:

- 30 gune kadar gunluk veri gosterilebilir.
- 31-180 gun arasi haftalik aggregation kullanilir.
- 180+ gun aylik veya donemsel aggregation kullanilir.
- Konu listelerinde tum konular degil, ilk 5-8 oncelikli konu gosterilir.
- Uzun konu adlari grafikte kisaltilir; tam ad detay/listede gosterilir.
- Deneme trendinde son 6 deneme belirgin, eski denemeler sikistirilmis gosterilir.
- Ders bazli grafiklerde ders sayisi artarsa yatay bar tercih edilir.

Fallback:

- Veri yogunlugu grafigi bozuyorsa sistem tablo/liste ozetine doner.
- Grafik altinda "Son veriler ozetlenerek gosterildi" gibi kisa aciklama yer alabilir.



### 36. Production Hardening V1

Bu bolum karar sisteminin sahada guvenli, izlenebilir ve geri alinabilir calismasi icin gereklidir. Core mimariyi degil, production dayanikliligini tanimlar.

#### Data Migration Stratejisi

Mevcut uygulamadaki eski kayitlar yeni karar motoruna zarar vermeden tasinmali.

Belirlenecek kurallar:

- Eski gorev kayitlari yeni calisma sinyallerine nasil maplenecek?
- Eski performans verileri yeni threshold sisteminde nasil yorumlanacak?
- Eski deneme kayitlari yeni deneme trendine nasil dahil edilecek?
- Eski cache varsa gecersiz sayilip yeniden mi uretilecek?
- Eksik alanli eski kayitlar dusuk guvenli veri mi sayilacak?

Baslangic karari:

- Yeni karar motoru acildiginda tum analiz cache'i yeniden uretilmeli.
- Eski kayitlar silinmemeli; normalize edilerek dusuk/orta guvenle sisteme alinmali.
- Migration sonucu audit notu olarak saklanmali.

#### Feature Flag ve Staged Rollout

Buyuk karar sistemi degisikligi tek seferde herkese acilmamali.

Rollout modeli:

- Eski analiz ekrani fallback olarak tutulur.
- Yeni Ebeveyn Karar Ekrani feature flag ile acilir.
- Ilk asama beta/test modu olabilir.
- Sorun halinde eski ekrana donus mumkun olmali.

Feature flag ornekleri:

- parentDecisionScreenEnabled
- parentDecisionEngineV1Enabled
- parentDecisionNotificationsEnabled
- parentDecisionActionsEnabled

#### Error State UX

Bos veri ve az veri disinda hesaplama hatalari da kullaniciya guvenli gosterilmeli.

Hata durumlari:

- Hesaplama basarisiz
- Cache bozuk
- Analiz timeout
- Sync problemi
- Migration eksik
- Grafik veri seti bozuk

UI davranisi:

- Ekran cokmemeli.
- Son saglam ozet varsa gosterilmeli.
- Hata teknik detayla degil, sade metinle anlatilmali.
- Yeniden dene / veriyi yenile aksiyonu verilmeli.

Ornek veli dili:

> Analiz su anda yenilenemedi. Son kaydedilen ozet gosteriliyor.

#### Observability ve Monitoring

Production'da karar motorunun performansi ve karar kalitesi izlenmeli.

Izlenecek metrikler:

- Event isleme suresi
- Analiz hesaplama suresi
- Cache hit/miss orani
- Hangi threshold kac kez tetiklendi?
- Kritik uyari orani
- Notification spam orani
- Grafik render/aggregation suresi
- Migration basari/hata sayisi
- Fallback ekranina dusme sayisi

Ilke:

- Monitoring cocuk verisinin icerigini tasimamali.
- Metrikler anonim/teknik olculer uzerinden tutulmali.

#### Manual Override ve Admin Tuning

Threshold ve agirliklar ileride sadece kod degisikligiyle ayarlanmamali.

Tuning alanlari:

- Threshold tuning
- Cooldown tuning
- Weighting tuning
- Decay window tuning
- Grafik aggregation limitleri
- Notification severity ayarlari

Ilk surumde bu degerler config dosyasi/tablosu olarak merkezi tutulmali. Admin UI daha sonra eklenebilir.

#### Edge-Case Policy

Belirsiz durumlar onceden kural altina alinmali.

Edge-case ornekleri:

| Durum | Baslangic davranisi |
| --- | --- |
| Hedef hic girilmedi | Hedef karti yerine hedef ekleme onerisi goster |
| Ders yarim birakildi | Tam basari hesabina katma; calisma sinyaline dusuk agirlikla ekle |
| Ayni gun 20 tekrar var | Outlier kontrolu yap; analizde agirligi sinirla |
| Veri import edildi | Migration + cache rebuild pipeline calistir |
| Deneme eksik dersle girildi | Deneme analizi dusuk guvenle uret |
| Soru sayisi var ama dogru/yanlis yok | Soru hacmi say, basari yorumunu uretme |
| Ders silindi ama eski kayit var | Eski kaydi arsivle, aktif ders kararindan cikar |

#### Idempotency

Event sistemi ayni olayi iki kez islerse duplicate sonuc uretmemeli.

Kurallar:

- Her event benzersiz event_id tasimali.
- Ayni event_id ikinci kez gelirse islenmis sayilmali.
- Ayni notification tekrar gonderilmemeli.
- Veli aksiyon butonu duplicate gorev olusturmamali.
- Cache rebuild tekrar calissa bile sonuc tutarli kalmali.

Kritik alanlar:

- Bildirimler
- Ogrenci gorevi olusturma
- Hedef guncelleme
- Deneme importu
- Migration

#### Performance Budget

Mobil ve dusuk cihazlarda karar ekrani hafif kalmali.

Baslangic limitleri:

| Alan | V1 limit |
| --- | ---: |
| Ana ekranda grafik sayisi | En fazla 2-3 |
| Ana ekranda kart sayisi | En fazla 6 ana karar karti |
| Grafik veri noktasi | En fazla 60 nokta, fazlasi aggregation |
| Konu listesi | Ilk 5-8 oncelikli konu |
| Ekran acilis hedefi | 1 saniye civari yerel veriyle |
| Tek analiz hesaplama hedefi | 200-500 ms arasi, buyuk veri cache/batch |
| 4000-6000 kayit | Canli agir hesap yok, cache/aggregation zorunlu |

#### Security ve Privacy Policy

Cocuk verisi oldugu icin gizlilik ve veri kontrolu urun seviyesinde dusunulmeli.

Politika basliklari:

- Veri silme
- Veri export
- Ebeveyn erisimi
- Cocuk paneli erisimi
- Yerel veri saklama
- Yedek/import guvenligi
- Hassas yorum sinirlari
- Bildirimlerde hassas veri gostermeme

Ilke:

- Bildirimlerde detayli cocuk performans verisi acikta gosterilmemeli.
- Export/import islemleri kullanici onayiyla yapilmali.
- Veriyi silme akisi net ve geri donus uyarili olmali.

#### Test Matrix V1

Tek tek testler yetmez; kombinasyon matrisi gerekir.

Test kombinasyonlari:

| Senaryo | Beklenen sonuc |
| --- | --- |
| Az veri + dusuk confidence | On yorum, agresif kritik yok |
| Cok veri + celiskili sinyal | Conflict resolution aciklamasi |
| Eski veri iyi + son veri dusuk | Son dusus maskelenmez |
| Supheli kayit + yuksek basari | Dusuk guvenli olumlu yorum |
| Hedef yok | Hedef ekleme onerisi |
| Deneme sayisi 1 | Trend yok, az veri mesaji |
| Ayni event iki kez | Duplicate notification/gorev yok |
| Notification cooldown aktif | Tekrar bildirim yok |
| Yogun konu listesi | Top-risk filtreleme |
| 6000 kayit | Cache/aggregation ile kabul edilebilir hiz |
| Threshold sinir degeri | Etiket dogru ve stabil |
| Cache bozuk | Son saglam ozet veya yenileme mesaji |


## Arka Planda Hesaplanacak Metrikler

Bu metrikler sistemde kalabilir ama veliye teknik isimleriyle gosterilmemeli.

- Ders basari puani
- Konu basari puani
- Soru dogruluk orani
- Cozulen soru sayisi
- Calisma suresi
- Tamamlama duzeni
- Konu tekrar ihtiyaci
- Odak kalitesi
- Verimli gun ve saat araligi
- Ders bazli ilerleme trendi
- Konu bazli risk skoru
- Son denemeye gore degisim
- Deneme net trendi
- Ders bazli deneme net degisimi
- Hedef gerceklesme yuzdesi
- Hedefe kalan fark
- Calisma aksama sinyali
- Basari dusus sinyali
- Soru cozumu azalma sinyali
- Konu oncelik sinifi
- Veri guvenilirlik seviyesi
- Oncelik motoru skoru
- Trend yonu
- Tahmin guven seviyesi
- Konu on kosul etkisi
- Supheli veri agirligi
- Veri yaslanma / decay agirligi
- Rolling window sonuc setleri
- Cache gecerlilik durumu
- Conflict resolution sonucu
- Threshold tetikleyici bilgisi
- Event tetikleyici bilgisi
- Grafik aggregation seviyesi
- Migration durumu
- Feature flag durumu
- Cache/error state durumu
- Notification cooldown durumu
- Event idempotency durumu
- Performance budget durumu
- Bildirim onem seviyesi
- Onerilen sonraki gorev

Veliye donusturulecek ifade:

- Bu ders iyi gidiyor.
- Bu ders dikkat istiyor.
- Bu konu tekrar edilmeli.
- Bu saatlerde daha verimli calisiyor.
- Bu hafta soru cozumu az kalmis.
- Calisma var ama basari beklenen kadar artmamis.
- Bu hedefe yaklasiyor.
- Bu hedefte geride.
- Bu konuda acil tekrar gerekiyor.
- Bu yorum az veriyle olusturuldu.
- Bu konu kritik oncelikte.
- Bu ders dusus trendinde.
- Bu oneri yuksek guvenle olusturuldu.
- Son veriler eski verilere gore daha agir kullanildi.
- Bu karar su sinyallerle olustu.

## Veliye Direkt Gosterilmemesi Gereken Teknik Alanlar

Bu alanlar ya kaldirilacak ya da sade yorumlara donusturulecek:

- EMA trend
- Kalibrasyon skoru
- Akademik ozguven
- Yorgunluk endeksi
- Deep work orani
- Verimlilik korelasyonu
- Retention / kalicilik egrisi teknik adi
- Hata tipi dagilimi teknik hali
- Ayni anda hakimiyet + odak + verim gibi fazla puan gosterimi
- Ham risk skoru
- Ham hedef algoritmasi
- Ham veri guvenilirlik puani
- Ham severity / urgency / confidence puanlari
- Ogrenci tip etiketi gibi sert siniflandirmalar
- Teshis, karakter veya motivasyon yargisi

## Grafik Politikasi

Grafikler az sayida, okunur ve karar odakli olmali.

Her grafik su sorulardan birini cevaplamali:

- Hangi ders daha iyi?
- Hangi ders destek istiyor?
- Bu hafta calisma arttimi azaldi mi?
- Hangi saatlerde daha verimli?
- Hangi konular tekrar istiyor?
- Hedefin ne kadari tamamlandi?
- Deneme neti artiyor mu azaliyor mu?
- Ders hedefe gore nerede?

Grafiklerde uyulacak kurallar:

- Buyuk ve bos alan kaplayan grafikler kaldirilacak.
- Her grafikte tek ana mesaj olacak.
- Grafik basligi teknik degil veli diliyle yazilacak.
- Grafik altinda kisa yorum olacak.
- Ders bazli tiklanabilir detay akisi olacak.
- Renkler iOS tasarim diline uygun, yumusak ve sinirli tutulacak.
- Uzun konu adlari grafikte tasma yapmayacak; listede veya tooltipte gosterilecek.

Grafik turleri kullanicidan alinacak.

### Grafik Turu On Karari

Kullanici tarafindan verilen MUI X Charts secenekleri icinden ilk uygun esleme:

| Ekran / ihtiyac | Grafik turu | Neden |
| --- | --- | --- |
| Haftalik / aylik / 3 aylik genel ders performansi | Line chart | Zaman icindeki yukselis/dusus net gorulur. |
| Ders bazli karsilastirma | Horizontal bar chart | Cok ders ve uzun ders adlari daha okunur kalir. |
| Ders detay performansi | Line chart + kisa durum kartlari | Secilen dersin trendi ve son durumu birlikte okunur. |
| Deneme net degisimi | Line chart + hedef cizgisi | Son denemeye gore artis/azalis ve hedef mesafesi netlesir. |
| Ders bazli deneme performansi | Grouped bar chart | Dersler arasi net/basari farki kolay karsilastirilir. |
| Hedef gerceklesme yuzdesi | Donut / progress ring | Tek yuzdelik hedef icin hizli okuma saglar. |
| Ders bazli hedef durumu | Stacked horizontal bar | Tamamlanan / kalan hedef ayni satirda gorulur. |
| Dogru / yanlis / bos dagilimi | Stacked bar chart | Soru cozumu kalitesi tek bakista okunur. |
| En verimli saatler | Bar chart | Saat araliklari kategori oldugu icin en temiz okuma bar ile olur. |
| Konu oncelik listesi | Liste + mini bar | Uzun konu adlari grafikte bogulmaz, karar listede kalir. |
| Uzun donem veri inceleme | Brush destekli line chart | Sadece detay ekraninda, uzun veri araligini secmek icin kullanilir. |

Kullanilmamasi gerekenler:

- Ana ekranda buyuk, bos alan kaplayan grafikler.
- Veliye net karar vermeyen cok serili karmasik grafikler.
- Pasta grafik; sadece tek yuzdelik hedef icin donut olarak sinirli kullanilabilir.
- Scatter veya cift eksenli grafikler; veli ekraninda teknik kalir.

Bekleyen karar:

- Haftalik / aylik / 3 aylik ders performansi icin grafik turu
- Ders detay performansi icin grafik turu
- Odak performansi icin grafik turu
- En verimli saatler icin grafik turu
- Konu durumlari icin grafik turu
- Soru cozme / dogru-yanlis icin grafik turu
- Deneme net trendi icin grafik turu
- Ders bazli deneme performansi icin grafik turu
- Hedef gerceklesme yuzdesi icin grafik turu
- LGS hazirlik durumu icin grafik turu
- Trend yonu icin grafik/etiket turu
- Oncelik siralamasi icin gorsel turu

## Planlanan Ekran Akisi

### Faz 1 - Karar Modeli

- Hangi metrik veliye gosterilecek belirlenecek.
- Hangi metrik arka planda kalacak belirlenecek.
- Teknik metriklerin veli dilindeki karsiliklari yazilacak.
- Ders, konu, odak ve zaman analizi ciktisi netlestirilecek.
- Deneme, hedef, uyari, olculebilir calisma sinyalleri ve veri guvenilirligi modelleri netlestirilecek.
- Oncelik motoru, trend yonu, tahmin guveni, konu bagimliligi ve veri kaynagi dogrulama modeli netlestirilecek.
- Veri yasam dongusu, decay, rolling window, threshold ve sinyal agirliklandirma modeli netlestirilecek.
- Conflict resolution ve guvenli fallback kurallari tanimlanacak.

### Faz 2 - Grafik Secimi

- Kullanici grafik turlerini verecek.
- Her grafik icin cevapladigi soru yazilacak.
- Her grafik icin veri kaynagi ve hesaplama mantigi belirlenecek.
- Gereksiz grafikler elenecek.
- Her grafik icin bos veri ve az veri davranisi belirlenecek.
- Grafik veri yogunlugu icin aggregation/grouping kurallari belirlenecek.

### Faz 3 - Ekran Sadelestirme

- Raporlar ve analiz alanindaki tekrar eden kartlar tespit edilecek.
- Teknik basliklar veli diline cevrilecek.
- Ana ekranda sadece karar ureten kartlar kalacak.
- Ders detayina inme akisi tasarlanacak.
- Deneme ve hedef alanlari ana ekran mi detay ekran mi karar verilecek.
- Uyari sistemi icin yerlesim belirlenecek.
- Bildirim katmanlari ve spam onleme kurallari belirlenecek.
- Cache ve event tetikleme akisi tasarlanacak.
- Migration, feature flag, error state ve rollback/fallback akisi tasarlanacak.
- Audit/aciklanabilirlik metinlerinin UI yeri belirlenecek.
- Observability, admin tuning ve test matrix kapsami netlestirilecek.

### Faz 4 - Uygulama

- Mevcut iOS tasarim dili korunarak UI duzenlenecek.
- Yeni grafikler mevcut yapinin icine yerlestirilecek.
- Gereksiz teknik alanlar kaldirilacak veya sade yorumlara donusturulecek.
- Ders tiklama ile ders detay gorunumu eklenecek.
- Veli aksiyon butonlari ogrenci gorev/hedef akisi ile baglanacak.

### Faz 5 - Test

- Haftalik, aylik ve 3 aylik veriyle test edilecek.
- Ders bazli tiklama akisi test edilecek.
- Uzun konu adlari test edilecek.
- Bos veri, az veri ve cok veri durumlari test edilecek.
- Veli dili okunabilirlik testi yapilacak.
- Deneme sinavi ve hedef senaryolari test edilecek.
- Uyari sistemi senaryolari test edilecek.
- Veli aksiyon butonlarinin ogrenci ekranina dusmesi test edilecek.
- 4000-6000 kayit hedefiyle performans testi tekrar calistirilacak.

## Kabul Kriterleri

- Veli ilk 10 saniyede genel durumu anlayabilmeli.
- Her grafik tek bir karar sorusuna cevap vermeli.
- Ders bazli performans haftalik, aylik ve 3 aylik gorulebilmeli.
- Bir derse tiklaninca o dersin detay performansi acilmali.
- En verimli gun/saat bilgisi sade bicimde gorunmeli.
- Teknik terimler ana ekranda yer almamali.
- Mevcut iPhone / iOS arayuz hissi korunmali.
- Gereksiz tekrar eden alanlar kaldirilmali.
- Uzun konu adlari arayuzu bozmamali.
- Hesaplamalar test verisiyle dogrulanmali.
- Deneme net degisimi ve ders bazli deneme performansi gorulebilmeli.
- Hedef gerceklesme yuzdesi veliye sade bicimde gosterilmeli.
- Kritik durumlarda veli uyarisi olusmali.
- Oneriler aksiyon butonuyla goreve/hedefe donusebilmeli.
- Az veri durumunda ekran yaniltici sonuc gostermemeli.
- LGS hedef modu acildiginda kalan sure, hazirlik ve deneme trendi gorulebilmeli.
- Oncelik motoru kritik/dikkat/takip/stabil etiketlerini dogru uretmeli.
- Trend yonu yukseliyor/stabil/dusuyor/hizli dusuyor olarak gorulebilmeli.
- Tahmin guveni az veri ile cok veri arasinda ayrim yapmali.
- Supheli calisma kayitlari analizi yaniltmamali.
- Sistem aciklamalari olculebilir sinyallerle sinirli kalmali, teshis veya sert etiket uretmemeli.
- Eski veri son dususu maskelememeli; rolling window ve decay mantigi dogru calismali.
- Cakisan sinyallerde sistem tutarli ve aciklanabilir karar uretmeli.
- Threshold degerleri izlenebilir ve test edilebilir olmali.
- Grafikler veri yogunlugu arttiginda okunurlugunu kaybetmemeli.
- Eski kayitlar yeni karar motoruna veri kaybi olmadan normalize edilebilmeli.
- Feature flag ile yeni ekran acilip kapatilabilmeli ve eski ekran fallback olarak kalabilmeli.
- Hesaplama/cache hatasinda ekran cokmemeli, son saglam ozet veya yenileme mesaji gosterilmeli.
- Ayni event tekrar islenirse duplicate bildirim, hedef veya gorev olusmamali.
- Mobil performans limitleri ve test matrix gecmeden uygulama tamamlanmis sayilmamali.

## Sonraki Adim

Kullanici grafik turlerini verecek. Her grafik turu bu dosyaya eklenecek ve hangi veli sorusunu cevapladigi netlestirilecek. Grafik turleri kesinlesmeden kod uygulamasina gecilmeyecek.

Grafik turleri geldikten sonra her grafik icin su bilgiler yazilacak:

- Hangi ekranda yer alacak?
- Hangi veli sorusunu cevaplayacak?
- Hangi veriyle beslenecek?
- Hangi zaman filtresini destekleyecek?
- Bos veri durumunda ne gosterecek?
- Tiklaninca hangi detaya gidecek?
