# DersRotasi Analiz Mimarisi

## Amac
Cocugun performansini sadece gorev tamamlama uzerinden degil, konu hakimiyeti, plan uyumu, oturum kalitesi ve gelisim trendi uzerinden dogru okumak.

## Mevcut Durum Ozeti
Su an uygulamada analizler 4 farkli kaynaktan uretiliyor:
- gorev tamamlama verisi
- successScore
- focusScore
- performanceData

Bu parcalar tek bir akademik modelde bulusmadigi icin analizler parcali ve yer yer mantiksiz.

## Mevcut Analiz Bilesenleri

### Korunacak ama yeniden hesaplanacak
- `App.tsx` icindeki `generateReport`
- `components/child/StudyStats.tsx`
- `components/parent/ReadingAnalytics.tsx`
- `components/parent/ReportsCourseTrends.tsx`
- `components/parent/BestPeriodAnalysis.tsx`
- `components/parent/TaskTypeAnalysis.tsx`

### Mantigi korunacak ama veri kaynagi degisecek
- ders bazli trend
- en verimli saat / gun
- haftalik ozet
- kitap okuma istatistikleri

### Tamamen zayif veya hatali oldugu icin yeniden yazilacak
- `types.ts` icindeki `PerformanceData`
- eski `performanceData.correct / incorrect / timeSpent` tabanli ozetler
- sadece gorev tipi ortalamasina bakan analizler
- sadece tamamlanan gorev sayisina bakan performans yorumlari

### Uretim kararlarinda ana veri kaynagi olmayacak
- `successPoints`
- odul / rozet verisi
- sadece streak bilgisi

## Mevcut Mantik Hatalari

### 1. Gorev tamamlamak ile ogrenmek ayni sey gibi ele aliniyor
Bu su anki en buyuk hata.
Bir gorevin tamamlanmasi, o konunun ogrenildigi anlamina gelmez.
Ozellikle:
- ders calisma
- kitap okuma
- serbest calisma
icin bu cok daha belirgin.

### 2. `ders calisma` gorevlerinde basari puani guvenilir degil
Su an ders calismada `successScore = focusScore` gibi calisiyor.
Yani:
- mola azsa
- sure hedefe yakin ise
basarili sayiliyor.
Bu akademik basariyi vermez.

### 3. `kitap okuma` icin anlama olculmuyor
Su an:
- sayfa sayisi
- sure
baz aliniyor.
Ama:
- anlama
- ozetleme
- duzey uygunlugu
- sureklilik
ayri degerlendirilmedigi icin okuma analizi eksik.

### 4. `PerformanceData` fazla sig
Su an sadece sunlar tutuluyor:
- correct
- incorrect
- timeSpent
Bu veri yapisi ile:
- unite bazli analiz
- konu bazli hakimiyet
- tekrar etkisi
- plan uyumu
- zayif konu trendi
cikmaz.

### 5. Gorev turu analizi tek basina yaniltici
`TaskTypeAnalysis.tsx` su an gorev turu bazli ortalama puan ve sure gosteriyor.
Bu yaniltici olabilir cunku:
- soru cozme daha zor olabilir
- kitap okuma daha hafif olabilir
- ders calisma hazirlik oturumu olabilir
Yani gorev tipi ile akademik zorluk ayni degil.

### 6. En verimli saat analizi orneklem yanilgisina acik
`BestPeriodAnalysis.tsx` tamamlanan gorevlerin saatine bakiyor.
Ama:
- az veri varsa anlamsiz olur
- kolay gorevler belli saatlerde toplanmis olabilir
- zor konu saat etkisini bozar
Bu analiz yardimci olabilir ama ana karar verici olamaz.

### 7. Ders bazli analiz yetmez
Ders bazli ortalama performans tek basina zayiftir.
Dogru katman su olmali:
- ders
- unite
- konu
- gerekirse gorev tipi

### 8. Plan uyumu analizi henuz ayrismis degil
Cocuk:
- planli gorevi zamaninda yapti mi
- erteledi mi
- serbest calisma ile acik kapatti mi
- hangi gunler sapma var
bunlar ayri skor olmalý.
Su an net degil.

## Dogru Analiz Katmanlari

### 1. Oturum Performansi
Her tekil calisma icin hesaplanir.
Alanlar:
- actualDuration
- breakTime
- pauseTime
- correctCount
- incorrectCount
- pagesRead
- taskType
- plannedDuration

Uretilen skorlar:
- `sessionFocusScore`
- `sessionAccuracyScore`
- `sessionCompletionScore`
- `sessionEfficiencyScore`

### 2. Konu Hakimiyeti
Bu sistemin ana metrigidir.
Her `ders > unite > konu` icin tutulur.

Bakilan seyler:
- bu konuda kac oturum var
- son 3 oturum trendi
- soru dogrulugu artiyor mu
- sure verimliligi artiyor mu
- tekrar sonrasi gelisim var mi
- bu konu hep erteleniyor mu

Uretilen skor:
- `topicMasteryScore`

### 3. Plan Uyumu
Haftalik plan ile gercekleseni karsilastirir.

Bakilan seyler:
- zamaninda baslama
- zamaninda bitirme
- planli gorev tamamlama
- ertelenen gorev orani
- plan disi ama faydali serbest calisma

Uretilen skor:
- `planAdherenceScore`

### 4. Tutarlilik ve Ritim
Cocugun duzenini olcer.

Bakilan seyler:
- ardisik gun calisma
- haftalik dalgalanma
- belli derslerde duzen
- gorev yarim birakma oraný

Uretilen skor:
- `consistencyScore`

### 5. Toparlanma Gucu
Zayif konudan ne kadar hizli ciktigini olcer.

Bakilan seyler:
- dusuk basari sonrasi tekrar var mi
- ikinci/ucuncu denemede artis var mi
- zayif konu tekrar planina uyuluyor mu

Uretilen skor:
- `recoveryScore`

## Gorev Tipine Gore Degerlendirme Kurali

### Soru cozme
Ana akademik performans kaynagi.
En guvenilir veri:
- dogruluk
- sure
- tekrar trendi

### Ders calisma
Tek basina akademik basari kaniti degil.
Bu gorevler:
- hazirlik
- konuya maruz kalma
- duzen
- odak
olarak degerlendirilir.
Konu hakimiyetine etkisi dolayli olur.

### Kitap okuma
Ayri bir okuma performans modeli ister.
Su anlik:
- sure
- sayfa
- duzen
ile olculur.
Ileride eklenmeli:
- kisa ozet
- mini kavrama sorusu
- seviye uygunlugu

### Serbest calisma
Degerli ama ayri raporlanmali.
Plan uyumunu bozmasin diye:
- planli gorevlerden ayri
- ancak destekleyici calisma olarak izlenmeli.

## Yeni Veri Modeli
Mevcut `Task` kalacak ama analiz icin turetilmis katman eklenecek.

### Yeni turetilmis yapilar
- `SessionMetrics`
- `TopicMetrics`
- `CourseMetrics`
- `PlanMetrics`
- `ReadingMetrics`

### `SessionMetrics`
- taskId
- courseId
- unitName
- topicName
- taskType
- sessionFocusScore
- sessionAccuracyScore
- sessionEfficiencyScore
- completionDate

### `TopicMetrics`
- courseName
- unitName
- topicName
- totalSessions
- totalQuestionTasks
- averageAccuracy
- averageFocus
- averageEfficiency
- lastTrendDirection
- masteryScore
- needsRevision

### `PlanMetrics`
- week
- assignedTaskCount
- completedTaskCount
- lateTaskCount
- postponedTaskCount
- adherenceScore

## Parent Ekraninda Olacak Analizler

### Ana Panel
- genel durum ozet kartlari
- plan uyumu
- en zayif 5 konu
- en cok gelisen 5 konu
- bu hafta riskli dersler

### Ders Bazli Analiz
- ders genel puani
- unite bazli dagilim
- ders trendi
- sure / dogruluk dengesi

### Unite ve Konu Bazli Analiz
- unite bazli hakimiyet haritasi
- konu bazli zayiflik listesi
- tekrar gerektiren konular
- yeni guclenen konular

### Plan Analizi
- haftalik plana uyum
- ertelenen gorevler
- plan disi serbest calisma etkisi
- tamamlanmayan kritik konular

### Okuma Analizi
- okuma ritmi
- tur dagilimi
- sure ve sayfa dengesi
- ileride kavrama bazli genisletme

## Cocuk Ekraninda Kalacak Ozetler
Cocuk tarafi agir analiz ekrani olmayacak.
Kalacak seyler:
- bugun tamamlanan gorev
- haftalik puan
- calisma duzeni ozeti
- basit gelisim bildirimi
- motive edici kisa yorum

## Hangi Mevcut Bilesen Ne Olacak

### `App.tsx` icindeki `generateReport`
Kalacak ama yeni metric selector kullanacak.

### `components/parent/TaskTypeAnalysis.tsx`
Yeniden yazilacak.
Tek gorev turu ortalamasi yerine:
- gorev tipi + konu zorlugu + sonuc guveni
katmani eklenecek.

### `components/parent/BestPeriodAnalysis.tsx`
Kalacak ama sadece yardimci analiz olacak.
Ana karar verici olmayacak.

### `components/parent/ReportsCourseTrends.tsx`
Kalacak ama kaynak veri `TopicMetrics` ve `SessionMetrics` olacak.

### `components/parent/ReadingAnalytics.tsx`
Kalacak ama basari puani yerine okuma ritmi ve kavrama hazir modeliyle duzeltilecek.

### `components/child/StudyStats.tsx`
Kalacak ama sade ozet olarak kalacak.

### `types.ts -> PerformanceData`
Buyuk olcude etkisiz hale gelecek veya migration sonrasi sade yardimci ozet veri olacak.
Ana analiz kaynagi olmayacak.

## Uygulama Sirasi
1. Analiz veri turetme katmanini yaz
2. Konu/unite bazli `TopicMetrics` hesapla
3. Parent ana analiz ekranini bu veriye bagla
4. Ders trend ve plan uyumu ekranlarini bagla
5. Okuma analizini ayri duzelt
6. Cocuk ozet ekranini sade tut
7. Sonra AI ozetlerini bu gercek verilere bagla

## Ana Kural
Bu uygulamada dogru performans analizi su soruya cevap vermeli:
- Cocuk sadece gorev tamamliyor mu?
- Yoksa belirli konularda gercekten gelisiyor mu?

Bizim yeni mimaride ana cevap ikinci soru olacak.
