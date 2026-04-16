# DersRotasi Eksik/Hata Takip Raporu (12 Nisan 2026)

## Durum Ozeti
- Build: Basarili
- Kritik akislarda kod seviyesinde sertlestirme yapildi.
- Manuel uctan uca test bekleyen maddeler asagida listelendi.

## Kapanan Maddeler

### K-001
- Baslik: Odul talebinde cift tiklama ile coklu islem riski
- Modul: Cocuk Paneli
- Durum: Kapandi
- Cozum: UI + App seviyesinde claim lock eklendi.

### K-002
- Baslik: Gorev/okuma tamamla cift tiklama ile tekrar completion riski
- Modul: Cocuk Seans Ekranlari
- Durum: Kapandi
- Cozum: Tamamlama butonlarina tek-sefer kilit eklendi.

### K-003
- Baslik: Timer drift (arka plan/geri donus) nedeniyle sayaç sapmasi
- Modul: ActiveTaskTimer / ActiveReadingSession
- Durum: Kapandi
- Cozum: Date.now delta-time tabanli sayaç akisi uygulandi.

### K-004
- Baslik: Plan uretiminde cift tetikleme ile duplicate plan/gorev riski
- Modul: PlanningPanel
- Durum: Kapandi
- Cozum: isGeneratingPlan kilidi eklendi.

### K-005
- Baslik: Plan uretimi hatasinda yari-plan/yari-gorev kalma riski
- Modul: PlanningPanel
- Durum: Kapandi
- Cozum: Hata durumunda o turda olusan gorevleri rollback eden mekanizma eklendi.

### K-006
- Baslik: completeTask tekrar cagrilarinda cift puan riski
- Modul: App / Puanlama
- Durum: Kapandi
- Cozum: completeTask idempotency + lock eklendi.

### K-007
- Baslik: Date.now tabanli ID carpismasi riski
- Modul: App
- Durum: Kapandi
- Cozum: randomUUID tabanli guvenli ID uretimi eklendi (fallback ile).

### K-008
- Baslik: Cocuk tarafinda mufredat-unite seciminde ad varyasyonu nedeniyle bos liste
- Modul: ChildDashboard
- Durum: Kapandi
- Cozum: normalize lookup eslesmesi eklendi.

### K-009
- Baslik: Tum veriyi sil isleminde yanlis tiklama riski
- Modul: ParentDashboard
- Durum: Kapandi
- Cozum: Cift dogrulama (confirm + SIL metni) eklendi.

### K-010
- Baslik: Import'ta eski yedek formatlariyla tam reddetme riski
- Modul: App Import
- Durum: Kapandi
- Cozum: performanceData eksikligine tolerans eklendi.

## Acik / Manuel Test Bekleyen Maddeler

### O-001
- Baslik: Plan rollback davranisinin canli hata senaryosunda dogrulanmasi
- Modul: PlanningPanel
- Durum: Kapandi
- Oncelik: P1
- Not:
	- Rollback canli senaryoda dogrulandi.
	- Plan uretiminde kontrollu hata olusturulduktan sonra UI mesaji goruldu: `Plan olusturulamadi. Islem geri alindi, tekrar deneyin.`
	- Konsol kaydi: `Plan olusturma hatasi, olusturulan gorevler geri alindi`.
	- Sonuc: plan/gorevler yari durumda kalmadi, `Kayitli Haftalar` alani bos kaldi.

### O-002
- Baslik: Import toleransinin farkli eski yedek varyasyonlariyla dogrulanmasi
- Modul: App Import
- Durum: Kapandi
- Oncelik: P1
- Not: 
	- `qa-import-legacy-missing-performance.json` ile import basarili: `Veriler basariyla ice aktarildi.`
	- `qa-import-invalid-missing-rewards.json` ile import reddedildi: `Gecersiz yedek dosyasi: gerekli alanlar eksik veya hatali.`
	- `qa-import-malformed.json` (kasti bozuk JSON) ile import reddedildi: `Yedek dosyasi okunamadi veya JSON formati gecersiz.`
	- Sonuc: toleransli kabul + gecersiz formatlari belirgin mesajla reddetme birlikte dogrulandi.

### O-003
- Baslik: Mufredat normalize eslesmesinin Turkce karakter varyasyonlarinda dogrulanmasi
- Modul: ChildDashboard / ParentDashboard
- Durum: Kapandi
- Oncelik: P1
- Not:
	- Koku neden: import sonrasi kurs adina gore bos bir anahtar (`fizik: []`) olustugunda, dolu eslesen anahtar (`FİZİK`) yerine bu bos dizi tercih ediliyordu.
	- Kod duzeltmesi: `ChildDashboard` ve `ParentDashboard` aktif unite seciminde bos dogrudan eslesme yerine normalize edilmis dolu eslesme onceliklendirildi.
	- Canli yeniden test: `qa-import-normalize-curriculum.json` iceri alindi, cocuk paneli > serbest calisma ekraninda ders `fizik` seciliyken unite listesinde `Unite 1`, unite seciminden sonra konu listesinde `Konu A` gorundu.
	- Sonuc: Turkce karakter varyasyonlu mufredat eslesmesi canli ortamda dogrulandi.

### O-004
- Baslik: Import gecersiz dosyada kullaniciya belirgin hata geri bildirimi eksikligi
- Modul: App Import / Veri Islemleri
- Durum: Kapandi
- Oncelik: P2
- Not:
	- Import false durumunda artik net hata toasti veriliyor: `Gecersiz yedek dosyasi: gerekli alanlar eksik veya hatali.`
	- JSON parse/okuma hatasinda net hata toasti veriliyor: `Yedek dosyasi okunamadi veya JSON formati gecersiz.`

### O-005
- Baslik: Ogrenci durum paneli metriklerinin regresyon ve tutarlilik dogrulamasi
- Modul: App / Analysis Engine / Parent Dashboard
- Durum: Kapandi
- Oncelik: P1
- Not:
	- Derleme yeniden calistirildi: `npm run build` basarili.
	- Otomatik smoke script eklendi ve calistirildi: `npx -y tsx scripts/smoke-tests.ts`.
	- Dogrulanan senaryolar:
		- Gorev atama > tamamlama > puan > odul akisi.
		- Soru cozme / ders calisma / ders tekrar gorev turu sinyalleri.
		- Import/export sonrasi analiz snapshot tutarliligi.
		- Ayni veride deterministik ayni sonuc kontrolu.
	- Sonuc: P0/P1 acik bulgu yok.

## Bir Sonraki Iterasyon Plani
1. docs/qa-kontrol-listesi-2026-04-12.md uzerinden A/B/C kritik adimlari manuel yurut.
2. Her sapmayi bu dosyada yeni O-xxx kaydi olarak ac.
3. P0/P1 bulgulara once kod duzeltmesi uygula, sonra ayni adimla geri test et.
4. Tum P0/P1 maddeler kapandiginda final stabilite turuna gec.
