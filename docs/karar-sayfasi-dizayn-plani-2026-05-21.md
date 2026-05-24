# Karar Sayfasi Dizayn Plani

Tarih: 2026-05-21  
Durum: Basladi

## 1) Hedef

Karar sayfasini (ebeveyn odakli) gorseldeki yerlesime tasimak:

1. Ana Ekran - Genel Bakis
2. Ders Detay Sayfasi
3. Konu Detay Sayfasi
4. Raporlar Sayfasi

Amac:
- Teknik dashboard hissini azaltmak
- Ebeveynin ilk bakista karar alabilmesini saglamak
- Tum grafiklerin canli ve veri girildikce otomatik guncellenmesini saglamak

## 2) Canli Veri ve Grafik Kriteri

Tum metrik ve grafikler mevcut state/analiz akisindan beslenecek:
- tasks
- courses
- studyPlans
- examRecords
- compositeExamResults
- deriveAnalysisSnapshot ciktilari

Kural:
- Mock/sabit skor yok
- Hesaplanan metrik yoksa "veri yok" veya "yorum icin yetersiz veri" fallback'i gosterilecek

Canli Grafik Kriterleri:
1. Derslere gore hakimiyet trendi:
   - Haftalik kumeleme ile ders bazli cizgi
   - Veri girdikce yeniden hesaplanir
2. Son 4 haftalik trend:
   - Ders/Konu detayinda secili perioda gore dinamik
3. Deneme performansi:
   - compositeExamResults bazli trend/delta
4. Konu performans/hata dagilimi:
   - task tabanli dogru-yanlis-hata alanlarindan uretilir

## 3) Ekran Bazli Uygulama Adimlari

### Adim A - Ana Ekran (Genel Bakis)

1. Yerlesim gorseldeki hiyerarsiye sabitlenecek:
   - Genel Durum
   - Bugunun Oncelik Gorevi
   - Haftalik Ozet (4 KPI)
   - Derslerin Durumu (degisim gostergeleri ile)
   - Sag kolon: Risk Alanlari + Yaklasan Sinavlar
2. "Konu -> Neden -> Bugun yapilacak -> Gorev durumu" zinciri korunacak.
3. Kart yogunlugu sade kalacak (kart icinde kart minimizasyonu).

Teslim Kriteri:
- Genel bakis tek bakista okunur
- Haftalik ozet ve degisim gostergeleri canli

### Adim B - Ders Detay Sayfasi

1. Ust bolum:
   - Ders adi
   - Period filtresi
2. Sol:
   - Buyuk ders skoru/ring
3. Sag:
   - Calisma suresi
   - Dogruluk orani
   - Soru cozum sayisi
   - Deneme performansi
4. Alt:
   - Konularin durumu listesi (progress + yuzde + etiket)
   - Son 4 haftalik trend

Teslim Kriteri:
- Secili dersin tum kritik metrikleri tek sayfada
- Konu listesi risk diline gore renklenir

### Adim C - Konu Detay Sayfasi

1. Ust:
   - Konu adi
   - Period filtresi
2. Sol:
   - Konu skoru/ring
3. Sag:
   - Calisma suresi
   - Soru cozum
   - Dogruluk
   - Tekrar ihtiyaci
4. Alt:
   - Konu performansi alt metrikleri
   - Hata dagilimi grafigi
   - Oneri/aksiyon bandi

Teslim Kriteri:
- Konu bazli zayiflik net gorulur
- Ebeveyn icin tek adimli aksiyon cikar

### Adim D - Raporlar Sayfasi

1. Sekmeli yapi:
   - Genel / Ders / Konu / Zaman
2. Ust KPI:
   - Ortalama hakimiyet
   - Toplam calisma
   - Tamamlanan gorev
   - Deneme performansi
3. Alt:
   - Derslere gore hakimiyet trendi (canli)
   - En cok gelisen konular
   - Zorlanilan konular

Teslim Kriteri:
- Haftalik rapor canli guncellenir
- Liste ve grafik birbiriyle tutarli olur

## 4) Teknik Uygulama Notlari

1. Mevcut bilesenler korunacak, moduler eklenecek:
   - ParentAnalysisWorkspace
   - AnalysisGraphCenter
   - ParentOverviewWorkspace
2. Hesaplar useMemo ile merkezi tutulacak.
3. Buyuk veride performans:
   - Gereksiz full-sort azaltilacak
   - Liste sinirlama/virtualization gerekli yerlerde kullanilacak
4. Veri fallback:
   - null/eksik veride yikilmayan durum kartlari

## 5) Dogrulama ve Test

Her adim sonrasi zorunlu:
1. npm run typecheck
2. npm run build
3. npm run smoke

Buyuk veri dogrulamasi:
4. npm run test:heavy
5. npm run test:matrix

UI davranis kontrolu:
- Kritik akislarda manuel kontrol
- Overflow/okunurluk/mobil kirilim kontrolu

## 6) Kabul Kriterleri

1. Gorseldeki yerlesim mantigi korunmus olmali.
2. Grafikler canli olmalı; veri girildikce otomatik guncellenmeli.
3. Mock/sabit skor olmamali.
4. Ebeveyn dilinde karar ciktisi olmalı:
   - Cocuk ne yapti?
   - Ne eksik?
   - Bugun ne yapilmali?
5. Typecheck + build + smoke temiz olmali.

## 7) Uygulama Sirasi (aktif)

1. Genel Bakis rafine (tamamlananlar)
2. Ders Detay sayfasi implementasyonu (siradaki)
3. Konu Detay sayfasi implementasyonu
4. Raporlar sayfasi yerlesim + canli trend tamamlama
5. Uctan uca test ve final duzeltmeler
