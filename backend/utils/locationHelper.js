const axios = require('axios');
const mongoose = require('mongoose');

function googleGeocodingApiKey() {
    return (process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

function trLower(s) {
    return String(s || '').normalize('NFC').toLocaleLowerCase('tr-TR');
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buyukHarfMetniniAdresIcinDuzelt(text) {
    if (!text) return '';
    return text.replace(/\b([A-ZÇĞİÖŞÜ]{2,})\b/g, (w) => {
        const lower = w.toLocaleLowerCase('tr-TR');
        return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    });
}

const GeocacheSchema = new mongoose.Schema({
    aramaMetni: { type: String, required: true, unique: true },
    hamMetin:   { type: String, required: true },
    lat:        { type: Number, required: true },
    lng:        { type: Number, required: true },
    geoStatus:  { type: Boolean, default: true }
});
const Geocache = mongoose.models.Geocache || mongoose.model('Geocache', GeocacheSchema);

const KOCAELI_ILCELERI = [
    'Başiskele', 'Karamürsel', 'Çayırova', 'Dilovası', 'Kartepe',
    'Derince', 'Gölcük', 'Körfez', 'Kandıra', 'Gebze', 'Darıca', 'İzmit'
];

const ILCE_ESLESTIRME = {
    'izmit': 'İzmit', 'i̇zmit': 'İzmit', 'kocaeli merkez': 'İzmit',
    'gebze': 'Gebze', 'darica': 'Darıca', 'darıca': 'Darıca',
    'korfez': 'Körfez', 'körfez': 'Körfez',
    'golcuk': 'Gölcük', 'gölcük': 'Gölcük',
    'derince': 'Derince',
    'cayirova': 'Çayırova', 'çayırova': 'Çayırova',
    'kartepe': 'Kartepe',
    'basiskele': 'Başiskele', 'başiskele': 'Başiskele',
    'karamursel': 'Karamürsel', 'karamürsel': 'Karamürsel',
    'kandira': 'Kandıra', 'kandıra': 'Kandıra',
    'dilovasi': 'Dilovası', 'dilovası': 'Dilovası',
};

const ILCE_MERKEZLERI = {
    'İzmit':      { lat: 40.7654, lng: 29.9408 },
    'Gebze':      { lat: 40.8025, lng: 29.4305 },
    'Darıca':     { lat: 40.7667, lng: 29.3711 },
    'Körfez':     { lat: 40.7681, lng: 29.7872 },
    'Gölcük':     { lat: 40.7130, lng: 29.8280 },
    'Derince':    { lat: 40.7535, lng: 29.8245 },
    'Çayırova':   { lat: 40.8278, lng: 29.3694 },
    'Kartepe':    { lat: 40.7533, lng: 30.0232 },
    'Başiskele':  { lat: 40.7085, lng: 29.8650 },
    'Karamürsel': { lat: 40.6875, lng: 29.6064 },
    'Kandıra':    { lat: 41.0742, lng: 30.1558 },
    'Dilovası':   { lat: 40.7817, lng: 29.5297 },
};

const SEMT_ILCE_MAP = {
    'yahya kaptan':'İzmit','tavşantepe':'İzmit','yenidoğan':'İzmit','plajyolu':'İzmit',
    'yenişehir':'İzmit','alikahya':'İzmit','kuruçeşme':'İzmit','gültepe':'İzmit',
    'şirintepe':'İzmit','bekirdere':'İzmit','kozluk':'İzmit','hacıhızır':'İzmit',
    'karabaş':'İzmit','cedit':'İzmit','kemalpaşa':'İzmit','tepecik':'İzmit',
    'sarımeşe':'İzmit','yeşilova':'İzmit','gündoğdu':'İzmit','suadiye':'İzmit',
    'erenler':'İzmit','kabaoğlu':'İzmit','çubuklubala':'İzmit','durhasan':'İzmit',
    'akçakoca':'İzmit','orhan':'İzmit','yenikent':'İzmit','turgut':'İzmit',
    'ömerağa':'İzmit','körfez mahallesi':'İzmit','mehmet ali paşa':'İzmit',
    'yenimahalle':'İzmit','çarşıbaşı':'İzmit','karadenizliler':'İzmit',
    'topçular':'İzmit','mimar sinan':'İzmit','serdar':'İzmit','nusretiye':'İzmit',
    'çataltepe':'İzmit','uzunçiftlik':'İzmit','küçük bahçe':'İzmit',
    'büyük bahçe':'İzmit','tatlısu':'İzmit','kullar':'İzmit',
    'malta':'İzmit','çamlıtepe':'İzmit','28 haziran':'İzmit',
    'değirmendere':'Gölcük','donanma':'Gölcük','hisareyn':'Gölcük',
    'yazlık':'Gölcük','halıdere':'Gölcük','nenehatun':'Gölcük',
    'adnan menderes':'Gölcük','alt değirmendere':'Gölcük',
    'bahçecik':'Başiskele','yuvacık':'Başiskele','ovacık':'Başiskele',
    'kavaklar':'Başiskele','serdar mahallesi':'Başiskele',
    'yeniköy':'Başiskele','göktepe':'Başiskele',
    'maşukiye':'Kartepe','arslanbey':'Kartepe','köseköy':'Kartepe',
    'uzuntarla':'Kartepe','subaşı':'Kartepe','ertuğrulgazi':'Kartepe',
    'derbent':'Kartepe','safiye hatun':'Kartepe','nüzhetiye':'Kartepe',
    'tütünçiftlik':'Gebze','osman yılmaz':'Gebze','güzeller':'Gebze',
    'beylikbağ':'Gebze','gaziler':'Gebze','tavşancıl':'Gebze',
    'fatih sultan mehmet':'Gebze','güneşler':'Gebze','muallimköy':'Gebze',
    'pelitli':'Gebze','aydıntepe':'Gebze','altınova':'Gebze',
    'çaybaşı':'Gebze','şişli':'Gebze','bağçalı':'Gebze',
    'hereke':'Körfez','yarımca':'Körfez','kalburcu':'Körfez',
    'kirazlıyalı':'Körfez','yukarı hereke':'Körfez','rahmiye':'Körfez',
    'karaçalı':'Körfez','yeniköy körfez':'Körfez',
    'çenedağ':'Derince','deniz mahallesi':'Derince','köseköy derince':'Derince',
    'işçi evleri':'Derince','gündoğdu derince':'Derince',
    'şekerpınar':'Çayırova','akse':'Çayırova','özgürlük':'Çayırova',
    'ballıkaya':'Çayırova','ulaş':'Çayırova',
    'bayramoğlu':'Darıca','osmangazi':'Darıca','bağlarbaşı':'Darıca',
    'güneştepe':'Darıca','abdi ipekçi':'Darıca','ömerli':'Darıca',
    'sevindik':'Dilovası','diliskelesi':'Dilovası','köseler':'Dilovası',
    'semetler':'Karamürsel','akmeşe':'Karamürsel','nüzhetiye karamürsel':'Karamürsel',
    'acısu':'Kandıra','saraçoğlu':'Kandıra','kızderbent':'Kandıra',
};

const OZEL_LOKASYONLAR = {
    'barlar sokağı':        { lat:40.7634, lng:29.9328, tamAd:'Barlar Sokağı, İzmit', ilce:'İzmit' },
    'yürüyüş yolu':         { lat:40.7628, lng:29.9360, tamAd:'Yürüyüş Yolu, İzmit', ilce:'İzmit' },
    'fethiye caddesi':      { lat:40.7645, lng:29.9312, tamAd:'Fethiye Caddesi, İzmit', ilce:'İzmit' },
    'kandıra sapağı':       { lat:40.7680, lng:29.9540, tamAd:'Kandıra Sapağı, İzmit', ilce:'İzmit' },
    'perşembe pazarı':      { lat:40.7615, lng:29.9480, tamAd:'Perşembe Pazarı, İzmit', ilce:'İzmit' },
    'umuttepe':             { lat:40.8210, lng:29.9230, tamAd:'Umuttepe Kampüsü, Kocaeli', ilce:'İzmit' },
    'sekapark':             { lat:40.7651, lng:29.9192, tamAd:'Sekapark, İzmit', ilce:'İzmit' },
    'seka park':            { lat:40.7651, lng:29.9192, tamAd:'Seka Park, İzmit', ilce:'İzmit' },
    'd-100':                { lat:40.7700, lng:29.9200, tamAd:'D-100 Karayolu, Kocaeli', ilce:'İzmit' },
    'derince liman':        { lat: 40.7520, lng: 29.8350, tamAd: 'Derince Limanı, Derince', ilce: 'Derince' },
    'osmangazi köprüsü':    { lat:40.7428, lng:29.5283, tamAd:'Osmangazi Köprüsü, Körfez', ilce:'Körfez' },
    'kocaeli üniversitesi': { lat:40.8210, lng:29.9230, tamAd:'Kocaeli Üniversitesi', ilce:'İzmit' },
    'kocaeli üni':          { lat:40.8210, lng:29.9230, tamAd:'Kocaeli Üniversitesi', ilce:'İzmit' },
    'gebze organize':       { lat:40.8000, lng:29.4800, tamAd:'Gebze Organize Sanayi', ilce:'Gebze' },
    'gosb':                 { lat:40.8000, lng:29.4800, tamAd:'Gebze Organize Sanayi (GOSB)', ilce:'Gebze' },
    'dilovası osb':         { lat:40.7817, lng:29.5297, tamAd:'Dilovası OSB', ilce:'Dilovası' },
    'karadenizliler':       { lat:40.7880, lng:29.9954, tamAd:'Karadenizliler Mahallesi, İzmit', ilce:'İzmit' },
    'çarşıbaşı':            { lat:40.7690, lng:29.9440, tamAd:'Çarşıbaşı, İzmit', ilce:'İzmit' },
    'ormanya':              { lat:40.7050, lng:29.9300, tamAd:'Ormanya Tabiat Parkı, İzmit', ilce:'İzmit' },
    'tüpraş':               { lat:40.7580, lng:29.7800, tamAd:'TÜPRAŞ Rafinerisi, Körfez', ilce:'Körfez' },
    'ford otosan':          { lat:40.7200, lng:29.8150, tamAd:'Ford Otosan Fabrikası, Gölcük', ilce:'Gölcük' },
    'gebze teknik':         { lat:40.8090, lng:29.3560, tamAd:'Gebze Teknik Üniversitesi, Gebze', ilce:'Gebze' },
    'gtü':                  { lat:40.8090, lng:29.3560, tamAd:'Gebze Teknik Üniversitesi, Gebze', ilce:'Gebze' },
    'derince limanı':       { lat:40.7520, lng:29.8350, tamAd:'Derince Limanı, Derince', ilce:'Derince' },
    'kartepe kayak':        { lat:40.5970, lng:30.0330, tamAd:'Kartepe Kayak Merkezi, Kartepe', ilce:'Kartepe' },
    'kocaeli stadyumu':     { lat:40.7730, lng:29.9505, tamAd:'Kocaeli Stadyumu, İzmit', ilce:'İzmit' },
    'rams park':            { lat:40.7730, lng:29.9505, tamAd:'Rams Park Stadyumu, İzmit', ilce:'İzmit' },
    'darıca faruk yalçın':  { lat:40.7695, lng:29.3640, tamAd:'Faruk Yalçın Hayvanat Bahçesi, Darıca', ilce:'Darıca' },
    'hayvanat bahçesi':     { lat:40.7695, lng:29.3640, tamAd:'Faruk Yalçın Hayvanat Bahçesi, Darıca', ilce:'Darıca' },
    'kocaeli emniyet':      { lat:40.7660, lng:29.9380, tamAd:'Kocaeli Emniyet Müdürlüğü, İzmit', ilce:'İzmit' },
    'yahya kaptan':         { lat:40.7793, lng:29.9600, tamAd:'Yahya Kaptan Mahallesi, İzmit', ilce:'İzmit' },
    'alikahya':             { lat:40.7900, lng:29.9800, tamAd:'Alikahya, İzmit', ilce:'İzmit' },
    'çayırova organize':    { lat:40.8278, lng:29.3694, tamAd:'Çayırova OSB, Çayırova', ilce:'Çayırova' },
    'izmit sahil':          { lat:40.7630, lng:29.9250, tamAd:'İzmit Sahil Yolu, İzmit', ilce:'İzmit' },
    'gebze arena':          { lat:40.8020, lng:29.4310, tamAd:'Gebze Arena, Gebze', ilce:'Gebze' },
    'tavşantepe':           { lat:40.7750, lng:29.9500, tamAd:'Tavşantepe Mahallesi, İzmit', ilce:'İzmit' },
    'yenikent kültür':      { lat:40.7610, lng:29.8250, tamAd:'Yenikent Kültür Merkezi, Derince', ilce:'Derince' },
    'kazıklı kervansarayı': { lat:40.7180, lng:29.8350, tamAd:'Kazıklı Kervansarayı Kültür Yapısı, Gölcük', ilce:'Gölcük' }
};

const BBOX = { minLat: 40.55, maxLat: 41.20, minLng: 29.35, maxLng: 30.35 };

function kocaeliIcindeMi(lat, lng) {
    return lat >= BBOX.minLat && lat <= BBOX.maxLat &&
        lng >= BBOX.minLng && lng <= BBOX.maxLng;
}

async function geocodeGoogle(apiSorgu, apiKey) {
    const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: { address: apiSorgu, key: apiKey, region: 'tr', language: 'tr' },
        timeout: 10000
    });
    if (data.status !== 'OK') return null;
    for (const r of data.results || []) {
        const loc = r.geometry?.location;
        if (loc && kocaeliIcindeMi(loc.lat, loc.lng)) return { lat: loc.lat, lng: loc.lng };
    }
    return null;
}

async function geocodeNominatim(apiSorgu, bounded) {
    await new Promise(r => setTimeout(r, 1100));
    const q = encodeURIComponent(apiSorgu);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=tr&addressdetails=1&viewbox=29.35,41.20,30.35,40.55&bounded=${bounded ? 1 : 0}`;
    const resp = await axios.get(url, {
        headers: { 'User-Agent': 'KocaeliHaberHaritasi/5.0 (educational)' },
        timeout: 10000
    });
    if (!resp.data?.length) return null;
    const gecerli = resp.data.find(row => kocaeliIcindeMi(parseFloat(row.lat), parseFloat(row.lon)));
    if (!gecerli) return null;
    return { lat: parseFloat(gecerli.lat), lng: parseFloat(gecerli.lon) };
}

function deterministikOffset(seed) {
    let h1 = 2166136261;
    let h2 = 2166136261 ^ 0xDEADBEEF;
    for (let i = 0; i < seed.length; i++) {
        const c = seed.charCodeAt(i);
        h1 = ((h1 ^ c) * 16777619) >>> 0;
        h2 = ((h2 ^ (c * 31)) * 16777619) >>> 0;
    }
    const dLat = ((h1 % 1000) / 1000 - 0.5) * 0.008;
    const dLng = ((h2 % 1000) / 1000 - 0.5) * 0.008;
    return { dLat, dLng };
}

const KURUM_FILTRELERI = [
    'hastanesi', 'hastanesine', 'hastaneye', 'hastanede',
    'adliye', 'adliyesi', 'adliyeye', 'adliyede',
    'cezaevi', 'cezaevine',
    'morga kaldırıldı', 'morga gönderildi'
];

const YAKALAMA_FILTRELERI = [
    'yakalan', 'gözaltına', 'operasyonla', 'tutuklan',
    'adliyeye sevk', 'cezaevine gönderildi', 'kovuşturma'
];

function ilceBul(baslik, icerikOnce) {
    const bL = trLower(baslik);

    const icerikIlk = trLower((icerikOnce || '').substring(0, 500));
    const icerikSon = trLower((icerikOnce || '').substring(500, 1500));
    const skorlar = {};

    for (const ilce of KOCAELI_ILCELERI) {
        const core = escapeRegExp(trLower(ilce));
        const re = new RegExp(`(?:^|[^a-zçğıöşü0-9])${core}(?:['']?(?:de|da|ye|ya|nin|nın|nun|nün|li|lı|lu|lü|ler|lar|e|a|i|ı|u|ü|den|dan|deki|daki){0,2})?(?=[^a-zçğıöşü0-9]|$)`, 'gi');
        const basHit = (bL.match(re) || []).length;
        const ilkHit = (icerikIlk.match(re) || []).length;
        const sonHit = (icerikSon.match(re) || []).length;

        let kurumCezasi = 0;
        for (const kf of KURUM_FILTRELERI) {
            const kurumRe = new RegExp(`${core}.{0,50}${escapeRegExp(kf)}`, 'gi');
            if (kurumRe.test(icerikIlk + icerikSon)) kurumCezasi += 3;
        }

        let yakalamaC = 0;
        for (const yf of YAKALAMA_FILTRELERI) {
            const yakalamaRe = new RegExp(`${core}.{0,80}${escapeRegExp(yf)}`, 'gi');
            if (yakalamaRe.test(icerikIlk + icerikSon)) yakalamaC += 3;
        }

        const toplam = basHit * 5 + ilkHit * 3 + sonHit - kurumCezasi - yakalamaC;
        if (toplam > 0) skorlar[ilce] = (skorlar[ilce] || 0) + toplam;
    }

    for (const [alt, standart] of Object.entries(ILCE_ESLESTIRME)) {
        const re = new RegExp(`(?:^|[^a-zçğıöşü])${escapeRegExp(alt)}(?:[^a-zçğıöşü]|$)`, 'i');
        if (re.test(bL)) skorlar[standart] = (skorlar[standart] || 0) + 4;
        else if (re.test(icerikIlk)) skorlar[standart] = (skorlar[standart] || 0) + 3;
        else if (re.test(icerikSon)) skorlar[standart] = (skorlar[standart] || 0) + 1;
    }

    if (Object.keys(skorlar).length > 0) {
        const maxSkor = Math.max(...Object.values(skorlar));
        const tied = Object.keys(skorlar).filter(k => skorlar[k] === maxSkor);
        if (tied.length === 1) return tied[0];
        return tied.reduce((best, ilce) => {
            const core = escapeRegExp(trLower(ilce));
            const re = new RegExp(core, 'gi');
            return (bL.match(re) || []).length >= (bL.match(new RegExp(escapeRegExp(trLower(best)), 'gi')) || []).length ? ilce : best;
        }, tied[0]);
    }

    const combined = `${bL} ${icerikIlk}`;
    for (const [semt, ilce] of Object.entries(SEMT_ILCE_MAP)) {
        const re = new RegExp(`(?:^|[^a-zçğıöşü])${escapeRegExp(semt)}(?:[a-zçğıöşü']{0,4})?(?=[^a-zçğıöşü]|$)`, 'i');
        if (re.test(combined)) return ilce;
    }

    if (combined.includes('kocaeli')) return 'İzmit';

    return null;
}

function adresBilesenleri(text) {
    text = buyukHarfMetniniAdresIcinDuzelt(text);

    const mahalleRe = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}(?:\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}){0,2})\s+(?:Mahallesi|Mahalle|Mah\.|Mh\.)/g;
    const caddeRe   = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}(?:\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}){0,2})\s+(Caddesi|Cadde|Cad\.|Bulvarı|Bulvar|Blv\.|Sokağı|Sokak|Sk\.|Otoyolu)/g;
    const mevkiRe   = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}(?:\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}){0,2})\s+(Kavşağı|Kavşak|Köprüsü|Köprü|Mevkii|Mevki|Viyadüğü)/g;

    const KIRLETICILER = [
        'çatısında','içinde','önünde','yakınında','karşısında','arkasında',
        'üzerinde','altında','yanında','çıkan','bulunan','olan','kalan',
        'yaşanan','meydana','gelen','çıktı','başladı','söndürüldü','devrildi','çarptı'
    ];
    const ETIKETLER = ['Mahallesi','Mahalle','Mah.','Mh.','Caddesi','Cadde','Bulvarı','Bulvar','Sokağı','Sokak','Kavşağı','Kavşak','Köprüsü','Köprü','Mevkii','Mevki'];

    function temizIsim(isim) {
        const kelimeler = isim.split(' ');
        const son = [];
        for (let i = kelimeler.length - 1; i >= 0; i--) {
            if (ETIKETLER.some(e => kelimeler[i].includes(e))) break;
            son.unshift(kelimeler[i]);
        }
        return son.join(' ');
    }

    const mahalleler = [], caddeler = [], mevkiler = [];
    let m;

    while ((m = mahalleRe.exec(text)) !== null) {
        let isim = temizIsim(m[1].trim());
        if (!isim || isim.length < 3) continue;
        if (KIRLETICILER.some(k => trLower(isim).includes(k))) continue;
        if (!isim.split(' ').every(k => /^[A-ZÇĞİÖŞÜ]/.test(k))) continue;
        if (KOCAELI_ILCELERI.some(ilce => trLower(ilce) === trLower(isim))) continue;
        mahalleler.push(isim + ' Mahallesi');
    }
    while ((m = caddeRe.exec(text)) !== null) {
        let isim = temizIsim(m[1].trim());
        if (!isim || isim.length < 3) continue;
        if (!isim.split(' ').every(k => /^[A-ZÇĞİÖŞÜ]/.test(k))) continue;
        caddeler.push(`${isim} ${m[2]}`);
    }
    while ((m = mevkiRe.exec(text)) !== null) {
        let isim = temizIsim(m[1].trim());
        if (!isim || isim.length < 3) continue;
        if (!isim.split(' ').every(k => /^[A-ZÇĞİÖŞÜ]/.test(k))) continue;
        mevkiler.push(`${isim} ${m[2]}`);
    }

    return { mahalleler, caddeler, mevkiler };
}

async function getKonumFromText(baslik, icerik, seed = '') {
    if (icerik === undefined) {
        icerik = baslik.substring(200);
        baslik = baslik.substring(0, 200);
    }
    if (!baslik && !icerik) return { geoStatus: false };

    const temizBaslik = buyukHarfMetniniAdresIcinDuzelt((baslik || '').trim());
    const temizIcerik = (icerik || '').substring(0, 1000);
    const tamMetin = trLower(`${temizBaslik} ${temizIcerik}`);

    for (const [anahtar, bilgi] of Object.entries(OZEL_LOKASYONLAR)) {
        const index = tamMetin.indexOf(trLower(anahtar));
        if (index !== -1) {
            const riskliAnahtarlar = ['umuttepe', 'kocaeli üniversitesi', 'kocaeli üni', 'farabi', 'tıp fakültesi'];
            if (riskliAnahtarlar.includes(trLower(anahtar))) {
                const baglamBaslangic = Math.max(0, index - 50);
                const baglamBitis = Math.min(tamMetin.length, index + 150);
                const baglam = tamMetin.substring(baglamBaslangic, baglamBitis);

                const hastaneMi = ['hastane', 'kaldırıldı', 'sevk', 'tedavi', 'morg', 'ambulans'].some(w => baglam.includes(w));
                if (hastaneMi) {
                    continue;
                }
            }

            console.log(`   📍 Statik: ${bilgi.tamAd}`);
            return { hamMetin: bilgi.tamAd, ilce: bilgi.ilce, lat: bilgi.lat, lng: bilgi.lng, geoStatus: true };
        }
    }

    const ilceBaglamIcerik = (icerik || '').substring(0, 1000);
    const ilceBulundu = ilceBul(temizBaslik, ilceBaglamIcerik);

    if (!ilceBulundu) {
        console.log(`   ⛔ İlçe tespit edilemedi: "${temizBaslik.substring(0, 60)}"`);
        return { geoStatus: false };
    }

    const aramaMetni = `${temizBaslik} ${temizIcerik}`;
    const { mahalleler, caddeler, mevkiler } = adresBilesenleri(aramaMetni);
    const mahalle = mahalleler[0] || null;
    const cadde   = caddeler[0]   || null;
    const mevki   = mevkiler[0]   || null;

    let hamMetin;
    if (cadde && mahalle) hamMetin = `${cadde}, ${mahalle}, ${ilceBulundu}`;
    else if (mahalle) hamMetin = `${mahalle}, ${ilceBulundu}`;
    else if (cadde)   hamMetin = `${cadde}, ${ilceBulundu}`;
    else if (mevki)   hamMetin = `${mevki}, ${ilceBulundu}`;
    else              hamMetin = ilceBulundu;

    if (!mahalle && !cadde && !mevki) {
        for (const [semt, ilce] of Object.entries(SEMT_ILCE_MAP)) {
            if (ilce !== ilceBulundu) continue;
            const re = new RegExp(`(?:^|[^a-zçğıöşü])${escapeRegExp(semt)}(?:[a-zçğıöşü']{0,4})?(?=[^a-zçğıöşü]|$)`, 'i');
            if (re.test(tamMetin)) {
                const merkez = ILCE_MERKEZLERI[ilceBulundu];
                if (merkez) {
                    const offsetSeed = `${semt}_${ilceBulundu}_${seed}`;
                    const { dLat, dLng } = deterministikOffset(offsetSeed);
                    console.log(`   📍 Semt eşleşmesi: ${semt}, ${ilceBulundu}`);
                    return {
                        hamMetin: `${semt.charAt(0).toUpperCase() + semt.slice(1)}, ${ilceBulundu}`,
                        ilce: ilceBulundu,
                        lat: merkez.lat + dLat,
                        lng: merkez.lng + dLng,
                        geoStatus: true
                    };
                }
            }
        }
    }

    const temNormalize = (s) => s
        .replace(/\bTem\s+Otoyolu\b/gi, 'Anadolu Otoyolu')
        .replace(/\bTEM\s+Otoyolu\b/gi, 'Anadolu Otoyolu')
        .replace(/\bTem\b/gi, 'Anadolu Otoyolu');

    const sorguListesi = [];
    if (cadde && mahalle) sorguListesi.push(temNormalize(`${cadde}, ${mahalle}, ${ilceBulundu}, Kocaeli, Turkey`));
    if (cadde)            sorguListesi.push(temNormalize(`${cadde}, ${ilceBulundu}, Kocaeli, Turkey`));
    if (mahalle)          sorguListesi.push(`${mahalle}, ${ilceBulundu}, Kocaeli, Turkey`);
    if (mevki)            sorguListesi.push(temNormalize(`${mevki}, ${ilceBulundu}, Kocaeli, Turkey`));
    sorguListesi.push(`${ilceBulundu}, Kocaeli, Turkey`);

    const gKey = googleGeocodingApiKey();
    const seen = new Set();
    const benzersiz = sorguListesi.filter(s => {
        const k = s.toLowerCase().trim();
        if (seen.has(k)) return false;
        seen.add(k); return true;
    });

    for (let i = 0; i < benzersiz.length; i++) {
        const sorgu = benzersiz[i].replace(/\s{2,}/g, ' ').trim();
        const normalKey = sorgu.toLowerCase().trim();
        const sonCare = i === benzersiz.length - 1;

        try {
            const cached = await Geocache.findOne({ aramaMetni: normalKey });
            if (cached) {
                if (!kocaeliIcindeMi(cached.lat, cached.lng)) continue;
                console.log(`   ⚡ Cache: ${cached.hamMetin}`);
                return { hamMetin, ilce: ilceBulundu, lat: cached.lat, lng: cached.lng, geoStatus: true };
            }
        } catch (_) {}

        if (sonCare && ILCE_MERKEZLERI[ilceBulundu]) {
            const { lat, lng } = ILCE_MERKEZLERI[ilceBulundu];
            const { dLat, dLng } = deterministikOffset(`ilce_${ilceBulundu}_${seed}`);
            console.log(`   📌 İlçe merkezi: ${ilceBulundu}`);
            try { await new Geocache({ aramaMetni: normalKey, hamMetin: sorgu, lat, lng }).save(); } catch (_) {}
            return { hamMetin, ilce: ilceBulundu, lat: lat + dLat, lng: lng + dLng, geoStatus: true };
        }

        let lat = null, lng = null;

        if (gKey) {
            try {
                const g = await geocodeGoogle(sorgu, gKey);
                if (g) { lat = g.lat; lng = g.lng; console.log(`   🌍 Google: ${sorgu}`); }
            } catch (err) { console.error(`   Google hata: ${err.message}`); }
        }

        if (lat == null) {
            try {
                let n = await geocodeNominatim(sorgu, true);
                if (!n) n = await geocodeNominatim(sorgu, false);
                if (n) { lat = n.lat; lng = n.lng; console.log(`   🌍 Nominatim: ${sorgu}`); }
            } catch (err) { console.error(`   Nominatim hata: ${err.message}`); }
        }

        if (lat != null && lng != null) {
            try { await new Geocache({ aramaMetni: normalKey, hamMetin: sorgu, lat, lng }).save(); } catch (_) {}
            console.log(`   📌 Konum: ${hamMetin}`);
            return { hamMetin, ilce: ilceBulundu, lat, lng, geoStatus: true };
        }
    }

    console.log(`   ⛔ Geocoding başarısız, haber atlanıyor: ${hamMetin}`);
    return { geoStatus: false };
}

module.exports = { getKonumFromText };