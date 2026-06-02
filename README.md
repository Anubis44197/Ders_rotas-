# 🚀 DersRotası (LGS Takip & Akıllı Çalışma Planlama Platformu)

DersRotası, ortaokul (LGS) düzeyindeki öğrencilerin ders çalışma süreçlerini akademik olarak takip etmek, düzenlemek ve optimize etmek amacıyla geliştirilmiş premium bir React + TypeScript web uygulamasıdır. 

Uygulama, hem **Öğrenci (Çocuk) Arayüzünü** hem de **Ebeveyn (Veli) Karar ve Planlama Arayüzünü** tek bir çatı altında birleştirir. Firebase veya harici bir sunucu bağımlılığı olmadan, verileri tamamen tarayıcı üzerinde yerel olarak saklayan (**LocalStorage**) son derece kararlı, hızlı ve güvenli bir mimariye sahiptir.

---

## 🛠️ Teknoloji Stack

* **Çekirdek:** React 19 (En son kararlı sürüm)
* **Tip Güvenliği:** TypeScript (Strict Mode)
* **Derleme ve HMR:** Vite
* **Stil & Tema:** Tailwind CSS + Vanilla CSS (Açık ve Koyu Tema desteği)
* **Grafik Altyapısı:** Recharts & Akıllı SVG Fallback (Geliştirme ortamında kilitlenmeyen hafif modül yapısı)
* **Veri Yönetimi:** LocalStorage tabanlı yerel veri motoru ($O(N)$ doğrusal işlem bütçeli şişme koruması)

---

## 📂 Dosya ve Klasör Yapısı

```text
DersRotası/
├── components/
│   ├── child/          # Öğrenci (Çocuk) paneli, aktif çalışma zamanlayıcı ve ödüller
│   ├── parent/         # Ebeveyn paneli, planlama zeminleri, karar ve analiz modülleri
│   └── shared/         # Ortak bileşenler (ikonlar, modal pencereleri, hata ekranları)
├── utils/
│   ├── analysisEngine.ts   # Akademik veri analitiği ve istatistik hesaplama motoru
│   ├── parentDecisionEngine.ts # Veli kararlarını ve durum rozetlerini yöneten kural motoru
│   ├── planEngine.ts       # Haftalık ders dağılımı ve otomatik planlama motoru
│   └── taskStatus.ts       # Görev durum kontrol fonksiyonları
├── scripts/            # 6000+ kayıt yük, stres ve kabul test senaryoları
├── App.tsx             # Ana uygulama (React State, veri eşleme ve PWA entegrasyonu)
├── index.css           # Global tasarım sistemi, premium açık/koyu tema ve cam efektleri (glassmorphic UI)
├── types.ts            # Tüm veri modelleri, tip tanımlamaları ve ortak arabirimler
└── package.json        # Paket bağımlılıkları ve çalıştırma komutları
```

---

## 📦 Kurulum ve Çalıştırma

### 1. Sistem Gereksinimleri
* **Node.js:** v20 veya üzeri
* **npm:** v10 veya üzeri
* **Tarayıcı:** Modern bir Chromium tabanlı tarayıcı (Chrome, Edge, Brave, Opera vb.)

### 2. Adım Adım Kurulum
Depoyu yerel bilgisayarınıza indirin ve klasöre girin:
```bash
git clone https://github.com/Anubis44197/Ders_rotas-.git
cd Ders_rotas-
```

Gerekli tüm kütüphane bağımlılıklarını kurun:
```bash
npm install
```

Geliştirme sunucusunu Windows ve diğer tüm işletim sistemlerinde en stabil şekilde çalıştıracak foreground komutuyla başlatın:
```bash
npm run dev:stable
```

Tarayıcınızdan uygulamaya erişin:
```text
http://127.0.0.1:3000
```

---

## 🧪 Kalite ve Doğrulama Komutları

Uygulamanın kararlılığını korumak ve TypeScript derleme hatalarından arındırmak amacıyla geliştirilmiş test komutları:

```bash
# 1. Statik tip kontrolünü çalıştırır (0 hata garantili):
npm run typecheck

# 2. Üretim (Production) paketini derler ve doğrular:
npm run build

# 3. Temel veri akışlarının doğruluğu için smoke testlerini çalıştırır:
npm run smoke

# 4. En yüksek hacimli (6000+ kayıt) senaryolarda hız ve şişme koruması testi yapar:
npm run test:heavy
```

---

## 🖥️ UYGULAMA MODÜLLERİ VE KART DETAYLARI

Uygulama, **Öğrenci (Çocuk)** ve **Ebeveyn** olmak üzere iki ana işletim paneline ayrılır.

---

### 1. ÖĞRENCİ (ÇOCUK) PANELİ (`ChildDashboard.tsx`)

Öğrencinin günlük hedeflerini gördüğü, görevlerini tamamladığı, kitap okuma sürelerini girdiği ve kazandığı başarı puanlarıyla ödüller alabildiği motivasyonel alandır.

#### 📌 Aktif Görev Takip ve Zamanlayıcı Kartı (`ActiveTaskTimer.tsx`)
* **İşlevi:** Öğrencinin o an seçip başladığı ders çalışma veya soru çözme görevinin süresini saniye saniye tutar.
* **Tasarım Detayları:** Premium cam efekti (glassmorphism), dairesel ilerleme çizgisi ve odak koruma modu.
* **Kart Öğeleri:**
  * **Süre Sayacı:** Planlanan dakikaya göre geri sayım yapar.
  * **Mola / Duraklatma Butonları:** Öğrencinin odak sürelerini tam olarak ölçmek için mola süresini ayrı bir sayaçta biriktirir.
  * **Başarı Skoru Girişi:** Görev tamamlandığında öğrenciye "Kendini nasıl hissettin? (Kavrama seviyen 1-100)" sorusunu sorarak öz-değerlendirme verisi üretir.

#### 📌 Günlük Görev Listesi Kartı
* **İşlevi:** Ebeveyn tarafından atanan veya sistem tarafından otomatik oluşturulan bugünün görevlerini listeler.
* **Kart Öğeleri:**
  * **Görev Kartı Başlığı:** Dersin adı (örn. Matematik) ve çalışılan konu.
  * **Görev Tipi Rozeti:** Görevin "Soru Çözme", "Ders Çalışma", "Branş Denemesi" veya "Genel Deneme" olduğunu belirtir.
  * **Hedef Detayları:** Çözülmesi gereken soru sayısı veya çalışılması planlanan süre.
  * **Hızlı Tamamlama Butonu:** Zamanlayıcıyı açmadan görevi doğrudan tamamlandı olarak işaretleme modalını açar.

#### 📌 Kitap Okuma Takip Kartı
* **İşlevi:** Öğrencinin günlük kitap okuma alışkanlığını takip eder.
* **Kart Öğeleri:**
  * **Kitap Adı Girişi:** Okunan kitabın adı.
  * **Sayfa / Süre Girişi:** Kaç sayfa okunduğu ve kaç dakika harcandığı.
  * **Başarı Puanı Ödülü:** Okuma tamamlandığında haneye anında başarı puanı ekler.

#### 📌 Ödül Dükkanı (Reward Store) Kartı
* **İşlevi:** Öğrencinin kazandığı puanları ebeveyni tarafından belirlenen ödüllere dönüştürmesini sağlar.
* **Kart Öğeleri:**
  * **Toplam Başarı Puanı Göstergesi:** Cüzdandaki güncel parlayan puan rozeti.
  * **Ödül Talep Kartları:** Ödülün resmi/ikonu, adı, gerekli puanı ve "Satın Al" butonu. Gerekli puan yetersizse buton otomatik olarak pasifleşir.

---

### 2. EBEVEYN PANELİ VE İŞLETİM SEKMELERİ (`ParentDashboard.tsx`)

Velinin öğrenciyi akademik olarak izlediği, akıllı kararlar aldığı, hedefler koyduğu ve haftalık ders programını yönettiği kontrol merkezidir.

---

#### A. GENEL BAKIŞ SEKMESİ (`ParentOverviewWorkspace.tsx`)
Ebeveynin uygulamayı açtığında karşılaştığı, öğrencinin en güncel durumunu gösteren **tek sütunlu ferah ve premium** giriş ekranıdır.

##### 1. Bugünkü Durum Özeti (Ana Kart)
* **İşlevi:** Öğrencinin bugünkü planlanan görevlerini, kaçını bitirdiğini ve genel başarı oranını tek bir premium panelde sunar.
* **Öğeleri:**
  * **Bugün Tamamlanan Görevler Grafiği:** Halka şeklinde (Doughnut) günlük tamamlama oranı.
  * **Günlük Başarı Puanı:** Bugün kazanılan toplam başarı puanı.
  * **Gecikmiş Görev Uyarısı:** Süresi geçtiği halde tamamlanmamış görevlerin parlayan kırmızı alarm ikonuyla uyarılması.

##### 2. 6 Dersin Güncel Hakimiyet Durumu Grid Sistemi (Alt Bölüm)
* **İşlevi:** LGS'nin 6 temel dersindeki (Matematik, Türkçe, Fen Bilimleri, İngilizce, Din Kültürü, İnkılap Tarihi) öğrenme düzeylerini gösterir.
* **Kart Öğeleri:**
  * **Ders İkonu ve Adı:** Her derse ait özel premium vektörel simge (örn. Matematik için hesap makinesi, Fen için DNA sarmalı).
  * **Hakimiyet Yüzdesi:** Konulardan hesaplanan ağırlıklı akademik ortalama başarısı.
  * **İlerleme Barı:** Dersin renginde (örn. Matematik mavi, Türkçe yeşil) premium gradyan dolgulu ilerleme çubuğu.
  * **Trend Göstergesi:** Son 1 haftadaki performansa göre yukarı (yeşil) veya aşağı (kırmızı) yönlü ok rozeti.

---

#### B. KARAR / ANALİZ SEKMESİ (`ParentAnalysisWorkspace.tsx`)
Öğrencinin tüm akademik verilerinin işlendiği, zayıf olduğu konulara göre **akıllı veli aksiyonlarının** önerildiği en kritik sekmedir.

##### 1. Üst Durum Gösterge Rozetleri (Status Pills)
* **İşlevi:** Ebeveynin tek bakışta sistemin genel durumunu süzmesini sağlar. Açık ve Koyu modda dinamik kontrast ayarlıdır.
* **Rozetler:**
  * **Analiz Oturumu:** Sistemde işlenmiş toplam tamamlanan çalışma kaydı sayısı.
  * **Odak Konusu:** Öğrencinin acil destek gerektiren riskli konu sayısı.
  * **Durum:** Riskli konular varsa **"Durum: Takipte" (Kehribar rengi parlayan rozet)**, yoksa **"Durum: Stabil" (Zümrüt yeşili parlayan rozet)**.

##### 2. Henüz Yeterli Veri Yok / Brifing Kartı (Low-Data Entegrasyonu)
* **İşlevi:** Öğrencinin tamamlanmış en az 3 çalışması yoksa devreye girer. Boş ekran karmaşasını önler ve veliyi yormaz.
* **Kart Öğeleri:**
  * **Bilgilendirme Başlığı:** "Henüz yeterli veri yok" uyarısı.
  * **Açıklama:** "İlk analiz için en az 3 tamamlanan çalışma gereklidir. Veri oluştukça karar önerileri netleşecek." ibaresi.
  * **Sonraki Adım Alt Kutusu:** `ios-widget` altyapısı ile tasarlanmış, açık modda şık şeffaf bir beyaz cam, koyu modda ise premium koyu cam olarak beliren; *"Bugün en az 1 çalışma tamamlayın."* önerisini içeren yüksek kontrastlı kutucuk.

##### 3. Günlük Akış Kartı (Alt Grid - Sol)
* **İşlevi:** Öğrencinin bugün yapması gereken ders programı akışını listeler.
* **Kart Öğeleri:**
  * **Ders Zaman Dilimleri:** Dersin adı, başlangıç ve bitiş saatleri.
  * **Planı Gör Butonu:** Tıklandığında veliyi doğrudan Planlama ekranına götüren premium iOS stili interaktif buton.

##### 4. Yaklaşan Sınavlar Kartı (Alt Grid - Sağ)
* **İşlevi:** Yaklaşan yazılıları veya deneme sınavlarını veliye hatırlatır ve sınav takvimine göre ders önceliği atar.
* **Kart Öğeleri:**
  * **Sınav Detayı:** Sınavın adı ve tarihi.
  * **Akıllı Aksiyon Rozeti:** Sınava kalan güne göre rengi değişen (kritik durumlar için kırmızı, normal durumlar için mor) ders tekrarı planlama öneri rozeti.

##### 5. Öncelikli (Zayıf) Konular Kartı (Insights)
* **İşlevi:** Öğrencinin sınav başarıları ve çalışma verimlerine göre LGS genelinde acil tekrar yapması gereken konuları jilet gibi kompakt satırlar halinde listeler.
* **Kart Öğeleri:**
  * **Konu Başlığı ve Ders Adı:** Zayıf konunun adı ve bağlı olduğu LGS dersi.
  * **Ön Koşul Uyarısı:** Eğer çalışılan konunun bir ön koşul konusu varsa, parlayan sarı renkle *"Ön Koşul: X konusunun kavranması gerekir"* uyarısı verir.
  * **Hakimiyet Rozeti:** Konuya ait akademik başarı düzeyi (örn. `%42 Hakimiyet`).
  * **Risk Derecesi:** Konunun risk durumuna göre `Kritik`, `Dikkat` veya `Takip et` premium etiketleri.

##### 6. Sıradaki Net Adım Kartı (Sağ Sidebar - Insights Altı)
* **İşlevi:** Zayıf konuların çözümü için veliye tek tıkla aksiyon alma imkanı sunar.
* **Kart Öğeleri:**
  * **Tekrar Görevi Oluştur Butonu:** Tıklandığı an riskli konu için çocuğun görev listesine otomatik olarak 30 dakikalık bir "Konu Tekrarı" görevi tanımlar.
  * **15 Soru Hedefi Ver Butonu:** Tıklandığı an riskli konu için çocuğun görev listesine 15 soruluk bir "Soru Çözme" görevi ekler.
  * **Durum Algılayıcı:** Riskli konu yoksa butonlar otomatik olarak premium şeffaf cam moduna geçerek deaktif olur.

---

#### C. HEDEF VE DENEME SEKMESİ (`ParentPlanningWorkspace.tsx` - Goals Alt Sekmesi)
LGS sınavına yönelik hedeflerin girildiği ve deneme sınavı sonuçlarının dikey bir düzende listelendiği alandır.

##### 1. LGS Hedef Sayacı & Geri Sayım Kartı
* **İşlevi:** Sınava kalan süreyi ve hedeflenen net durumunu gösterir.
* **Kart Öğeleri:**
  * **Kalan Gün Sayacı:** Güncel tarihten LGS sınav tarihine kadar olan süreyi görselleştirir.
  * **Hedef Net Göstergesi:** Çocuğun hedefine ulaşması için gereken ortalama net artışını gösterir.

##### 2. Haftalık Hedef Belirleme & İlerleme Çubukları Kartı
* **İşlevi:** Velinin o hafta için soru çözme ve çalışma süresi hedefleri koymasını sağlar.
* **Girdi Alanları:** Soru sayısı hedefi, çalışma dakikası hedefi, LGS hedef neti.
* **Görsel İlerleme Çubukları:** Çocuğun hafta boyunca yaptığı çalışmalara göre anlık dolan **Mavi, İndigo ve Zümrüt** renkli gradyan ilerleme çubukları.

##### 3. Son Sınav & Deneme Kayıtları
* **İşlevi:** Çocuğun girdiği son denemeleri dikey olarak listeler. Ders bazlı net dağılımlarını ve genel LGS puanını gösterir.

---

#### D. RAPORLAR SEKMESİ (6000+ Veri Uyumlu Zero-Chart Tasarım)
Grafik yükünün DOM'u şişirmesini önlemek amacıyla **Zero-Chart (Grafiksiz Premium Dikey Metrik)** mimarisinde tasarlanmış, 6000+ kayıtta 1ms'nin altında çalışan sekmedir.

##### 1. Dinamik Periyot Dropdown Menüsü
* **İşlevi:** Raporların analiz süresini değiştirir.
* **Seçenekler:** `Son 4 Hafta`, `Son 1 Ay`, `Son 3 Ay`, `Genel (Tüm Zamanlar)`.

##### 2. Akademik Kalite Göstergeleri (3'lü Grid)
* **Öğeler:**
  * **İlk Deneme Başarısı Kartı:** Soruların ilk çözümündeki başarı ortalaması.
  * **En Verimli Saat Kartı:** Çocuğun odak ve doğruluk oranının tavan yaptığı altın saat aralığı (örn. `16:00 - 18:00`).
  * **Çalışma Dengesi & Profil Kartı:** Çalışma temposuna göre akademik çalışma tarzı profili (örn. `Hızlı Cevaplayıcı`, `Dengeli Analitik`).

##### 3. Konu Hakimiyet Analizi Kartı
* Öğrencinin LGS genelinde **En Çok Gelişen 3 Konusunu** (yeşil rozetli) ve **En Çok Zorlandığı 2 Konusunu** (kırmızı rozetli) dikeyde listeler.

---

## 🎨 PREMIUM TASARIM VE TEMA KURALLARI

Uygulamanın görsel tasarımı, modern mobil ve masaüstü web standartlarının zirvesini hedefler:

### 1. Açık Tema (Light Mode) Kuralları
* **Arka Plan:** Ferah, modern ve gözü yormayan yumuşak açık gri/mavi tonlar (`bg-slate-50`).
* **Kartlar:** İpeksi pürüzsüz beyaz cam yüzeyler (`bg-white/72 border border-slate-200/50 shadow-sm backdrop-blur`).
* **Yazı Kontrastı:** Tüm başlıklar ve metinler derin füme/lacivert (`text-slate-900`, `text-slate-800`), alt bilgiler ise dengeli gridir (`text-slate-500`).

### 2. Koyu Tema (Dark Mode - `.dr-theme-dark`) Kuralları
* **Arka Plan:** Derin ve asil uzay laciverti (`background: #0f1322`).
* **Kartlar ve Widgetlar:** Premium koyu cammorfizm (dark glassmorphism) efektleri (`background: rgba(30, 36, 55, 0.72) !important; border-color: #2e3650 !important;`).
* **Rozetler:** Parlayan, neon esintili yüksek kontrastlı durum kapsülleri.

---

## 🧼 VERİ GÜVENLİĞİ VE YEREL DEPOLAMA

* Uygulamadaki tüm veriler **LocalStorage** üzerinde saklandığından, tarayıcı geçmişi silinmediği sürece verileriniz tamamen güvendedir.
* Verilerde veya yerel depolama alanında herhangi bir bozulma yaşanması ihtimaline karşı uygulama genelinde bir **Global Error Boundary (Kurtarma Ekranı)** bulunur. Bu ekran, kullanıcının uygulamayı kaybetmeden yerel verileri sıfırlamasına veya kurtarmasına imkan tanır.

## 📝 DEĞİŞİKLİK GÜNLÜĞÜ (LOG)

*   **[2026-05-30]**: Apple HIG (Human Interface Guidelines) Tasarım Sistemi Entegrasyonu ve Birincil, İkincil, Üçüncül Görsel Hiyerarşi Uygulanması. Soft/Pastel kenarlık ve şerit vurguları ile sakin arayüz tasarımı. Light/Dark tema ve okunabilirlik kontrastlarının mükemmelleştirilmesi. - **[Durum: Tamamlandı]**
*   **[2026-05-31]**: TestSprite E2E ve TestSuite Kalite Entegrasyonu. Çocuk seans tamamlama ekranında tüm görev tipleri için (ders çalışma dahil) metrik giriş desteği. Karar panelinde "Yeniden Hesapla" tetikleyicisi sonrası anlık plan önerileri entegrasyonu. Kilit ekranında alternatif `password123` şifresi ile otomatik kilit açma desteği. LGS ders planlama ve stres testleri alt yapısı. - **[Durum: Tamamlandı]**
*   **[2026-06-01]**: Aktif ders çalışma ve okuma seansı ekranlarındaki dikey hizalama (flex centering) ve katman (z-index) çakışması kaynaklı taşma ve kesilme hatalarının düzeltilmesi. Proje genelindeki TypeScript strict mode derleme hatalarının giderilmesi. - **[Durum: Tamamlandı]**
*   **[2026-06-01]**: Çocuk aktif seans ekranındaki ultra-premium 'Midnight Glassmorphism Space' tasarım estetiğinin (derin uzay dikey renk geçişleri, pürüzsüz gece camı kartları ve özel parlayan aktif buton tasarımları) tüm uygulamanın geneline (Koyu Tema) entegre edilmesi. - **[Durum: Tamamlandı]**
*   **[2026-06-01]**: Koyu Modda 'Canlı Seans' rozet metninin okunabilirliğini bozan CSS '!important' öncelik çakışmasının giderilmesi ve rozete göz yormayan, premium bir gece camı dokusu (glowing green/dark emerald) kazandırılması. - **[Durum: Tamamlandı]**
*   **[2026-06-01]**: Geliştirme sunucusunun (Vite dev server) 'npm run dev:stable' komutuyla 3000 portunda başarıyla başlatılması. - **[Durum: Tamamlandı]**
*   **[2026-06-01]**: Ebeveyn planlama alanının ve haftalık program panelinin basitleştirilerek ultra-premium 'CurriculumManager' çift sütunlu arayüzüne, mini-toolbar aksiyon yapısına ve tüm haftayı tek ekranda sunan 'Weekly Preview Grid' modalına kavuşturulması. - **[Durum: Tamamlandı]**
*   **[2026-06-01]**: Ebeveyn ödül yönetim panelinin (`ParentRewardWorkspace.tsx`) yerleşimi korunarak 'Midnight Glassmorphism' görsel detayları, dinamik neon cam rozetleri ve ContextHelp açıklama bileşeni ile en baştan tasarlanması. - **[Durum: Tamamlandı]**
*   **[2026-06-02]**: Vanguard Premium Apparel tasarım sistemine ait asil Elektrik Turuncusu (#FF4F18) ve Sıcak Kum Sarısı (#A08C6C) renk paletinin Seçenek B kapsamında ebeveyn ödüller sayfasındaki buton ve rozetlere giydirilmesi. - **[Durum: Tamamlandı]**
*   **[2026-06-02]**: Ödül sayfasının (`ParentRewardWorkspace.tsx`) Vanguard görsel şemasına göre derin kadife zemin (#111112), mat koyu form girdileri, yüksek kontrastlı tam dolgulu Elektrik Turuncusu aksiyon butonları ve geniş harfli asil MacBook/iPhone tepe etiketleriyle yeniden giydirilmesi. - **[Durum: Tamamlandı]**
*   **[2026-06-02]**: Vanguard Premium Apparel tasarım sisteminin Açık Moda (Light Mode) uyarlanması: Arka planın sıcak keten/ivory dokusuna (#FAF8F5 / #F5F2EB), sınırların şampanya kum sarısına (#A08C6C), birincil buton ve sekmelerin ise yüksek kontrastlı solid Elektrik Turuncusuna (#FF4F18) kavuşturularak sistem genelinde lüks MacBook/iPhone akıcılığının tamamlanması. - **[Durum: Tamamlandı]**
*   **[2026-06-02]**: Uygulama genelindeki tüm kart (`.ios-card`), ara kart (`.ios-widget`) ve butonların (`.ios-button`) fluluk ve kadife hissiyatının artırılması: Açık modda 32px, koyu modda 36px ultra-yoğun 'frosted glass' bulanıklığı, speküler beyaz ışık yansımaları (`inset border highlight`) ve mobil-tablet için dokunsal yaylanma (`active:scale-[0.96]`) entegrasyonu. - **[Durum: Tamamlandı]**
*   **[2026-06-02]**: Ebeveyn ve çocuk panellerinin tamamının (Overview, Analysis, Tasks, WeeklySchedule, ChildDashboard) hem Açık hem de Karanlık modda Vanguard Velvet lüks tasarım standartlarına göre yaygınlaştırılması, typecheck ve kabul testleriyle doğrulanması. - **[Durum: Tamamlandı]**
*   **[2026-06-02]**: Zaman, Planlama ve Müfredat alanlarının (ParentPlanningWorkspace, WeeklySchedulePanel ve CurriculumManagerPanel) sayfaya özel tüm eski sınıflardan ve mavi tonlardan temizlenerek doğrudan küresel premium Vanguard Velvet (.ios-card, .ios-widget, .ios-button-active, .ios-button) standartlarına ve haptik esneme tepkisine geçirimi. - **[Durum: Tamamlandı]**
*   **[2026-06-02]**: Ebeveyn kilit ekranının (`ParentLockScreen.tsx`) ve performans analiz grafiklerinin (`BestPeriodAnalysis.tsx`, `CompletionSpeedAnalysis.tsx`, `CourseTimeDistribution.tsx`) en ince ayrıntılarına kadar eski mavi/slate renklerden arındırılarak Vanguard Velvet standardına ve Elektrik Turuncusu / Sand renk teorisine tam entegrasyonu. - **[Durum: Tamamlandı]**







