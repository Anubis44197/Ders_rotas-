# DersRotasi

DersRotasi, tablet odakli bir ogrenci takip uygulamasidir. Ebeveyn paneli ve cocuk paneli ayni React uygulamasi icinde calisir; ders, gorev, sinav, calisma performansi, odul ve raporlama akislari tek veri modeli uzerinden yonetilir.

Uygulama su an React + TypeScript + Vite ile calisir. Veri kaliciligi yerel tarayici depolamasi uzerinden ilerler; Firebase entegrasyonu aktif degildir.

## Hızlı Başlangıç

Gereksinimler:

- Node.js 22 veya uzeri
- npm

Kurulum:

```bash
npm install
npm run dev
```

Varsayilan gelistirme adresi:

```text
http://localhost:3000
```

Production build:

```bash
npm run build
npm run preview
```

Kalite kontrolleri:

```bash
npm run typecheck
npm run smoke
npm run build
```

## Ortam Değişkenleri

AI ozellikleri icin Google Gemini anahtari gerekiyorsa proje kokunde `.env.local` dosyasi olusturun:

```bash
VITE_GOOGLE_AI_API_KEY=buraya_anahtarinizi_yazin
```

Bu dosya Git'e eklenmez. Anahtar yoksa uygulamanin temel takip, planlama ve raporlama yuzeyleri yine calisir; AI destekli alanlarda yanit uretimi sinirli olabilir.

## Ana Modüller

- **Ebeveyn Paneli:** genel bakis, planlama, ders/gorev yonetimi, analiz, odul ve veri islemleri.
- **Cocuk Paneli:** aktif gorevler, sureli calisma, okuma gorevleri, soru cozme ve odul ilerlemesi.
- **Analiz ve Raporlama:** genel skor, odak, verim, dogruluk, ders trendleri, calisma turu dagilimi ve grafikler.
- **Veri Yonetimi:** yerel veri saklama, export/import akislari ve smoke test senaryolari.

## Tasarım Yönü

Mevcut arayuz koyu tema oncelikli olarak guncellenmistir. Hedef, web sitesi gibi davranan bir sayfa yerine tablette kullanilan, yogun ama okunakli bir ogrenci takip paneli sunmaktir.

Tasarim ilkeleri:

- iOS Human Interface Guidelines yaklasimina yakin hiyerarsi, bosluk ve kontrol dili
- pastel ama okunabilir koyu tema renkleri
- kartlarda tutarli cerceve, yuzey ve vurgu renkleri
- grafiklerde ayni renk tokenlarini kullanan sade veri gorsellestirme
- buyuk dokunma hedefleri ve tablet ergonomisi

## Proje Yapısı

```text
.
├── App.tsx
├── index.tsx
├── index.css
├── components/
│   ├── child/
│   ├── parent/
│   └── shared/
├── utils/
├── scripts/
├── public/
├── docs/
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

Onemli dosyalar:

- `App.tsx`: ana uygulama durumu, veri akislari ve ekran gecisleri
- `components/parent/`: ebeveyn paneli, analiz, planlama ve gorev yuzeyleri
- `components/child/`: cocuk paneli ve aktif calisma akislari
- `components/shared/`: ortak UI, yardim, bildirim ve grafik yardimcilari
- `utils/analysisEngine.ts`: performans sinyalleri ve analiz hesaplari
- `utils/planEngine.ts`: planlama motoru
- `scripts/smoke-tests.ts`: temel veri akisi kontrolu

## Temiz Repo Notları

Repoda bilincli olarak tutulmayan dosyalar:

- `node_modules/`
- `dist/`
- `.env*`
- `.firebase/`
- `.playwright-mcp/`
- gecici ekran goruntuleri ve test ciktilari

Bu nedenle GitHub'dan indirildiginde kurulum icin sadece `npm install` calistirilmasi yeterlidir.

## Güncel Doğrulama

Son temizleme ve paketleme kontrolunde su komutlar basariyla calistirildi:

```bash
npm run typecheck
npm run smoke
npm run build
```

Bilinen not: `npm audit`, `@google/genai -> google-auth-library -> gaxios -> uuid` zincirinden gelen 2 adet moderate uyari gosterebilir. Bu zincir upstream bagimlilik oldugu icin force upgrade uygulanmamistir.

## Geliştirme Akışı

1. Yeni dal acin.
2. Degisiklikleri yapin.
3. `npm run typecheck`, `npm run smoke`, `npm run build` calistirin.
4. Pull request acin.

## Lisans

Bu proje icin lisans dosyasi henuz eklenmemistir. Yayina almadan once lisans karari verilmelidir.
