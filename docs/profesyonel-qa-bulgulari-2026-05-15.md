# Profesyonel QA Bulgulari - 2026-05-15

## Test kapsami
- Gercek mufredat kaynak verisi uzerinden buyuk veri testi hazirlandi.
- Hedef hacim: 6000 gorev kaydi.
- Dagilim:
  - 4500 soru cozme
  - 750 konu tekrari
  - 750 ders calisma
  - 5900 tamamlanan kayit
  - 100 bekleyen/gecikme riski tasiyan kayit
- Aktif ders sayisi: 6
- Mufredat konu sayisi: 289
- Analizde uretilen konu sayisi: 227

## Otomatik test kanitlari
- `npm run typecheck`: gecti.
- `npm run smoke`: gecti (`SMOKE_TESTS_OK`).
- `npm run test:heavy`: gecti (`HEAVY_REAL_DATA_TESTS_OK`).
- `npm run build`: seri kosumda gecti.
- `git diff --check`: gecti; yalnizca LF/CRLF uyarilari var.
- Uygulama kaynaklari mojibake/Turkce karakter taramasi: 0 bulgu.
- Localhost kontrolu: `http://127.0.0.1:3000/?quick=planning&reset=math` -> 200.

## Buyuk veri metrikleri
- Toplam gorev: 6000
- Tamamlanan gorev/session: 5900
- Soru cozme: 4500
- Konu tekrari: 750
- Ders calisma: 750
- Analiz suresi: 346 ms son kosumda, onceki kosumda 366 ms
- Backup JSON round-trip suresi: 57 ms
- Genel skor: 79

## Dogrulanan sozlesmeler
- Tum tamamlanan gorevler analiz sessionina donusuyor.
- Soru cozme, konu tekrari ve ders calisma ayri gorev turu metriklerine yansiyor.
- Tum aktif dersler icin ders bazli performans uretiliyor.
- Konu bazli risk/mastery verisi bos kalmiyor.
- Genel skor, ders performansi, risk, mufredat kapsama, kalicilik, dogruluk/sure, verimli zaman ve gorev turu grafikleri icin veri kaynagi uretiliyor.
- Sayisal metriklerde `NaN`, `Infinity` veya gecersiz sayi uretilmiyor.
- Import/export benzeri JSON round-trip gorev, ders, session ve genel skor kaybi uretmiyor.
- Plan motoru calisma bloklarini ev calisma penceresi disina tasirmiyor.

## Bulgular
- P3 / Test altyapisi: `npm run build` diger komutlarla paralel kosarken bir kez Vite/Rollup path emit hatasi verdi. Aynı build seri kosuldugunda gecti. Test kapilarinda build seri kosulmali.
- P2 / UI riski: Uzun konu adlari otomatik veri/analiz tarafinda sorun cikarmadi; manuel UI turunda dropdown, kart, grafik ekseni ve mobil tasma ayrica kontrol edilmeli.
- P2 / Kapsam riski: Bu tur otomatik hesaplama ve veri sozlesmesi turudur. UI uzerinden 20-30 manuel kayit girisi, grafik gezme ve mobil viewport henuz tamamlanmadi.

## Sonraki manuel QA turu
1. Planlama ekraninda ders/unite/konu secimlerini gez.
2. Uzun konu adlarinda tasma, okunurluk ve secim davranisini kontrol et.
3. UI uzerinden 10 soru cozme, 5 konu tekrari, 5 ders calisma kaydi gir.
4. Girilen kayitlarin gorev listesi, konu durumu, analiz ozeti ve grafiklere yansidigini kontrol et.
5. Desktop ve mobil viewportta Analiz > Grafik Merkezi icindeki tum grafik kategorilerini tek tek gez.
6. Console error/warn ve beyaz ekran olup olmadigini kaydet.

## 2026-05-15 Manuel Gercek Kayit Seed Turu
- Uygulamaya gizli QA parametresi eklendi: `qaRecords=manual`.
- Kullanilacak link: `http://127.0.0.1:3000/?quick=analysis&reset=math&qaRecords=manual`.
- Bu link gercek mufredat uzerinden 24 hassas test kaydi basar.
- Dagilim:
  - 13 soru cozme
  - 5 konu tekrari
  - 6 ders calisma
  - 6 aktif dersin tamami
  - 24 tamamlanan kayit
- Ozellikle uzun konu adlari secildi:
  - Matematik carpanlar/katlar uzun basligi
  - Matematik karekoklu ifadeler uzun basligi
  - Turkce cumle turleri ve soz sanatlari
  - Fen enerji donusumleri ve elektrik konulari
  - Inkilap uzun unite/konu basliklari
- QA headless dogrulama sonucu:
  - `tasks`: 24
  - `completed`: 24
  - `question`: 13
  - `revision`: 5
  - `study`: 6
  - `courses`: 6
  - `performanceRows`: 6
  - `successPoints`: 424
- Ek dogrulama:
  - `npm run typecheck`: gecti
  - `npm run build`: gecti
  - `npm run smoke`: gecti
  - URL 200 dondu

## Manuel UI kontrol notu
Bu seed verisiyle siradaki adim ekran uzerinden kontrol olacak:
1. Analiz ekraninda genel skor, ders performansi ve risk kartlari doluyor mu?
2. Grafik Merkezi'nde uzun konu adlari eksen/kart tasmasi yapiyor mu?
3. Gorev listesinde uzun basliklar okunabilir mi?
4. Mobil genislikte konu secimi ve grafikler tasiyor mu?
5. Console error/warn uretiyor mu?

## Rapor Grafikleri - 2026-05-15

- Bulgu: Raporlar/Grafik Merkezi alaninda veri olmasina ragmen localhost ortaminda grafikler metin fallback olarak gorunuyordu.
- Kok neden: `SafeResponsiveContainer` localhost uzerinde Recharts renderini kapatip sadece metin fallback basiyordu; Recharts manuel acildiginda React 19 gelistirme ortaminda `Maximum update depth exceeded` dongusu tekrar gorulebiliyor.
- Duzeltme: Metin fallback yerine chart verisini okuyup hafif SVG grafik ureten fallback eklendi. QA seed, eski `drEnableRecharts`/`drDisableRecharts` localStorage anahtarlarini temizliyor.
- Dogrulama: `?quick=analysis&analysisTab=reports&reset=math&qaRecords=manual` ile 24 kayit, kilitsiz ebeveyn analizi, Raporlar sekmesi ve grafik yuzeyinde SVG olusumu dogrulandi.


## Hedef ve Deneme Karar Alani - 2026-05-16

- Yeni QA odagi: veli `Hedef ve Deneme` sekmesinde hedef gerceklesme, deneme trendi, ders bazli son deneme ve aksiyon butonunu tek akis icinde gorebilmeli.
- Dogrulanan otomatik kapilar:
  - `npm run typecheck`
  - `npm run smoke`
  - `npm run build`
  - `npm run test:heavy`
  - `git diff --check`
- Son agir test sonucu: 6000 gorev / 5900 tamamlanan oturum / 4500 soru gorevi / 227 analiz konusu / genel skor 79.
- Manuel QA maddesi eklendi: `15 soru hedefi ver` butonuna basinca bugunun planina soru cozme gorevi dusmeli ve metrikleri `accuracy`, `focus`, `duration`, `completion` olarak gelmeli.
- Risk: Deneme trendi tek kayitta dogru sekilde az veri mesaji verir; iki veya daha fazla deneme kaydinda line chart davranisi manuel veriyle ayrica test edilecek.

## Monitoring / Observability Kapanisi - 2026-05-17

- Uygulamaya hafif gozlemlenebilirlik katmani eklendi (localStorage tabanli, son 120 event):
  - `analysis_snapshot`
  - `analysis_runtime_error`
  - `notification_queue`
  - `notification_action`
- Amac:
  - Analiz pipeline davranisini ve bildirim akisinin uretim yukunde izlenebilir hale getirmek.
  - Sorun oldugunda “neden kritik dedi / neden bildirim geldi” hattini teknik olarak takip edebilmek.
- Eventler sadece kisa ve olculebilir metadata tutar; hassas/yorumlayici psikolojik veri tutulmaz.

### Kapanis dogrulama

- `npm run typecheck`: gecti.
- `npm run smoke`: gecti.
- `npm run test:matrix`: gecti.
- `npm run test:heavy`: gecti.
- `npm run build`: gecti.

### Kalan bilinen risk (V2)

- Gozlemlenebilirlik su an localStorage seviyesinde. Merkezi dashboard veya uzak telemetry entegrasyonu (server tarafi) V2 kapsaminda.
