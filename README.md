# Ders Rotası / Ders Tak

Ders Rotası, LGS hazırlığı için ebeveyn ve çocuk panellerini tek web uygulamasında birleştiren React + TypeScript uygulamasıdır. Uygulama artık yalnızca yerel tarayıcı kaydıyla sınırlı değildir; Firebase Hosting üzerinde yayınlanır ve aile içi ortak veri Firestore üzerinden canlı senkronize edilir.

## Canlı Adresler

```text
GitHub repo: https://github.com/Anubis44197/Ders_rotas-.git
Firebase project: ders-tak
Firebase Hosting: https://ders-tak.web.app
Firebase Console: https://console.firebase.google.com/project/ders-tak/overview
Aktif yerel klasör: C:\Users\90535\Desktop\Ders_rotas-
Aktif geliştirme dalı: main
```

Başka bir IDE veya bilgisayarda kaldığımız yerden devam etmek için:

```bash
git clone https://github.com/Anubis44197/Ders_rotas-.git
cd Ders_rotas-
git checkout main
npm install
npm run dev:stable
```

Yerel geliştirme adresi:

```text
http://127.0.0.1:3000
```

## Teknoloji

- React 19 + TypeScript
- Vite
- Tailwind CSS + global Vanguard Velvet / iOS cam yüzey tasarım sistemi
- Firebase Hosting
- Firebase Authentication: Anonymous Auth
- Cloud Firestore: aile içi canlı ortak state
- IndexedDB + LocalStorage: yerel hızlı açılış, geçici cihaz cache'i ve eski veri uyumluluğu

## Firebase Canlı Senkron

Canlı uygulamada ebeveyn, çocuk ve diğer cihazlar aynı Firestore verisini görür. Çocuk bir görevi tamamladığında veya veli görev atadığında veri Firestore'a yazılır; diğer cihazlar açıkken snapshot listener ile güncellenir.

Kullanılan ortak aile verisi:

```text
families/ders-tak-main/state/courses
families/ders-tak-main/state/tasks
families/ders-tak-main/state/performanceData
families/ders-tak-main/state/rewards
families/ders-tak-main/state/badges
families/ders-tak-main/state/curriculum
families/ders-tak-main/state/weeklySchedule
families/ders-tak-main/state/examRecords
families/ders-tak-main/state/compositeExamResults
families/ders-tak-main/state/examScheduleEntries
families/ders-tak-main/state/studyPlans
families/ders-tak-main/state/meta
```

`meta` bölümünde `successPoints` ve `planningEngineSnapshot` tutulur. Büyük tek Firestore dokümanı yerine parçalı state kullanılmasının nedeni 6000 civarı kayıt hedefinde doküman boyutu ve gereksiz okuma/yazma şişmesini azaltmaktır.

Firebase bağlantı kodu:

```text
utils/firebaseLiveSync.ts
```

Firebase proje seçimi:

```text
.firebaserc -> default: ders-tak
firebase.json -> hosting public: dist
firestore.rules -> families/ders-tak-main/state/* kuralları
```

## Ücretsiz Katman Notu

Bu proje Spark/ücretsiz katmanda kalacak şekilde ayarlanmıştır.

- Cloud Functions kullanılmıyor.
- Blaze gerektiren servis eklenmedi.
- Hosting + Firestore + Anonymous Auth kullanılıyor.
- 6000 civarı kayıt beklenen kullanım için uygundur; yine de Firestore okuma/yazma ve doküman boyutu ayda bir kontrol edilmelidir.

Firebase Console'da gerekli ayar:

```text
Authentication > Sign-in method > Anonymous: Enabled
```

Firebase'in “Google ile oturum aç önerilir” uyarısı genel güvenlik tavsiyesidir. Bu projede şimdilik aile içi birkaç cihaz kullanımı için Anonymous Auth yeterli olacak şekilde kuruldu.

## Mock / QA Verisi Güvenliği

Canlı Firebase'e mock veri gitmemesi için önemli kural:

```text
?e2e=1
```

Bu parametre açıkken uygulama test/QA moduna geçer ve Firebase canlı senkron/publish devre dışı kalır. QA seed fonksiyonları sadece `?e2e=1` ve ilgili QA parametreleriyle çalışır. Normal canlı adres olan `https://ders-tak.web.app` mock veri seed etmez.

Canlı test yaparken şu adresi kullan:

```text
https://ders-tak.web.app
```

Yerel/QA test için kullanılabilecek örnek:

```text
http://127.0.0.1:3000/?quick=planning&e2e=1
```

Bu QA adresinde oluşan veriler canlı Firebase'e yazılmamalıdır.

## Kurulum

Gereksinimler:

- Node.js 20+
- npm 10+
- Modern Chromium tabanlı tarayıcı

Kurulum:

```bash
npm install
```

Yerel sunucu:

```bash
npm run dev:stable
```

Alternatif Vite komutu:

```bash
npm run dev
```

## Doğrulama Komutları

Kod değişikliğinden sonra önerilen sıra:

```bash
npm run typecheck
npm run smoke
npm run build
```

Ağır veri kontrolü gerektiğinde:

```bash
npm run test:heavy
```

Mevcut build uyarısı:

```text
Some chunks are larger than 600 kB after minification.
```

Bu şu an hata değildir; Vite production build tamamlanır. İleride kod bölme/manualChunks ile optimize edilebilir.

## Firebase Deploy

Canlıya aktarım öncesi:

```bash
npm run typecheck
npm run smoke
npm run build
```

Hosting deploy:

```bash
npx firebase deploy --only hosting
```

Firestore rules değişirse:

```bash
npx firebase deploy --only firestore:rules
```

Hosting deploy çıktısında şu adres görünmelidir:

```text
Hosting URL: https://ders-tak.web.app
```

## GitHub Aktarım

Değişiklikleri kaydetmek için:

```bash
git status
git add <dosyalar>
git commit -m "Kısa açıklama"
git push origin main
```

Başka IDE'de devam ederken önce güncel dalı çek:

```bash
git fetch origin
git checkout main
git pull origin main
npm install
npm run dev:stable
```

## Veri Akışı Özeti

- Veli görev atar.
- `App.tsx` içindeki görev state'i güncellenir.
- Görev IndexedDB'ye hızlıca yazılır.
- Firebase sync hazırsa Firestore `tasks` bölümüne publish edilir.
- Çocuk paneli aynı `tasks` listesinden bekleyen görevleri okur.
- Çocuk görevi tamamlayınca görev ve performans verileri güncellenir.
- Firestore listener açık cihazlarda güncel durumu çeker.

## Son Çalışma Durumu

2026-06-03 itibarıyla:

- Görev atama yenileme sonrası kaybolma sorunu düzeltildi.
- Görev ekleme/silme işlemleri IndexedDB'ye anında yazılıyor.
- Firebase eski snapshot'ın yeni yerel görevi ezmesini engelleyen local-dirty guard eklendi.
- Atanan görevler veli panelinde listeleniyor.
- Atanan görevler en yeni en üstte olacak şekilde sıralanıyor.
- Veli görev satırında `Sil` ve `Tekrarla` aksiyonları var.
- Görev atandıktan sonra modal kapanıyor ve görünür onay mesajı çıkıyor.
- Arama alanı kaldırıldı; bildirim paneli üst barda doğru konuma alındı.
- Firebase Hosting deploy edildi: https://ders-tak.web.app
- Son doğrulamalar: `typecheck`, `smoke`, `build` geçti.

## Tasarım Notu

Genel uygulama dili Vanguard Velvet / iOS cam yüzey mimarisidir:

- `ios-card`, `ios-widget`, `ios-button`, `ios-button-active`
- `var(--dr-surface)`, `var(--dr-text-primary)`, `var(--dr-text-secondary)`, `var(--dr-orange)`
- Yumuşak cam yüzey, kontrollü kontrast, koyu/açık tema uyumu

Görev satırı renkleri şu an ders ayrımını güçlendirmek için daha belirgin bırakıldı. Daha sonra genel kadifemsi mimariye yumuşatılması ayrıca ele alınacak.
