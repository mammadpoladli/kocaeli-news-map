const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Haber = require('./models/Haber');
const { scrapeAllSites } = require('./services/scraper');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

let scrapingDevamEdiyor = false;

async function scrapiGuvenliBastir(gunSayisi = 3) {
    if (scrapingDevamEdiyor) {
        console.log('⚠️ Scraping zaten çalışıyor, yeni istek reddedildi.');
        return null;
    }
    scrapingDevamEdiyor = true;
    try {
        const sonuc = await scrapeAllSites(gunSayisi);
        return sonuc;
    } finally {
        scrapingDevamEdiyor = false;
    }
}

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ Veritabanı Bağlantısı Başarılı');

        try {
            await Haber.syncIndexes();
            console.log('🔄 İndeksler senkronize edildi.');
        } catch (e) {
            console.warn('⚠️ İndeks senkronizasyonu atlandı:', e.message);
        }

        console.log('🔄 Başlangıç scraping başlatılıyor (Son 3 Gün)...');
        scrapiGuvenliBastir(3)
            .then(sonuc => {
                if (sonuc) {
                    const toplamHaber = sonuc.reduce((acc, s) => acc + (s.count || 0), 0);
                    console.log(`✅ Başlangıç scraping tamamlandı! ${toplamHaber} yeni haber eklendi.`);
                }
            })
            .catch(err => console.error('❌ Başlangıç scraping hatası:', err));

        const ALTI_SAAT = 6 * 60 * 60 * 1000;
        setInterval(() => {
            console.log('⏰ Periyodik otomatik scraping tetiklendi...');
            scrapiGuvenliBastir(3).catch(err => console.error('❌ Periyodik scraping hatası:', err));
        }, ALTI_SAAT);
    })
    .catch(err => console.error('❌ Veritabanı Hatası:', err));

app.get('/', (req, res) => {
    res.send('Kocaeli Haber Haritası API Çalışıyor 🚀');
});

app.get('/api/maps-key', (req, res) => {
    const key = process.env.GOOGLE_MAPS_FRONTEND_KEY || '';
    if (!key) {
        return res.status(500).json({ error: 'Maps API anahtarı .env dosyasında tanımlı değil.' });
    }
    res.json({ key });
});

app.get('/api/scrape/all', async (req, res) => {
    if (scrapingDevamEdiyor) {
        return res.status(429).json({
            status: 'busy',
            message: 'Scraping zaten devam ediyor. Lütfen tamamlanmasını bekleyin.'
        });
    }

    const gunSayisi = Math.min(Math.max(parseInt(req.query.gun) || 3, 1), 30);

    console.log(`📢 Manuel scraping isteği alındı (Son ${gunSayisi} gün)...`);
    try {
        const sonuclar = await scrapiGuvenliBastir(gunSayisi);
        res.json({ status: "success", detaylar: sonuclar });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

app.get('/api/haberler', async (req, res) => {
    try {
        const { tur, ilce, baslangicTarihi, bitisTarihi } = req.query;
        const filtre = {};

        if (tur && tur !== 'hepsi' && tur !== '') {
            const turDizisi = tur.split(',');
            filtre.haberTuru = { $in: turDizisi };
        }

        if (ilce && ilce !== 'hepsi') {
            filtre['konum.ilce'] = ilce;
        }

        if (baslangicTarihi || bitisTarihi) {
            const tarihFiltre = {};

            if (baslangicTarihi) {
                const baslangic = new Date(baslangicTarihi);
                if (!Number.isNaN(baslangic.getTime())) {
                    baslangic.setHours(0, 0, 0, 0);
                    tarihFiltre.$gte = baslangic;
                }
            }

            if (bitisTarihi) {
                const bitis = new Date(bitisTarihi);
                if (!Number.isNaN(bitis.getTime())) {
                    bitis.setHours(23, 59, 59, 999);
                    tarihFiltre.$lte = bitis;
                }
            }

            if (Object.keys(tarihFiltre).length > 0) {
                filtre.tarih = tarihFiltre;
            }
        }

        const haberler = await Haber.find(filtre).sort({ tarih: -1 }).limit(500);
        res.json(haberler);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/scrape/status', (req, res) => {
    res.json({ devamEdiyor: scrapingDevamEdiyor });
});

app.listen(PORT, () => {
    console.log(`\n🚀 SUNUCU BAŞLADI: http://localhost:${PORT}`);
});
