# Okul Sinavi ve Donemsel Performans Modeli

## Amac
Uygulamadaki calisma performansini okuldan gelen gercek sonuclar ile ayni tabloda okumak.

Bu model 4 soruya cevap vermeli:
- Cocugun uygulamadaki calisma kalitesi nasil?
- Bu kalite okul notuna ne kadar yansiyor?
- Hangi derste plan var ama sonuc yok?
- Devlet sinavi ve donem sonu icin risk nerede birikiyor?

## Ana Ilke
Calisma performansi ile okul sonucu ayni sey degil.

- uygulama performansi = surec kalitesi
- okul notu = gercek cikti
- analiz motoru = ikisi arasindaki farki yorumlayan katman

Bu nedenle sistem tek skorla calismayacak. En az 3 ayri katman tutulacak:
- `studyPerformance`
- `schoolOutcome`
- `alignmentAnalysis`

## Donemsel Zaman Pencereleri
Veli tarafinda performans sabit degil, secilebilir pencere mantigiyla okunmali.

Desteklenecek ana pencereler:
- Aylik
- 3 Aylik
- Yar yil
- Donem Sonu
- Ozel Tarih Araligi

Her pencere su alanlari uretir:
- ders bazli calisma skoru
- ders bazli okul sonucu ortalamasi
- ders bazli uyum skoru
- ders bazli risk seviyesi
- genel ozet

## Yeni Veri Katmanlari

### 1. Okul Sinav Kaydi
Uygulamaya elle girilecek ana veri tipi.

Onerilen tip:

```ts
export type ExamType =
  | 'school-written'
  | 'school-quiz'
  | 'school-oral'
  | 'mock-exam'
  | 'state-exam'
  | 'report-card';

export interface ExamRecord {
  id: string;
  courseId: string;
  courseName: string;
  examType: ExamType;
  title: string;
  date: string; // YYYY-MM-DD
  termKey: string; // 2025-2026-1, 2025-2026-2 gibi
  scopeType: 'topic' | 'unit' | 'course' | 'multi-course';
  unitNames?: string[];
  topicNames?: string[];
  score: number; // 0-100
  weight?: number; // varsayilan 1
  maxScore?: number; // varsayilan 100
  notes?: string;
  source: 'manual' | 'import';
}
```

### 2. Ders Bazli Donemsel Ozet
Bu veri kalici tutulmak zorunda degil, analiz sirasinda turetilebilir.

```ts
export interface PeriodCoursePerformance {
  courseId: string;
  courseName: string;
  periodKey: string;
  studyScore: number;
  schoolScore: number | null;
  predictedSchoolScore: number | null;
  alignmentGap: number | null;
  alignmentStatus: 'uyumlu' | 'sapma-var' | 'kritik-sapma' | 'veri-yetersiz';
  trend: 'up' | 'down' | 'flat';
  riskLevel: 'dusuk' | 'orta' | 'yuksek';
}
```

### 3. Cok Dersli Sinav Sonucu
Devlet sinavi veya genis kapsamli deneme icin ayri model gerekir.

```ts
export interface CompositeExamResult {
  id: string;
  title: string;
  examType: 'state-exam' | 'mock-exam';
  date: string;
  courses: Array<{
    courseId: string;
    courseName: string;
    score: number;
    net?: number;
  }>;
  totalScore?: number;
  notes?: string;
}
```

## Hesap Mantigi

### 1. Study Score
Bu, uygulamanin kendi ic performansi.

Bu skor dogrudan mevcut analizden gelir ama donemsel pencereye gore filtrelenir.

Bilesenler:
- konu hakimiyeti
- soru dogrulugu
- odak istikrari
- plan uyumu
- tekrar devamlıligi
- geciken gorev baskisi

Onerilen agirliklar:
- konu hakimiyeti: %35
- dogruluk: %25
- plan uyumu: %15
- odak: %10
- tekrar devamlıligi: %10
- gecikme cezasi: %5

Formul:

```text
studyScore =
  mastery * 0.35 +
  accuracy * 0.25 +
  planAdherence * 0.15 +
  focus * 0.10 +
  revisionDiscipline * 0.10 +
  discipline * 0.05
```

Not:
- `discipline` burada ceza etkili normalize edilmis alt skor olarak dusunulecek.
- kitap okuma ve ders calisma gorevleri dogrudan okul notuna esit sayilmayacak.

### 2. School Score
Gercek okul sonucu.

Hesap:
- ayni ders icindeki secili zaman penceresindeki tum sinavlar alinir
- agirlik varsa agirlikli ortalama hesaplanir
- agirlik yoksa basit ortalama kullanilir

```text
schoolScore = weightedAverage(exam.score, exam.weight)
```

### 3. Predicted School Score
Bu, uygulamanin okulda kac bekledigini gosteren tahmindir.

Direkt `studyScore = predictedSchoolScore` yapilmayacak.
Araya sinava uyarlanmis donusum katmani girecek.

Onerilen model:

```text
predictedSchoolScore =
  studyScore * 0.55 +
  examReadiness * 0.25 +
  recentQuestionAccuracy * 0.20
```

Burada:
- `examReadiness`: sinav kapsamina yakin gorevlerin tamamlama ve tekrar kalitesi
- `recentQuestionAccuracy`: son 21-30 gundeki soru dogrulugu

### 4. Alignment Gap
Uygulama ile okul arasindaki fark.

```text
alignmentGap = predictedSchoolScore - schoolScore
```

Yorum:
- `-8` ile `+8` arasi: uyumlu
- `-18` ile `-9` arasi: okul sonucu beklentiden iyi
- `+9` ile `+18` arasi: okul sonucu beklenenin altinda
- `|gap| > 18`: kritik sapma

### 5. Yorum Motoru
Veliye teknik skor degil, anlamli yorum verilecek.

Ornekler:
- `studyScore 88`, `schoolScore 84`, `gap 4`: "Calisma ile okul sonucu uyumlu. Sistem dogru yone gidiyor."
- `studyScore 90`, `schoolScore 70`, `gap 20`: "Calisma guclu gorunse de bu guc okul sonucuna ayni seviyede yansimamis. Sinav formati, stres veya transfer problemi olabilir."
- `studyScore 62`, `schoolScore 78`, `gap -16`: "Okul notu beklenenden iyi. Ancak mevcut calisma duzeni korunmazsa bu seviye surdurulemeyebilir."

## Ders Bazli Karsilastirma Kurali
Karsilastirma yalnizca ayni ders icinde yapilir.

Ornek:
- Turkce studyScore = 90
- Turkce schoolScore = 70

Bu durumda sistem sunlari uretir:
- `alignmentGap = 20`
- `alignmentStatus = kritik-sapma`
- veli yorumu: "Turkce calismalari guclu gorunuyor ama okul yazilisina yansima dusuk. Sinav benzeri soru gorevleri artirilmali."

Karar kurali:
- soru bazli derslerde dogruluk ve sinav benzeri gorevler daha yuksek agirlik alir
- soyzel derslerde okudugunu anlama, yorumlama ve deneme/sinav pratigi ayri izlenir

## Devlet Sinavi Modeli
Devlet sinavi tum dersleri ayni tabloda topladigi icin ayri ozet gerekir.

### Uretilecek Alanlar
- ders bazli beklenen skor
- ders bazli gercek skor
- toplam beklenen sonuc
- toplam gercek sonuc
- en buyuk 3 riskli ders
- en buyuk 3 guclu ders
- 30 gunluk sinav hazirligi skoru

### Risk Yorumu
Ornek:
- Matematik: calisma 82, deneme 61
- Turkce: calisma 74, deneme 79

Yorum:
- Matematikte bilgi var ama sinav uygulamasi zayif
- Turkcede calisma orta ama transfer iyi

Bu, veliye dogru mudahale alanini verir.

## Veli Ekrani Tasarimi

### 1. Yeni Ana Sekme: Okul Performansi
Parent tarafta yeni bir alan eklenmeli.

Alt bolumler:
- Sinav Sonuclari
- Donemsel Karsilastirma
- Risk ve Sapma Analizi
- Devlet Sinavi Hazirligi

### 2. Sinav Sonucu Girme Ekrani
Form alanlari:
- ders
- sinav tipi
- sinav adi
- tarih
- konu/unite kapsami
- not
- agirlik
- not/yorum

### 3. Donemsel Karsilastirma Kartlari
Her ders icin:
- calisma skoru
- okul ortalamasi
- beklenen not
- fark
- yorum

Ornek kart:

```text
Turkce
Calisma Skoru: 90
Beklenen Okul Sonucu: 87
Gercek Okul Sonucu: 70
Fark: -17
Yorum: Calisma var, sinav aktarimi zayif.
```

### 4. Genel Ozet
Veliye 4 net ciktı verilmeli:
- Hangi derste emek sonuca donusuyor?
- Hangi derste plan var ama nota yansimiyor?
- Hangi derste okul notu iyi ama altyapi kirilgan?
- Devlet sinavi icin en buyuk risk nerede?

## Veri Akisi

### Kaynaklar
- `tasks`
- analiz motorundan gelen donemsel ders skorlari
- yeni eklenecek `examRecords`
- yeni eklenecek `compositeExamResults`

### Isleme Sirasi
1. secili donem/pencere belirlenir
2. o pencereye dusen gorevler filtrelenir
3. o pencereye dusen okul sinavlari filtrelenir
4. ders bazli `studyScore` hesaplanir
5. ders bazli `schoolScore` hesaplanir
6. `predictedSchoolScore` hesaplanir
7. `alignmentGap` ve yorum uretilir

## Uygulama Asamalari

### Faz 1
- `ExamRecord` veri modeli
- sinav sonucu giris ekranı
- local storage / import export uyumu

### Faz 2
- donemsel filtreleme motoru
- ders bazli `studyScore` ve `schoolScore`
- karsilastirma kartlari

### Faz 3
- `predictedSchoolScore`
- `alignmentGap`
- veli yorumlari

### Faz 4
- devlet sinavi / deneme sinavi modulu
- cok dersli analiz
- risk odakli ozet

## Import / Export Gereksinimi
Var olan yedek yapisina yeni alanlar eklenmeli:

```ts
examRecords?: ExamRecord[];
compositeExamResults?: CompositeExamResult[];
```

Geriye donuk uyumluluk kurali:
- bu alanlar yoksa bos liste olarak normalize edilir

## Kritik Tasarim Kararlari
- Okul notu uygulama skorunun aynisi kabul edilmeyecek
- Her ders kendi icinde karsilastirilacak
- Sinav kapsami bilinmiyorsa yalnizca ders bazli karsilastirma yapilacak
- Kapsam biliniyorsa unite/konu etkisi daha dogru hesaplanacak
- Devlet sinavi ayri bir toplu sinav modeli olarak ele alinacak

## Uygulanabilir Ilk Surum
En hizli deger uretecek ilk surum su olmali:
- ders bazli okul sinavi girisi
- aylik / 3 aylik / yar yil / donem sonu filtreleri
- studyScore vs schoolScore karsilastirmasi
- fark yorumu

Bu ilk surum tek basina bile veliye su sorunun cevabini verir:
"Bu uygulamadaki emek okul sonucuna donusuyor mu, donusmuyorsa hangi derste kopuyor?"