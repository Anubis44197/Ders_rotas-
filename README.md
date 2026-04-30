# DersRotasi

DersRotasi, tablet kullanimi icin tasarlanan ogrenci takip uygulamasidir. Ebeveyn ve cocuk panelleri ayni React uygulamasi icinde calisir. Ders, gorev, sinav, calisma performansi, odul ve raporlama akislarini tek yerde toplar.

## Teknoloji

- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts

## Kurulum

```bash
npm install
```

## Gelistirme Ortami

```bash
npm run dev
```

Uygulama varsayilan olarak burada calisir:

```text
http://localhost:3000
```

## Kontrol Komutlari

```bash
npm run typecheck
npm run smoke
npm run build
```

## Production Onizleme

```bash
npm run build
npm run preview
```

## Ortam Degiskeni

AI destekli alanlar icin proje kokunde `.env.local` dosyasi olusturulabilir:

```bash
VITE_GOOGLE_AI_API_KEY=anahtarinizi_yazin
```

Bu dosya repoya eklenmez.

## Proje Yapisi

```text
App.tsx                 Ana uygulama ve durum yonetimi
index.tsx               React giris dosyasi
index.css               Global stil ve tema
components/child        Cocuk paneli
components/parent       Ebeveyn paneli
components/shared       Ortak arayuz bilesenleri
utils                   Analiz, planlama ve yardimci fonksiyonlar
scripts                 Smoke test betikleri
public                  Ikon ve manifest dosyalari
docs                    Plan, analiz ve QA notlari
```

## Notlar

- Firebase aktif degildir.
- Veri akisi yerel tarayici depolamasi ve uygulama state yapisi uzerinden calisir.
- `node_modules`, `dist`, `.env`, `.firebase`, test ciktilari ve gecici ekran goruntuleri repoya eklenmez.
- GitHub'dan indirildikten sonra calismasi icin `npm install` yeterlidir.
