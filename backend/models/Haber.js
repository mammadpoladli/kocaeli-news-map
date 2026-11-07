const mongoose = require('mongoose');

const HaberSchema = new mongoose.Schema({
    baslik: {
        type: String,
        required: true,
        trim: true
    },
    icerik: {
        type: String,
        required: true
    },
    ozet: { type: String },
    haberTuru: {
        type: String,
        enum: ['Trafik Kazası', 'Yangın', 'Elektrik Kesintisi', 'Hırsızlık', 'Kültürel Etkinlikler'],
        required: true
    },
    tarih: {
        type: Date,
        default: Date.now
    },
    kaynaklar: [{
        siteAdi: { type: String, required: true },
        link: { type: String, required: true },
        yayinTarihi: { type: Date }
    }],
    konum: {
        hamMetin: { type: String },
        ilce: { type: String },
        lat: { type: Number },
        lng: { type: Number },
        geoStatus: { type: Boolean, default: false }
    },
    embedding: {
        type: [Number],
        select: false
    }
}, { timestamps: true });

HaberSchema.index({ 'kaynaklar.link': 1 });
HaberSchema.index({ tarih: -1 });
HaberSchema.index({ haberTuru: 1 });
HaberSchema.index({ 'konum.ilce': 1 });

module.exports = mongoose.model('Haber', HaberSchema);