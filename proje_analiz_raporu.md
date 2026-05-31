# Ders Rotası - Kapsamlı Proje Analiz ve İnceleme Raporu

Kapsamlı inceleme sonucunda uygulamanın mevcut durumu, 6000+ veri girişi senaryosundaki performansı, mantık hataları, veri akışları ve kod kalitesine dair tespitler aşağıda detaylandırılmıştır. Bu bir analiz ve planlama raporudur; **kod üzerinde henüz hiçbir değişiklik yapılmamıştır.**

---

## 1. Mimari ve Performans Analizi (6000+ Veri Altyapısı)

Şu anki altyapı 6000+ veriyi (görevler, performans kayıtları, geçmiş veriler) işlemekte **ciddi performans sorunları** yaşatacak durumdadır. Özellikle tablet gibi donanım gücü sınırlı cihazlarda uygulama çökebilir veya çok yavaşlayabilir.

*   **App.tsx Monolitik Yapısı:** `App.tsx` dosyası yaklaşık 4700 satır ve 256KB boyutunda. Uygulamadaki **tüm state (durum) yönetimi** burada yapılıyor. 6000 veri eklendiğinde, ufak bir değişiklik (örneğin bir checkbox'a tıklamak) tüm `App.tsx`'in yeniden render edilmesini tetikleyerek arayüzü kilitleyecektir.
*   **Virtual Scroll (Sanal Kaydırma) Eksikliği:** `components/shared/VirtualScroll.tsx` dosyası oluşturulmuş ancak **içi tamamen boş** ve hiçbir yerde kullanılmıyor. 6000 adet görevin DOM (ekran) üzerinde aynı anda çizilmesi tarayıcıyı çökertecektir. Acilen listelerin sanallaştırılması (virtualization) gerekmektedir.
*   **Ağır Analiz Hesaplamaları:** `utils/analysisEngine.ts` içerisindeki hesaplamalar `map`, `filter`, ve `reduce` işlemleriyle tüm veri setini senkron (ana thread üzerinde) tarıyor. 6000 veri için bu hesaplama, sayfalar arası geçişlerde veya grafikleri güncellerken ciddi donmalara yol açacaktır. Web Worker (`overview-metrics.worker.ts`) kurulmuş olsa da tam entegre edilmemiş.

## 2. Veri Akışı ve Grafik Hesaplamaları

*   **Çakışan Veri Akışları:** Veriler `App.tsx`'ten aşağıya props olarak aktarılıyor ancak `AnalysisGraphCenter`, `PerformanceAnalytics` ve `ParentAnalysisWorkspace` gibi sayfalarda **aynı veriler farklı şekillerde tekrar tekrar hesaplanıyor**. Bu durum grafiklerde tutarsızlıklara (örneğin bir yerde %80 başarı, başka yerde %75 görünmesi) yol açma potansiyeline sahip.
*   **Grafik Matematik Hataları:** Bölme işlemlerinde (örneğin `accuracyScore` hesaplamasında) `questionCount`'un 0 olması durumu her yerde tam olarak ele alınmamış. Sıfıra bölme (division by zero) hatası NaN (Not a Number) üretebilir ve grafikleri bozabilir.
*   **Child / Parent Veri Paylaşımı:** Çocuk (ChildDashboard) ve Ebeveyn (ParentDashboard) panelleri aynı state'ten besleniyor. Ancak `StudyStats.tsx` dosyası hem `child` hem de `shared` klasöründe iki kopya halinde bulunuyor. Bu çakışan (duplicate) bileşen, veri akışında karmaşaya neden oluyor.

## 3. Planlama ve Karar (Decision) Mekanizmaları

Bahsettiğiniz gibi planlama kısmı oldukça karmaşık ve gereksiz özellikler barındırıyor:
*   **Fazla Karmaşık Engineler:** `parentDecisionEngine.ts` ve `planEngine.ts` içinde çok fazla yapay zeka/otomatik planlama algoritması taslağı var. Ancak `PlanBlockType`, `ReplanTriggerRecord` gibi tipler henüz arayüzde tam karşılığını bulmamış. 
*   **Kullanılmayan Görünümler:** `ParentPlanningWorkspace.tsx` ve `PlanningPanel.tsx` oldukça büyük dosyalar ancak içerdikleri "Smart Replan", "Risk V2 Model" gibi özellikler şu an tam çalışmayan veya veri akışı eksik olan "geliştirme aşamasındaki" kısımlar.
*   **Temizlik Gereksinimi:** Temel haftalık planlama dışındaki deneysel özelliklerin koddan temizlenmesi, uygulamanın hafiflemesi için kritik önem taşıyor.

## 4. Kod Kalitesi ve Tablet Uyumluluğu (Responsive)

*   **Responsive Tasarım (Tablet):** `index.css` ve Tailwind sınıfları ağırlıklı olarak masaüstü (`lg:`) veya çok küçük mobil ekranlar (`sm:`) için tasarlanmış. Yatay tablet (landscape) veya dikey tablet (portrait - `md:`) görünümleri için özel optimizasyonlar eksik.
*   **Aşırı CSS Boyutu:** `index.css` 48KB boyutunda ve içinde gereksiz Tailwind `@apply` kuralları ile bileşenlere özel stiller birbirine girmiş durumda.
*   **Hafıza Sızıntıları (Memory Leaks):** `App.tsx` içindeki sayısız `useEffect`, temizleme (cleanup function) işlemlerini tam yapmıyor. Timer'lar ve event listener'lar sayfa değiştikçe arka planda birikerek tableti yavaşlatacaktır.

## 5. Gizli Kodlar ve Firebase Geleceği

*   **Firebase Kalıntıları:** Proje dökümantasyonunda (.gitignore, tsconfig vb.) `.firebase` tanımları var. `types.ts` içinde `createdAt: string // Firebase compatibility` gibi notlar bulunuyor. Şu an Firebase aktif değil, yerel Storage kullanılıyor. Geçiş yapılacağı zaman bu yapı sorun çıkarmaz ancak veri yapısının JSON ağacına uygun olması için şimdiden `id` tabanlı ilişkilendirmelerin (referansların) sağlamlaştırılması gerekiyor.
*   **Mock Veriler:** `initialRealCurriculum.ts` (yaklaşık 40KB) içinde gömülü veriler var. 6000 veri girecekseniz bu statik dosyaların uygulamanın bundle (derleme) boyutunu şişirmemesi için dinamik yüklenmesi (lazy load) gerekecek.

---

### Önerilen Aksiyon Planı

1. **Performans (Kritik):** `VirtualScroll` mekanizmasını aktif edip, 6000 veriyi listeleyebilecek sanallaştırmayı kurmak ve hesaplamaları arka plana (Web Worker) taşımak.
2. **State Bölünmesi:** 4700 satırlık devasa `App.tsx`'i parçalayıp Context API veya Zustand gibi bir global state yöneticisi ile veri akışını düzenlemek.
3. **Temizlik:** Karar ve planlama kısmındaki kullanılmayan, ağır yapay zeka / analiz taslak kodlarını temizlemek.
