const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const Haber = require('../models/Haber');
const { getKonumFromText } = require('../utils/locationHelper');
const { getEmbedding, calculateCosineSimilarity } = require('../utils/similarityHelper');
const { getPageHtml, closeBrowser } = require('../utils/browserHelper');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const axiosConfig = {
    timeout: 8000,
    httpsAgent,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/',
        'Connection': 'keep-alive'
    }
};

async function fetchHtml(url, puppeteerGerekli = false) {
    try {
        const response = await axios.get(url, axiosConfig);
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        if (puppeteerGerekli && (status === 403 || status === 503 || error.code === 'ECONNABORTED')) {
            return await getPageHtml(url);
        }
        throw error;
    }
}

function createPool(limit) {
    let active = 0;
    const queue = [];
    function next() {
        while (active < limit && queue.length) {
            active++;
            const { fn, resolve, reject } = queue.shift();
            fn().then(resolve, reject).finally(() => { active--; next(); });
        }
    }
    return (fn) => new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
    });
}

const KATEGORI_ONCELIK = {
    'Yangın': 1,
    'Trafik Kazası': 2,
    'Elektrik Kesintisi': 3,
    'Hırsızlık': 4,
    'Kültürel Etkinlikler': 5
};

const BENZERLIK_ESIGI_YUZDE = 90;

const ANAHTAR_KELIMELER = {
    'Trafik Kazası': {
        agirlikli: [
            'trafik kazası', 'zincirleme kaza', 'trafik kazasında', 'otomobil çarpıştı',
            'araç çarpıştı', 'yoldan çıkan araç', 'şarampole yuvarlanan', 'takla attı',
            'kamyon devrildi', 'motosiklet kazası', 'tır devrildi', 'kaza yaptı',
            'otomobil takla', 'kamyonet devrildi', 'trafik kazasında hayatını',
            'kaza kurbanı', 'ölümlü kaza', 'yaralı kaza', 'çarpışma meydana geldi'
        ],
        normal: [
            'çarpıştı', 'şarampole', 'devrildi', 'yoldan çıktı', 'maddi hasarlı',
            'otomobil', 'kamyon', 'motorsiklet', 'motosiklet', 'trafik',
            'sürücü yaralandı', 'kazada yaralı', 'kazada hayatını kaybetti',
            'araç sürücüsü', 'istinat duvarına', 'refüje çarptı', 'bariyere çarptı',
            'kafa kafaya', 'makas attı', 'alkollü sürücü', 'ehliyetsiz'
        ]
    },
    'Yangın': {
        agirlikli: [
            'yangın çıktı', 'yangına müdahale', 'alevlere teslim', 'yangında hayatını',
            'ev yangını', 'iş yeri yangını', 'orman yangını', 'araç yangını',
            'fabrika yangını', 'depo yangını', 'kundakçılık', 'yangın çıkması',
            'alevler sardı', 'cayır cayır yandı', 'yangın söndürüldü', 'kül oldu'
        ],
        normal: [
            'yangın', 'alev', 'itfaiye', 'kül oldu', 'duman', 'söndürüldü',
            'yandı', 'tutuştu', 'yanık', 'alevler', 'yangın tüpü', 'dumandan',
            'itfaiye eri', 'itfaiye aracı', 'yangın ihbarı'
        ]
    },
    'Elektrik Kesintisi': {
        agirlikli: [
            'elektrik kesintisi', 'planlı elektrik kesintisi', 'elektrikler kesilecek',
            'elektrik verilmeyecek', 'sedaş duyurdu', 'elektrik kesintisi yaşanacak',
            'elektrik kesintileri', 'programlı kesinti', 'dağıtım şirketi duyurdu',
            'kesinti duyurusu', 'kesinti olacak mahalleler', 'hangi mahalleler',
            'saatler arasında kesinti'
        ],
        normal: [
            'sedaş', 'gesk', 'trafosu patladı', 'elektrikler kesildi',
            'karanlıkta kaldı', 'elektrik arızası', 'enerji kesintisi',
            'elektrik yok', 'akım kesildi', 'güç kesintisi', 'elektrik şirketi'
        ]
    },
    'Hırsızlık': {
        agirlikli: [
            'hırsızlık yaptı', 'hırsızlıktan gözaltı', 'soygun gerçekleştirdi',
            'hırsız yakalandı', 'kasa patlattı', 'oto hırsızı', 'evden hırsızlık',
            'iş yerini soydu', 'motosiklet çaldı', 'araç çaldı', 'hırsızlık operasyonu',
            'market soygunu', 'ev soygunu', 'kapkaç olayı', 'gasp olayı',
            'dolandırıcılık operasyonu', 'hırsızlık şüphelisi', 'hırsızlık şebekesi'
        ],
        normal: [
            'hırsızlık', 'soygun', 'gasp', 'yankesicilik', 'hırsız', 'çırpıştırdı',
            'çaldı', 'çalıntı', 'kapkaç', 'dolandırıcılık', 'dolandırıcı',
            'sahte para', 'suçüstü yakalandı'
        ]
    },
    'Kültürel Etkinlikler': {
        agirlikli: [
            'konser düzenlenecek', 'festival başlıyor', 'tiyatro oyunu', 'sergi açıldı',
            'etkinlik programı', 'konser biletleri', 'müzik festivali', 'kültür merkezi',
            'belediye tiyatrosu', 'müze ziyaret', 'sergi salonu', 'spor festivali',
            'turnuva düzenlendi', 'kültür sanat merkezi', 'ödül töreni',
            'sahne aldı', 'gala gecesi düzenlendi', 'etkinlik takvimi',
            'ücretsiz etkinlik', 'katılım ücretsiz', 'davetlisiniz'
        ],
        normal: [
            'kültür sanat', 'canlı performans', 'bilet satışı', 'gala gecesi',
            'konser', 'festival', 'tiyatro', 'sergi', 'gösteri',
            'müzik', 'dans', 'sinema', 'sempozyum', 'şampiyona', 'turnuva',
            'müze', 'kütüphane', 'atölye', 'panayır', 'sahne', 'yarışma'
        ]
    }
};

const RED_KELIMELER = [
    'intihar', 'tatbikat', 'sahte', 'dizi', 'reklam', 'ilan',
    'odmd', 'satış raporu', 'pazar payı raporu',
    'cinayet', 'katliamı', 'infaz', 'katil', 'öldüren zanlı',
    'bıçakladı', 'bıçaklayarak', 'silahlı saldırı', 'tabancayla ateş',
    'kavgada öldü', 'kavgada öldüren', 'pusu kurarak',
    'uyuşturucu', 'narkotik', 'ecstasy',
    'siber operasyon', 'siber suç',
    'vizyona giriyor', 'sinema salonlarında',
    'zabıtası', 'zabıta',
    'siyasal iletişim', 'siyasal pozisyon',
    'eczane', 'nöbetçi eczane', 'nöbetçi', 'milletvekili', 'meclis', 'parti', 'tahliye oldu', 'adliye koridorları', 'sanık kürsüsü'
];

const NEGATIF_KALIPLAR = {
    'Yangın': [
        'dumansız', 'sigara yasağı', 'hava sahası', 'yangın tatbikatı', 'yangın eğitimi', 'yangın haftası',
        'kötü koku', 'koku ihbarı', 'kokuya rastlanmadı', 'koku ile karşılaştım',
        'ölçüm yaptı', 'insan sağlığını rahatsız',
        'dava süreci', 'duruşma', 'avukat', 'sanık', 'iddianame', 'mahkeme', 'tv programı',
        'değerlendirdi', 'yıldönümü', 'facianın', 'katliam'
    ],
    'Trafik Kazası': [
        'trafik eğitimi', 'trafik haftası', 'trafik denetimi', 'trafik cezası haberleri',
        'trafik kuralları', 'trafik bilinci', 'trafik eğitim parkı', 'uygulamalı eğitim',
        'güvenli trafik davranış', 'akülü araç', 'trafik bilincini', 'trafik kültürü',
        'liman yolu', 'liman projesi', 'danıştay', 'yürütme durdurma', 'iptal kararı',
        'imar planı', 'proje durduruldu', 'proje iptal', 'kamulaştırma',
        'otomobil satış', 'araç satış', 'satış raporu', 'satış verileri', 'satış rakamları',
        'pazar payı', 'distribütör', 'odmd', 'tescil rakam', 'ticari araç satış',
        'bıçaklı kavga', 'bıçaklı saldırı', 'bıçaklama', 'bıçakla yaraladı',
        'kavgada öldü', 'kavgada hayatını', 'markette kavga', 'markette bıçaklı',
        'silahlı kavga', 'ateşli silah', 'öldürüldü', 'öldürme',
        'trafik cezası', 'ceza artışı', 'fahiş zam', 'trafik politikası',
        'parti olarak', 'partisi',
        'zabıta', 'hatalı parklanma', 'çift taraflı park', 'park cezası', 'cezai işlem',
        'su bastı', 'su birikintisi', 'sağanak nedeniyle', 'alt geçit su',
        'yol çalışması', 'altyapı çalışması', 'trafik kontrollü', 'bant aktarımı',
        'üstyapı imalatı', 'gece mesaisi', 'karayolları ekipleri', 'asfaltlama'
    ],
    'Elektrik Kesintisi': [
        'elektrikli araç', 'elektrik faturası', 'elektrik üretimi',
        'toplu iş sözleşmesi', 'toplu sözleşme', 'sendika', 'tes-iş',
        'genel başkan', 'iş sözleşmesi', 'müzakere', 'grev', 'işçi hakları',
        'maaş zammı', 'konfederasyon',
        'çukura saplandı', 'çukura düştü', 'çukur oluştu', 'kamyon saplandı',
        'araç saplandı', 'toprakla kapatıldı', 'yolda çukur'
    ],
    'Kültürel Etkinlikler': [
        'vali', 'milletvekili', 'meclis üyesi', 'parti başkanı', 'savcılık', 'mahkeme',
        'dava açıldı', 'bütçe', 'ihale', 'siyasi', 'siyasal', 'trafik kazası', 'yangın çıktı',
        'elektrik kesintisi', 'hırsızlık', 'soygun',
        'siyasal iletişim', 'kampanya yürütmek', 'siyasal strateji', 'siyaset yapma',
        'seçmen', 'aday', 'adaylık', 'oy oranı',
        'futbol', 'basketbol', 'voleybol', 'hentbol', 'güreş', 'boks',
        'karate', 'taekwondo', 'judo', 'yüzme', 'atletizm', 'okçuluk',
        'halter', 'badminton', 'masa tenisi',
        'şampiyon oldu', 'şampiyonluğu', 'şampiyonluk', 'madalya kazandı', 'madalya aldı',
        'altın madalya', 'gümüş madalya', 'bronz madalya',
        'gençlerbirliği', 'kağıtspor', 'kocaelispor', 'gebzespor',
        'spor kulübü', 'süper lig', 'lig maçı', 'maç sonucu',
        'antrenör', 'teknik direktör', 'sporcu', 'gol', 'deplasman',
        'ot biçme', 'çim biçme', 'budama çalışması', 'peyzaj çalışması',
        'park bakımı', 'bahçe bakımı', 'temizlik çalışması', 'bakım çalışması',
        'asfalt çalışması', 'yol bakımı', 'altyapı çalışması', 'kaldırım çalışması',
        'çevre temizliği', 'belediye çalışması', 'bakım onarım'
    ],
    'Hırsızlık': [
        'oyuncak', 'film çekimi', 'dizi çekimi',
        'öldürüldü', 'öldüğü', 'öldürme', 'cinayet', 'katil', 'katliamı',
        'cinayetle', 'cinayetten', 'saldırıda hayatını', 'hayatını kaybetti',
        'bıçaklı saldırı', 'silahlı saldırı', 'bıçaklama', 'saldırgan',
        'uyuşturucu', 'uyuşturucu operasyonu',
        'terör', 'bomba', 'patlama', 'infaz',
        'btk', 'düzenleme yapıldı', 'istenmeyen arama', 'istenmeyen sms',
        'abonelik başvuru', 'işletmeci', 'alan kodu', 'yaptırım uygulan',
        'vizyona', 'sinema', 'başrol', 'yönetmen', 'senaryo',
        'animasyon', 'komedi filmi', 'korku filmi'
    ]
};

function trLower(s) {
    return String(s || '').normalize('NFC').toLocaleLowerCase('tr-TR');
}

function metniTemizle(rawText) {
    if (!rawText) return '';
    return rawText
        .replace(/<[^>]*>?/gm, '')
        .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/[\t\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function icerikTemizle(text) {
    if (!text) return '';

    text = text.replace(/\$\s*Dolar[\s\S]{0,300}?Gümüş\s*[\d.,]+\s*%?[+-]?[\d.,]*/gi, '');
    text = text.replace(/[€$£]\s*(?:Dolar|Euro|Sterlin)\s*[\d.,]+\s*%[+-]?[\d.,]*/gi, '');
    text = text.replace(/(?:Altın|Gümüş)\s*\$?[\d.,]+\s*%[+-]?[\d.,]*/gi, '');

    text = text.replace(/ABONE OL/gi, '');
    text = text.replace(/(?:Haber albümü|Video|Büyütmek)\s+için\s+(?:resme|play'e)\s+tıklayın/gi, '');
    text = text.replace(/\+\d{1,2}\s+/g, ' ');

    text = text.replace(/#\s+[a-zA-ZçğıöşüÇĞİÖŞÜ]+(?:\s*,\s*[a-zA-ZçğıöşüÇĞİÖŞÜ]+){1,}/g, '');
    text = text.replace(/\bNNNN\b/g, '');
    text = text.replace(/\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2}\s+TSI/g, '');
    text = text.replace(/\([A-ZÇĞİÖŞÜ]{2,4}(?:-[A-ZÇĞİÖŞÜ]{1,4}){0,4}\)/g, '');
    text = text.replace(/Kaynak:\s*[a-zA-ZçğıöşüÇĞİÖŞÜ]+/gi, '');

    const konumKalip = /^(?:Kocaeli[''ʼ]?(?:de|nin|nde|nın)|İzmit[''ʼ]?(?:te|in)|Gebze[''ʼ]?(?:de|nin)|Darıca[''ʼ]?(?:da|nın)|Körfez[''ʼ]?(?:de|te)|Gölcük[''ʼ]?(?:te|ün)|Yalova[''ʼ]?(?:nın|da)|Derince[''ʼ]?(?:de)|Çayırova[''ʼ]?(?:da)|Kartepe[''ʼ]?(?:de)|Sakarya[''ʼ]?(?:da)|İstanbul[''ʼ]?(?:da|un))/i;

    const cumleler = text.split(/(?<=[.!?])\s+/);
    let ardisik = 0;
    let kesimIdx = -1;
    let toplamKar = 0;

    for (let i = 0; i < cumleler.length; i++) {
        const c = cumleler[i].trim();
        toplamKar += c.length + 1;
        if (toplamKar < 200) continue;

        if (konumKalip.test(c) && c.length > 40 && c.length < 500) {
            ardisik++;
            if (ardisik >= 2 && kesimIdx < 0) {
                const baslangicCumle = cumleler[i - ardisik + 1];
                const pos = text.indexOf(baslangicCumle, 150);
                if (pos > 150) kesimIdx = pos;
            }
        } else {
            ardisik = 0;
        }
    }

    if (kesimIdx > 200) {
        text = text.substring(0, kesimIdx);
    }

    if (text.length > 3000) {
        const sonNokta = text.lastIndexOf('.', 3000);
        if (sonNokta > 500) text = text.substring(0, sonNokta + 1);
    }

    return text.replace(/\s+/g, ' ').trim();
}

const BASLIK_STOP = new Set([
    'bir', 'bu', 'da', 'de', 've', 'ile', 'için', 'olan', 'oldu',
    'gibi', 'daha', 'çok', 'kadar', 'sonra', 'var', 'yok', 'her',
    'şu', 'ama', 'ancak', 'üzere', 'olarak', 'göre', 'yeni', 'son',
    'kocaeli', "kocaeli'de", "kocaeli'nde", 'büyük', 'ilk'
]);

function baslikBenzerMi(baslik1, baslik2) {
    const temizle = s => trLower(s).replace(/[.,!?:;'"()\[\]]/g, '').split(/\s+/)
        .filter(k => k.length > 2 && !BASLIK_STOP.has(k));
    const k1 = temizle(baslik1);
    const k2 = temizle(baslik2);
    let ortak = 0;
    for (const a of k1) {
        for (const b of k2) {
            const min = Math.min(a.length, b.length);
            const cmp = Math.max(4, Math.floor(min * 0.7));
            if (a.substring(0, cmp) === b.substring(0, cmp)) { ortak++; break; }
        }
    }
    return ortak >= 2;
}

function reklamTemizle($) {
    const kaldirilacaklar = [
        'aside', 'footer', 'nav', 'header',
        '.reklam', '.advertisement', '.ad-container', '.ads', '.advert',
        '.sidebar', '.widget', '.related-news', '.related-posts',
        '.social-share', '.social-media', '.share-buttons',
        '.comment-section', '.comments', '.yorum',
        '.breadcrumb', '.tags', '.etiketler',
        '[id*="advert"]', '[id*="reklam"]', '[class*="advert"]',
        '[class*="reklam"]', '[class*="sponsor"]',
        '[id*="yorum"]', '[class*="yorum"]', '[id*="comment"]', '[class*="comment"]',
        '.cookie-banner', '.popup', '.modal',
        'script', 'style', 'noscript', 'iframe',
        '.haberler-list', '.other-news', '.news-list',
        '.diger-haberler', '.son-haberler', '.manset-haberler',
        '.swiper', '.slider', '.carousel',
        '.abone', '.subscription', '.newsletter',
        '.doviz', '.kur-bilgi', '.currency', '.finans-bar', '.ticker',
        '[class*="ilgili"]', '[class*="related"]', '[class*="benzer"]',
        '[class*="son-haber"]', '[class*="diger"]', '[class*="manset"]',
        '[class*="doviz"]', '[class*="kur"]', '[class*="finans"]',
        '[class*="ticker"]', '[class*="currency"]'
    ];
    kaldirilacaklar.forEach(selector => {
        try { $(selector).remove(); } catch (_) { }
    });
}

function turBelirle(baslik, icerik) {
    const temizIcerik = icerik.substring(0, 2000);
    const b = trLower(baslik);
    const ic = trLower(temizIcerik);
    const fullText = `${b} ${b} ${b} ${b} ${b} ${b} ${ic}`;

    for (const red of RED_KELIMELER) {
        if (b.includes(trLower(red))) return null;
    }

    const skorlar = {};
    for (const key of Object.keys(ANAHTAR_KELIMELER)) skorlar[key] = 0;

    for (const [kategori, { agirlikli, normal }] of Object.entries(ANAHTAR_KELIMELER)) {
        for (const kelime of agirlikli) {
            const escaped = kelime.replace(/\s+/g, '[\\s]+');
            const re = new RegExp(`(?:^|[\\s.,!?'":;(\\[{])${escaped}(?:[a-zçğıöşü]{0,8})?(?=$|[\\s.,!?'":;)\\]}])`, 'gi');
            const hits = fullText.match(re);
            if (hits) skorlar[kategori] += hits.length * 4;
        }
        for (const kelime of normal) {
            const re = new RegExp(`(?:^|[\\s.,!?'":;(\\[{])${kelime}(?:[a-zçğıöşü]{0,6})?(?=$|[\\s.,!?'":;)\\]}])`, 'gi');
            const hits = fullText.match(re);
            if (hits) skorlar[kategori] += hits.length;
        }

        if (skorlar[kategori] > 0 && NEGATIF_KALIPLAR[kategori]) {
            for (const nk of NEGATIF_KALIPLAR[kategori]) {
                if (fullText.includes(trLower(nk))) {
                    skorlar[kategori] = 0;
                    break;
                }
            }
        }
    }

    const asayisMax = Math.max(skorlar['Trafik Kazası'], skorlar['Yangın'], skorlar['Hırsızlık'], skorlar['Elektrik Kesintisi']);
    if (asayisMax > 0 && skorlar['Kültürel Etkinlikler'] > 0 && asayisMax >= skorlar['Kültürel Etkinlikler']) {
        skorlar['Kültürel Etkinlikler'] = 0;
    }

    let secilenKategori = null;
    let maxSkor = 0;
    for (const [kategori, skor] of Object.entries(skorlar)) {
        if (skor > maxSkor) { maxSkor = skor; secilenKategori = kategori; }
        else if (skor > 0 && skor === maxSkor) {
            if (KATEGORI_ONCELIK[kategori] < KATEGORI_ONCELIK[secilenKategori]) {
                secilenKategori = kategori;
            }
        }
    }

    if (maxSkor < 3) return null;
    return secilenKategori;
}

const ULUSAL_KARA_LISTE = [
    'adana', 'adıyaman', 'afyon', 'ağrı', 'amasya', 'ankara', 'antalya', 'artvin',
    'aydın', 'balıkesir', 'bilecik', 'bingöl', 'bitlis', 'bolu', 'burdur', 'bursa',
    'çanakkale', 'çankırı', 'çorum', 'denizli', 'diyarbakır', 'edirne', 'elazığ',
    'erzincan', 'erzurum', 'eskişehir', 'gaziantep', 'giresun', 'gümüşhane', 'hakkari',
    'hatay', 'ısparta', 'mersin', 'istanbul', 'izmir', 'kars', 'kastamonu', 'kayseri',
    'kırklareli', 'kırşehir', 'konya', 'kütahya', 'malatya', 'manisa', 'kahramanmaraş',
    'mardin', 'muğla', 'muş', 'nevşehir', 'niğde', 'ordu', 'rize', 'sakarya', 'samsun',
    'siirt', 'sinop', 'sivas', 'tekirdağ', 'tokat', 'trabzon', 'tunceli', 'şanlıurfa',
    'uşak', 'van', 'yozgat', 'zonguldak', 'aksaray', 'bayburt', 'karaman', 'kırıkkale',
    'batman', 'şırnak', 'bartın', 'ardahan', 'ığdır', 'yalova', 'karabük', 'kilis',
    'osmaniye', 'düzce',
    'katar', 'suriye', 'abd', 'rusya', 'almanya', 'yunanistan', 'ırak', 'iran', 'kktc',
    'türkiye geneli', 'türkiye genelinde', 'ülke genelinde', 'türkiye çapında',
    'afad', 'cumhurbaşkanı', 'meclis', 'bakanlık', 'odmd'
];

function ulusalMi(baslik, icerik) {
    const tam = trLower(`${baslik} ${(icerik || '').substring(0, 1500)}`);

    const cokluIlMatch = tam.match(/(\d+)\s+il(?:de|e|i|den)?\b/);
    if (cokluIlMatch && parseInt(cokluIlMatch[1]) >= 3) return true;

    const kontrolSehirler = [
        'adana','ankara','antalya','bursa','denizli','diyarbakır',
        'eskişehir','gaziantep','istanbul','izmir','kayseri','konya',
        'malatya','manisa','mersin','samsun','trabzon','şanlıurfa',
        'batman','aksaray','karaman','van','erzurum','hatay'
    ];
    let bulunan = 0;
    for (const s of kontrolSehirler) {
        const re = new RegExp(`(?:^|[^a-zçğıöşü])${s}(?:[^a-zçğıöşü]|$)`, 'i');
        if (re.test(tam)) bulunan++;
        if (bulunan >= 3) return true;
    }

    const etkinlikBaskaIlRe = /(?:istanbul|ankara|izmir|antalya|bursa|samsun|trabzon|eskişehir|adana|konya|gaziantep)(?:['']?\s*(?:ili)?(?:['']?(?:da|de|nda|nde|ında|inde))).{0,50}(?:gerçekleş|düzenlen|yapıl|sahne al)/i;
    if (etkinlikBaskaIlRe.test((icerik || '').substring(0, 800))) return true;

    return false;
}

async function rssFeeddenHaberleriIsle(rssUrl, siteAdi, baseUrl, startDate, endDate, mevcutUrlSet, embeddingOnbellek) {
    console.log(`   📡 [${siteAdi}] RSS işleniyor: ${rssUrl}`);
    let eklenenSayisi = 0;
    try {
        const response = await axios.get(rssUrl, { ...axiosConfig, timeout: 10000 });
        const $ = cheerio.load(response.data, { xmlMode: true });

        const items = [];
        $('item, entry').each((i, el) => {
            const link = $(el).find('link').text().trim()
                || $(el).find('link').attr('href')
                || $(el).find('guid').text().trim();
            const baslik = metniTemizle($(el).find('title').text());
            const yayinTarihiStr = $(el).find('pubDate, published, updated, dc\\:date').first().text().trim();
            const description = metniTemizle(
                $(el).find('description, summary, content, content\\:encoded').first().text()
            );
            if (link && link.startsWith('http')) {
                items.push({ link, baslik, yayinTarihiStr, description });
            }
        });

        console.log(`   📡 [${siteAdi}] RSS: ${items.length} öğe bulundu.`);

        const pool = createPool(3);
        await Promise.allSettled(items.map(item => pool(async () => {
            const { link, baslik: rssBaslik, yayinTarihiStr, description } = item;
            if (mevcutUrlSet.has(link)) return;

            let haberTarihi = yayinTarihiStr ? new Date(yayinTarihiStr) : null;
            if (!haberTarihi || isNaN(haberTarihi.getTime())) haberTarihi = new Date();
            if (haberTarihi < startDate || haberTarihi > endDate) return;

            mevcutUrlSet.add(link);

            try {
                const detayHtml = await fetchHtml(link, false);
                const $$ = cheerio.load(detayHtml);

                let baslik = metniTemizle($$('h1').first().text());
                if (!baslik || baslik.length < 5) baslik = rssBaslik;

                reklamTemizle($$);
                let icerik = metniTemizle(
                    $$('article').text() ||
                    $$('.haber-detay, .news-content, .news-detail, .entry-content, .post-content').first().text() ||
                    $$('p').map((i, el) => $$(el).text()).get().join(' ')
                );
                if (!icerik || icerik.length < 50) icerik = description || '';
                icerik = icerikTemizle(icerik);

                let ozet = '';
                $$('p').each((i, el) => {
                    const t = metniTemizle($$(el).text());
                    if (!ozet && t.length > 40) {
                        ozet = t.length > 250 ? t.substring(0, 250).trim() + '…' : t;
                    }
                });
                if (!ozet) ozet = icerik.length > 250 ? icerik.substring(0, 250).trim() + '…' : icerik;

                if (!baslik || baslik.length <= 5 || !icerik || icerik.length <= 30) return;

                if (ULUSAL_KARA_LISTE.some(sehir => {
                    const re = new RegExp(`(?:^|\\s)${sehir}(?:'|\\s|\\.|,|$)`, 'i');
                    return re.test(trLower(baslik));
                })) return;

                if (ulusalMi(baslik, icerik)) return;

                const tur = turBelirle(baslik, icerik);
                if (!tur) return;

                const konumBilgisi = await getKonumFromText(baslik, icerik, link);
                if (!konumBilgisi || !konumBilgisi.geoStatus) return;

                const embeddingMetni = `${baslik}\n${icerik.substring(0, 2500)}`;
                const yeniEmbedding = await getEmbedding(embeddingMetni);

                let isDuplicate = false, matchedHaber = null;
                for (const eskiHaber of embeddingOnbellek) {
                    if (calculateCosineSimilarity(eskiHaber.embedding, yeniEmbedding) >= BENZERLIK_ESIGI_YUZDE) {
                        isDuplicate = true; matchedHaber = eskiHaber; break;
                    }
                }

                if (isDuplicate && matchedHaber) {
                    const kategoriUyumlu = matchedHaber.haberTuru === tur;
                    if (!kategoriUyumlu) {
                        isDuplicate = false;
                        matchedHaber = null;
                    }
                }

                if (!isDuplicate) {
                    for (const eskiHaber of embeddingOnbellek) {
                        if (eskiHaber.haberTuru === tur &&
                            eskiHaber.konum?.ilce === konumBilgisi.ilce &&
                            baslikBenzerMi(eskiHaber.baslik, baslik)) {
                            isDuplicate = true;
                            matchedHaber = eskiHaber;
                            console.log(`   🔁 [${siteAdi}] Başlık benzerliği ile duplicate tespit edildi.`);
                            break;
                        }
                    }
                }

                if (isDuplicate) {
                    const ayniSiteVar = matchedHaber.kaynaklar.some(k => k.siteAdi === siteAdi);
                    const ayniLinkVar = matchedHaber.kaynaklar.some(k => k.link === link);
                    if (!ayniSiteVar && !ayniLinkVar) {
                        matchedHaber.kaynaklar.push({ siteAdi, link, yayinTarihi: haberTarihi });
                        try { await matchedHaber.save(); } catch (e) { }
                        console.log(`   🔄 [${siteAdi}] Benzer haber güncellendi (yeni kaynak eklendi).`);
                    }
                } else {
                    const yeniHaberDocument = new Haber({
                        baslik, icerik, ozet, haberTuru: tur, tarih: haberTarihi,
                        kaynaklar: [{ siteAdi, link, yayinTarihi: haberTarihi }],
                        konum: konumBilgisi, embedding: yeniEmbedding
                    });

                    embeddingOnbellek.push(yeniHaberDocument);

                    try { await yeniHaberDocument.save(); } catch (e) { }
                    eklenenSayisi++;
                    console.log(`   ✅ [${siteAdi}] ${tur} | ${baslik.substring(0, 55)}`);
                }
            } catch (err) {
            }
        })));
    } catch (err) {
        console.log(`   ⚠️ [${siteAdi}] RSS hata: ${err.message}`);
    }
    return eklenenSayisi;
}

async function sayfadanLinkTopla(url, baseUrl, puppeteerGerekli = false) {
    const linkler = new Set();
    try {
        const html = await fetchHtml(url, puppeteerGerekli);
        const $ = cheerio.load(html);
        $('a').each((i, el) => {
            let link = $(el).attr('href');
            if (link && link.length > 30 && !link.includes('javascript') && !link.includes('kategori')) {
                if (link.includes('/haber/') || link.includes('/video/') || link.includes('.html') || (link.match(/\d{4,}/) && link.includes('-'))) {
                    if (!link.startsWith('http')) link = link.startsWith('/') ? `${baseUrl}${link}` : `${baseUrl}/${link}`;
                    if (link.startsWith(baseUrl)) linkler.add(link);
                }
            }
        });
    } catch (_) { }
    return linkler;
}

async function haberleriIsle(siteAdi, baseUrl, targetUrls, startDate, endDate, mevcutUrlSet, embeddingOnbellek, puppeteerGerekli = false) {
    console.log(`\n🕷️ [${siteAdi}] Web scraping başlıyor...`);
    let eklenenSayisi = 0;
    const tumLinkler = new Set();
    const pool = createPool(2);

    await Promise.allSettled(targetUrls.map(url => pool(() =>
        sayfadanLinkTopla(url, baseUrl, puppeteerGerekli).then(linkler => {
            linkler.forEach(l => tumLinkler.add(l));
            console.log(`   🟢 [${siteAdi}] ${linkler.size} link: ${url.replace(baseUrl, '') || '/'}`);
        }).catch(() => {
            console.log(`   ⚠️ [${siteAdi}] Erişilemedi: ${url.replace(baseUrl, '') || '/'}`);
        })
    )));

    if (tumLinkler.size === 0) {
        console.log(`   ❌ [${siteAdi}] Hiçbir link bulunamadı.`);
        return 0;
    }

    const yeniLinkler = [...tumLinkler].filter(l => !mevcutUrlSet.has(l));
    console.log(`   🔎 [${siteAdi}] ${tumLinkler.size} toplam, ${yeniLinkler.length} yeni link.`);
    if (yeniLinkler.length === 0) return 0;

    const detayPool = createPool(2);
    await Promise.allSettled(yeniLinkler.map(link => detayPool(async () => {
        if (mevcutUrlSet.has(link)) return;
        mevcutUrlSet.add(link);
        try {
            const detayHtml = await fetchHtml(link, puppeteerGerekli);
            const $$ = cheerio.load(detayHtml);

            let baslik = metniTemizle($$('h1').first().text());
            if (!baslik || baslik.length < 5) baslik = metniTemizle($$('h2').first().text());

            reklamTemizle($$);
            let icerik = metniTemizle(
                $$('article').text() ||
                $$('.haber-detay, .news-content, .news-detail, .entry-content').first().text() ||
                $$('p').map((i, el) => $$(el).text()).get().join(' ')
            );
            icerik = icerikTemizle(icerik);
            let ozet = '';
            $$('p').each((i, el) => {
                const t = metniTemizle($$(el).text());
                if (!ozet && t.length > 40) {
                    ozet = t.length > 250 ? t.substring(0, 250).trim() + '…' : t;
                }
            });
            if (!ozet && icerik.length > 0) {
                ozet = icerik.length > 250 ? icerik.substring(0, 250).trim() + '…' : icerik;
            }

            if (ULUSAL_KARA_LISTE.some(sehir => {
                const re = new RegExp(`(?:^|\\s)${sehir}(?:'|\\s|\\.|,|$)`, 'i');
                return re.test(trLower(baslik));
            })) return;

            if (ulusalMi(baslik, icerik)) return;

            let haberTarihi = null;
            const yayinTarihiStr = $$('meta[property="article:published_time"]').attr('content')
                || $$('meta[itemprop="datePublished"]').attr('content')
                || $$('meta[name="datePublished"]').attr('content')
                || $$('time').attr('datetime');
            if (yayinTarihiStr) haberTarihi = new Date(yayinTarihiStr);

            if (!haberTarihi || isNaN(haberTarihi.getTime())) {
                const metin = $$('body').text();
                const m1 = metin.match(/(\d{2})[\.\/  -](\d{2})[\.\/  -](\d{4})/);
                if (m1) haberTarihi = new Date(`${m1[3]}-${m1[2]}-${m1[1]}T12:00:00`);
                else {
                    const m2 = metin.match(/(\d{1,2})\s+(Oca|Ocak|Şub|Şubat|Mar|Mart|Nis|Nisan|May|Mayıs|Haz|Haziran|Tem|Temmuz|Ağu|Ağustos|Eyl|Eylül|Eki|Ekim|Kas|Kasım|Ara|Aralık)\s+(\d{4})/i);
                    if (m2) {
                        const aylar = { 'oca': '01', 'ocak': '01', 'şub': '02', 'şubat': '02', 'mar': '03', 'mart': '03', 'nis': '04', 'nisan': '04', 'may': '05', 'mayıs': '05', 'haz': '06', 'haziran': '06', 'tem': '07', 'temmuz': '07', 'ağu': '08', 'ağustos': '08', 'eyl': '09', 'eylül': '09', 'eki': '10', 'ekim': '10', 'kas': '11', 'kasım': '11', 'ara': '12', 'aralık': '12' };
                        haberTarihi = new Date(`${m2[3]}-${aylar[m2[2].toLowerCase()]}-${m2[1].padStart(2, '0')}T12:00:00`);
                    }
                }
            }

            if (!haberTarihi || isNaN(haberTarihi.getTime())) {
                haberTarihi = new Date();
                console.log(`   ⚠️ Tarih bulunamadı, bugün atandı: ${link.substring(0, 60)}`);
            }
            if (haberTarihi < startDate || haberTarihi > endDate) return;

            const tur = turBelirle(baslik, icerik);
            if (!tur || baslik.length <= 10 || icerik.length <= 50) return;

            const konumBilgisi = await getKonumFromText(baslik, icerik, link);
            if (!konumBilgisi || !konumBilgisi.geoStatus) return;

            const embeddingMetni = `${baslik}\n${icerik.substring(0, 2500)}`;
            const yeniEmbedding = await getEmbedding(embeddingMetni);

            let isDuplicate = false, matchedHaber = null;
            for (const eskiHaber of embeddingOnbellek) {
                if (calculateCosineSimilarity(eskiHaber.embedding, yeniEmbedding) >= BENZERLIK_ESIGI_YUZDE) {
                    isDuplicate = true; matchedHaber = eskiHaber; break;
                }
            }

            if (isDuplicate && matchedHaber) {
                const kategoriUyumlu = matchedHaber.haberTuru === tur;
                if (!kategoriUyumlu) {
                    isDuplicate = false;
                    matchedHaber = null;
                }
            }

            if (!isDuplicate) {
                for (const eskiHaber of embeddingOnbellek) {
                    if (eskiHaber.haberTuru === tur &&
                        eskiHaber.konum?.ilce === konumBilgisi.ilce &&
                        baslikBenzerMi(eskiHaber.baslik, baslik)) {
                        isDuplicate = true;
                        matchedHaber = eskiHaber;
                        console.log(`   🔁 [${siteAdi}] Başlık benzerliği ile duplicate tespit edildi.`);
                        break;
                    }
                }
            }

            if (isDuplicate) {
                const ayniSiteVar = matchedHaber.kaynaklar.some(k => k.siteAdi === siteAdi);
                const ayniLinkVar = matchedHaber.kaynaklar.some(k => k.link === link);
                if (!ayniSiteVar && !ayniLinkVar) {
                    matchedHaber.kaynaklar.push({ siteAdi, link, yayinTarihi: haberTarihi });
                    try { await matchedHaber.save(); } catch (e) { }
                    console.log(`   🔄 [${siteAdi}] Benzer haber güncellendi (yeni kaynak eklendi).`);
                }
            } else {
                const yeniHaberDocument = new Haber({
                    baslik, icerik, ozet, haberTuru: tur, tarih: haberTarihi,
                    kaynaklar: [{ siteAdi, link, yayinTarihi: haberTarihi }],
                    konum: konumBilgisi, embedding: yeniEmbedding
                });

                embeddingOnbellek.push(yeniHaberDocument);

                try { await yeniHaberDocument.save(); } catch (e) { }
                eklenenSayisi++;
                console.log(`   ✅ [${siteAdi}] ${tur} | ${baslik.substring(0, 55)}`);
            }
        } catch (_) { }
    })));

    return eklenenSayisi;
}

const scrapeAllSites = async (gunSayisi = 3) => {
    console.log(`\n🚀 Scraping Başlıyor... (Son ${gunSayisi} Gün)`);
    const baslangicZamani = Date.now();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - gunSayisi);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();

    const mevcutHaberler = await Haber.find({}, 'kaynaklar.link');
    const mevcutUrlSet = new Set();
    mevcutHaberler.forEach(h => h.kaynaklar.forEach(k => mevcutUrlSet.add(k.link)));
    console.log(`   📦 DB'de ${mevcutUrlSet.size} mevcut URL yüklendi.`);

    const limitTarihi = new Date();
    limitTarihi.setDate(limitTarihi.getDate() - (gunSayisi + 2));
    const embeddingOnbellek = await Haber.find({ tarih: { $gte: limitTarihi } }, '+embedding').sort({ tarih: -1 });
    console.log(`   📦 ${embeddingOnbellek.length} embedding önbelleğe alındı.`);

    const sonuclar = [];
    let toplamEklenen = 0;

    try {
        const rssSiteleri = [
            {
                isim: 'Özgür Kocaeli',
                rss: 'https://www.ozgurkocaeli.com.tr/rss'
            },
            {
                isim: 'Çağdaş Kocaeli',
                rss: 'https://www.cagdaskocaeli.com.tr/rss'
            },
            {
                isim: 'Ses Kocaeli',
                rss: 'https://www.seskocaeli.com/rss'
            },
        ];

        for (const site of rssSiteleri) {
            try {
                const n = await rssFeeddenHaberleriIsle(
                    site.rss, site.isim, '', startDate, endDate, mevcutUrlSet, embeddingOnbellek
                );
                toplamEklenen += n;
                sonuclar.push({ success: true, site: site.isim, count: n });
            } catch (err) {
                console.log(`   ❌ [${site.isim}] RSS başarısız: ${err.message}`);
                sonuclar.push({ success: false, site: site.isim });
            }
        }

        {
            const n1 = await rssFeeddenHaberleriIsle(
                'https://www.yenikocaeli.com/rss',
                'Yeni Kocaeli', 'https://www.yenikocaeli.com',
                startDate, endDate, mevcutUrlSet, embeddingOnbellek
            );
            const n2 = await haberleriIsle(
                'Yeni Kocaeli', 'https://www.yenikocaeli.com',
                ['https://www.yenikocaeli.com/', 'https://www.yenikocaeli.com/kocaeli-haberleri'],
                startDate, endDate, mevcutUrlSet, embeddingOnbellek, false
            );
            toplamEklenen += n1 + n2;
            sonuclar.push({ success: true, site: 'Yeni Kocaeli', count: n1 + n2 });
        }

        {
            const n1 = await rssFeeddenHaberleriIsle(
                'https://www.bizimyaka.com/rss',
                'Bizim Yaka', 'https://www.bizimyaka.com',
                startDate, endDate, mevcutUrlSet, embeddingOnbellek
            );
            const n2 = await haberleriIsle(
                'Bizim Yaka', 'https://www.bizimyaka.com',
                [
                    'https://www.bizimyaka.com/',
                    'https://www.bizimyaka.com/kocaeli-asayis-haberleri',
                    'https://www.bizimyaka.com/kocaeli-son-dakika-haberleri',
                    'https://www.bizimyaka.com/yasam-haberleri',
                ],
                startDate, endDate, mevcutUrlSet, embeddingOnbellek, false
            );
            toplamEklenen += n1 + n2;
            sonuclar.push({ success: true, site: 'Bizim Yaka', count: n1 + n2 });
        }

    } finally {
        await closeBrowser();
    }

    const sure = ((Date.now() - baslangicZamani) / 1000).toFixed(1);
    console.log(`\n🎉 Scraping Tamamlandı! Toplam ${toplamEklenen} yeni haber eklendi. (${sure} saniye)`);
    return sonuclar;
};

module.exports = { scrapeAllSites };