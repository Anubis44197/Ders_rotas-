# Ebeveyn Planlama Akisi Duzeltme Plani

## Ozet

Planlama ekrani ebeveyn icin tek komuta merkezi olacak. Ders/k konu girisi, okul programi, evde calisma zamani, sinav takvimi ve haftalik plan uretimi birbirinden kopuk sayfalar gibi degil, ayni haftalik plan mantigi icinde yonetilecek.

## Temel Degisiklikler

- Ust navigasyonda Sinavlar ayri ana bolum gibi one cikarilmayacak; sinav girisi Planlama > Haftalik Planlar > Sinav Takvimi icinde kalacak.
- Gorevler ayri buyuk veri giris sayfasi gibi davranmayacak; aktif haftalik planin gorev/uygulama takibi olarak kucultulecek.
- Haftalik okul programindaki "Ders gir" ifadeleri kaldirilacak; okul ders blogu ve ev calisma penceresi net ayrilacak.
- Ders/k konu olusturma tek kaynakta kalacak: mufredat/ders yonetimi. Haftalik program ekrani yeni ders olusturmayacak.
- Planlama ekranindaki kart icinde kart yapisi azaltilacak; tek genis planlama yuzeyi, kompakt bolumler ve daha az bosluk kullanilacak.

## Uygulama Kararlari

- Haftalik program modeli okul bloklari (`slots`) ile ev calisma pencerelerini (`availableWindows`) birlikte tasir.
- Plan motoru artik sabit varsayilan calisma saatleri yerine ebeveynin girdigi ev calisma pencerelerini kullanir.
- Plan uretimi okul programi, ev calisma penceresi veya gun onayi eksikse durur ve eksigi acikca soyler.
- Sinav ekleme butonu Planlama icindeki sinav takviminde kalir.
- Gorev takibi aktif plan ciktisi olarak Planlama icinde okunur; ayri ana sayfa agirligi verilmez.

## Test Planı

- Ebeveyn gorunumunde ders/k konu girisinin tek kaynakta kaldigi kontrol edilir.
- Haftalik okul programinda "Ders gir" ifadesi kalmadigi dogrulanir.
- Ev calisma penceresi eklenmeden plan uretiminin eksik veri uyarisi verdigi kontrol edilir.
- Sinav ekleme akisi Planlama icindeki sinav takviminden acilir.
- `npm run typecheck`, `npm run build` ve `npm run smoke` calistirilir.
- Tarayicida Planlama ekrani mobil ve masaustu gorunumde kart yogunlugu, tasan metin ve bosluk acisindan kontrol edilir.

## Sonraki Adim

Bu ilk uygulama bilgi mimarisi, isimlendirme ve veri zemini duzeltmesidir. Sonraki adimda plan motorunun daha akilli ders/konu dagitim kurallari ve sinav baskisi derinlestirilecek.
