# DersRotasi Yeniden Kurulum Plani

## Kaynak Eslestirme

### `ders-tak-p2-source` tarafindan korunacak ana omurga
- Parent moduler calisma alani
- Child gorev panosu mantigi
- Gorev, odul, performans ve analiz veri modeli
- Gorev tamamlama, puan ve istatistik zinciri

### `mufredat-y-neti-mi-source` tarafindan alinacak ana akis
- Mufredat editoru hiyerarsisi
- Plan olusturma adimlari
- Hafta bazli plan gorunumu
- Ayarlar / ders programi duzeni

## Hedef Parent Bilgi Mimarisi

1. `Genel Bakis`
   Ebeveynin ozet KPI ve riskli konulari gordugu alan.

2. `Ders Programi`
   Haftalik program ve calisma ritmi.

3. `Mufredat`
   Ders > Unite > Konu yapisinin yonetildigi editor.

4. `Planlama`
   Plan turu secimi, hafta uretimi, plan duzenleme ve cocuga aktarim.

5. `Gorevler`
   Manuel gorev atama, filtreleme ve mevcut gorev havuzu.

6. `Analiz`
   Performans, konu hakimiyeti, plan uyumu ve rapor.

## Uygulama Sirasi

1. Parent moduler kabuk
2. Ders programi ekranini yeniden tasarla
3. Mufredat ekranini yeniden tasarla
4. Planlama ekranini step bazli yap
5. Gorev ve analiz ekranlarini yeni kabuga yerlestir
6. Child panelini yeni parent akisina gore sade ama guclu hale getir
