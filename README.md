# DersRotasi

DersRotasi, ogrenci calisma sureci icin gelistirilmis React tabanli bir takip ve planlama uygulamasidir. Ebeveyn ve cocuk panelleri ayni uygulama icinde calisir; ders, mufredat, gorev, okul programi, sinav, analiz, odul ve raporlama akislarini tek yerde toplar.

## Teknoloji Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- LocalStorage tabanli yerel veri saklama

## Gereksinimler

- Node.js 20 veya uzeri onerilir.
- npm 10 veya uzeri onerilir.
- Modern bir Chromium, Edge veya Chrome tarayici.

Surum kontrolu icin:

```bash
node -v
npm -v
```

## Kurulum

Depoyu klonlayin:

```bash
git clone https://github.com/Anubis44197/Ders_rotas-.git
cd Ders_rotas-
```

Bagimliliklari kurun:

```bash
npm install
```

Gelistirme sunucusunu baslatin:

```bash
npm run dev
```

Vite varsayilan olarak uygulamayi su adreste acar:

```text
http://localhost:3000
```

## Dogrulama Komutlari

Kod degisikligi sonrasi onerilen kontrol sirasi:

```bash
npm run typecheck
npm run build
npm run smoke
```

Komutlarin amaci:

| Komut | Aciklama |
| --- | --- |
| `npm run typecheck` | TypeScript tip kontrolu yapar. |
| `npm run build` | Production build uretir ve Vite derlemesini dogrular. |
| `npm run smoke` | Temel veri ve uygulama davranisi icin smoke testleri calistirir. |
| `npm run test:heavy` | Daha kapsamli gercek veri senaryolarini calistirir. |
| `npm run preview` | Build ciktisini lokal olarak onizler. |

## Production Onizleme

```bash
npm run build
npm run preview
```

Preview sunucusu Vite tarafindan verilen lokal adreste calisir.

## Ortam Degiskenleri

Normal kurulum ve kullanim icin herhangi bir API anahtari veya ortam degiskeni gerekmez.

## Guncel Stabil Durum

- Beyaz ekran riskine karsi uygulama geneline hata yakalama ekrani eklendi.
- Eski veya bozuk LocalStorage verileri normalize edilerek render hatalarinin onune gecildi.
- Recharts kaynakli gelistirme ortami render donguleri icin `SafeResponsiveContainer` kullanilir.
- Localhost uzerinde grafikler varsayilan olarak guvenli ozet/fallback ile acilir. Recharts renderini manuel test etmek icin tarayici konsolunda `localStorage.drEnableRecharts = 'true'` yazilip sayfa yenilenebilir.
- Planlama ekranindaki Haftalik Zaman Zemini kartindan cocuga hizli gorev atanabilir.
- Gorev atama penceresi ders, unite, konu, tarih, sure, soru sayisi ve takip olcutu secimlerini mevcut gorev sistemine baglar.
- PWA metadata uyarilari icin modern mobile web app meta etiketi eklenmistir.

## Proje Yapisi

```text
App.tsx                 Ana uygulama, state ve veri normalizasyonu
index.tsx               React giris noktasi ve global error boundary
index.css               Global stil ve tema katmani
components/child        Cocuk paneli ekranlari
components/parent       Ebeveyn paneli, planlama, analiz ve raporlama ekranlari
components/shared       Ortak bilesenler, grafik ve hata yakalama katmani
utils                   Analiz, planlama, tarih ve veri yardimcilari
scripts                 Smoke ve agir veri test betikleri
public                  Ikon, manifest ve statik varliklar
docs                    Plan, audit, QA ve karar notlari
```

## Veri Saklama

- Uygulama Firebase veya uzak veritabani kullanmaz.
- Ders, gorev, plan, sinav ve ayarlar tarayici LocalStorage alaninda tutulur.
- Farkli tarayici veya farkli cihazda veri otomatik tasinmaz.
- Bozuk yerel veri durumunda uygulama beyaz ekran yerine kurtarma ekrani gosterir ve yerel veriyi temizleme secenegi sunar.

## Git ve Repo Hijyeni

Repoya eklenmemesi gerekenler:

- `node_modules`
- `dist`
- `.env` ve `.env.local`
- `.firebase`
- test ciktilari
- gecici ekran goruntuleri
- tarayici profil klasorleri

Mevcut `.gitignore` bu dosyalari disarida tutacak sekilde kullanilmalidir.

## Sorun Giderme

### Uygulama beyaz ekran yerine kurtarma ekrani acarsa

Bu genellikle tarayicidaki eski veya bozuk LocalStorage verisinden kaynaklanir. Kurtarma ekranindaki yeniden dene veya yerel veriyi temizle secenekleri kullanilabilir.

### Localhost uzerinde grafikler fallback olarak gorunurse

Bu beklenen guvenli davranistir. Recharts renderini manuel kontrol etmek icin:

```js
localStorage.drEnableRecharts = 'true'
location.reload()
```

### Port 3000 doluysa

Vite baska bir port onerebilir. Terminalde verilen lokal adres kullanilmalidir.

## Son Dogrulanan Durum

Bu surum icin calistirilan kontroller:

```bash
npm run typecheck
npm run build
npm run smoke
```

Uc komut da temiz gecmistir.
