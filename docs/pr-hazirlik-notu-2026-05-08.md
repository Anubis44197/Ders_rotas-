# PR Hazırlık Notu - 2026-05-08

## Branch
- `codex/ios-dark-theme-production-cleanup`

## Önerilen PR Başlığı
Ebeveyn planlama akışını sağlamlaştır ve analiz/çocuk paneli kapanış QA'sını tamamla

## PR Özeti
- Planlama ekranı ebeveyn için tek komuta merkezi olacak şekilde sadeleştirildi; eski `tasks` ve `exams` girişleri Planlama yüzeyine yönleniyor.
- Haftalık okul programı ile ev çalışma pencereleri ayrıldı; plan üretimi çocuk görevlerine bağlanan gerçek haftalık çalışma blokları üzerinden doğrulandı.
- Ders merkezi tek ders/k konu kaynağı olarak güçlendirildi; aktif/pasif ders güvenliği ve kırık ders referansı uyarıları eklendi.
- Analiz, rapor ve grafik bileşenleri gerçek görev/sınav/plan verisiyle beslenecek şekilde sertleştirildi; boş veri durumları sahte skor üretmeden gösteriliyor.
- Çocuk paneli, görev uygulama akışı, ödül merkezi, veri yönetimi ve görünür Türkçe metinler son polish turundan geçirildi.
- Smoke test kapsamına müfredat -> okul programı -> ev çalışma zamanı -> sınav -> haftalık plan -> çocuk görevi -> tamamlanma -> analiz yansıması zinciri eklendi.

## Commit/Paket Grupları
1. Planlama bilgi mimarisi
   - `ParentPlanningWorkspace`, `PlanningPanel`, `WeeklySchedulePanel`, `App.tsx` yönlendirme ve workspace akışı.
2. Analiz ve grafik sağlamlaştırma
   - `ParentAnalysisShell`, `ParentAnalysisWorkspace`, `AnalysisGraphCenter`, analiz alt bileşenleri, `utils/taskStatus.ts`.
3. Ders merkezi ve veri güvenliği
   - `types.ts`, import/normalize akışı, aktif/pasif ders davranışı, kırık referans kontrolleri.
4. Çocuk paneli ve uygulama takibi
   - `ChildDashboard`, aktif görev/okuma zamanlayıcıları, manuel tamamlama ve görev panosu metinleri.
5. Görsel sistem ve Türkçe polish
   - Paylaşılan bileşenler, modal/toast/filtre metinleri, iOS yüzey/stil düzenlemeleri.
6. Dokümantasyon ve QA
   - Plan, strateji denetimi, ders merkezi kararı, kapanış planı, backlog notları ve smoke E2E senaryosu.

## Doğrulama
- `npm run typecheck` geçti.
- `git diff --check` geçti; yalnızca LF/CRLF uyarıları var.
- `npm run build` sandbox içinde `spawn EPERM` verdi, izinli ortamda geçti.
- `npm run smoke` sandbox içinde `spawn EPERM` verdi, izinli ortamda `SMOKE_TESTS_OK` döndü.
- Canlı QA `http://127.0.0.1:3003/` üzerinde yapıldı:
  - `quick=overview`
  - `quick=planning`
  - `quick=analysis`
  - eski `quick=tasks`
  - eski `quick=exams`
  - Çocuk paneli
- Canlı QA sırasında console hata/uyarı üretmedi.

## Kalan Riskler
- Diff geniş olduğu için PR review'da paket paket okunmalı.
- Geniş gerçek kullanıcı verisiyle uzun süreli manuel kullanım testi, merge sonrası ayrı gözlem turu olarak tutulmalı.
- Plan motoru daha akıllı dağıtım optimizasyonları bu kapanışın dışında, sonraki faz konusu.

