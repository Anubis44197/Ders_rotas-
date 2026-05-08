# Ders Merkezi Karar Dosyasi (7 Mayis 2026)

## Amac
Ders ekleme, duzenleme, pasiflestirme ve silme davranisini tek kaynak uzerinden netlestirmek. Bu karar dosyasi olmadan ders modeli refactoruna girilmeyecek.

## Ana Karar
Ders icin tek kaynak `Ders Merkezi` olacak. Planlama, mufredat, gorev, sinav, analiz ve rapor modulleri yeni ders olusturmayacak; yalnizca Ders Merkezi'nden gelen aktif ders listesini kullanacak.

## Hedef Course Sozlesmesi
```ts
Course {
  id: string;
  name: string;
  active: boolean;
  order: number;
  icon?: string;
}
```

Gecis doneminde mevcut `Course` kayitlari `active: true` ve mevcut liste sirasina gore `order` almis kabul edilecek.

## Silme ve Pasiflestirme Politikasi
- Varsayilan aksiyon `pasiflestir` olacak.
- Pasif ders yeni gorev, yeni sinav, yeni okul programi blogu ve yeni plan uretiminde secilemeyecek.
- Pasif ders gecmis gorevlerde, sinav kayitlarinda, plan gecmisinde ve analiz arsivinde gorunmeye devam edecek.
- Kalici silme ikinci seviye tehlikeli aksiyon olacak ve yalnizca hic bagli veri yoksa onerilecek.
- Bagli veri varsa kalici silme yerine pasiflestirme yapilacak; kullaniciya hangi kayitlarin dersi kullandigi gosterilecek.

## Bagli Veri Kurali
Asagidaki veriler `courseId` ile baglanmali:
- gorevler
- okul sinavi kayitlari
- deneme/genel sinav ders satirlari
- performans verisi
- plan gorevleri
- okul programi ders bloklari
- ev calisma plani bloklari
- analiz ve rapor ciktilari

Mufredat su an ders adi anahtariyla calisiyor. Refactor sirasinda gecici uyumluluk katmani korunacak:
- `courseId -> course.name` gorunum icin kullanilir.
- Eski mufredat anahtarlari normalize edilerek aktif dersle eslestirilir.
- Yeni kayitlarda hedef `courseId` bazli mufredat baglantisidir.

## UI Kurallari
- Ders olusturma sadece Ders Merkezi'nde olacak.
- Planlama ekrani ders olusturmayacak; mevcut aktif dersleri okul/ev zaman bloklarina baglayacak.
- Mufredat editoru ders iskeletini Ders Merkezi'nden gelen derslerle iliskilendirecek.
- Haftalik programda ders listesi sadece aktif derslerden gelecek.
- Analiz ekraninda pasif dersler, gecmis veri varsa "arsiv" tonu ile okunur kalacak.

## Gecis Adimlari
1. `Course` modeline `active` ve `order` alanlarini ekle.
2. LocalStorage/import normalizasyonunda eski derslere varsayilan `active: true`, `order: index` ata.
3. Aktif ders selector'u olustur; yeni veri giris formlari sadece bunu kullansin.
4. Ders silme modalini pasiflestirme odakli hale getir.
5. Kalici silme icin bagli veri sayaci ekle.
6. Mufredat anahtari ile `courseId` arasinda uyumluluk katmani kur.
7. Hayalet ders ve kirik referans taramasi ekle.

## Kabul Kriterleri
- Kullanici dersi nerede ekleyecegini tek bakista anlar.
- Planlama, sinav, gorev ve analiz yeni ders olusturma noktasi gibi davranmaz.
- Pasif ders gecmis veriyi bozmaz.
- Bagli verisi olan ders kalici silinmez.
- `typecheck`, `build`, `smoke` ve tarayici QA gecer.

## Acik Sorular
- Pasif ders tekrar aktif edilince eski planlama bloklari da tekrar onerilecek mi, yoksa yalnizca yeni kayitlarda mi aktif olacak?
- Mufredat tamamen `courseId` bazli modele ne zaman tasinacak?
- Genel sinavlarda artik aktif olmayan ders satirlari raporda hangi etiketle gosterilecek?
