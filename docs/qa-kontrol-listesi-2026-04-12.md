# DersRotasi QA Kontrol Listesi (12 Nisan 2026)

## Amaç
Bu liste, son sertlestirme degisikliklerinden sonra uygulamanin kritik akislarini uctan uca dogrulamak icin hazirlandi.

## Test Kurallari
- Gercek verilerle test et (mock yok).
- Her adimda beklenen sonuc dogrulanmadan sonraki adıma gecme.
- Hata bulursan asagidaki "Eksik/Hata Kayit Formu" ile aninda kayit ac.

## A. Cocuk Paneli Kritik Akislar

### A1. Gorev Baslatma Cift Tik Koruma
1. Bekleyen bir gorevde Baslat butonuna hizli sekilde art arda tikla.
2. Beklenen:
- Tek bir aktif seans acilir.
- Buton kisa sure "Baslatiliyor..." durumuna gecer.
- Ayni gorev icin ikinci seans acilmaz.

### A2. Serbest Calisma Cift Submit Koruma
1. Serbest calisma formunu doldur.
2. "Olustur ve baslat" butonuna hizli sekilde art arda tikla.
3. Beklenen:
- Tek gorev olusur.
- Buton "Olusturuluyor..." olur.
- Mukkerrer gorev olusmaz.

### A3. Odul Talep Cift Tik Koruma
1. Yeterli puana sahip bir odul sec.
2. Talep et butonuna hizli sekilde art arda tikla.
3. Beklenen:
- Puan tek sefer duser.
- Buton gecici olarak "Talep ediliyor..." olur.
- Ayni odul tek eylemde iki kez talep edilmez.

### A4. Timer Drift Dayaniklilik
1. Aktif gorev veya okuma seansi baslat.
2. 20-30 saniye sonra sekmeyi arka plana al, sonra geri don.
3. Beklenen:
- Sayaç asiri sapma yapmaz.
- Calisma/mola/duraklatma sureleri statuye gore dogru artar.

### A5. Seans Tamamlama Cift Tik Koruma
1. Seansi bitirme modalinda Tamamla butonuna art arda tikla.
2. Beklenen:
- Tek bir tamamlama islemi olur.
- Puan ve istatistik bir kez yazilir.

## B. Ebeveyn Paneli Kritik Akislar

### B1. Ders Ekleme Cift Submit
1. Ayni ders adiyla hizli art arda ekleme dene.
2. Beklenen:
- Mukkerrer ekleme olmaz.
- Gecerli durumda tek ders kaydi olusur.

### B2. Odul Ekleme Cift Submit
1. Odul formunu doldurup hizli art arda kaydet dene.
2. Beklenen:
- Tek odul kaydi olusur.

### B3. Gorev Ekleme Cift Submit
1. Gorev formunu doldurup hizli art arda kaydet dene.
2. Beklenen:
- Tek gorev kaydi olusur.

### B4. Rapor Uret Cift Tetikleme
1. Rapor Uret butonuna art arda tikla.
2. Beklenen:
- Tek rapor islemi calisir.
- Buton islem suresince kilitlenir.

### B5. Veri Islemleri Kilitleri
1. Ice Aktar / Disa Aktar / Tum Veriyi Sil butonlarini art arda dene.
2. Beklenen:
- Her islem tek sefer calisir.
- UI durum metni dogru gorunur.

### B6. Tum Veriyi Sil Cift Onay
1. Tum Veriyi Sil islemini tetikle.
2. Beklenen:
- Ilk onay penceresi gelir.
- Sonrasinda "SIL" metin dogrulamasi istenir.
- Yanlis metinde islem iptal olur.

## C. Planlama ve Rollback

### C1. Plan Uretimi Cift Tetikleme Koruma
1. Plan olustur butonuna art arda tikla.
2. Beklenen:
- Tek plan uretimi calisir.
- Ayni hafta icin cift plan olusmaz.

### C2. Plan Uretiminde Hata ve Rollback
1. Plan uretim akisini tetikle.
2. Uretim sirasinda hata uretecek bir senaryo olustur (or. ders eslesmesi bozuk veri).
3. Beklenen:
- Islem hata mesaji verir.
- O denemede acilan ara gorevler geri alinir.
- Yari plan/yari gorev durumu kalmaz.

## D. Import/Export Uyumluluk

### D1. Yeni Yedek Dosyasi
1. Disa aktar al.
2. Temiz durumda ice aktar yap.
3. Beklenen:
- Tüm ana veriler geri gelir.

### D2. Eski Yedek Toleransi
1. performanceData alani eksik bir yedek dosyasi ile ice aktar dene.
2. Beklenen:
- Import tamamen patlamaz.
- Eksik alanlar guvenli varsayilanla toparlanir.

## E. Mufredat Eslesme

### E1. Turkce Karakter Varyasyonu
1. Ders adini farkli Turkce karakter varyasyonlari ile test et.
2. Beklenen:
- Unite/Konu secimi bos gelmez.
- Normalize eslesme dogru calisir.

## Eksik/Hata Kayit Formu
Her hata icin bir kayit ac:

- ID:
- Tarih/Saat:
- Modul: (Cocuk / Ebeveyn / Planlama / Import-Export / Mufredat)
- Adimlar:
- Beklenen:
- Gerceklesen:
- Etki Seviyesi: (Kritik / Yuksek / Orta / Dusuk)
- Tekrar Edilebilirlik: (Evet / Hayir)
- Ekran Goruntusu/Video:
- Not:

## Onceliklendirme
- P0: Veri kaybi, cift puan, cift gorev, sistem kilitlenmesi
- P1: Akis bozulmasi, yanlis analiz/rapor
- P2: UI/mesaj sorunlari, kucuk tutarsizliklar

## Cikis Kriteri
- A/B/C maddelerindeki kritik testlerin tamami gecti.
- Acik P0/P1 kayit kalmadi.
- Import/Export ve Planlama rollback en az bir kez basariyla dogrulandi.
