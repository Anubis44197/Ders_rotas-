import type { Course, PerformanceData, SubjectCurriculum } from './types';

export const INITIAL_REAL_COURSES: Course[] = [
  {
    id: "course_matematik",
    name: "Matematik",
    active: true,
    order: 0,
    icon: "BookOpen"
  },
  {
    id: "course_inkilap_tarihi",
    name: "T.C. İnkılap Tarihi ve Atatürkçülük",
    active: true,
    order: 1,
    icon: "BookOpen"
  },
  {
    id: "course_fen_bilgisi",
    name: "Fen Bilgisi",
    active: true,
    order: 2,
    icon: "BookOpen"
  },
  {
    id: "course_din_kulturu",
    name: "Din Kültürü ve Ahlak Bilgisi",
    active: true,
    order: 3,
    icon: "BookOpen"
  },
  {
    id: "course_ingilizce",
    name: "Ingilizce",
    active: true,
    order: 4,
    icon: "BookOpen"
  },
  {
    id: "course_turkce",
    name: "Türkçe",
    active: true,
    order: 5,
    icon: "BookOpen"
  }
];

export const INITIAL_REAL_PERFORMANCE: PerformanceData[] = [
  {
    courseId: "course_matematik",
    courseName: "Matematik",
    correct: 0,
    incorrect: 0,
    timeSpent: 0
  },
  {
    courseId: "course_inkilap_tarihi",
    courseName: "T.C. İnkılap Tarihi ve Atatürkçülük",
    correct: 0,
    incorrect: 0,
    timeSpent: 0
  },
  {
    courseId: "course_fen_bilgisi",
    courseName: "Fen Bilgisi",
    correct: 0,
    incorrect: 0,
    timeSpent: 0
  },
  {
    courseId: "course_din_kulturu",
    courseName: "Din Kültürü ve Ahlak Bilgisi",
    correct: 0,
    incorrect: 0,
    timeSpent: 0
  },
  {
    courseId: "course_ingilizce",
    courseName: "Ingilizce",
    correct: 0,
    incorrect: 0,
    timeSpent: 0
  },
  {
    courseId: "course_turkce",
    courseName: "Türkçe",
    correct: 0,
    incorrect: 0,
    timeSpent: 0
  }
];

export const INITIAL_REAL_CURRICULUM: SubjectCurriculum = {
  Matematik: [
    {
      name: "1. Ünite",
      topics: [
        {
          name: "Çarpanlar ve Katlar: Pozitif tam sayıların pozitif tam sayı çarpanlarını bulma, pozitif tam sayıları üslü ifade ya da üslü ifadelerin çarpımı şeklinde yazma",
          completed: false
        },
        {
          name: "Çarpanlar ve Katlar: İki doğal sayının en büyük ortak böleni ve en küçük ortak katı",
          completed: false
        },
        {
          name: "Çarpanlar ve Katlar: Aralarında asal sayılar",
          completed: false
        },
        {
          name: "Üslü İfadeler: Tam sayıların tam sayı kuvvetleri",
          completed: false
        },
        {
          name: "Üslü İfadeler: Üslü ifadeler ile ilgili temel kurallar",
          completed: false
        },
        {
          name: "Üslü İfadeler: Ondalık gösterimleri çözümleme",
          completed: false
        },
        {
          name: "Üslü İfadeler: Bir sayıyı 10’un farklı tam sayı kuvvetlerini kullanarak ifade etme ve bilimsel gösterim",
          completed: false
        }
      ]
    },
    {
      name: "2. Ünite",
      topics: [
        {
          name: "Kareköklü İfadeler: Tam kare pozitif tam sayılar ile bu sayıların karekökleri arasındaki ilişki",
          completed: false
        },
        {
          name: "Kareköklü İfadeler: Tam kare olmayan kareköklü bir ifadenin değerinin bulunduğu sayı aralıkları",
          completed: false
        },
        {
          name: "Kareköklü İfadeler: Kareköklü bir ifadeyi a√b şeklinde yazma ve a√b şeklindeki ifadede katsayıyı kök içine alma",
          completed: false
        },
        {
          name: "Kareköklü İfadeler: Kareköklü ifadelerde çarpma ve bölme işlemleri",
          completed: false
        },
        {
          name: "Kareköklü İfadeler: Kareköklü ifadelerde toplama ve çıkarma işlemleri",
          completed: false
        },
        {
          name: "Kareköklü İfadeler: Kareköklü bir ifade ile çarpıldığında sonucu doğal sayı yapan çarpanlar",
          completed: false
        },
        {
          name: "Kareköklü İfadeler: Ondalık ifadelerin karekökleri",
          completed: false
        },
        {
          name: "Kareköklü İfadeler: Gerçek sayılar",
          completed: false
        },
        {
          name: "Veri Analizi: Çizgi ve sütun grafikleri",
          completed: false
        },
        {
          name: "Veri Analizi: Verilerin farklı gösterimleri",
          completed: false
        }
      ]
    },
    {
      name: "3. Ünite",
      topics: [
        {
          name: "Basit Olayların Olma Olasılığı: Basit olayların olma olasılığı",
          completed: false
        },
        {
          name: "Cebirsel İfadeler ve Özdeşlikler: Basit cebirsel ifadeler ve cebirsel ifadelerle çarpma işlemi",
          completed: false
        },
        {
          name: "Cebirsel İfadeler ve Özdeşlikler: Özdeşlikler",
          completed: false
        },
        {
          name: "Cebirsel İfadeler ve Özdeşlikler: Cebirsel ifadeleri çarpanlara ayırma",
          completed: false
        }
      ]
    },
    {
      name: "4. Ünite",
      topics: [
        {
          name: "Doğrusal Denklemler: Birinci dereceden bir bilinmeyenli denklemler",
          completed: false
        },
        {
          name: "Doğrusal Denklemler: Koordinat sistemi",
          completed: false
        },
        {
          name: "Doğrusal Denklemler: Aralarında doğrusal ilişki bulunan değişkenler",
          completed: false
        },
        {
          name: "Doğrusal Denklemler: Doğrusal denklemlerin grafiği",
          completed: false
        },
        {
          name: "Doğrusal Denklemler: Doğrusal ilişki içeren gerçek hayat durumları",
          completed: false
        },
        {
          name: "Doğrusal Denklemler: Eğim",
          completed: false
        },
        {
          name: "Eşitsizlikler: Eşitsizlikler",
          completed: false
        }
      ]
    },
    {
      name: "5. Ünite",
      topics: [
        {
          name: "Üçgenler: Üçgende açıortay, kenarortay ve yükseklik",
          completed: false
        },
        {
          name: "Üçgenler: Üçgenlerin kenarları arasındaki ilişkiler",
          completed: false
        },
        {
          name: "Üçgenler: Üçgenlerin kenar uzunlukları ile açı ölçüleri arasındaki ilişkiler",
          completed: false
        },
        {
          name: "Üçgenler: Yeterli sayıda elemanının ölçüleri verilen bir üçgeni çizme",
          completed: false
        },
        {
          name: "Üçgenler: Pisagor bağıntısı",
          completed: false
        },
        {
          name: "Üçgenler: Eşlik ve benzerlik",
          completed: false
        }
      ]
    },
    {
      name: "6. Ünite",
      topics: [
        {
          name: "Dönüşüm Geometrisi: Öteleme ve yansıma",
          completed: false
        },
        {
          name: "Dönüşüm Geometrisi: Öteleme",
          completed: false
        },
        {
          name: "Dönüşüm Geometrisi: Yansıma",
          completed: false
        },
        {
          name: "Dönüşüm Geometrisi: Çokgenlerin öteleme ve yansımalar sonucu oluşan görüntüleri",
          completed: false
        },
        {
          name: "Geometrik Cisimler: Dik prizma",
          completed: false
        },
        {
          name: "Geometrik Cisimler: Dik dairesel silindir",
          completed: false
        },
        {
          name: "Geometrik Cisimler: Dik dairesel silindirin temel elemanları ve açınımı",
          completed: false
        },
        {
          name: "Geometrik Cisimler: Dik dairesel silindirin yüzey alanı",
          completed: false
        },
        {
          name: "Geometrik Cisimler: Dik dairesel silindirin hacmi",
          completed: false
        },
        {
          name: "Geometrik Cisimler: Dik piramit",
          completed: false
        },
        {
          name: "Geometrik Cisimler: Dik koni",
          completed: false
        }
      ]
    }
  ],
  "T.C. İnkılap Tarihi ve Atatürkçülük": [
    {
      name: "1. Ünite: Bir Kahraman Doğuyor",
      topics: [
        {
          name: "XX. Yüzyılın başlarında Osmanlı Devleti’nin siyasi ve sosyal durumu",
          completed: false
        },
        {
          name: "Mustafa Kemal’in eğitim hayatı",
          completed: false
        },
        {
          name: "Mustafa Kemal’in fikir hayatının oluşması",
          completed: false
        },
        {
          name: "Mustafa Kemal’in askerlik hayatı",
          completed: false
        }
      ]
    },
    {
      name: "2. Ünite: Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar",
      topics: [
        {
          name: "Birinci Dünya Savaşı ve savaşın gelişimi",
          completed: false
        },
        {
          name: "Birinci Dünya Savaşı ve bloklar",
          completed: false
        },
        {
          name: "Osmanlı Devleti’nin Birinci Dünya Savaşı’na girmesi",
          completed: false
        },
        {
          name: "Birinci Dünya Savaşı ve Osmanlı Devleti",
          completed: false
        },
        {
          name: "Birinci Dünya Savaşı’nda Osmanlı Devleti’nin savaştığı cepheler",
          completed: false
        },
        {
          name: "Mondros Ateşkes Antlaşması ve antlaşmaya tepkiler",
          completed: false
        },
        {
          name: "Mondros Ateşkes Antlaşması (30 Ekim 1918)",
          completed: false
        },
        {
          name: "Mondros Ateşkes Antlaşması’nın uygulanması ve antlaşmaya tepkiler",
          completed: false
        },
        {
          name: "Paris Barış Konferansı ve konferansın sonuçları",
          completed: false
        },
        {
          name: "İzmir’in İşgali (15 Mayıs 1919)",
          completed: false
        },
        {
          name: "Memleketin genel durumu, Kuvâ-yı Millîye ve cemiyetler",
          completed: false
        },
        {
          name: "Kuvâ-yı Millîye ruhunun ortaya çıkışı",
          completed: false
        },
        {
          name: "Memleketin genel durumu ve cemiyetler",
          completed: false
        },
        {
          name: "Millî Mücadele’nin hazırlık dönemi",
          completed: false
        },
        {
          name: "Mustafa Kemal Paşa’nın İstanbul’a gelişi ve çözüm arayışları",
          completed: false
        },
        {
          name: "Millî Mücadele’nin başlaması",
          completed: false
        },
        {
          name: "Millî birliği sağlama çalışmaları",
          completed: false
        },
        {
          name: "Millî Mücadele’nin hazırlık aşamasında Mustafa Kemal Paşa’nın sorunlara çözüm arayışları",
          completed: false
        },
        {
          name: "Ulusal egemenlik gerçekleşiyor",
          completed: false
        },
        {
          name: "Temsil Heyetinin Ankara’ya gelişi (27 Aralık 1919)",
          completed: false
        },
        {
          name: "Misakımillî’nin kabulü (28 Ocak 1920)",
          completed: false
        },
        {
          name: "Büyük Millet Meclisinin açılması (23 Nisan 1920)",
          completed: false
        },
        {
          name: "Büyük Millet Meclisine yönelik ayaklanmalar",
          completed: false
        },
        {
          name: "Ulusal egemenliği yok etme faaliyetleri",
          completed: false
        },
        {
          name: "Büyük Millet Meclisinin ayaklanmalara yönelik aldığı tedbirler",
          completed: false
        },
        {
          name: "Sevr Antlaşması ve antlaşmaya tepkiler",
          completed: false
        },
        {
          name: "Ölü doğan bir antlaşma",
          completed: false
        },
        {
          name: "Sevr Antlaşması’nın sonuçları ve antlaşmaya tepkiler",
          completed: false
        }
      ]
    },
    {
      name: "3. Ünite: Millî Bir Destan: Ya İstiklal Ya Ölüm!",
      topics: [
        {
          name: "Millî Mücadele Dönemi’nde Doğu ve Güney Cephesi",
          completed: false
        },
        {
          name: "Ermenilere karşı Doğu Cephesi",
          completed: false
        },
        {
          name: "Destansı bir mücadele (Güney Cephesi)",
          completed: false
        },
        {
          name: "Millî Mücadele Dönemi’nde Batı Cephesi",
          completed: false
        },
        {
          name: "Düzenli ordunun kurulması",
          completed: false
        },
        {
          name: "I. İnönü Muharebesi ve muharebenin sonuçları",
          completed: false
        },
        {
          name: "II. İnönü Muharebesi ve muharebenin sonuçları",
          completed: false
        },
        {
          name: "Kütahya-Eskişehir Muharebeleri ve muharebelerin sonuçları",
          completed: false
        },
        {
          name: "Millî Mücadele Dönemi’nde Eğitim (Maarif) Kongresi",
          completed: false
        },
        {
          name: "Topyekûn bir mücadele",
          completed: false
        },
        {
          name: "Mustafa Kemal Paşa’nın başkomutan seçilmesi",
          completed: false
        },
        {
          name: "Tekalif-i Millîye Emirleri’nin çıkarılması (7-8 Ağustos 1921)",
          completed: false
        },
        {
          name: "Türk halkının Millî Mücadele dayanışması",
          completed: false
        },
        {
          name: "Sakarya Meydan Savaşı ve Büyük Taarruz",
          completed: false
        },
        {
          name: "Sakarya Meydan Savaşı (26 Ağustos-13 Eylül 1921)",
          completed: false
        },
        {
          name: "Kars Antlaşması (13 Ekim 1921)",
          completed: false
        },
        {
          name: "Ankara Antlaşması (20 Ekim 1921)",
          completed: false
        },
        {
          name: "Büyük Taarruz ve Başkomutanlık Meydan Savaşı (26 Ağustos-18 Eylül 1922)",
          completed: false
        },
        {
          name: "Mudanya Ateşkes Antlaşması (11 Ekim 1922)",
          completed: false
        },
        {
          name: "Kalıcı barış: Lozan Barış Antlaşması",
          completed: false
        },
        {
          name: "Lozan Barış Antlaşması ve antlaşmanın sonuçları",
          completed: false
        },
        {
          name: "Millî Mücadele Dönemi’nde sanat ve edebiyat",
          completed: false
        }
      ]
    },
    {
      name: "4. Ünite: Atatürkçülük ve Çağdaşlaşan Türkiye",
      topics: [
        {
          name: "Atatürk ilkeleri ve bu ilkelerin özellikleri",
          completed: false
        },
        {
          name: "Siyasi alanda yapılan inkılaplar",
          completed: false
        },
        {
          name: "Saltanatın kaldırılması (1 Kasım 1922)",
          completed: false
        },
        {
          name: "Ankara’nın başkent oluşu (13 Ekim 1923)",
          completed: false
        },
        {
          name: "Cumhuriyetin ilan edilmesi (29 Ekim 1923)",
          completed: false
        },
        {
          name: "Halifeliğin kaldırılması (3 Mart 1924)",
          completed: false
        },
        {
          name: "Şeriye ve Evkâf Vekâletinin kaldırılması (3 Mart 1924)",
          completed: false
        },
        {
          name: "Erkân-ı Harbiye Vekâletinin kaldırılması (3 Mart 1924)",
          completed: false
        },
        {
          name: "1924 Anayasası’nın kabulü",
          completed: false
        },
        {
          name: "Hukuk alanında yapılan inkılaplar",
          completed: false
        },
        {
          name: "Hukukta birliğin sağlanması",
          completed: false
        },
        {
          name: "Türk Medeni Kanunu’nun kabulü (17 Şubat 1926)",
          completed: false
        },
        {
          name: "Eğitim ve kültür alanında yapılan inkılaplar",
          completed: false
        },
        {
          name: "Tevhid-i Tedrisat Kanunu’nun kabulü (3 Mart 1924)",
          completed: false
        },
        {
          name: "Harf İnkılabı (1 Kasım 1928)",
          completed: false
        },
        {
          name: "Millet Mekteplerinin açılması",
          completed: false
        },
        {
          name: "Millî kültürümüzü oluşturma yönünde yapılan faaliyetler",
          completed: false
        },
        {
          name: "Tarih alanında yapılan çalışmalar",
          completed: false
        },
        {
          name: "Dil alanında yapılan çalışmalar",
          completed: false
        },
        {
          name: "Üniversite reformu",
          completed: false
        },
        {
          name: "Sanat ve spor alanında yapılan çalışmalar",
          completed: false
        },
        {
          name: "Toplumsal alanda yapılan inkılaplar",
          completed: false
        },
        {
          name: "Şapka ve kıyafet inkılabı",
          completed: false
        },
        {
          name: "Tekke, zaviye ve türbelerin kapatılması",
          completed: false
        },
        {
          name: "Takvim, saat ve ölçülerde değişiklik yapılması",
          completed: false
        },
        {
          name: "Soyadı Kanunu’nun kabulü",
          completed: false
        },
        {
          name: "Türk kadınına sağlanan siyasi ve sosyal haklar",
          completed: false
        },
        {
          name: "Ekonomi alanında yapılan inkılaplar",
          completed: false
        },
        {
          name: "Millî ekonomiye geçiş (İzmir İktisat Kongresi-17 Şubat 1923)",
          completed: false
        },
        {
          name: "Sanayi alanında yapılan çalışmalar",
          completed: false
        },
        {
          name: "Tarım alanında yapılan çalışmalar",
          completed: false
        },
        {
          name: "Ticaret ve denizcilik alanlarında yapılan çalışmalar",
          completed: false
        },
        {
          name: "Sağlık alanında yapılan inkılaplar",
          completed: false
        },
        {
          name: "Yaşasın Cumhuriyet!",
          completed: false
        },
        {
          name: "Büyük Nutuk ve Onuncu Yıl Nutku",
          completed: false
        },
        {
          name: "Türk gençliğinin görevleri ve sorumlulukları",
          completed: false
        },
        {
          name: "Atatürk’ün bazı kişilik özellikleri",
          completed: false
        },
        {
          name: "Atatürk ilke ve inkılaplarını oluşturan temel esaslar",
          completed: false
        }
      ]
    },
    {
      name: "5. Ünite: Demokratikleşme Çabaları",
      topics: [
        {
          name: "Türkiye Cumhuriyeti’nin demokratikleşme süreci",
          completed: false
        },
        {
          name: "Demokratikleşme yolunda atılan adımlar",
          completed: false
        },
        {
          name: "Cumhuriyet Halk Fırkasının faaliyetleri",
          completed: false
        },
        {
          name: "Terakkiperver Cumhuriyet Fırkasının kurulması",
          completed: false
        },
        {
          name: "Serbest Cumhuriyet Fırkasının kurulması",
          completed: false
        },
        {
          name: "Mustafa Kemal Paşa’ya suikast girişimi",
          completed: false
        },
        {
          name: "Türkiye Cumhuriyeti’ne yönelik iç ve dış tehditler",
          completed: false
        },
        {
          name: "Türkiye’nin jeopolitik konumu",
          completed: false
        },
        {
          name: "Ülkemizin her geçen gün güçlenmesi",
          completed: false
        },
        {
          name: "İç ve dış tehditler karşısında sorumluluklarımız",
          completed: false
        }
      ]
    },
    {
      name: "6. Ünite: Atatürk Dönemi Türk Dış Politikası",
      topics: [
        {
          name: "Atatürk Dönemi Türk dış politikasının temel ilkeleri ve amaçları",
          completed: false
        },
        {
          name: "1923-1938 yılları arasında Türk dış politikası",
          completed: false
        },
        {
          name: "Lozan Barış Antlaşması’nın Türk dış politikasına etkileri",
          completed: false
        },
        {
          name: "Yabancı okullar sorunu",
          completed: false
        },
        {
          name: "Dış borçlar sorunu",
          completed: false
        },
        {
          name: "Musul sorunu",
          completed: false
        },
        {
          name: "Nüfus mübadelesi",
          completed: false
        },
        {
          name: "Milletler Cemiyetine giriş (18 Temmuz 1932)",
          completed: false
        },
        {
          name: "Balkan Antantı (9 Şubat 1934)",
          completed: false
        },
        {
          name: "Montreux Boğazlar Sözleşmesi (20 Temmuz 1936)",
          completed: false
        },
        {
          name: "Sadabat Paktı (8 Temmuz 1937)",
          completed: false
        },
        {
          name: "Hatay’ın Türkiye’ye katılması",
          completed: false
        }
      ]
    },
    {
      name: "7. Ünite: Atatürk’ün Ölümü ve Sonrası",
      topics: [
        {
          name: "Atatürk’ün ölümünün yankıları",
          completed: false
        },
        {
          name: "İsmet İnönü’nün cumhurbaşkanı seçilmesi",
          completed: false
        },
        {
          name: "Atatürk’ün Türk milletine bıraktığı eserleri",
          completed: false
        },
        {
          name: "Yeni bir savaşa doğru",
          completed: false
        },
        {
          name: "İkinci Dünya Savaşı’nı hazırlayan gelişmeler",
          completed: false
        },
        {
          name: "İkinci Dünya Savaşı öncesinde Türkiye",
          completed: false
        },
        {
          name: "İkinci Dünya Savaşı’nın sonuçları ve Türkiye’ye etkileri",
          completed: false
        },
        {
          name: "İkinci Dünya Savaşı ve savaşın sonuçları",
          completed: false
        },
        {
          name: "İkinci Dünya Savaşı’nın Türkiye’ye etkileri",
          completed: false
        },
        {
          name: "Çok partili sisteme yeniden geçiş",
          completed: false
        }
      ]
    }
  ],
  "Fen Bilgisi": [
  {
    "name": "1. Ünite: Mevsimler ve İklim",
    "topics": [
      {
        "name": "Mevsimlerin Oluşumu: Mevsimler",
        "completed": false
      },
      {
        "name": "İklim ve Hava Hareketleri: İklim ve hava olayları arasındaki fark",
        "completed": false
      },
      {
        "name": "İklim ve Hava Hareketleri: Hava olayı nedir?",
        "completed": false
      },
      {
        "name": "İklim ve Hava Hareketleri: İklim nedir?",
        "completed": false
      },
      {
        "name": "İklim ve Hava Hareketleri: İklim değişikliği",
        "completed": false
      }
    ]
  },
  {
    "name": "2. Ünite: DNA ve Genetik Kod",
    "topics": [
      {
        "name": "DNA ve Genetik Kod: Nükleotid, gen, DNA ve kromozom arasındaki ilişki",
        "completed": false
      },
      {
        "name": "DNA ve Genetik Kod: DNA’nın yapısı",
        "completed": false
      },
      {
        "name": "DNA ve Genetik Kod: DNA’nın kendini eşlemesi",
        "completed": false
      },
      {
        "name": "Kalıtım: Kalıtım",
        "completed": false
      },
      {
        "name": "Kalıtım: Kalıtımla ilgili kavramlar",
        "completed": false
      },
      {
        "name": "Kalıtım: Tek karakter çaprazlamaları",
        "completed": false
      },
      {
        "name": "Kalıtım: Akraba evliliklerinin genetik sonuçları",
        "completed": false
      },
      {
        "name": "Mutasyon ve Modifikasyon: Mutasyon",
        "completed": false
      },
      {
        "name": "Mutasyon ve Modifikasyon: Modifikasyon",
        "completed": false
      },
      {
        "name": "Mutasyon ve Modifikasyon: Mutasyon ve modifikasyon arasındaki fark",
        "completed": false
      },
      {
        "name": "Adaptasyon: Canlıların yaşadıkları çevreye uyumları",
        "completed": false
      },
      {
        "name": "Biyoteknoloji: Genetik mühendisliği ve biyoteknoloji arasındaki ilişki",
        "completed": false
      },
      {
        "name": "Biyoteknoloji: Genetik mühendisliği ve biyoteknolojinin geleceği",
        "completed": false
      }
    ]
  },
  {
    "name": "3. Ünite: Basınç",
    "topics": [
      {
        "name": "Basınç: Katı basıncı",
        "completed": false
      },
      {
        "name": "Basınç: Sıvı basıncı",
        "completed": false
      },
      {
        "name": "Basınç: Sıvı basıncına etki eden etmenler",
        "completed": false
      },
      {
        "name": "Basınç: Gazların basıncı",
        "completed": false
      },
      {
        "name": "Basınç: Katı, sıvı ve gazların basınç özelliklerinden yararlanılarak geliştirilen teknolojiler",
        "completed": false
      }
    ]
  },
  {
    "name": "4. Ünite: Madde ve Endüstri",
    "topics": [
      {
        "name": "Periyodik Sistem: Periyodik sistem",
        "completed": false
      },
      {
        "name": "Periyodik Sistem: Periyodik sistemin oluşturulması",
        "completed": false
      },
      {
        "name": "Periyodik Sistem: Periyotlar",
        "completed": false
      },
      {
        "name": "Periyodik Sistem: Gruplar",
        "completed": false
      },
      {
        "name": "Periyodik Sistem: Elementlerin periyodik sistem üzerinde sınıflandırılması",
        "completed": false
      },
      {
        "name": "Periyodik Sistem: Metaller",
        "completed": false
      },
      {
        "name": "Periyodik Sistem: Ametaller",
        "completed": false
      },
      {
        "name": "Periyodik Sistem: Yarı metaller",
        "completed": false
      },
      {
        "name": "Fiziksel ve Kimyasal Değişimler",
        "completed": false
      },
      {
        "name": "Kimyasal Tepkimeler: Bileşikler kimyasal tepkimeler sonucunda oluşur",
        "completed": false
      },
      {
        "name": "Asitler ve Bazlar: Asit ve bazların genel özellikleri",
        "completed": false
      },
      {
        "name": "Asitler ve Bazlar: Maddelerin asitlik ve bazlık durumlarına ilişkin pH değerleri",
        "completed": false
      },
      {
        "name": "Asitler ve Bazlar: Asit yağmurları",
        "completed": false
      },
      {
        "name": "Maddenin Isı ile Etkileşimi: Isı ve sıcaklık nedir?",
        "completed": false
      },
      {
        "name": "Maddenin Isı ile Etkileşimi: Öz ısı",
        "completed": false
      },
      {
        "name": "Maddenin Isı ile Etkileşimi: Maddedeki hâl değişimleri",
        "completed": false
      },
      {
        "name": "Türkiye’de Kimya Endüstrisi: Geçmişten günümüze ülkemizdeki kimya endüstrisinin gelişimi",
        "completed": false
      },
      {
        "name": "Türkiye’de Kimya Endüstrisi: Ülkemizde kimya endüstrisinin gelişimine katkı sağlayan resmî ve özel kurum / kuruluşlar",
        "completed": false
      }
    ]
  },
  {
    "name": "5. Ünite: Basit Makineler",
    "topics": [
      {
        "name": "Basit Makineler: Basit makinelerin sağladığı avantajlar",
        "completed": false
      },
      {
        "name": "Basit Makineler: Makaralar (sabit, hareketli, palangalar)",
        "completed": false
      },
      {
        "name": "Basit Makineler: Kaldıraçlar",
        "completed": false
      },
      {
        "name": "Basit Makineler: Eğik düzlem",
        "completed": false
      },
      {
        "name": "Basit Makineler: Çıkrık",
        "completed": false
      },
      {
        "name": "Basit Makineler: Basit makinelerden yararlanılarak bileşik makine tasarlama",
        "completed": false
      }
    ]
  },
  {
    "name": "6. Ünite: Enerji Dönüşümleri ve Çevre Bilimi",
    "topics": [
      {
        "name": "Besin Zinciri ve Enerji Akışı: Besin zinciri ve enerji akışı",
        "completed": false
      },
      {
        "name": "Besin Zinciri ve Enerji Akışı: Ekoloji piramitlerinde enerji aktarımı, vücut büyüklüğü, birey sayısı ve biyolojik birikim",
        "completed": false
      },
      {
        "name": "Enerji Dönüşümleri: Bitkilerde besin üretimi (fotosentez)",
        "completed": false
      },
      {
        "name": "Enerji Dönüşümleri: Fotosentezle ilgili deney ve gözlemler",
        "completed": false
      },
      {
        "name": "Enerji Dönüşümleri: Fotosentez hızını etkileyen faktörler",
        "completed": false
      },
      {
        "name": "Enerji Dönüşümleri: Canlılarda solunumun önemi",
        "completed": false
      },
      {
        "name": "Madde Döngüleri ve Çevre Sorunları: Madde döngülerinin yaşam açısından önemi",
        "completed": false
      },
      {
        "name": "Madde Döngüleri ve Çevre Sorunları: Küresel iklim değişikliğinin nedenleri ve olası sonuçları",
        "completed": false
      },
      {
        "name": "Madde Döngüleri ve Çevre Sorunları: Ekolojik ayak izi",
        "completed": false
      },
      {
        "name": "Sürdürülebilir Kalkınma: Kaynakların tasarruflu kullanımı",
        "completed": false
      },
      {
        "name": "Sürdürülebilir Kalkınma: Geri dönüşüm",
        "completed": false
      }
    ]
  },
  {
    "name": "7. Ünite: Elektrik Yükleri ve Elektrik Enerjisi",
    "topics": [
      {
        "name": "Elektrik Yükleri ve Elektriklenme: Elektriklenmenin bazı doğa olaylarında ve teknolojideki uygulama alanları",
        "completed": false
      },
      {
        "name": "Elektrik Yükleri ve Elektriklenme: Elektrik yükleri ve birbirlerine etkileri",
        "completed": false
      },
      {
        "name": "Elektrik Yükleri ve Elektriklenme: Elektriklenme çeşitleri",
        "completed": false
      },
      {
        "name": "Elektrik Yüklü Cisimler: Cisimlerin sahip oldukları elektrik yükleri",
        "completed": false
      },
      {
        "name": "Elektrik Yüklü Cisimler: Topraklama",
        "completed": false
      },
      {
        "name": "Elektrik Enerjisinin Dönüşümü: Elektrik enerjisinin ısı, ışık ve hareket enerjisine dönüşümü",
        "completed": false
      },
      {
        "name": "Elektrik Enerjisinin Dönüşümü: Güç santrallerinde elektrik enerjisi nasıl üretilir?",
        "completed": false
      },
      {
        "name": "Elektrik Enerjisinin Dönüşümü: Güç santrallerinin avantaj ve dezavantajları",
        "completed": false
      },
      {
        "name": "Elektrik Enerjisinin Dönüşümü: Elektrik enerjisinin bilinçli ve tasarruflu kullanımı",
        "completed": false
      }
    ]
  }
],
  "Din Kültürü ve Ahlak Bilgisi": [
    {
      "name": "1. Ünite: Kader İnancı",
      "topics": [
        {
          "name": "Kader ve Kaza İnancı",
          "completed": false
        },
        {
          "name": "İnsanın İradesi ve Kader",
          "completed": false
        },
        {
          "name": "Kaderle İlgili Kavramlar",
          "completed": false
        },
        {
          "name": "Bir Peygamber Tanıyorum: Hz. Musa (as)",
          "completed": false
        },
        {
          "name": "Bir Ayet Tanıyorum: Ayete’l-Kürsi ve Anlamı",
          "completed": false
        }
      ]
    },
    {
      "name": "2. Ünite: Zekât ve Sadaka",
      "topics": [
        {
          "name": "İslam’ın Paylaşma ve Yardımlaşmaya Verdiği Önem",
          "completed": false
        },
        {
          "name": "Zekât ve Sadaka İbadeti",
          "completed": false
        },
        {
          "name": "Zekât ve Sadakanın Bireysel ve Toplumsal Faydaları",
          "completed": false
        },
        {
          "name": "Bir Peygamber Tanıyorum: Hz. Şuayb (as)",
          "completed": false
        },
        {
          "name": "Bir Sure Tanıyorum: Mâûn Suresi ve Anlamı",
          "completed": false
        }
      ]
    },
    {
      "name": "3. Ünite: Din ve Hayat",
      "topics": [
        {
          "name": "Din, Birey ve Toplum",
          "completed": false
        },
        {
          "name": "Dinin Temel Gayesi",
          "completed": false
        },
        {
          "name": "Bir Peygamber Tanıyorum: Hz. Yusuf (as)",
          "completed": false
        },
        {
          "name": "Bir Sure Tanıyorum: Asr Suresi ve Anlamı",
          "completed": false
        }
      ]
    },
    {
      "name": "4. Ünite: Hz. Muhammed’in Örnekliği",
      "topics": [
        {
          "name": "Hz. Muhammed’in (sav) Doğruluğu ve Güvenilir Kişiliği",
          "completed": false
        },
        {
          "name": "Hz. Muhammed’in (sav) Merhametli ve Affedici Oluşu",
          "completed": false
        },
        {
          "name": "Hz. Muhammed’in (sav) İstişareye Önem Vermesi",
          "completed": false
        },
        {
          "name": "Hz. Muhammed’in (sav) Davasındaki Cesaret ve Kararlılığı",
          "completed": false
        },
        {
          "name": "Hz. Muhammed’in (sav) Hakkı Gözetmedeki Hassasiyeti",
          "completed": false
        },
        {
          "name": "Hz. Muhammed’in (sav) İnsanlara Değer Vermesi",
          "completed": false
        },
        {
          "name": "Bir Sure Tanıyorum: Kureyş Suresi ve Anlamı",
          "completed": false
        }
      ]
    },
    {
      "name": "5. Ünite: Kur’an-ı Kerim ve Özellikleri",
      "topics": [
        {
          "name": "İslam Dininin Temel Kaynakları",
          "completed": false
        },
        {
          "name": "Kur’an-ı Kerim’in Ana Konuları",
          "completed": false
        },
        {
          "name": "Kur’an-ı Kerim’in Temel Özellikleri",
          "completed": false
        },
        {
          "name": "Bir Peygamber Tanıyorum: Hz. Nuh (as)",
          "completed": false
        }
      ]
    }
  ],
  "Ingilizce": [
    {
      "name": "1. Unit: Friendship",
      "topics": [
        {
          "name": "Friendship",
          "completed": false
        }
      ]
    },
    {
      "name": "2. Unit: Teen Life",
      "topics": [
        {
          "name": "Teen Life",
          "completed": false
        }
      ]
    },
    {
      "name": "3. Unit: In The Kitchen",
      "topics": [
        {
          "name": "In The Kitchen",
          "completed": false
        }
      ]
    },
    {
      "name": "4. Unit: On The Phone",
      "topics": [
        {
          "name": "On The Phone",
          "completed": false
        }
      ]
    },
    {
      "name": "5. Unit: The Internet",
      "topics": [
        {
          "name": "The Internet",
          "completed": false
        }
      ]
    },
    {
      "name": "6. Unit: Adventures",
      "topics": [
        {
          "name": "Adventures",
          "completed": false
        }
      ]
    },
    {
      "name": "7. Unit: Tourism",
      "topics": [
        {
          "name": "Tourism",
          "completed": false
        }
      ]
    },
    {
      "name": "8. Unit: Chores",
      "topics": [
        {
          "name": "Chores",
          "completed": false
        }
      ]
    },
    {
      "name": "9. Unit: Science",
      "topics": [
        {
          "name": "Science",
          "completed": false
        }
      ]
    },
    {
      "name": "10. Unit: Natural Forces",
      "topics": [
        {
          "name": "Natural Forces",
          "completed": false
        }
      ]
    }
  ],
  "Türkçe": [
    {
      "name": "1. Ünite: 1. Dönem",
      "topics": [
        {
          "name": "Fiilimsiler (Eylemsiler): İsim-fiil, sıfat-fiil, zarf-fiil",
          "completed": false
        },
        {
          "name": "Sözcükte Anlam: Gerçek, yan, mecaz ve terim anlam, eş ve zıt anlamlı kelimeler",
          "completed": false
        },
        {
          "name": "Deyimler ve Atasözleri",
          "completed": false
        }
      ]
    },
    {
      "name": "2. Ünite: 1. Dönem",
      "topics": [
        {
          "name": "Cümlenin Ögeleri: Temel ögeler (özne, yüklem), yardımcı ögeler (nesne, yer tamlayıcısı, zarf tamlayıcısı)",
          "completed": false
        },
        {
          "name": "Söz Gruplarında Anlam: Kalıplaşmış ifadeler",
          "completed": false
        },
        {
          "name": "Cümlede Anlam: Öznel-nesnel, neden-sonuç, amaç-sonuç, koşul-sonuç cümleleri",
          "completed": false
        }
      ]
    },
    {
      "name": "3. Ünite: 1. Dönem",
      "topics": [
        {
          "name": "Fiilde Çatı: Öznesine göre (etken, edilgen), nesnesine göre (geçişli, geçişsiz)",
          "completed": false
        },
        {
          "name": "Parçada Anlam: Ana fikir, yardımcı fikirler, konu, başlık, ana duygu",
          "completed": false
        },
        {
          "name": "Anlatım Biçimleri ve Düşünceyi Geliştirme Yolları: Açıklama, tartışma, öyküleme, betimleme; tanımlama, örneklendirme, karşılaştırma vb.",
          "completed": false
        }
      ]
    },
    {
      "name": "4. Ünite: 2. Dönem",
      "topics": [
        {
          "name": "Cümle Türleri: Anlamına göre (olumlu, olumsuz, soru, ünlem), yüklemin yerine göre (kurallı, devrik), yüklemin türüne göre (isim, fiil), yapısına göre (tek yüklemli, fiilimsisi olan, bağlacı olan, birden çok yüklemli)",
          "completed": false
        },
        {
          "name": "Yazım Kuralları: Büyük harflerin kullanımı, sayıların yazımı, \"de\" ve \"ki\"nin yazımı vb.",
          "completed": false
        },
        {
          "name": "Noktalama İşaretleri: Nokta, virgül, iki nokta, üç nokta vb.",
          "completed": false
        }
      ]
    },
    {
      "name": "5. Ünite: 2. Dönem",
      "topics": [
        {
          "name": "Anlatım Bozuklukları: Yapısal (anlamsal) ve mantıksal bozukluklar",
          "completed": false
        },
        {
          "name": "Metin Türleri: Makale, deneme, söyleşi, hikâye, roman, anı, günlük, gezi yazısı vb.",
          "completed": false
        },
        {
          "name": "Söz Sanatları: Abartma (mübalağa), benzetme (teşbih), kişileştirme (teşhis), konuşturma (intak), karşıtlık (tezat)",
          "completed": false
        }
      ]
    },
    {
      "name": "6. Ünite: 2. Dönem",
      "topics": [
        {
          "name": "Görsel Okuma ve Grafik Yorumlama: Tablo, çizelge ve karikatür yorumlama",
          "completed": false
        },
        {
          "name": "Sözel Mantık ve Muhakeme: Akıl yürütme ve çıkarım yapma soruları",
          "completed": false
        },
        {
          "name": "Bilgi Kaynaklarını Etkili Kullanma",
          "completed": false
        }
      ]
    }
  ]
};