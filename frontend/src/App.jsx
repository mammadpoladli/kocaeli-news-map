import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const CATEGORY_STYLES = {
    "Trafik Kazası":       { color: "#ff4757", icon: "🚗", label: "Trafik Kazası" },
    "Yangın":              { color: "#ff7f50", icon: "🔥", label: "Yangın" },
    "Elektrik Kesintisi":  { color: "#ffb818", icon: "⚡", label: "Elektrik Kesintisi" },
    "Hırsızlık":           { color: "#a55eea", icon: "🦹", label: "Hırsızlık" },
    "Kültürel Etkinlikler":{ color: "#2ed573", icon: "🎭", label: "Kültürel Etkinlikler" },
    "Varsayılan":          { color: "#95a5a6", icon: "📰", label: "Diğer" }
};

const createEmojiMarker = (emoji, color) => {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="${color}" flood-opacity="0.6"/>
                </filter>
            </defs>
            <circle cx="24" cy="24" r="16" fill="${color}" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)">
                <animate attributeName="r" values="16;17.5;16" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <text x="24" y="30.5" font-size="18" text-anchor="middle">${emoji}</text>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

async function loadGoogleMaps(apiBase) {
    if (window.google && window.google.maps) return;
    try {
        const res = await axios.get(`${apiBase}/api/maps-key`);
        const key = res.data.key;
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&language=tr&region=TR`;
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Google Maps yüklenemedi'));
            document.head.appendChild(script);
        });
        } catch (err) {
            console.error('Maps API key alınamadı:', err.message);
            throw err;
        }
    }

    const LIGHT_MAP_STYLES = [
        { featureType: "poi.business", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
    ];

    const DARK_MAP_STYLES = [
        { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
        { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#334155" }] },
        { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#166534" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
        { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#475569" }] },
        { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f8fafc" }] },
        { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
        { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#475569" }] },
        { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#334155" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] }
    ];

    function App() {
    const mapRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [markersList, setMarkersList] = useState([]);
    const [mapsHazir, setMapsHazir] = useState(false);
    const [mapsHata, setMapsHata] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    const [filteredNews, setFilteredNews] = useState([]);

    const [filters, setFilters] = useState({
        tur: [],
        ilce: 'hepsi',
        baslangicTarihi: '',
        bitisTarihi: ''
    });
    const [isScraping, setIsScraping] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [scrapeGun, setScrapeGun] = useState(3);
    const markersMapRef = useRef({});

    const debouncedFilters = useDebounce(filters, 400);

    const toggleFilterTur = (key) => {
        setFilters(prev => {
            const currentTur = prev.tur;
            if (currentTur.includes(key)) {
                return { ...prev, tur: currentTur.filter(t => t !== key) };
            } else {
                return { ...prev, tur: [...currentTur, key] };
            }
        });
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    useEffect(() => {
        loadGoogleMaps(API_BASE)
            .then(() => setMapsHazir(true))
            .catch(() => setMapsHata(true));
    }, []);

    const kategoriDagilimi = useMemo(() => {
        const sayimlar = {};
        for (const key of Object.keys(CATEGORY_STYLES)) {
            if (key !== 'Varsayılan') sayimlar[key] = 0;
        }
        filteredNews.forEach(h => {
            if (sayimlar[h.haberTuru] !== undefined) sayimlar[h.haberTuru]++;
        });
        return sayimlar;
    }, [filteredNews]);

    const handleHaberClick = useCallback((haber) => {
        if (!mapInstance || !haber.konum?.lat) return;
        const marker = markersMapRef.current[String(haber._id)];
        if (marker) {
            mapInstance.panTo(marker.getPosition());
            mapInstance.setZoom(14);
            window.google.maps.event.trigger(marker, 'click');
        }
    }, [mapInstance]);

    const fetchHaberler = useCallback(async (aktifFiltreler) => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const f = aktifFiltreler || debouncedFilters;
            const params = new URLSearchParams();
            if (f.tur && f.tur.length > 0) params.append('tur', f.tur.join(','));
            if (f.ilce && f.ilce !== 'hepsi') params.append('ilce', f.ilce);
            if (f.baslangicTarihi) params.append('baslangicTarihi', f.baslangicTarihi);
            if (f.bitisTarihi) params.append('bitisTarihi', f.bitisTarihi);

            const qs = params.toString();
            const url = `${API_BASE}/api/haberler${qs ? '?' + qs : ''}`;
            const response = await axios.get(url);
            setFilteredNews(response.data);
        } catch (error) {
            console.error("Veri çekme hatası:", error);
            setFetchError("Sunucuya bağlanılamadı. Backend çalıştığından emin olun.");
        } finally {
            setIsLoading(false);
        }
    }, [debouncedFilters]);

    const handleScrape = async () => {
        setIsScraping(true);
        try {
            const scrapeRes = await axios.get(`${API_BASE}/api/scrape/all?gun=${scrapeGun}`);
            if (scrapeRes.data?.status === 'busy') {
                alert("Scraping zaten devam ediyor. Lütfen bekleyin.");
                setIsScraping(false);
                return;
            }
            await fetchHaberler(debouncedFilters);
            alert(`Son ${scrapeGun} günün haberleri başarıyla çekildi!`);
        } catch(e) {
            if (e.response?.status === 429) {
                alert("Scraping zaten devam ediyor. Lütfen tamamlanmasını bekleyin.");
            } else {
                alert("Veri çekilirken hata oluştu. Sunucu bağlantısını kontrol edin.");
            }
        }
        setIsScraping(false);
    };

    const updateFilter = (alan, deger) => {
        setFilters((onceki) => ({ ...onceki, [alan]: deger }));
    };

    const resetFilters = () => {
        setFilters({
            tur: [],
            ilce: 'hepsi',
            baslangicTarihi: '',
            bitisTarihi: ''
        });
    };

    useEffect(() => {
        if (!mapsHazir || !mapRef.current || mapInstance) return;
        const map = new window.google.maps.Map(mapRef.current, {
            center: { lat: 40.7654, lng: 29.9408 },
            zoom: 11,
            disableDefaultUI: true,
            zoomControl: true,
            backgroundColor: isDarkMode ? '#0f172a' : '#aadaff',
            styles: isDarkMode ? DARK_MAP_STYLES : LIGHT_MAP_STYLES
        });
        setMapInstance(map);
    }, [mapsHazir, mapInstance]);

    useEffect(() => {
        if (!mapInstance) return;
        mapInstance.setOptions({
            backgroundColor: isDarkMode ? '#0f172a' : '#aadaff',
            styles: isDarkMode ? DARK_MAP_STYLES : LIGHT_MAP_STYLES
        });
    }, [isDarkMode, mapInstance]);

    useEffect(() => {
        fetchHaberler(debouncedFilters);
    }, [debouncedFilters, fetchHaberler]);

    useEffect(() => {
        if (!mapInstance || !window.google) return;

        markersList.forEach(marker => marker.setMap(null));
        const newMarkers = [];
        markersMapRef.current = {};
        const infoWindow = new window.google.maps.InfoWindow();
        const bounds = new window.google.maps.LatLngBounds();
        let hasValidPoints = false;
        const timeouts = [];

        filteredNews.forEach((haber, index) => {
            if (!haber.konum || !haber.konum.lat) return;

            const styleData = CATEGORY_STYLES[haber.haberTuru] || CATEGORY_STYLES["Varsayılan"];
            const iconUrl = createEmojiMarker(styleData.icon, styleData.color);

            const idSeed = parseInt(haber._id.toString().slice(-6), 16);
            const offsetLat = ((idSeed % 1000) / 1000 - 0.5) * 0.0003;
            const offsetLng = (((idSeed >> 3) % 1000) / 1000 - 0.5) * 0.0003;

            const position = { lat: haber.konum.lat + offsetLat, lng: haber.konum.lng + offsetLng };

            const marker = new window.google.maps.Marker({
                position,
                icon: {
                    url: iconUrl,
                    scaledSize: new window.google.maps.Size(36, 36),
                    anchor: new window.google.maps.Point(18, 18)
                },
                title: haber.baslik,
                animation: window.google.maps.Animation.DROP
            });

            marker.addListener("click", () => {
                const kaynakButonlari = (haber.kaynaklar || []).map(k => `
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid #e2e8f0;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:11px; font-weight:600; color:#475569;">${k.siteAdi}</span>
                            <a href="${k.link}" target="_blank" rel="noreferrer"
                               style="font-size:11px; text-decoration:none; background:#2563eb; color:white; padding:4px 8px; border-radius:4px;">
                                Habere Git &rsaquo;
                            </a>
                        </div>
                    </div>
                `).join('');

                const ozetHtml = haber.ozet
                    ? `<p style="font-size:12px; color:#475569; margin:6px 0 8px; line-height:1.5;
                                 display:-webkit-box; -webkit-line-clamp:3; line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">
                           ${haber.ozet}
                       </p>`
                    : '';

                const contentString = `
                    <div style="max-width:280px; padding:4px; font-family:'Inter', sans-serif;">
                        <h6 style="color:#1e293b; font-size:14px; font-weight:700; margin:0 0 4px 0;
                                   line-height:1.4;">${haber.baslik}</h6>
                        <div style="display:flex; gap:10px; font-size:12px; color:#64748b; margin-bottom:4px;">
                            <span>${styleData.icon} ${haber.haberTuru}</span>
                            <span>📅 ${new Date(haber.tarih).toLocaleDateString('tr-TR')}</span>
                        </div>
                        <div style="font-size:11px; color:#94a3b8; margin-bottom:6px;">
                            📍 ${haber.konum?.hamMetin || 'Kocaeli'}
                        </div>
                        ${ozetHtml}
                        ${kaynakButonlari}
                    </div>
                `;
                infoWindow.setContent(contentString);
                infoWindow.open(mapInstance, marker);
            });

            bounds.extend(position);
            hasValidPoints = true;

            const markerKey = String(haber._id);
            markersMapRef.current[markerKey] = marker;
            newMarkers.push(marker);

            const t = setTimeout(() => {
                marker.setMap(mapInstance);
            }, index * 40);
            timeouts.push(t);
        });

        if (hasValidPoints) {
            if (filteredNews.length === 1) {
                mapInstance.panTo(newMarkers[0].getPosition());
                mapInstance.setZoom(13);
            } else {
                mapInstance.fitBounds(bounds, { padding: 40 });
            }
        }

        setMarkersList(newMarkers);
        
        return () => {
            timeouts.forEach(clearTimeout);
            newMarkers.forEach(marker => marker.setMap(null));
        };
    }, [filteredNews, mapInstance]);

    return (
        <div className="app-wrapper">
            <div className="sidebar-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="header-brand d-flex align-items-center gap-2">
                        <span style={{ fontSize: '24px' }}>🗺️</span>
                        <div>
                            <h4 className="fw-bold mb-0" style={{ color: 'var(--text-primary)' }}>Kocaeli Olay</h4>
                            <small className="fw-semibold" style={{ color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.5px' }}>CANLI HABER AKIŞI</small>
                        </div>
                    </div>
                    <button 
                        className="theme-toggle-btn" 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        title={isDarkMode ? "Gündüz Moduna Geç" : "Gece Moduna Geç"}
                    >
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                </div>

                <div className="filter-card mb-3">
                    <h6 className="fw-bold mb-3 text-secondary"
                        style={{fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                        Veri Çekme (Scraping)
                    </h6>

                    <div className="mb-3">
                        <label className="fw-semibold mb-1 text-dark" style={{fontSize: '13px', color: 'var(--text-primary)'}}>Zaman Aralığı</label>
                        <select
                            className="form-select custom-input"
                            value={scrapeGun}
                            onChange={(e) => setScrapeGun(Number(e.target.value))}
                            disabled={isScraping}
                        >
                            <option value={1}>Son 1 Gün</option>
                            <option value={3}>Son 3 Gün</option>
                            <option value={7}>Son 7 Gün</option>
                            <option value={14}>Son 14 Gün</option>
                            <option value={30}>Son 30 Gün</option>
                        </select>
                    </div>

                    <button
                        className="btn w-100 mb-1 fw-bold shadow-sm rounded-3 py-2 btn-scrape"
                        onClick={handleScrape}
                        disabled={isScraping}
                    >
                        {isScraping ? (
                            <span>
                                <span className="spinner-border spinner-border-sm me-2"
                                      role="status" aria-hidden="true"></span>
                                Taranıyor...
                            </span>
                        ) : `⚡ Son ${scrapeGun} Günün Haberlerini Çek`}
                    </button>
                </div>

                <div className="filter-card">
                    <h6 className="fw-bold mb-3 text-secondary"
                        style={{fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                        Zaman ve Bölge Filtreleri
                    </h6>

                    <div className="date-filter-container mb-3">
                        <div className="d-flex align-items-center gap-2 mb-2 date-inputs-wrapper">
                            <span className="date-icon text-secondary">🗓️</span>
                            <div className="flex-grow-1">
                                <input
                                    type="date"
                                    className="form-control custom-input modern-date-input"
                                    value={filters.baslangicTarihi}
                                    max={filters.bitisTarihi || undefined}
                                    onChange={(e) => updateFilter('baslangicTarihi', e.target.value)}
                                    title="Başlangıç Tarihi"
                                />
                            </div>
                            <span className="text-secondary fw-bold" style={{fontSize: '12px'}}>—</span>
                            <div className="flex-grow-1">
                                <input
                                    type="date"
                                    className="form-control custom-input modern-date-input"
                                    value={filters.bitisTarihi}
                                    min={filters.baslangicTarihi || undefined}
                                    onChange={(e) => updateFilter('bitisTarihi', e.target.value)}
                                    title="Bitiş Tarihi"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="fw-semibold mb-1 text-dark" style={{fontSize: '13px', color: 'var(--text-primary)'}}>📍 İlçe Seçimi</label>
                        <select className="form-select custom-input"
                                value={filters.ilce}
                                onChange={(e) => updateFilter('ilce', e.target.value)}>
                            <option value="hepsi">Tüm Kocaeli</option>
                            <option value="İzmit">İzmit</option>
                            <option value="Gebze">Gebze</option>
                            <option value="Darıca">Darıca</option>
                            <option value="Körfez">Körfez</option>
                            <option value="Gölcük">Gölcük</option>
                            <option value="Derince">Derince</option>
                            <option value="Çayırova">Çayırova</option>
                            <option value="Kartepe">Kartepe</option>
                            <option value="Başiskele">Başiskele</option>
                            <option value="Karamürsel">Karamürsel</option>
                            <option value="Kandıra">Kandıra</option>
                            <option value="Dilovası">Dilovası</option>
                        </select>
                    </div>

                    <button type="button" className="btn btn-outline-secondary w-100" onClick={resetFilters}>
                        Filtreleri Temizle
                    </button>
                </div>

                <div className="filter-card stats-card">
                    <h6 className="fw-bold mb-3 text-secondary"
                        style={{fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                        Kategori Dağılımı
                    </h6>
                    <div className="stats-grid">
                        {Object.entries(kategoriDagilimi).map(([tur, sayi]) => {
                            const style = CATEGORY_STYLES[tur];
                            return (
                                <div key={tur} className="stat-item" style={{'--stat-color': style.color}}>
                                    <span className="stat-icon">{style.icon}</span>
                                    <span className="stat-count">{sayi}</span>
                                    <span className="stat-label">{style.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <h6 className="fw-bold mb-3 mt-3 text-secondary"
                    style={{fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                    Son Haberler ({filteredNews.length})
                </h6>
                <div className="news-feed">
                    {isLoading ? (
                        <div className="text-center p-4 text-muted bg-white rounded-3 border">
                            <span className="spinner-border spinner-border-sm me-2"
                                  role="status" aria-hidden="true"></span>
                            <small>Haberler yükleniyor...</small>
                        </div>
                    ) : fetchError ? (
                        <div className="text-center p-4 bg-white rounded-3 border" style={{color: '#ef4444'}}>
                            <span style={{fontSize: '24px'}}>⚠️</span><br/>
                            <small>{fetchError}</small>
                        </div>
                    ) : filteredNews.length === 0 ? (
                        <div className="text-center p-4 text-muted bg-white rounded-3 border">
                            <small>Kriterlere uygun haber bulunamadı.</small>
                        </div>
                    ) : (
                        filteredNews.map((haber) => {
                            const styleData = CATEGORY_STYLES[haber.haberTuru] || CATEGORY_STYLES["Varsayılan"];
                            const kaynakSayisi = haber.kaynaklar?.length || 0;

                            return (
                                <div
                                    key={haber._id}
                                    className="news-item"
                                    style={{ '--card-color': styleData.color }}
                                    onClick={() => handleHaberClick(haber)}
                                    title="Haritada göster"
                                >
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="news-date">
                                            {styleData.icon} {new Date(haber.tarih).toLocaleDateString('tr-TR')}
                                        </span>
                                        <div className="d-flex align-items-center gap-1" style={{flexWrap:'wrap', justifyContent:'flex-end'}}>
                                            {kaynakSayisi > 1 ? (
                                                <>
                                                    <span
                                                        className="badge-multi-source"
                                                        title={haber.kaynaklar.map(k => k.siteAdi).join(', ')}
                                                    >
                                                        {kaynakSayisi} kaynak
                                                    </span>
                                                    {haber.kaynaklar.map((k, i) => (
                                                        <span key={i} className="badge-source" title={k.siteAdi}>
                                                            {k.siteAdi}
                                                        </span>
                                                    ))}
                                                </>
                                            ) : (
                                                <span className="badge-source">
                                                    {kaynakSayisi > 0 ? haber.kaynaklar[0].siteAdi : 'Bilinmeyen Kaynak'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <h6 className="news-title">{haber.baslik}</h6>
                                    {haber.ozet && (
                                        <p className="news-ozet">{haber.ozet}</p>
                                    )}
                                    <div className="d-flex align-items-center mt-2">
                                        <span className="badge bg-light text-dark border" style={{fontSize: '11px'}}>
                                            📍 {haber.konum?.hamMetin || 'Kocaeli'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="map-wrapper">
                {mapsHata && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: '#f8fafc', zIndex: 10, flexDirection: 'column', gap: 8
                    }}>
                        <span style={{fontSize: 32}}>⚠️</span>
                        <p style={{color: '#ef4444', fontWeight: 600}}>Harita yüklenemedi.</p>
                        <small style={{color: '#64748b'}}>
                            .env dosyasında GOOGLE_MAPS_FRONTEND_KEY tanımlı olduğunu kontrol edin.
                        </small>
                    </div>
                )}
                <div ref={mapRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></div>

                <div className="map-legend">
                    <div className="legend-title">Lejant</div>
                    {Object.entries(CATEGORY_STYLES).map(([key, val]) => {
                        if (key === 'Varsayılan') return null;
                        
                        const isNoFilter = filters.tur.length === 0;
                        const isActive = filters.tur.includes(key);
                        const isInactive = !isNoFilter && !isActive;
                        
                        const className = `legend-item ${isNoFilter ? '' : isActive ? 'active' : 'inactive'}`;

                        return (
                            <div 
                                key={key} 
                                className={className}
                                style={{ '--legend-color': val.color }}
                                onClick={() => toggleFilterTur(key)}
                                title="Filtreyi aç/kapat"
                            >
                                <span className="legend-dot" style={{backgroundColor: val.color}}></span>
                                <span className="legend-icon">{val.icon}</span>
                                <span className="legend-label">{val.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default App;
