# Release Notu (13 Nisan 2026)

## Kapsam

Bu turda odak, ilk sayfanin ogrenci durum paneli olarak sadeleştirilmesi, odul mekanizmasi dogrulugu ve analiz motorunda ders tekrar sinyalinin ayrıştırılması oldu.

## Tamamlanan Basliklar

- Ilk sayfa ogrenci durum detaylari odakli hale getirildi.
- Ust ozet kartlari ve son aktivite/ geciken gorev gorunumu aktif.
- Son aktivite satirinda tarih bilgisi eklendi.
- Tum dersler performans listesi ve genel performans rozeti gorunur.
- Gecikme orani, son 7 gun odak ve 14 gun dogruluk trend kartlari eklendi.
- Risk seviyesi esikleri (dusuk/orta/yuksek) kodlandi ve kart renk semantigi birlestirildi.
- Metrik sozlugu ve yardim metinleri eklendi.
- Uzun ders adlarinda satir kirilma ve bos durum metin standardizasyonu tamamlandi.
- Parent gorev/analiz ekranina `successPoints` prop akisi tamamlandi.
- Odul panelinde mevcut puan tek kaynaktan (`successPoints`) okunuyor.
- Odul panelinde renk esikleri, ulasilabilir/birikiyor etiketi ve tumunu goster akisi aktif.
- Odul eklemede ayni ad + ayni puan duplicate engeli aktif.
- Analiz motorunda `taskGoalType=konu-tekrari` icin ayri `revision` kovasi aktif.
- Ayni veride deterministik ayni sonuc kontrolu eklendi.
- Analiz grafik merkezi UX'i masaustunde sol kategori/ grafik menusu + sag tek grafik kanvasi olacak sekilde sadeleştirildi.
- Mobil analiz akisi dropdown tabanli tek grafik gosterimiyle netlestirildi.
- Otomatik smoke test scripti eklendi: `scripts/smoke-tests.ts`.
- Smoke test kapsamina Faz 5 icin veri yok / az veri / cok veri senaryolari eklendi.
- Uygulama derlemesi basarili (`npm run build`).
- Otomatik smoke test basarili (`npx -y tsx scripts/smoke-tests.ts` -> `SMOKE_TESTS_OK`).
- Faz 5 teknik dogrulama raporu yayinlandi: `docs/faz5-dogrulama-raporu-2026-04-13.md`.

## Teknik Notlar

- Kod tarafinda kritik dosyalarda hata yok: `App.tsx`, `components/parent/ParentDashboard.tsx`, `utils/analysisEngine.ts`, `types.ts`.
- Problems panelindeki kalan kayitlarin buyuk kismi `docs` altinda markdown lint uyarilaridir; uygulama derlemesini engellemez.

## Acik Kalanlar

- Bu tur icin acik P0/P1 kayit bulunmuyor.
