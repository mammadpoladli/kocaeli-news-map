# 🗺️ Kocaeli News Map

A full-stack web application that automatically collects local news from Kocaeli, organizes news by category, and displays news locations on an interactive map.

## 📌 About the Project

Kocaeli News Map is a web application developed for the Software Laboratory II course at Kocaeli University.

The application collects news from different local news websites in Kocaeli. It focuses on five categories: traffic accidents, fires, power outages, theft, and cultural events.

The system uses Natural Language Processing (NLP) to detect similar news articles and avoid duplicates. It also identifies news locations and displays them on Google Maps.

It combines web scraping, Natural Language Processing, database management, and interactive maps in a single web application.

---

## 🚀 Features

- **Automatic News Collection:** Collects news from multiple local websites using RSS feeds and web scraping.
- **AI-Based Duplicate Detection:** Uses an NLP model and cosine similarity to identify similar news articles.
- **Location Detection:** Converts news locations into geographic coordinates using Google Geocoding API and Nominatim.
- **Interactive Map:** Displays news on Google Maps with markers, clustering, and category filters.
- **Dark and Light Mode:** Supports different themes for the map and user interface.
- **Multiple News Sources:** Combines information from different sources about the same event.

---

## 🛠️ Technologies Used

### Backend

| Technology | Purpose |
|---|---|
| Node.js & Express | REST API server |
| MongoDB & Mongoose | Database management |
| Puppeteer & Stealth | Web scraping |
| Cheerio | HTML parsing |
| @xenova/transformers | NLP and text embeddings |
| Axios | HTTP requests |

For duplicate detection, the application uses the `paraphrase-multilingual-MiniLM-L12-v2` model and cosine similarity.

### Frontend

| Technology | Purpose |
|---|---|
| React 19 & Vite | Web interface |
| Bootstrap 5 | UI design |
| Google Maps JavaScript API | Interactive map |
| Axios | Backend communication |

---

## 📁 Project Structure

```text
230202013/
├── backend/
│   ├── models/
│   │   └── Haber.js
│   ├── services/
│   │   └── scraper.js
│   ├── utils/
│   │   ├── browserHelper.js
│   │   ├── locationHelper.js
│   │   └── similarityHelper.js
│   ├── scripts/
│   │   └── cleanupDb.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── main.jsx
    │   └── index.css
    ├── public/
    ├── package.json
    └── vite.config.js
```

---

## ⚙️ Installation and Setup

### Requirements

Before running the project, make sure you have:

- Node.js 18 or higher
- MongoDB (local or MongoDB Atlas)
- Google Maps API key

### 1. Backend Setup

Open a terminal and run:

```bash
cd backend
npm install
cp .env.example .env
```

Update the `.env` file with your database connection and API keys.

Start the backend server:

```bash
npm start
```

The backend runs at:

`http://localhost:5001`

### 2. Frontend Setup

Open another terminal and run:

```bash
cd frontend
npm install
npm run dev
```

Open the application in your browser:

`http://localhost:5173`

---

## 🔑 Environment Variables

Create a `.env` file inside the `backend` folder using `.env.example`.

| Variable | Description |
|---|---|
| `PORT` | Backend port (default: 5001) |
| `MONGO_URI` | MongoDB connection string |
| `GOOGLE_MAPS_API_KEY` | Google Maps and Geocoding API key |
| `GOOGLE_MAPS_FRONTEND_KEY` | Google Maps JavaScript API key for the frontend |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Check API status |
| GET | `/api/haberler` | Get news with optional filters |
| GET | `/api/scrape/all` | Start news scraping manually |
| GET | `/api/scrape/status` | Check scraping status |
| GET | `/api/maps-key` | Get the frontend Maps API key |

### News Filters

The `/api/haberler` endpoint supports these parameters:

| Parameter | Description |
|---|---|
| `tur` | News category (supports multiple categories) |
| `ilce` | District name (e.g., Gebze) |
| `baslangicTarihi` | Start date (ISO 8601) |
| `bitisTarihi` | End date (ISO 8601) |

---

## 📰 Supported News Sources

The application collects news from five local news websites:

- Özgür Kocaeli
- Çağdaş Kocaeli
- Ses Kocaeli
- Yeni Kocaeli
- Bizim Yaka

---

## 📊 News Categories

| Category | Icon |
|---|---|
| Traffic Accidents | 🚗 |
| Fires | 🔥 |
| Power Outages | ⚡ |
| Theft | 🦹 |
| Cultural Events | 🎭 |


