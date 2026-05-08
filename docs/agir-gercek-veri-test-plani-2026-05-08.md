# Ağır Gerçek Veri Test Planı - 2026-05-08

## Amaç
Uygulamayı gerçekçi ve yoğun veriyle uçtan uca test etmek. Hedef yalnızca ekranların açılması değil; plan üretimi, görev akışı, sınav takvimi, analiz snapshot'ı, grafik merkezi, çocuk paneli ve veri güvenliği davranışlarının doğru hesaplanıp doğru göründüğünü kanıtlamak.

## Öncelik Sırası
1. Copilot yorumlarını kapat: çalışma penceresi tekil kimliği, Türkçe görünen metinler, `React.StrictMode`.
2. Veri üretim senaryosu kur: çoklu ders, ünite, konu, okul programı, ev çalışma penceresi, sınav takvimi, görev ve performans kayıtları.
3. Plan motorunu test et: ev çalışma pencerelerine göre haftalık plan ve çocuk görevleri üretiliyor mu?
4. Çocuk panelini test et: görev başlatma, tamamlama, manuel tamamlama, okuma, ödül ve istatistik akışları.
5. Analiz ve grafik merkezini test et: gerçek tamamlanan görevlerden skor, doğruluk, süre, verim, sınav uyumu ve risk metrikleri üretiliyor mu?
6. Büyük veri ve regresyon turu: 100+ görev, çoklu plan, çoklu sınav, pasif/aktif ders, eski `tamamlandi` kayıtları.
7. Eksik/hatalı özellik raporu çıkar: P0/P1/P2 sınıflandırması ve geliştirme backlog'u.

## Test Verisi Matrisi
- Dersler: Matematik, Türkçe, Fen Bilimleri, Sosyal Bilgiler, İngilizce.
- Müfredat: Her derste en az 2 ünite, her ünitede 3 konu.
- Okul programı: Hafta içi okul blokları, hafta sonu boş veya kısa tekrar.
- Ev çalışma pencereleri: Aynı güne birden fazla pencere; aynı saat/kaliteye sahip iki pencere ile key/silme regresyon testi.
- Sınavlar: Yaklaşan yazılı, deneme/genel sınav ve geçmiş sonuç.
- Görevler: Soru çözme, konu tekrarı, ders çalışması, kitap okuma, sınav hazırlık.
- Durumlar: `completed`, legacy `tamamlandi`, pending, overdue.
- Performans: doğru/yanlış/boş, süre, odak, mastery, verim, okul notu.

## Kabul Kriterleri
- Plan üretimi okul saatlerini ihlal etmez ve yalnızca ev çalışma pencerelerine çalışma bloğu yerleştirir.
- Üretilen plan çocuk panelinde görev olarak görünür.
- Görev tamamlanınca başarı puanı, analiz snapshot'ı ve ilgili grafikler değişir.
- Boş veri durumları sahte skor üretmez.
- Legacy `tamamlandi` görevleri tüm analiz/grafik hesaplarında tamamlanmış sayılır.
- Grafik merkezi metinleri ve tooltip'leri bozuk Türkçe veya mojibake üretmez.
- Eski `quick=tasks` ve `quick=exams` rotaları ayrı büyük sayfa gibi davranmaz, Planlama'ya düşer.
- 100+ görevle ekranlar kilitlenmez; uzun listeler kısa görünümden taşmaz.

## Komut Kapıları
- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `git diff --check`

## Canlı Browser QA Rotaları
- `quick=overview`
- `quick=planning`
- `quick=analysis`
- `quick=tasks`
- `quick=exams`
- Çocuk paneli modu
- Analiz > Raporlar > Grafik Merkezi

## Hata Sınıflandırması
- P0: Ekran beyazlıyor, veri kaybı, plan/görev zinciri kopuyor, build/smoke kırılıyor.
- P1: Hesaplama yanlış, grafik gerçek veriyi göstermiyor, yanlış görev/sınav yönlendirmesi, yinelenen çalışma penceresi yanlış siliniyor.
- P2: Görsel taşma, metin tutarsızlığı, eksik boş durum, performans yavaşlığı.
- P3: İyileştirme ve gelecek faz önerisi.

## Çıktı
- Bulgu listesi: dosya/akış, beklenen, gerçekleşen, önem, önerilen çözüm.
- Güncelleme listesi: hemen yapılacaklar ve sonraki faz önerileri.
- Test kanıtı: komut çıktıları, browser QA rotaları, varsa console log durumu.

## 2026-05-08 İlk Ağır Test Turu

### Kapatılan Copilot Yorumları
- `WeeklySchedulePanel`: Ev çalışma pencereleri artık kalıcı `id` taşıyor. Aynı saat ve kaliteye sahip iki pencere React key/silme çakışması üretmemeli.
- `ParentPlanningWorkspace`: Görünen metinlerde kalan `Kayitli`, `Unite` vb. ASCII Türkçe ifadeler düzeltildi.
- `analysisEngine`: Okul/ev uyum yorumları doğru Türkçe karakterlerle üretilecek şekilde güncellendi.
- `index.tsx`: `React.StrictMode` geri eklendi.
- `parentDashboardShared`: Label map içinde kalan `Ölçme değerlendirme`, `Konu tekrarı`, `Elle atandı`, `Akıllı plan`, `Yazılı`, `Sözlü` metinleri düzeltildi.

### Ağır Testte Bulunan ve Kapatılan P1 Bulgular
- P1: Plan motoru ev çalışma penceresi dolu/uygunsuz olduğunda pencere dışına varsayılan saat bloğu koyabiliyordu. Çözüm: `chooseTimeWindow` artık pencere bulamazsa `null` döner; plan motoru alternatif günleri dener ve uygun pencere yoksa bloğu üretmez.
- P1: Çocuk panelinde tamamlanan haftalık plan görevi, analizde `completedPlannedTopicTasks` metriğine yalnızca plan içindeki `completed` bayrağı set edilmişse yansıyordu. Çözüm: analiz motoru artık `planTaskId` ile bağlı tamamlanmış çocuk görevlerini de plan tamamlama metriğine dahil ediyor.

### Eklenen Otomatik Ağır Test
- `npm run test:heavy` eklendi.
- Test dosyası: `scripts/heavy-real-data-tests.ts`.
- Kapsam: 160 görev, legacy `tamamlandi`, çoklu ders, okul sınavı, okul/ev uyumu, aynı saat/kaliteye sahip ev çalışma pencereleri, haftalık plan üretimi, çocuk görevi tamamlanması ve analiz yansıması.

### Doğrulama Kanıtı
- `npm run typecheck`: geçti.
- `npm run test:heavy`: izinli ortamda `HEAVY_REAL_DATA_TESTS_OK`.
- `npm run build`: izinli ortamda geçti.
- `npm run smoke`: izinli ortamda `SMOKE_TESTS_OK`.
- `git diff --check`: geçti; yalnızca LF/CRLF uyarıları var.
- Browser QA `http://127.0.0.1:3003/`:
  - `quick=overview`: geçti.
  - `quick=planning`: geçti.
  - `quick=analysis`: geçti.
  - eski `quick=tasks` ve `quick=exams`: Planlama'ya düştü.
  - Analiz > Raporlar: `Grafik Merkezi` ve `Genel skor trendi` göründü.
  - Console hata/uyarı yok.
  - `Ders gir`, `Kayitli`, `Unite`, `Olcme degerlendirme`, `Elle atandi`, `Akilli plan`, `Yazili`, `Sozlu`, `icin okul`, `ev calismasi` görünmedi.

### Sonraki Ağır Test Fazı
- Gerçek import/export dosyasıyla büyük veri taşıma testi.
- UI üzerinden aynı gün iki aynı ev çalışma penceresi ekle/sil testi.
- 100+ görevle mobil viewport görsel taşma testi.
- Analiz grafiklerinde her grafik tipi için dolu veri senaryosu.

## 2026-05-08 İkinci Ağır Test Turu

### Eklenen Sözleşme Testleri
- `npm run test:heavy` kapsamı genişletildi.
- Büyük yedek veri senaryosu eklendi: 140+ görev, dersler, müfredat, performans, ödül, rozet, okul programı, ev çalışma pencereleri, sınav kayıtları, genel deneme sonucu ve haftalık plan JSON round-trip sonrası tekrar analiz ediliyor.
- Grafik merkezi veri aileleri için sözleşme testi eklendi: genel skor/EMA, ders performansı, risk grafiği, müfredat kapsama, kalıcılık eğrisi, doğruluk/süre, en verimli zaman, öğrenme verimi, derin çalışma oranı, görev türü analizi ve okuma analitiği veri kaynağı boş kalmamalı.
- Aynı saat ve kaliteye sahip iki ev çalışma penceresi için tekil silme sözleşmesi eklendi; seçilen pencere silinirken eş pencereler korunmalı.

### Kapatılan Ek Bulgu
- P2: İçe aktarma hata toast metinlerinde `Gecersiz`, `dosyasi`, `formati` gibi kullanıcıya görünen ASCII Türkçe vardı. Mesajlar doğru Türkçe karakterlerle güncellendi.

### Doğrulama Kanıtı
- `npm run typecheck`: geçti.
- `npm run test:heavy`: izinli ortamda `HEAVY_REAL_DATA_TESTS_OK`.
- `npm run build`: izinli ortamda geçti.
- `npm run smoke`: izinli ortamda `SMOKE_TESTS_OK`.
- `git diff --check`: geçti; yalnızca LF/CRLF uyarıları var.
- Browser QA `http://127.0.0.1:3003/`:
  - `quick=overview`, `quick=planning`, `quick=analysis`: görünür, console error yok.
  - eski `quick=tasks` ve `quick=exams`: ayrı görev/sınav veri giriş sayfası gibi açılmadı, Planlama yüzeyine düştü.
  - Analiz > Raporlar > Grafik Merkezi: açıldı; boş veri durumunda sahte skor üretmeden yeterli veri yok mesajı gösterdi.
  - Görünür taramada `Ders gir`, mojibake, eski import hata metni ve belirgin ASCII Türkçe regresyonu görülmedi.

### Kalan Risk
- UI üzerinden dosya seçme/import ve aynı saatli çalışma penceresi ekle/sil akışı otomatik tarayıcıda dosya seçici kısıtı nedeniyle sözleşme testiyle doğrulandı. Bu iki davranış için ileride Playwright tam tarayıcı koşucusu veya özel test harness'i eklenirse daha iyi uçtan uca kanıt alınabilir.
