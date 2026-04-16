# 41 Madde Icra Plani (13 Nisan 2026)

Amaç: Ilk sayfayi "Ogrenci Durum Detaylari" olarak dogru veriyle calisan, karar destek veren bir panele donusturmek.

Durum Notu:
- Build baseline: Gecti
- Ilk sayfada modül kisayol butonlari kaldirildi: Tamamlandi
- Tum dersler performans listesi: Baslatildi

## Faz 0 - Baslangic Dogrulama (3)
1. Build baseline dogrulamasi. [tamamlandi]
2. Ilk sayfa mevcut akis haritasi cikarimi. [tamamlandi]
3. Kritik veri kaynaklari envanteri (tasks, studyPlans, rewards, successPoints). [tamamlandi]

## Faz 1 - Ogrenci Durum Ekrani Iskeleti (8)
4. Ilk sayfa baslik ve kimlik: Ogrenci Durum Detaylari. [tamamlandi]
5. Modül kisayol butonlarinin temizlenmesi. [tamamlandi]
6. Ust ozet kartlari: Ders/Bekleyen/Tamamlanan/Mevcut Puan. [tamamlandi]
7. Geciken gorev karti ekleme. [tamamlandi]
8. Son aktivite karti ekleme. [tamamlandi]
9. Tum dersler performans listesi (top 4 degil tamamı). [tamamlandi]
10. Genel performans rozeti ekleme. [tamamlandi]
11. Kart hiyerarsi ve metin sadeleştirme. [tamamlandi]

## Faz 2 - Veri Dogrulugu ve Hesap Kurallari (10)
12. Harcanabilir puan = successPoints dogrulamasi. [tamamlandi]
13. Odul panelinde gorunen puanin tek kaynaga baglanmasi. [tamamlandi]
14. Ders tekrar gorevlerinin ayri sinyal olarak etiketlenmesi. [tamamlandi]
15. taskGoalType=konu-tekrari icin analizde ayri sayim. [tamamlandi]
16. Gecikme orani hesap fonksiyonu. [tamamlandi]
17. Son 7 gun odak ortalama hesap fonksiyonu. [tamamlandi]
18. Son 14 gun dogruluk trend hesap fonksiyonu. [tamamlandi]
19. Risk seviyesi esiklerinin kodlanmasi (dusuk/orta/yuksek). [tamamlandi]
20. Veri yetersiz durumunda fallback metni. [tamamlandi]
21. Ayni veride deterministik ayni sonuc testi. [tamamlandi]

## Faz 3 - UI Davranis ve Kullanilabilirlik (8)
22. Mobilde kartlarin tek sutun akisa gecmesi. [tamamlandi]
23. Risk kartlarinda renk semantiği birlestirme. [tamamlandi]
24. Ders performans satirlarinda tutarli metrik sirasi. [tamamlandi]
25. Bos durum metinlerinin standardizasyonu. [tamamlandi]
26. Uzun ders adlarinda satir kirilma duzeltmesi. [tamamlandi]
27. Tooltip/yardim metni: metrik tanimlari. [tamamlandi]
28. Son aktivite satirinda tarih gosterimi. [tamamlandi]
29. Durum kartlarinda tekrar hesaplanan degerlerin memo optimize edilmesi. [tamamlandi]

## Faz 4 - Odul Mekanizmasi Iyilestirme (6)
30. Odul buton renk esiklerinin kalibrasyonu. [tamamlandi]
31. Odul listesinde "ulasilabilir" etiketi. [tamamlandi]
32. Odul listesinde "birikiyor" etiketi. [tamamlandi]
33. Odul listeleme siniri (ilk 8) yerine acilir tum liste. [tamamlandi]
34. Odul olusturmada ayni ad + ayni puan duplicate korumasi. [tamamlandi]
35. Odul islemlerinde islem toast metin standardi. [tamamlandi]

## Faz 5 - Test ve Kapanis (6)
36. Gorev atama > tamamlama > puan > odul akisi uctan uca test. [tamamlandi]
37. Soru cozme / ders calisma / ders tekrar gorev turu senaryolari. [tamamlandi]
38. Import/export sonrasi ilk sayfa metrik tutarliligi testi. [tamamlandi]
39. QA raporuna P0/P1 bulgu kaydi ve kapama. [tamamlandi]
40. Son build + manuel smoke test (desktop + mobile). [tamamlandi]
41. Final degisiklik ozeti ve release notu. [tamamlandi]

## Icra Sirası
- Once Faz 1 tamamlanir.
- Sonra Faz 2 (veri dogrulugu) bitirilmeden Faz 3'e gecilmez.
- Faz 4, Faz 2 ile birlikte kismi ilerleyebilir.
- Faz 5 kapanis fazidir.
