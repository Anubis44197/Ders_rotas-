# Analiz Grafik Nihai Plan, Formuller ve UX Akisi (2026-04-13)

## DEVAM NOTU (Yeni Pencere Icin Ozet)

### Uygulama Durumu Guncellemesi (2026-04-13)

1. Faz 1 baslatildi.
2. Versioned metric config eklendi (`utils/metricConfig.ts`).
3. `analysisEngine` icinde 0-1 normalize katmani eklendi.
4. `taskScore` ve `masteryContribution` hesaplari config tabanli hale getirildi.
5. `overall.generalScore` (0-100) hesabi eklendi.
6. Parent analiz kartlarinda `Genel Skor` gorunur hale getirildi.
7. Faz 2 baslatildi: risk_v1 + risk_v2 + retention/decay veri modeli eklendi.
8. `Task` ve `TaskCompletionData` alanlarina first-attempt ve error-type izleme eklendi.
9. Topic bazinda `retention1d/7d/30d`, `decayRate`, `riskScore`, `riskModel` uretiliyor.

### Kaldigimiz Yer

Analiz sistemi icin grafik ve metrik tasarimi dokumani tamamlandi. Kod uygulamasinda Faz 1 baslatildi ve temel metrik motoru devreye alindi.

### Su Ana Kadar Yapilanlar

1. Mevcut analiz ve grafik yapisi denetlendi.
2. Nihai 12 grafik seti kararlastirildi.
3. Kaldirilacak, iyilestirilecek ve eklenecek grafikler netlestirildi.
4. Metrik sozlugu (tanim + formul + girdi + not) yazildi.
5. Task score, mastery katkisi, normalization (0-1) kurallari yazildi.
6. Risk v1 ve Risk v2 formulleri yazildi.
7. Genel skor (weighted) modeli yazildi.
8. Kural motoru (minimum IF/THEN) yazildi.
9. Analiz sayfasi UX karari verildi: acilir menu + tek grafik gosterimi.
10. Faz bazli uygulama sirasi ve kabul kriterleri yazildi.

### Son Kararlar (Kilit Noktalar)

1. Analiz ekrani karma olmayacak; varsayilan tek grafik acik olacak.
2. Grafik secimi acilir menuden yapilacak.
3. Haftalik puan akisi kaldirilacak.
4. Retention + decay + genel skor + kural motoru zorunlu.
5. Tum alt metrikler normalize (0-1) olmadan genel skor uretilmeyecek.

### Siradaki Adimlar (Kod Uygulamasi Baslamadan Once)

1. Bu dokumana son onay verilecek.
2. Faz 1: metrik standardizasyonu ve genel skor.
3. Faz 2: risk v1 + retention/decay veri yapisi.
4. Faz 3: grafik donusumu (kaldir/iyilestir/ekle).
5. Faz 4: analiz UX donusumu (acilir menu + tek grafik).
6. Faz 5: build + smoke + ekran dogrulama.

### Not

Bu bolum yeni pencereye gecildiginde hizli devam icin referans olarak eklendi.

## Amac

Bu dokuman iki isi tek dosyada kilitler:

1. Analiz tarafi icin nihai 12 grafik plani + tam metrik/formul/kriter sozlugu.
2. Analiz sayfasinda grafiklerin karmasik gorunmesini engelleyen acilir menu tabanli temiz UX akisi.

## Kapsam

- Kod degisikligi bu dokumanin parcasi degildir.
- Bu dokuman onay sonrasi tek seferde uygulama icin referans plandir.

---

## Islem 1: Nihai Grafik ve Metrik Plani

## Nihai Grafik Seti (12)

### Ust Panel (4)

1. Genel skor trendi.
2. Ders bazli performans (mastery odakli).
3. Risk grafigi.
4. Mufredat kapsama.

### Analiz Paneli (4)

1. Retention egrisi (1g/7g/30g).
2. Accuracy vs Time (scatter).
3. En verimli zaman (focus + accuracy).
4. Learning efficiency.

### Davranis Paneli (2)

1. Deep work orani.
2. Gunluk trend (EMA).

### Destek Paneli (2)

1. Gorev turu analizi.
2. Okuma analitigi (sayfa + comprehension).

## Kaldirilacak / Iyilestirilecek / Eklenecek

### Kaldirilacak

- Haftalik puan akisi.

### Iyilestirilecek

- Ders bazli dagilim: sure + mastery birlikte.
- En verimli zaman: sadece skor degil focus + accuracy.
- Gunluk trend: EMA smoothing.
- Okuma analitigi: sayfa + comprehension.
- Tamamlanma hizi: normalize efficiency.

### Eklenecek

- Genel skor trendi.
- Risk grafigi.
- Mufredat kapsama.
- Retention egrisi.
- Accuracy vs Time.
- Learning efficiency.
- Deep work orani.

---

## Cekirdek Metrik Sozlugu (Tanim + Formul + Girdi + Not)

| Metrik | Tanim | Formul | Girdi Verileri | Not |
| --- | --- | --- | --- | --- |
| Accuracy | Soru gorevinde dogru oran | dogru / toplam_soru | correctCount, questionCount | 0-1 normalize |
| Focus | Aktif calisma yogunlugu | aktif_sure / (aktif_sure + pause + mola) | actualDuration, pauseTime, breakTime | aktif_sure = gercek_sure - (pause + mola) |
| Efficiency | Sure uyumu + kesinti cezasi | min(planlanan/gercek,1) * (1 - mola_orani) | plannedDuration, actualDuration, breakTime | plan asimi ve mola artisinda duser |
| Task Score | Gorev tipi bazli anlik basari | gorev tipine gore agirlikli kombinasyon | accuracy, focus, efficiency, completed | config dosyasinda versiyonlu |
| Mastery Katkisi | Bir gorevin ogrenmeye katkisi | `task_score * agirlik * sure_faktoru` | task_score, duration | konu/ders skoruna akar |
| Konu Performansi | Konu seviyesi ortalama | sum(task_score)/oturum_sayisi | topic-task history | rolling average tavsiye |
| Ders Performansi | Ders seviyesi ortalama | sum(konu_puani)/konu_sayisi | topic scores by course | konu agirligi opsiyonel |
| Trend | Yakin donem ivmesi | son_3_ortalama - onceki_3_ortalama | dated mastery/score | EMA desteklenir |
| Risk | Konu/alan riski | (1-mastery)+trend+retention+decay bilesenleri | mastery, trend, retention, decay | v1/v2 asamali |
| Learning Efficiency | Zaman basina ogrenme | mastery_artisi / harcanan_sure | mastery delta, study duration | bos calisma tespiti |
| Deep Work Ratio | Derin calisma payi | 25dk+ kesintisiz blok / toplam_sure | session blocks | kesintisiz blok tanimi zorunlu |
| Coverage | Mufredat kapsama | mastery_esigini_gecen_konu / toplam_konu | curriculum + mastery | stratejik ilerleme |

---

## Task Score Standarti (Versioned Config)

### v1 Formuller

1. Soru gorevi:
   - `task_score = 0.7 * accuracy + 0.2 * efficiency + 0.1 * focus`
2. Ders calisma:
   - `task_score = 0.5 * focus + 0.3 * efficiency + 0.2 * completion_flag`
   - completion_flag: tamamlandiysa 1, degilse 0
3. Tekrar:
   - `task_score = 0.6 * accuracy + 0.4 * retention`

## Mastery Katkisi

- `mastery_contribution = task_score * weight * duration_factor`

### Onerilen duration_factor

- duration_factor = min(actual_duration / target_duration, 1.2)
- alt sinir = 0.4, ust sinir = 1.2

---

## 0-1 Normalizasyon Standarti (Zorunlu)

| Metrik | Normalizasyon |
| --- | --- |
| Accuracy | dogru / toplam_soru |
| Focus | aktif_sure / (aktif_sure + pause + mola) |
| Efficiency | min(planlanan/gercek,1) * (1 - mola_orani) |
| Trend | trend_raw min-max veya tanh ile 0-1'e cekilir |
| Retention | test_t / ilk_skor |
| Decay | clamp((ilk_skor - skor_t) / max(ilk_skor, eps), 0, 1) |

Kural: 0-1 normalize edilmemis hicbir metrik genel_skor hesabina giremez.

---

## Retention ve Decay Katmani

## Retention

- retention_1g = test_1g / ilk_skor
- retention_7g = test_7g / ilk_skor
- retention_30g = test_30g / ilk_skor

## Mastery Decay

- `mastery_t = mastery_0 * e^(-lambda * gun)`

## Decay Rate

- decay_rate = (ilk_skor - skor_7g) / max(ilk_skor, eps)

## First Attempt Score

- first_attempt_score = ilk_testteki_dogruluk

## Error Type Breakdown

- concept_error_rate = concept_errors / total_errors
- process_error_rate = process_errors / total_errors
- attention_error_rate = attention_errors / total_errors

---

## Risk Modeli

### Risk v1 (gecici - retention/decay yokken)

- risk_v1 = (1 - mastery_norm) + negatif_trend_bonus
- negatif_trend_bonus:
  - trend < 0 ise +0.15
  - trend cok negatifse +0.25

### Risk v2 (hedef)

- risk_v2 = (1 - mastery_norm) + negatif_trend + dusuk_retention + yuksek_decay

### Ornek bilesen tanimi

- negatif_trend = clamp(-trend_norm, 0, 1)
- dusuk_retention = clamp(0.6 - retention_7g, 0, 0.6) / 0.6
- yuksek_decay = decay_rate

---

## Genel Skor (Tek Karar Metrigi)

Minimum viable form:

```text
genel_skor =
0.30 * ortalama_mastery +
0.20 * ortalama_accuracy +
0.15 * efficiency +
0.10 * focus +
0.10 * retention +
0.10 * trend +
0.05 * discipline
```

Notlar:

1. Tum terimler 0-1 normalize olmak zorunda.
2. Skor UI'da 0-100'e donusturulup gosterilebilir.
3. Agirliklar versiyonlu config dosyasinda tutulur.

---

## Kural Motoru (Minimum Set)

| Kural | Kosul | Aksiyon |
| --- | --- | --- |
| Retention dusuk | retention_7g < 0.6 | tekrar gorevi ekle |
| Riskli konu | trend < 0 AND mastery < 0.7 | konu risk listesine al |
| Hizli ama hatali | accuracy dusuk AND sure dusuk | hiz dusurme onerisi |
| Konu anlasilmamis | accuracy dusuk AND sure yuksek | temel konu tekrar oner |
| Yuksek yorgunluk | fatigue > esik | mola/oturum bolme oner |

---

## Grafik Bazinda Hesap ve Veri Akisi

| Grafik | Veri Kaynagi | Hesaplama / Icerik | Kabul Kriteri |
| --- | --- | --- | --- |
| Genel skor trendi | tum normalize metrikler + tarih | genel_skor zaman serisi | haftalik ve gunluk gorunum |
| Ders bazli performans | task/course/topic history | ders mastery ortalamasi | sure tek basina gosterilmez |
| Risk grafigi | topic mastery + trend + retention + decay | risk_v1/v2 | retention yoksa v1 |
| Mufredat kapsama | curriculum + mastery threshold | coverage = mastered_topics / total_topics | esik configlenebilir |
| Retention egrisi | tekrar testleri | 1g/7g/30g retention | en az 2 nokta varsa ciz |
| Accuracy vs Time | soru kayitlari | scatter: x=sure, y=accuracy | outlier filtre opsiyonel |
| En verimli zaman | timestamp + focus + accuracy | saat dilimi performans ortalamasi | altin saat etiketi |
| Learning efficiency | mastery delta + duration | mastery_artisi / sure | negatifte uyari verir |
| Deep work orani | oturum bloklari | 25dk+ kesintisiz / toplam sure | blok tanimi sabit |
| Gunluk trend (EMA) | gunluk skor/sure/accuracy | EMA(alpha) | noise azalmasi gorulur |
| Gorev turu analizi | taskType + task_score | tip bazli ortalama skor | destekleyici panel |
| Okuma analitigi | pagesRead + quiz/recall | sayfa + comprehension score | sayfa tek basina yeterli degil |

---

## Islem 2: Analiz Sayfasi UX (Acilir Menu ile Duzenli Gosterim)

## Problem

Tum grafiklerin ayni anda acik olmasi sayfayi karmasik hale getiriyor.

## Hedef UX

Grafikler ayni anda acik olmayacak. Kullanici acilir menuden secip tek seferde sadece istedigi grafigi gorecek.

## Onerilen Yapi

### Ustte Grafik Secici Alan

- Tek bir Grafik Merkezi karti.
- Icinde kategori bazli acilir menu:
  - Ust Panel
  - Analiz
  - Davranis
  - Destek

### Tekil Gosterim Alani

- Secilen grafik tek ana canvas alaninda acilir.
- Varsayilan: Genel skor trendi.
- Yeni secimde eski grafik kapanir.

### Opsiyonel Karsilastirma Modu

- Ikinci toggle olarak ac/kapat.
- Varsayilan kapali.

### Mobil

- Sadece dropdown + tek grafik.
- Cift kolon yok.

### Masaustu

- Sol: kategori/menuler.
- Sag: secili grafik.
- Ayni anda tek grafik acik.

## Karmasa Onleme Kurallari

1. Ayni anda maksimum 1 grafik acik.
2. Grafikler ayni viewportta alt alta yigilmaz.
3. Bos durum metni ve yukleme state standart olur.
4. Hata state tek tip kart ile gosterilir.

---

## Uygulama Sirasi (Onay Sonrasi Tek Sefer)

### Faz 1 - Metrik Standardi

1. versioned metric config
2. normalize katmani (0-1)
3. task_score + mastery_contribution standardizasyonu
4. genel_skor hesaplayici

### Faz 2 - Yeni Metrikler

1. risk_v1 aktiflestirme
2. retention veri modeli
3. decay modeli
4. first_attempt + error_type tracking
5. risk_v2 gecisi

### Faz 3 - Grafik Donusumu

1. kaldirilacak grafiklerin cikisi
2. iyilestirilecek grafiklerin refaktoru
3. yeni kritik grafiklerin eklenmesi

### Faz 4 - UX Donusumu

1. grafik merkezi acilir menu
2. tekil grafik paneli
3. mobil/masaustu sade layout

### Faz 5 - Dogrulama

1. veri yok/az/cok testleri
2. performans testleri
3. kullanilabilirlik ve okunabilirlik testi

---

## Kabul Kriterleri

1. Analiz ekraninda varsayilan olarak yalnizca 1 grafik gorunur.
2. Grafik secimi acilir menuden yapilir.
3. 12 grafik seti tanimli ve kategorize edilmis olur.
4. Haftalik puan akisi kaldirilmis olur.
5. Genel skor yalnizca normalize metriklerle uretilir.
6. Retention/decay yoksa risk_v1, geldikten sonra risk_v2 calisir.
7. Okuma analitigi sayfa + comprehension birlikte uretir.
8. First Attempt ve Error Type metrikleri raporlanir.

---

## Onay Kapisi

Dokuman detaylandirildi.
Sonraki adim kod uygulamasidir.
Kod degisikligine gecmeden once acik onay alinacaktir.
