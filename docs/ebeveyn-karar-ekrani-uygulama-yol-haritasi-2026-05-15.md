# Ebeveyn Karar Ekrani Uygulama Yol Haritasi - 2026-05-15

Bu dosya buyuk karar ekrani planinin uygulama sirasini ve kapsam katmanlarini netlestirir. Ana plan detayli mimari kayit olarak kalir; uygulamada bu yol haritasi takip edilir.

## Katman 1 - Core V1

Mutlaka ilk surumde cikacak cekirdek alanlar:

- Ebeveyn karar ozeti
- Ders bazli performans
- Ders detay akisi
- Trend yonu: yukseliyor / stabil / dusuyor / hizli dusuyor
- Sayac / mola / duraklatma metriklerinin korunmasi
- Threshold V1 tablosu
- Basic weighting modeli
- Priority engine V1: Kritik / Dikkat / Takip et / Stabil
- Conflict resolution V1
- Hedef sistemi V1
- Deneme analizi V1
- Olculebilir calisma sinyalleri
- Bos veri / az veri / on yorum modu
- Basic cache + event pipeline
- Notification V1: sessiz oneri / normal uyari / kritik uyari
- Veli aksiyon butonlari: gorev/hedef olusturma
- Ogrenci ekranina gorev/hedef yansitma
- Grafikler: kullanicinin verecegi secilen temel grafikler

Core V1 hedefi:

- Veli ilk 10 saniyede genel durumu anlamali.
- Her grafik tek karar sorusuna cevap vermeli.
- Ders tiklaninca ders detayina inmeli.
- Oneri aksiyona donusebilmeli.
- Teknik terimler ana ekranda gorunmemeli.

## Katman 2 - V1.5 Stabilizasyon

Core V1 calistiktan sonra saglamlastirma ve kalite katmani:

- Data migration ve cache rebuild
- Feature flag / eski ekran fallback
- Error state UX
- Notification cooldown detaylari
- Audit/aciklanabilirlik metinleri
- Grafik aggregation ve top-risk filtreleme
- Performance budget tuning
- Observability temel metrikleri
- Test matrix genisletme
- Edge-case policy uygulamasi
- Event idempotency kontrolleri
- Threshold/config merkezi yonetim hazirligi

V1.5 hedefi:

- Sistem bozuldugunda ekran cokmemeli.
- Eski veriler kayipsiz normalize edilmeli.
- Bildirim spam uretmemeli.
- 4000-6000 kayitta ekran hizli kalmali.

## Katman 3 - V2 Ileri Sistemler

Ilk surum sonrasi dusunulecek daha derin sistemler:

- Gelismis ders/konu normalization
- Gelismis weighting modeli
- Daha kompleks prerequisite graph
- Adaptive thresholds
- Predictive scheduling
- Daha detayli LGS hazirlik modellemesi
- Admin tuning arayuzu
- Gelismis monitoring paneli
- Uzun vadeli ogrenme/veri yaslanma optimizasyonlari

V2 hedefi:

- Sistem daha akilli ve ayarlanabilir hale gelir; fakat Core V1 cikisini geciktirmez.

## Implementation Sirasi

1. Karar modeli
2. Threshold + weighting modeli
3. Priority engine
4. Trend engine
5. Cache/event pipeline
6. Ders bazli performans ve ders detay akisi
7. Bos veri / az veri / guvenli fallback
8. Notification V1
9. Hedef sistemi
10. Deneme sistemi
11. Grafikler ve grafik veri yogunlugu kurallari
12. Veli aksiyon butonlari ve ogrenci ekranina yansitma
13. Production hardening: migration, feature flag, error state
14. Monitoring / observability
15. Test matrix ve 4000-6000 kayit dogrulamasi

## Su An Yapilmayacaklar

Core V1'i geciktirmemek icin ilk uygulama turunda ertelenecekler:

- Gelismis prerequisite graph
- Predictive scheduling
- Adaptive threshold sistemi
- Admin tuning arayuzu
- Gelismis monitoring paneli
- Cok detayli normalization modelleri

## Grafik Karari Bekleyen Alanlar

Kullanici grafik turlerini verdikten sonra her grafik icin su kararlar yazilacak:

- Hangi Core V1 ekraninda yer alacak?
- Hangi veli sorusunu cevaplayacak?
- Hangi veriyle beslenecek?
- Haftalik / aylik / 3 aylik filtrelerden hangisini destekleyecek?
- Bos veya az veride ne gosterecek?
- Tiklaninca hangi ders/konu detayina gidecek?

Ilk grafik esleme karari:

- Genel ders performansi: line chart.
- Ders bazli karsilastirma: horizontal bar chart.
- Ders detay trendi: line chart.
- Deneme net trendi: line chart + hedef cizgisi.
- Ders bazli deneme performansi: grouped bar chart.
- Hedef gerceklesme: donut / progress ring.
- Ders bazli hedef durumu: stacked horizontal bar.
- Dogru / yanlis / bos dagilimi: stacked bar chart.
- En verimli saatler: bar chart.
- Konu onceligi: liste + mini bar.
- Uzun donem detay inceleme: brush destekli line chart, sadece detay ekraninda.

## Uygulama Ilkesi

Mevcut iPhone / iOS tasarim dili korunacak. Renk paleti, kart sekilleri, radius, golge, cam yuzey ve buton dili degistirilmeyecek. Ana ekranda gereksiz teknik alanlar temizlenecek. Detayli hesaplamalar arka planda kalacak; veliye sadece sade karar, guvenli aciklama ve uygulanabilir aksiyon gosterilecek.

Sayac, mola ve duraklatma metrikleri kaldirilmayacak. Bu metrikler hesaplama motorunda calisma kalitesi, sure uyumu, oturum dengesi, verimlilik, veri guvenilirligi ve ders/konu performansi icin ham girdi olarak kalacak. Veli ekraninda teknik isimlerle degil, sade karar sinyalleriyle gosterilecek.

## Bekleyen Kullanici Kararlari

- Grafik turleri kullanici tarafindan verilecek.
- Grafik turleri netlesmeden grafik implementasyonuna baslanmayacak.
- Kullanici acik onay vermeden kod degisikligi veya UI refactor uygulanmayacak.
- Bir sonraki adim once mevcut durum / degisiklik kapsami analizi, sonra grafik turleri ve ekran akisi onayi olacak.


## Uygulama Ilerlemesi - 2026-05-16

Tamamlanan Core V1 parcalari:

- Ebeveyn karar ekrani iskeleti
- Ders bazli performans ve ders detay akisi
- Konu onceligi ve tekrar gorevi aksiyonu
- Rapor ve detay grafiklerinin sade kategori yapisi
- Hedef gerceklesme alani
- Deneme net/puan trendi alani
- Ders bazli son deneme karari
- Deneme sonrasi `15 soru hedefi ver` aksiyonu

Siradaki Core V1 adaylari:

1. Bildirim/uyari V1: sessiz oneri, normal uyari, kritik uyari.
2. Az veri/error state UX: hesaplama basarisiz, cache bozuk, timeout ve sync problemi metinleri.
3. Test matrix genisletme: iki deneme trendi, hedef yok, okul kaydi yok, cok uzun ders/konu adi, mobil gorunum.
4. Grafik turleri kullanici onayli nihai esleme: MUI line, bar, pie/donut, brush secimleri.