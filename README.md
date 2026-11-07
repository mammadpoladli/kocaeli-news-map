# Kocaeli Haber Haritası 🗺️

Kocaeli iline ait haberleri otomatik olarak toplayan, kategorize eden ve interaktif bir harita üzerinde görselleştiren full-stack web uygulaması.

## 📋 Proje Hakkında

Bu proje, Kocaeli'deki yerel haber sitelerinden belirli kategorilerdeki (trafik kazası, yangın, elektrik kesintisi, hırsızlık, kültürel etkinlikler) haberleri otomatik olarak çekip, yapay zeka destekli benzerlik analizi ile tekilleştirerek Google Maps üzerinde konumlandıran bir sistem sunar.

**Öğrenci:** 230202013  
**Ders:** Yazılım Laboratuvarı II  
**Platform:** Kocaeli Üniversitesi

---

## 🚀 Özellikler

- 🔍 **Otomatik Web Scraping** — RSS feed ve Puppeteer ile birden fazla yerel haber kaynağından veri çekme
- 🧠 **NLP Benzerlik Analizi** — `paraphrase-multilingual-MiniLM-L12-v2` modeli ile vektör tabanlı haber tekilleştirme (cosine similarity)
- 📍 **Coğrafi Kodlama** — Google Geocoding API ve Nominatim ile haber konumlarını koordinata dönüştürme
- 🗺️ **İnteraktif Harita** — Google Maps üzerinde kategori bazlı marker gösterimi, kümeleme ve filtreleme
- 🌙 **Karanlık/Aydınlık Mod** — Harita ve arayüz için tema desteği
- 📰 **Çoklu Kaynak Yönetimi** — Aynı haberi birden fazla kaynaktan takip etme

---

## 🛠️ Teknoloji Yığını

### Backend
| Teknoloji | Kullanım Amacı |
|-----------|----------------|
| Node.js + Express | REST API sunucusu |
| MongoDB + Mongoose | Haber veritabanı |
| Puppeteer + Stealth | Dinamik sayfa scraping |
| Cheerio | HTML parsing |
| @xenova/transformers | Yerel NLP modeli (embedding) |
| Axios | HTTP istekleri |

### Frontend
| Teknoloji | Kullanım Amacı |
|-----------|----------------|
| React 19 + Vite | SPA arayüz framework |
| Bootstrap 5 | UI bileşen kütüphanesi |
| Google Maps JS API | İnteraktif harita |
| Axios | Backend ile iletişim |

---

## 📁 Proje Yapısı

```
230202013/
├── backend/
│   ├── models/
│   │   └── Haber.js          # MongoDB şema tanımı
│   ├── services/
│   │   └── scraper.js        # Web scraping ve haber işleme
│   ├── utils/
│   │   ├── browserHelper.js  # Puppeteer yönetimi
│   │   ├── locationHelper.js # Geocoding ve ilçe tespiti
│   │   └── similarityHelper.js # Embedding ve cosine similarity
│   ├── scripts/
│   │   └── cleanupDb.js      # Veritabanı temizleme aracı
│   ├── .env.example          # Ortam değişkenleri şablonu
│   ├── package.json
│   └── server.js             # Express uygulama giriş noktası
└── frontend/
    ├── src/
    │   ├── App.jsx            # Ana uygulama bileşeni
    │   ├── App.css            # Özel stiller
    │   ├── main.jsx           # React giriş noktası
    │   └── index.css          # Global stiller
    ├── public/
    ├── package.json
    └── vite.config.js
```

---

## ⚙️ Kurulum ve Çalıştırma

### Gereksinimler
- Node.js >= 18
- MongoDB (Atlas veya yerel)
- Google Maps API anahtarı

### 1. Backend Kurulumu

```bash
cd backend
npm install
cp .env.example .env
# .env dosyasını kendi değerlerinizle doldurun
npm start
```

### 2. Frontend Kurulumu

```bash
cd frontend
npm install
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde çalışır.  
Backend API varsayılan olarak `http://localhost:5001` adresinde dinler.

---

## 🔑 Ortam Değişkenleri

`backend/.env.example` dosyasını kopyalayıp `.env` olarak adlandırın ve aşağıdaki değerleri girin:

| Değişken | Açıklama |
|----------|----------|
| `PORT` | Backend sunucu portu (varsayılan: 5001) |
| `MONGO_URI` | MongoDB bağlantı URI'si |
| `GOOGLE_MAPS_API_KEY` | Google Maps / Geocoding API anahtarı (backend) |
| `GOOGLE_MAPS_FRONTEND_KEY` | Google Maps JS API anahtarı (frontend için) |

---

## 📡 API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/` | API durum kontrolü |
| GET | `/api/haberler` | Haberleri filtreli listele |
| GET | `/api/scrape/all` | Manuel scraping başlat |
| GET | `/api/scrape/status` | Scraping durumunu sorgula |
| GET | `/api/maps-key` | Frontend için Maps API anahtarı |

### Haberler Endpoint Parametreleri
- `tur` — Haber türü filtresi (virgülle ayrılmış, örn: `Yangın,Trafik Kazası`)
- `ilce` — İlçe filtresi (örn: `Gebze`)
- `baslangicTarihi` — Başlangıç tarihi (ISO 8601)
- `bitisTarihi` — Bitiş tarihi (ISO 8601)

---

## 🗞️ Desteklenen Haber Kaynakları

- Özgür Kocaeli
- Çağdaş Kocaeli
- Ses Kocaeli
- Yeni Kocaeli
- Bizim Yaka

---

## 📊 Haber Kategorileri

| Kategori | İkon |
|----------|------|
| Trafik Kazası | 🚗 |
| Yangın | 🔥 |
| Elektrik Kesintisi | ⚡ |
| Hırsızlık | 🦹 |
| Kültürel Etkinlikler | 🎭 |
