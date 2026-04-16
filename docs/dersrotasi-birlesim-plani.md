# DersRotasi Birlesim Plani

## Ana karar
- Temel repo: `ders-tak-p2`
- Eklenecek cekirdek moduller: `mufredat-y-neti-mi`
- Hedef: Android tablet icin offline-first tek uygulama
- Kisa vadede Firebase, remote assignment ve web deploy yok

## Neden bu temel
`ders-tak-p2` zaten su modullere sahip:
- cocuk paneli
- ebeveyn paneli
- gorev tamamlama akisi
- puan, odul, rozet mantigi
- analiz ve grafik bilesenleri
- veri disa aktarma / ice aktarma temeli

`mufredat-y-neti-mi` ise su cekirdegi sagliyor:
- mufredat veri modeli
- unite / konu yapisi
- haftalik plan olusturma mantigi
- ders programina gore planlama
- plan ile rapor arasindaki bag

## Erisim kurali`r`n- `CurriculumPage`, haftalik plan olusturma, ders programi ayarlari ve plan reset islemleri sadece ebeveyn tarafinda olacak.`r`n- Cocuk tarafi mufredat duzenleme veya plan olusturma gormeyecek.`r`n- Cocuk sadece kendisine dusen bugunku gorevleri, oturum ekranini, ilerleme ozetini ve odul alanini gorecek.`r`n`r`n## Birlesecek ana moduller
1. `ders-tak-p2` icindeki gorev, cocuk paneli ve ebeveyn paneli korunacak.
2. `mufredat-y-neti-mi` icindeki `CurriculumPage`, `PlanPage`, `curriculumParser`, `StoredStudyPlan` modeli tasinacak.
3. Gorev modeli genisletilecek ve mufredat baglantisi eklenecek.
4. Performans analizleri sadece gorev tamamlama degil; konu, sure, dogruluk ve plan uyumu uzerinden hesaplanacak.

## Yeni domain modeli
Ana varliklar:
- `Course`
- `CurriculumUnit`
- `CurriculumTopic`
- `Task`
- `StudySession`
- `StoredStudyPlan`
- `WeeklySchedule`
- `Reward`
- `Badge`

Yeni Task alani ihtiyaci:
- `curriculumUnitName?: string`
- `curriculumTopicName?: string`
- `planWeek?: number`
- `sourcePlanId?: string`
- `sessionCount?: number`

Yeni StudySession modeli:
- `id`
- `taskId`
- `startedAt`
- `endedAt`
- `actualDuration`
- `breakTime`
- `correctCount`
- `incorrectCount`
- `focusScore`
- `successScore`

Bu ayrim gerekli cunku mevcut projede planlanan gorev ile gerceklesen performans ayni nesnede fazla yuk biriktiriyor.

## Tasima sirasi
### Faz 1
- taban repo derlenebilir halde tutulacak
- duplicate yapilar ve olu kodlar listelenecek
- entegrasyon belgeleri repo icine alinacak

### Faz 2
- `mufredat-y-neti-mi` veri modelleri bu repoya tasinacak
- `curriculumParser.ts` ve ilk mufredat yonetimi eklenecek
- ayarlara haftalik ders programi bolumu entegre edilecek

### Faz 3
- `PlanPage` mantigi bu repo UI yapisina uyarlanacak
- plan sonucunda gorevler `Task` listesine donusturulecek
- gorevlerin unite / konu baglari korunacak

### Faz 4
- rapor ve analiz mantigi yeniden yazilacak
- ders bazli, konu bazli, sure bazli ve dogruluk bazli ekranlar duzenlenecek

### Faz 5
- Android hedefi icin Capacitor kurulumu
- lokal yedekleme ve geri yukleme iyilestirmesi

## Mevcut teknik sorunlar
`ders-tak-p2`:
- `App-LocalStorage.tsx` duplicate app root
- `generateReport()` bos donuyor
- parent sifresi hardcoded `1234`
- remote/Firebase kalintilari hala var
- bazi bilesenler tek cihaz senaryosu yerine yari-remote mantik tasiyor

`mufredat-y-neti-mi`:
- performans modeli zayif
- raporlar gercek oturum verisine degil gorev tamamlama oranina yaslaniyor
- localStorage kullanimi savunmasiz
- reset akisi cok sert ve tum storage'i temizliyor

## Karar verilenler
- Firebase simdilik yok
- remote gorev atama simdilik yok
- uygulama once tablet icinde lokal calisacak
- uzaktan takip sonraki faz
- once yapi ve veri modeli duzgun kurulacak