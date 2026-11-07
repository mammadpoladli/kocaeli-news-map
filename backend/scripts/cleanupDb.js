const mongoose = require('mongoose');
require('dotenv').config();

const Haber = require('../models/Haber');

async function temizle() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB bağlandı.\n');

    const haberler = await Haber.find({});
    let kaynakDuzeltilen = 0;

    for (const haber of haberler) {
        const gorulenSiteler = new Set();
        const benzersizKaynaklar = [];

        for (const kaynak of haber.kaynaklar) {
            if (!gorulenSiteler.has(kaynak.siteAdi)) {
                gorulenSiteler.add(kaynak.siteAdi);
                benzersizKaynaklar.push(kaynak);
            }
        }

        if (benzersizKaynaklar.length < haber.kaynaklar.length) {
            const fark = haber.kaynaklar.length - benzersizKaynaklar.length;
            haber.kaynaklar = benzersizKaynaklar;
            await haber.save();
            kaynakDuzeltilen++;
            console.log(`🔧 "${haber.baslik.substring(0, 50)}" → ${fark} mükerrer kaynak silindi (${benzersizKaynaklar.length} kaldı)`);
        }
    }

    console.log(`\n📊 Mükerrer kaynak temizlendi: ${kaynakDuzeltilen} haber güncellendi.`);

    const result = await Haber.updateMany(
        { embedding: { $exists: true, $not: { $size: 0 } } },
        { $unset: { embedding: "" } }
    );
    console.log(`🧹 ${result.modifiedCount} haberden eski embedding vektörleri temizlendi.`);
    console.log('   (Yeni dense embedding\'ler bir sonraki scraping\'de üretilecek.)\n');

    await mongoose.disconnect();
    console.log('✅ Tamamlandı.');
}

temizle().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
