# DersRotası Kapanış ve Sağlamlaştırma Planı

## Özet
Planlama omurgası doğrulandı: `typecheck`, `build`, `smoke` ve canlı Planlama QA geçti. Sıradaki iş artık mimariyi yeniden kurmak değil; gerçek veri senaryosu, analiz/grafik doğruluğu, kalan Türkçe metin polish'i ve değişiklikleri güvenli paketleme.

Bu plan, `docs/strateji-guven-denetimi-2026-05-07.md` içindeki kapanış doğrulamasını temel alır.

## Sıralı Uygulama Adımları
1. Planı kaydet ve backlog'u güncelle.
2. Müfredat -> okul programı -> ev çalışma zamanı -> sınav -> haftalık plan -> çocuk görevi -> tamamlanma -> analiz/grafik zincirini gerçek veri senaryosuyla doğrula.
3. `AnalysisGraphCenter`, `ParentAnalysisWorkspace` ve ilgili rapor bileşenlerinde grafiklerin gerçek veriden beslendiğini ve boş veri durumlarının doğru göründüğünü kontrol et.
4. Genel Bakış, Çocuk Paneli, Müfredat editörü, Görev/Sınav modalları ve Analiz alt bileşenlerinde görünen Türkçe metinleri temizle.
5. 100+ görev, çoklu haftalık plan, çoklu sınav ve pasif/aktif ders karışımıyla büyük veri performansını kontrol et.
6. Geniş worktree değişikliklerini mantıklı paketlere ayır ve her paket sonunda kalite kapılarını çalıştır.

## Uygulama Durumu
- 2026-05-07: Plan dosyası kaydedildi.
- 2026-05-07: `scripts/smoke-tests.ts` içine uçtan uca akademik plan senaryosu eklendi.
- 2026-05-07: Yeni smoke senaryosu müfredat, okul programı, ev çalışma penceresi, sınav takvimi, plan üretimi, çocuk görevi, görev tamamlanması ve analiz yansımasını doğrular.
- 2026-05-07: `npm run typecheck` geçti.
- 2026-05-07: `npm run smoke` sandbox içinde `spawn EPERM` verdi; sandbox dışında `SMOKE_TESTS_OK` döndü.
- 2026-05-07: Analiz ekranındaki görünen Türkçe metin kaçakları düzeltildi; canlı `quick=analysis` QA'da eski ASCII/mojibake terimleri görünmedi.
- 2026-05-07: Kapanış kapıları tekrar çalıştı: `npm run typecheck`, `npm run build`, `npm run smoke`, `git diff --check` geçti. Build/smoke sandbox içinde `spawn EPERM` verdiği için sandbox dışında doğrulandı.
- 2026-05-07: Çocuk paneli, müfredat editörü, görev/veri alanları, sınav kayıt penceresi, bildirimler ve paylaşılan istatistik/öneri bileşenlerinde görünen Türkçe metin polish'i yapıldı.
- 2026-05-07: Canlı çocuk paneli QA'da `Çocuk Paneli`, `Bugünkü çalışma alanı`, `Görevler`, `Görev panosu` doğru göründü; eski ASCII/mojibake terimleri görünmedi.
- 2026-05-07: Son metin turunda ödül merkezi, yedekleme/silme akışı, görev listesi filtresi, zaman filtresi, çocuk zamanlayıcıları ve plan/replan mesajları temizlendi.
- 2026-05-07: Son metin turundan sonra `npm run typecheck`, `git diff --check` ve görünen ASCII Türkçe kaçak taraması temiz geçti. `npm run build` ve `npm run smoke` sandbox içinde yine `spawn EPERM` verdi; izinli tekrar sistem kullanım limiti nedeniyle bu turda başlatılamadı.
- 2026-05-08: Limit açıldıktan sonra `npm run build` ve `npm run smoke` izinli ortamda tekrar çalıştırıldı; build geçti ve smoke `SMOKE_TESTS_OK` döndü.
- 2026-05-08: Canlı tarayıcı QA `http://127.0.0.1:3003/` üzerinden yapıldı. `quick=overview`, `quick=planning`, `quick=analysis`, eski `quick=tasks` ve `quick=exams` rotaları kontrol edildi; tasks/exams Planlama'ya düştü, `Ders gir` ve eski ASCII kaçaklar görünmedi, console hata/uyarı üretmedi.
- 2026-05-08: Analiz içinde `Raporlar` sekmesi açıldı; `Grafik Merkezi`, `Tekil analiz görünümü` ve `Genel skor trendi` görünür durumda doğrulandı. Çocuk panelinde `Çocuk Paneli`, `Bugünkü çalışma alanı`, `Görevler`, `Görev panosu`, `Ödüller`, `İstatistik`, `Koç` doğru göründü.
- 2026-05-08: Paketleme turunda kalan `Gelişmiş İstatistikler` metni düzeltildi. Ardından `npm run typecheck`, `git diff --check`, `npm run build` ve `npm run smoke` tekrar geçti.

## Paketleme Grupları
- Planlama bilgi mimarisi: `ParentPlanningWorkspace`, `PlanningPanel`, `WeeklySchedulePanel`, eski tasks/exams yönlendirmeleri.
- Analiz ve grafik doğruluğu: `ParentAnalysisShell`, `ParentAnalysisWorkspace`, `AnalysisGraphCenter`, analiz alt bileşenleri ve `utils/taskStatus.ts`.
- Çocuk paneli ve uygulama takibi: `ChildDashboard`, aktif görev/okuma zamanlayıcıları, manuel tamamlama ve görev panosu metinleri.
- Veri güvenliği ve performans: import/normalize akışı, aktif/pasif ders güvenliği, uzun liste kısaltmaları, analiz hesap guard'ları.
- Dokümantasyon ve QA: kapanış planı, strateji güven denetimi, ders merkezi kararı, smoke E2E senaryosu ve backlog güncellemeleri.

## Test Planı
- Zorunlu komutlar: `npm run typecheck`, `npm run build`, `npm run smoke`, `git diff --check`.
- Canlı QA rotaları: `quick=overview`, `quick=planning`, `quick=analysis`; eski `quick=tasks` ve `quick=exams` yönlendirmeleri.
- Uçtan uca veri testi: müfredat, okul/ev programı, sınav, plan üretimi, çocuk görevi, görev tamamlanması, analiz/grafik yansıması.
- Regresyon kontrolü: `Ders gir` geri gelmemeli; sınav girişi Planlama içinde kalmalı; görevler ayrı büyük veri giriş sayfası gibi davranmamalı.

## Varsayımlar
- Ayrı "Sınavlar" ve "Görevler" ana sayfa ağırlığı geri getirilmeyecek.
- Ders/k konu oluşturmanın tek kaynağı müfredat/ders yönetimi olacak.
- Plan motorunun daha akıllı dağıtım optimizasyonları bu kapanıştan sonra ayrı faz olarak ele alınacak.
- Yeni P0/P1 hata bulunursa sıra durur, önce hata kapatılır.
