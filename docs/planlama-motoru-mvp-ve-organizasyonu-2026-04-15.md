# Planlama Motoru MVP ve Organizasyonu

## Belgenin Amaci

Bu belge, DersRotasi icindeki planlama motorunun urun mantigini, veri yapisini, karar kurallarini ve gelistirme sirasini tek dosyada toplar.

Bu belge dogrudan kod spesifikasyonu degildir.
Ama kodlama oncesi urun, mimari ve karar mantigi icin ana referans dokumandir.

Bu dosyanin hedefi su 5 soruya cevap vermektir:

1. Sistem hangi ana katmanlardan olusacak?
2. Plan nasil uretilecek ve nasil guncellenecek?
3. Analiz plani neye gore degistirecek?
4. Ebeveyn ve cocuk tarafinda akis nasil isleyecek?
5. Ilk surumde ne yapilacak, ne ertelenecek?

## Ana Urun Yaklasimi

Sistem tek bir gorev listesi mantigiyla calismayacak.

Arayuz tarafinda ana kural sun olacak:

- mevcut ekran akisi korunacak
- mevcut bilgi mimarisi bozulmayacak
- yeni yetenekler, mevcut arayuzun icine kontrollu eklemeler olarak yerlestirilecek
- plan motoru guclendirilirken arayuz akisi yeniden kurulmayacak

Bu, urun gelistirme boyunca sabit bir kisit olarak kabul edilir.

Asagidaki 5 katman birbirinden ayrilacak:

1. Schedule
Haftalik okul ve uygun calisma zamani omurgasi.

2. Curriculum
Ders, unite, konu hedef havuzu.

3. Plan
Haftalik olarak uretilen ve cocuga atanabilen calisma akisi.

4. Session / Assessment
Planlanan degil, gercekte yapilan calisma ve olculen sonuc.

5. Analysis / Decision Engine
Sadece rapor ureten degil, plani guncelleme karari da verebilen katman.

Ana ilke:

- calisildi != ogrenildi
- planlandi != uygulandi
- uygulandi != basarili olundu

Bu ayrim bozulursa urun hizla karisir.

## Cekirdek Urun Hedefi

Ilk surumde tum olasi senaryolari cozmeye calismayacagiz.
Once cekirdek urun kurulacak.

Ilk surumun amaci:

1. Haftalik okul programini sabitlemek
2. Mufredati konu havuzu olarak girmek
3. Haftalik plani otomatik uretmek
4. Cocuk tarafina aktif plan atamak
5. Gerceklesen calismalari ayri kaydetmek
6. Basit risk motoru ile yeniden planlama onermek
7. Ebeveyn onayi ile plani guncellemek

Ek urun kisiti:

8. Mevcut ebeveyn ve cocuk ekranlarinin temel akis yapisi bozulmadan bu mantigi yerlestirmek

## Varsayilan Calisma Modu

Ilk surum varsayilan modu:

`ebeveyn onayli otomatik`

Anlami:

1. Sistem plan onerisi uretir
2. Sistem risk algiladiginda yeni plan onerisi olusturur
3. Yeni plan ebeveyn onayi olmadan aktiflesmez
4. Cocuk sadece aktif plan surumunu gorur

Ileri surumlerde eklenebilecek modlar:

1. Tam otomatik
2. Sadece oner
3. Plansiz izleme modu
4. Mudahale modu

Ama ilk surumde ana mod tek tutulacak.

## Cekirdek Veri Modelleri

### 1. Schedule

Haftalik okul programi ve uygun calisma zaman penceresi.

Amaç:
- cocugun ne zaman musait oldugunu bilmek
- plan bloklarini okul saatleriyle cakistirmamak
- zaman penceresine kalite etiketi vermek

Onerilen ana alanlar:

```ts
interface ScheduleDayWindow {
  startTime: string;
  endTime: string;
  quality: 'light' | 'medium' | 'deep';
}

interface ScheduleLessonBlock {
  id: string;
  courseId?: string;
  courseName: string;
  startTime: string;
  endTime: string;
  note?: string;
}

interface ScheduleDay {
  dayName: string;
  schoolBlocks: ScheduleLessonBlock[];
  availableWindows: ScheduleDayWindow[];
  confirmed: boolean;
}
```

### 2. CurriculumTopic

Mufredatin cekirdek parcasidir.
Ilk surumde alt beceri yok.

```ts
interface CurriculumTopic {
  id: string;
  courseId: string;
  courseName: string;
  unitName: string;
  topicName: string;
  sequenceOrder: number;
  isRequired: boolean;
}
```

### 3. TopicStatus

Her konu icin dinamik durum katmani.

```ts
type TopicStatusValue =
  | 'new'
  | 'in_progress'
  | 'needs_revision'
  | 'risky'
  | 'stable';

interface TopicStatus {
  topicId: string;
  status: TopicStatusValue;
  lastStudiedAt?: string;
  lastAssessmentScore?: number;
  rollingAverageScore?: number;
  consecutiveRevisionCount?: number;
  nextRecommendedAction?: 'learn' | 'revise' | 'practice' | 'assess';
}
```

#### TopicStatus Guncelleme Sirasi

TopicStatus rastgele degismeyecek. Her guncelleme su sirayla yapilacak:

1. Eger ilgili assessment sonucu varsa once assessment bazli guncelleme yapilir
2. Assessment yoksa session + rolling average uzerinden guncelleme yapilir
3. Hic veri yoksa status degismez

Kural:

```text
if assessment exists:
  update status from assessment-driven rules
else if session exists:
  update status from session + rolling average
else:
  keep current status
```

Bu kural olmadan sistem sadece session gorup yanlis `stable` karari verebilir.

### 4. StudyPlan

Haftalik plan ana kaydidir.
Silinmez, surumlenir.

```ts
type StudyPlanStatus = 'draft' | 'pending-approval' | 'active' | 'archived';

interface StudyPlan {
  id: string;
  weekKey: string;
  version: number;
  status: StudyPlanStatus;
  reason:
    | 'initial-plan'
    | 'performance-drop'
    | 'revision-needed'
    | 'exam-pressure'
    | 'schedule-change'
    | 'manual-parent-update';
  generatedAt: string;
  approvedAt?: string;
  approvedBy?: 'parent' | 'system';
}
```

### 5. PlanBlock

Planin tekil bloklaridir.

```ts
type PlanBlockType =
  | 'new_learning'
  | 'revision'
  | 'question_practice'
  | 'assessment'
  | 'light_review'
  | 'compensation'
  | 'exam_prep';

interface PlanBlock {
  id: string;
  studyPlanId: string;
  dayName: string;
  startTime: string;
  endTime: string;
  courseId: string;
  courseName: string;
  topicId?: string;
  topicName?: string;
  blockType: PlanBlockType;
  priorityScore: number;
  required: boolean;
  assignmentMode: 'assigned' | 'recommended';
  sourceReason:
    | 'curriculum-flow'
    | 'revision-trigger'
    | 'exam-trigger'
    | 'manual-parent'
    | 'compensation';
}
```

### 6. StudySession

Cocugun gercekte yaptigi oturum kaydi.

```ts
interface StudySession {
  id: string;
  relatedPlanBlockId?: string;
  startedAt: string;
  endedAt?: string;
  courseId: string;
  topicId?: string;
  taskType: PlanBlockType;
  actualDuration: number;
  completed: boolean;
  completionQuality?: 'low' | 'medium' | 'high';
}
```

#### StudySession - Assessment Bag Kurali

StudySession ile AssessmentResult arasinda asagidaki kural uygulanir:

```text
if session.taskType is question_practice or assessment:
  assessment result beklenir
else:
  session tek basina yeterlidir
```

Anlami:

1. `question_practice` ve `assessment` bloklari olcme verisi uretmelidir
2. `revision`, `light_review`, `compensation`, `new_learning` gibi bloklar assessment olmadan da session olarak kaydedilebilir
3. Assessment beklenen bloklarda sonuc girilmediyse veri eksikligi olarak isaretlenebilir

### 7. AssessmentResult

Olcme sonucu.

```ts
interface AssessmentResult {
  id: string;
  courseId: string;
  topicId?: string;
  date: string;
  score: number;
  source: 'question-practice' | 'mini-quiz' | 'mock-exam' | 'school-exam';
  questionCount?: number;
  correctCount?: number;
  incorrectCount?: number;
}
```

### 8. ReplanTrigger

Yeniden planlamayi baslatan olay.

```ts
type ReplanTriggerType =
  | 'low-performance'
  | 'revision-delay'
  | 'exam-pressure'
  | 'plan-break'
  | 'schedule-change';

interface ReplanTrigger {
  id: string;
  type: ReplanTriggerType;
  createdAt: string;
  severity: 'low' | 'medium' | 'high';
  relatedCourseId?: string;
  relatedTopicId?: string;
  reasonText: string;
}
```

## Ilk Surum Karar Motoru

Karar motoru ilk surumde yalnizca olculebilir ve sade kurallarla calisacak.

### 1. Risk Durumu

Bir konu `risky` olur eger:

- son 3 ilgili calismanin ortalama basarisi `< 60`

Formul:

```text
risky if avg(last_3_scores) < 60
```

### 2. Tekrar Gerekliligi

Bir konu `needs_revision` olur eger:

- son basarili calisma uzerinden `7 gun` gecti
- ve arada tekrar calismasi yapilmadi

Formul:

```text
needs_revision if days_since_last_success >= 7 and no_revision_done
```

### 3. Kritik Risk

Bir konu `critical_risk` sinyaline girer eger:

- son 2 tekrar sonrasi artis `< 10`
- ve mevcut basari `< 65`

Formul:

```text
critical_risk if
  revision_gain_last_2 < 10
  and current_score < 65
```

Not:
Bu duzeltme onemlidir. Tek basina dusuk artis yanlis alarm uretebilir.

### 4. Hafta Ortasi Erken Uyari

Carsamba gunu kontrol:

- haftalik plan tamamlama `< %50` ise erken uyari

Formul:

```text
mid_week_warning if completion_rate_by_wednesday < 50%
```

### 5. Hafta Sonu Plan Kirilmasi

Hafta sonu kontrol:

- haftalik plan tamamlama `< %60` ise `plan_break`

Formul:

```text
plan_break if week_end_completion_rate < 60%
```

### 6. Sinav Baskisi

Sinava `<= 10 gun` kaldiginda:

- basari `< 60` ise `HIGH`
- basari `60-70` arasi ise `MEDIUM`
- basari `> 70` ise `LOW`

Formul:

```text
if days_to_exam <= 10:
  score < 60 => HIGH
  score 60-70 => MEDIUM
  score > 70 => LOW
```

## Oncelik Motoru

Planlama motoru her konuyu puanlayacak.

Formul:

```text
priority = risk + exam + revision + curriculum - fatigue
```

Ilk surum agirliklari:

- `risk`: `0-40`
- `exam`: `0-25`
- `revision`: `0-15`
- `curriculum`: `0-10`
- `fatigue`: `0-15`

### Neden Bu Dagilim?

1. Risk en guclu belirleyici olmali
2. Sinav yaklasiyorsa oncelik sert artmali
3. Tekrar ihtiyaci guclu ama baskin olmayan destekleyici etki olmali
4. Mufredat akisi dikkate alinmali ama sistemi esir almamali
5. Yorucu saat pencereleri cezalandirilmali

### Priority -> PlanBlock Donusum Kurali

Priority skoru tek basina yeterli degildir. Plan bloklarina donusum kurali sabit olmalidir.

Ilk surum mapping:

1. En yuksek puanli `top N` konu secilir
2. `N`, secilen tempoya gore belirlenir
3. Yuksek priority konular icin once `revision` veya `exam_prep`
4. Orta priority konular icin `question_practice`
5. Dusuk priority konular icin `light_review` veya ertelenme

Tempo bazli konu limiti:

- `Hafif` -> 5 konu
- `Orta` -> 8 konu
- `Yogun` -> 12 konu

Bu kural ilk surum plan ureticisini deterministic ve test edilebilir yapar.

## Zaman Penceresi Kalitesi

Bos saat yetmez.
Her saat araligi kalite etiketi alir.

### Ilk Surum Mapping

- `05:00-08:00` -> `light`
- `16:00-18:00` -> `medium`
- `18:00-20:00` -> `medium`
- `20:00+` -> `light`
- hafta sonu `10:00-13:00` -> `deep`
- hafta sonu `14:00-17:00` -> `deep`

### Ilk Surum Kullanimi

1. `light`
mini tekrar, hafif tarama, kisa soru

2. `medium`
normal konu calismasi, standart soru cozumu

3. `deep`
yeni ogrenme, uzun soru cozumu, sinav provasi

## Plan Blok Tipleri

Ilk surum standart blok seti:

1. `new_learning`
2. `revision`
3. `question_practice`
4. `assessment`
5. `light_review`
6. `compensation`
7. `exam_prep`

Bu set korunacak.
Ne eksik ne fazla.

## Plan Block Uretim Sinirlari

Ilk surumde plan uretici asiri yuk bindirmemeli.

Sabit sinirlar:

1. Hafta ici gunde en fazla `3 blok`
2. Hafta sonu gunde en fazla `4 blok`
3. Ayni gun icinde en fazla `1 deep blok`
4. Ayni gun ayni konuda arka arkaya yinelenen `2` bloktan fazlasi uretilmez

Bu sinirlar olmadan plan motoru teorik olarak dogru ama kullanimda agir bir yapi uretebilir.

## Replan Kurallari

Plan cok sik degismemeli.
Yoksa ebeveyn ve cocuk sistemi takip edemez.

### 1. Kucuk Sapma

Davranis:
- onerili mudahale uret
- aktif plani bozma

### 2. Orta Sapma

Davranis:
- hafta icine veya hafta sonuna telafi blogu ekle
- yeni surum zorunlu degil

### 3. Buyuk Sapma

Davranis:
- yeni plan surumu olustur
- ebeveyn onayina gonder

### 4. Stabilite Kurali

Ayni hafta icinde en fazla:

- `1 buyuk replan`

Bu kural kritik stabilite kuralidir.

### Compensation Blogu Kurali

`compensation` blok tipi sadece isim olarak kalmayacak, acik tetikleyicisi olacak.

Kural:

```text
if plan_break:
  create compensation blocks
  place them primarily on weekend windows
```

Ek kural:

1. Compensation bloklari mevcut haftanin kalan musait alanlarina yerlestirilir
2. Yeterli alan yoksa sonraki haftanin ilk uygun penceresine onerili blok olarak tasinir
3. Compensation bloklari yeni ogrenme yerine once eksik kalan plan bloklarini kapatmaya hizmet eder

## Plan Surumleme Kurali

Planlar silinmeyecek, surumlenecek.

Ornek:

- Hafta 14 / v1 / initial-plan
- Hafta 14 / v2 / performance-drop
- Hafta 14 / v3 / schedule-change

### Neden Surumleme Gerekli?

1. Analiz motoru plan degisimini dogru okumak icin
2. Ebeveyn neden degistigini gormek icin
3. Cocuk tarafi her zaman sadece aktif surumu gorsun diye
4. Gecmis ve sonuc karsilastirmasi yapabilmek icin

## Ebeveyn Tarafi Akisi

### A. Kurulum

1. Haftalik okul programi girilir
2. Mufredat girilir
3. Sistem haftalik plan uretir
4. Ebeveyn plani onaylar

Not:
Bu akis mevcut arayuz akisini bozmayacak sekilde yerlestirilmelidir. Ilk fazlarda yeni sayfa acmak yerine mevcut alanlara kontrollu ekleme tercih edilir.

### B. Normal Kullanım

1. Cocuk planli bloglari gorur
2. Cocuk uyguladikca session ve sonuc kaydi birikir
3. Analiz motoru bu verileri izler
4. Risk olursa ebeveyne onerili guncelleme sunulur

### C. Program Degisimi

1. Ebeveyn haftalik programi manuel degistirir
2. Sistem aktif planin guncelligini kontrol eder
3. Gerekirse yeni plan surumu onerir
4. Ebeveyn onaylarsa aktif plan degisir

### D. Risk Mudahalesi

1. Analiz zayif konu veya plan kirilmasi tespit eder
2. Replan trigger olusur
3. Sistem telafi veya yeni surum onerir
4. Ebeveyn onay verirse yeni plan aktif olur

## Cocuk Tarafi Akisi

Ilk surumde cocuk tarafi yalnizca aktif plani gorur.

### A. Gorunum

1. Gun gun
2. Saat saat
3. Hangi ders / hangi blok tipi

### B. Davranis

1. Blogu baslatir
2. Oturum tamamlanir
3. Gerekiyorsa mini olcme sonucu girilir

### C. Sonuc

1. Session kaydi olusur
2. Assessment sonucu varsa status guncellenir
3. Analiz motoru sonraki kararlar icin bunu kullanir

## Senaryo Matrisi

### 1. Iki hafta sonra konu zayiflandi

Beklenen davranis:

1. TopicStatus `risky` olur
2. ReplanTrigger `low-performance` olusur
3. Sistem telafi veya yeni surum onerir
4. Ebeveyn onay verirse plan guncellenir

### 2. Cocuk tekrar yapti ama artis yok

Beklenen davranis:

1. `critical_risk` degerlendirilir
2. Ayni tip tekrar kopyalanmaz
3. Blok tipi degistirilir
4. Gerekirse `assessment` veya `question_practice` agirligi artar

### 3. Ebeveyn fark etmedi

Beklenen davranis:

1. Sistem pasif rapor vermekle yetinmez
2. Oneri uretir
3. Gerekirse bekleyen plan guncellemesi acilir

### 4. Cocuk sabah 05:00'te calisiyor

Beklenen davranis:

1. Sabah blogu `light` kalite pencere olarak kullanilir
2. Uzun ve agir bloklar sabaha verilmez
3. Kisa tekrar veya tarama sabah icin uygundur

### 5. Okul programi degisti

Beklenen davranis:

1. Schedule degisimi algilanir
2. Aktif plan ile cakisma kontrol edilir
3. Gerekirse yeni plan surumu onerilir

### 6. Cocuk calisti ama analiz basarisiz diyor

Beklenen davranis:

1. Konu otomatik olarak `stable` sayilmaz
2. Session ile assessment ayri yorumlanir
3. Gerekirse `needs_revision` veya `risky` olur

## Uygulama Fazlari

## Arayuz Koruma Ilkesi

Gelistirme sirasinda uyulacak zorunlu urun ilkesi:

1. Mevcut arayuzun ana akis yapisi bozulmayacak
2. Yeni mantik mevcut ekranlara yerlestirilecek
3. Plan motoru kaynakli veri ve durum gelisimi, once arka plan mantigi olarak eklenecek
4. Zorunlu olmadikca buyuk ekran reorganizasyonu yapilmayacak
5. UI degisiklikleri ikinci faz iyilestirme basligi olarak ele alinacak

Bu belgeye gore once motor guclenecek, sonra arayuz iyilestirmeleri ayri karar olarak ele alinacak.

## Faz 1 - Cekirdek Plan Omurgasi

Yapilacaklar:

1. Schedule veri modelini netlestirme
2. CurriculumTopic ve TopicStatus ekleme
3. StudyPlan ve PlanBlock veri yapisini kurma
4. Surumleme mantigini ekleme
5. Arayuzu bozmadan mevcut state akisina bu modelleri baglama

Teslim sonucu:

- sistem plan surumu uretebilir ve saklayabilir

## Faz 2 - Plan Uretici

Yapilacaklar:

1. priority hesaplama
2. zaman penceresi kalite esitligi
3. blok tipi secimi
4. ilk haftalik plan uretimi
5. blok sinirlari ve tempo limitlerini uygulama

Teslim sonucu:

- sistem okul programi + mufredat ile plan uretebilir

## Faz 3 - Gerceklesen ve Sonuc Kaydi

Yapilacaklar:

1. StudySession modeli
2. AssessmentResult modeli
3. cocuk tarafinda oturum / sonuc baglantisi
4. session-assessment bag kurallarini uygulama

Teslim sonucu:

- planlanan ile gerceklesen ayrilir

## Faz 4 - Risk ve Replan Motoru

Yapilacaklar:

1. risky
2. needs_revision
3. critical_risk
4. mid_week_warning
5. plan_break
6. exam_pressure
7. replan trigger sistemi
8. TopicStatus update sirasi kurallarini uygulama

Teslim sonucu:

- analiz plan guncelleme onerisi uretebilir

## Faz 5 - Ebeveyn Onayli Guncelleme

Yapilacaklar:

1. bekleyen plan surumu akisi
2. ebeveyn onay ekranlari
3. aktif surume gecis mantigi

Teslim sonucu:

- yeniden planlama kontrollu sekilde uygulanir

## Faz 6 - Uyari ve Gecmis

Yapilacaklar:

1. plan gecmisi
2. neden degisti kaydi
3. risk uyari merkezi
4. UI akisina zarar vermeden bu gorunur durumu mevcut ekranlara yerlestirme

Teslim sonucu:

- ebeveyn ne oldugunu ve neden oldugunu gorebilir

## Ilk Surumde Bilincli Olarak Yapilmayacaklar

1. Alt beceri analizi
2. Gelismis retention modeli
3. Tam otomatik agresif plan guncelleme
4. Kisisel ritim ogrenme motoru
5. Derin okul performansi transfer modeli

## Teknik ve Urunsel Kabul Kriterleri

Bu planin ilk surumde basarili sayilmasi icin asagidaki kosullar saglanmali:

1. Haftalik ders programi girilebilmeli
2. Mufredat konu havuzu olusabilmeli
3. Sistem haftalik plan olusturabilmeli
4. Plan surumlenebilmeli
5. Cocuk aktif plan gorebilmeli
6. Session ve assessment kaydi olusmali
7. Basit risk motoru calismali
8. Replan onerisi cikmali
9. Ebeveyn onayi ile yeni plan aktiflesmeli
10. Mevcut arayuz akisi bozulmadan sistem calisabilmeli

## Nihai Hukum

Bu belgeye gore planlama motoru:

- mimari olarak uygulanabilir
- urun olarak gercekci
- ilk surum icin yeterince daraltılmis
- sonraki fazlar icin genislemeye uygun

Bu belgeden sonra gelistirme, rastgele ekran degisikligi uzerinden degil, bu cekirdek organizasyon uzerinden ilerlemelidir.
