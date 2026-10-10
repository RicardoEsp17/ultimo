const stationEndpoint = "https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestres/";
const fuelHistoryEndpoint = "https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestresHist/";
const yahooBrentQuoteUrl = "https://es.finance.yahoo.com/quote/BZ=F/";
const yahooBrentUrl = "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F";
const fredBrentUrl = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU";
const corsProxyUrl = "https://api.allorigins.win/raw?url=";
const corsProxyUrl2 = "https://api.codetabs.com/v1/proxy/?quest=";
const stationCacheKey = "pag3.stations.v1";
const stationCacheDateKey = "pag3.stationsDate.v1";
const historyCacheKey = "pag3.history.v8";
const historyCacheDateKey = "pag3.historyDate.v8";
const historyCacheRangeKey = "pag3.historyRange.v8";
const dailyAverageCacheKey = "pag3.dailyAverages.v1";

const fuelConfig = {
  gas95: {
    label: "Gas 95",
    field: "Precio Gasolina 95 E5",
    button: ".btn-gas95",
    avg: "avg-gas95",
    bar: "bar-gas95",
    breakdown: "breakdown-gas95",
    rawPct: 0.494,
    profitPct: 0.026,
    color: "#16a34a"
  },
  diesel: {
    label: "Diesel",
    field: "Precio Gasoleo A",
    button: ".btn-diesel",
    avg: "avg-diesel",
    bar: "bar-diesel",
    breakdown: "breakdown-diesel",
    rawPct: 0.509,
    profitPct: 0.077,
    color: "#f59e0b"
  },
  dieselPlus: {
    label: "Diesel +",
    field: "Precio Gasoleo Premium",
    button: ".btn-diesel-plus",
    avg: "avg-dieselPlus",
    bar: "bar-dieselPlus",
    breakdown: "breakdown-dieselPlus",
    rawPct: 0.507,
    profitPct: 0.091,
    color: "#dc2626"
  }
};

let map;
let markersLayer;
let stations = [];
let visibleStations = [];
let activeFuel = "gas95";
let historyPoints = [];
let stationsLoadedFromLive = false;

const fallbackStations = [
  {
    "Rotulo": "REPSOL",
    "Direccion": "AVENIDA DE AMERICA 12",
    "Municipio": "MADRID",
    "CP": "28002",
    "Latitud": "40,4378",
    "Longitud (WGS84)": "-3,6767",
    "Tipo Venta": "P",
    "Precio Gasolina 95 E5": "1,543",
    "Precio Gasoleo A": "1,697",
    "Precio Gasoleo Premium": "1,784"
  },
  {
    "Rotulo": "CEPSA",
    "Direccion": "CALLE ALCALA 420",
    "Municipio": "MADRID",
    "CP": "28027",
    "Latitud": "40,4352",
    "Longitud (WGS84)": "-3,6324",
    "Tipo Venta": "P",
    "Precio Gasolina 95 E5": "1,519",
    "Precio Gasoleo A": "1,649",
    "Precio Gasoleo Premium": "1,742"
  },
  {
    "Rotulo": "PLENOIL",
    "Direccion": "AVENIDA ANDALUCIA 10",
    "Municipio": "GETAFE",
    "CP": "28901",
    "Latitud": "40,3061",
    "Longitud (WGS84)": "-3,7301",
    "Tipo Venta": "P",
    "Precio Gasolina 95 E5": "1,479",
    "Precio Gasoleo A": "1,608",
    "Precio Gasoleo Premium": "1,699"
  },
  {
    "Rotulo": "BP",
    "Direccion": "PASEO CASTELLANA 244",
    "Municipio": "MADRID",
    "CP": "28046",
    "Latitud": "40,4718",
    "Longitud (WGS84)": "-3,6896",
    "Tipo Venta": "P",
    "Precio Gasolina 95 E5": "1,575",
    "Precio Gasoleo A": "1,715",
    "Precio Gasoleo Premium": "1,812"
  }
];

function parsePrice(value) {
  if (!value) return null;
  const parsed = Number(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchWithTimeout(url, timeout = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextReal(url) {
  const urls = [
    url,
    `${corsProxyUrl}${encodeURIComponent(url)}`,
    `${corsProxyUrl2}${encodeURIComponent(url)}`
  ];
  let lastError = null;
  for (const candidate of urls) {
    try {
      return await fetchWithTimeout(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No se pudo cargar " + url);
}

async function fetchJsonReal(url) {
  const text = await fetchTextReal(url);
  return JSON.parse(text);
}

function formatComma(value, digits) {
  if (value == null || Number.isNaN(value)) return "--";
  return Number(value).toFixed(digits).replace(".", ",");
}

function normalizeStation(raw) {
  const brand = raw.Rotulo || raw["Rótulo"] || raw["RÃ³tulo"] || "Gasolinera";
  const address = raw.Direccion || raw["Dirección"] || raw["DirecciÃ³n"] || "";
  return {
    brand,
    address,
    city: raw.Municipio || "",
    cp: raw.CP || "",
    lat: parsePrice(raw.Latitud),
    lon: parsePrice(raw["Longitud (WGS84)"]),
    gas95: parsePrice(raw["Precio Gasolina 95 E5"]),
    diesel: parsePrice(raw["Precio Gasoleo A"]),
    dieselPlus: parsePrice(raw["Precio Gasoleo Premium"])
  };
}

function getLogoUrl(brand) {
  const value = String(brand || "").toLowerCase();
  if (value.includes("repsol")) return "repsol.jpg";
  if (value.includes("cepsa")) return "cepsa.jpg";
  if (value.includes("campsa")) return "campsa.png";
  if (value.includes("galp")) return "galp.jpg";
  if (value.includes("moeve")) return "moeve.jpeg";
  if (value.includes("plenoil") || value.includes("plenergy")) return "plenoil.png";
  if (value.includes("q8")) return "q8.png";
  if (value.includes("petroprix")) return "petroprix.jpg";
  if (value.includes("ballenoil")) return "ballenoil.png";
  if (value.includes("bp")) return "bp.jpg";
  if (value.includes("bonarea")) return "bonarea.jpg";
  if (value.includes("shell")) return "shell.png";
  if (value.includes("gasexpress")) return "gasexpress.jpeg";
  if (value.includes("leclerc")) return "leclerc.jpeg";
  if (value.includes("alcampo")) return "alcampo.jpg";
  if (value.includes("carrefour")) return "carrefour.jpg";
  if (value.includes("petronor")) return "petronor.jpg";
  if (value.includes("disa")) return "disa.jpeg";
  if (value.includes("tgas")) return "tgas.jpg";
  if (value.includes("oceano") || value.includes("oc\u00e9ano")) return "oceano.png";
  if (value.includes("canary")) return "canaryoil.png";
  return "default.jpg";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function historyRangeKey(dates) {
  return `${dateKey(dates[0])}|${dateKey(dates[dates.length - 1])}`;
}

function dateForApi(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function saveStationCache(rawList) {
  try {
    localStorage.setItem(stationCacheKey, JSON.stringify(rawList));
    localStorage.setItem(stationCacheDateKey, todayKey());
  } catch {
  }
}

function loadStationCache() {
  try {
    const raw = localStorage.getItem(stationCacheKey);
    if (!raw) return null;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

function applyRawStations(rawList) {
  stations = rawList
    .filter(item => item && item["Tipo Venta"] === "P")
    .map(normalizeStation)
    .filter(station => station.lat != null && station.lon != null);
}

function saveHistoryCache(points, dates) {
  try {
    if (!isUsableHistory(points)) return;
    localStorage.setItem(historyCacheKey, JSON.stringify(points));
    localStorage.setItem(historyCacheDateKey, todayKey());
    localStorage.setItem(historyCacheRangeKey, historyRangeKey(dates));
  } catch {
  }
}

function loadHistoryCache(dates) {
  try {
    if (localStorage.getItem(historyCacheDateKey) !== todayKey()) return null;
    if (localStorage.getItem(historyCacheRangeKey) !== historyRangeKey(dates)) return null;
    const raw = localStorage.getItem(historyCacheKey);
    if (!raw) return null;
    const points = JSON.parse(raw);
    return isUsableHistory(points) && hasBrentHistory(points) ? points : null;
  } catch {
    return null;
  }
}

function isUsableHistory(points) {
  return Array.isArray(points) &&
    points.length >= 2 &&
    points.some(point => point && (point.gas95 != null || point.diesel != null || point.dieselPlus != null || point.brent != null));
}

function hasFuelHistory(points) {
  return Array.isArray(points) &&
    points.some(point => point && (point.gas95 != null || point.diesel != null || point.dieselPlus != null));
}

function hasBrentHistory(points) {
  return Array.isArray(points) &&
    points.some(point => point && point.brent != null);
}

function saveDailyAverageSnapshot() {
  try {
    const snapshot = {
      date: todayKey(),
      gas95: getAverage("gas95"),
      diesel: getAverage("diesel"),
      dieselPlus: getAverage("dieselPlus")
    };
    if (snapshot.gas95 == null && snapshot.diesel == null && snapshot.dieselPlus == null) return;
    const raw = localStorage.getItem(dailyAverageCacheKey);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list.filter(item => item && item.date !== snapshot.date) : [];
    next.push(snapshot);
    next.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    localStorage.setItem(dailyAverageCacheKey, JSON.stringify(next.slice(-45)));
  } catch {
  }
}

function loadDailyAverageMap() {
  try {
    const raw = localStorage.getItem(dailyAverageCacheKey);
    const list = raw ? JSON.parse(raw) : [];
    const values = new Map();
    if (!Array.isArray(list)) return values;
    list.forEach(item => {
      if (!item || !item.date) return;
      values.set(item.date, {
        gas95: item.gas95 ?? null,
        diesel: item.diesel ?? null,
        dieselPlus: item.dieselPlus ?? null
      });
    });
    return values;
  } catch {
    return new Map();
  }
}

function fillMissingHistoryValues(points, keys) {
  keys.forEach(key => {
    let carry = null;
    points.forEach(point => {
      if (point[key] != null) carry = point[key];
      else if (carry != null) point[key] = carry;
    });

    let backfill = null;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      if (points[index][key] != null) backfill = points[index][key];
      else if (backfill != null) points[index][key] = backfill;
    }
  });
  return points;
}

function countRealFuelDays(points) {
  return points.filter(point =>
    point && (point.gas95 != null || point.diesel != null || point.dieselPlus != null)
  ).length;
}

function trendValue(current, index, total, amplitude, digits = 3) {
  if (current == null) return null;
  const lastIndex = Math.max(1, total - 1);
  const wave = Math.sin((index + 2) * 0.65) * amplitude + Math.cos((index + 5) * 0.28) * amplitude * 0.55;
  const lastWave = Math.sin((lastIndex + 2) * 0.65) * amplitude + Math.cos((lastIndex + 5) * 0.28) * amplitude * 0.55;
  const slowDrift = ((index - lastIndex) / lastIndex) * amplitude * 1.2;
  return Number((current + wave - lastWave + slowDrift).toFixed(digits));
}

function buildEstimatedFuelHistory(dates) {
  const averages = {
    gas95: getAverage("gas95"),
    diesel: getAverage("diesel"),
    dieselPlus: getAverage("dieselPlus")
  };
  return dates.map((day, index) => ({
    date: dateKey(day),
    label: day.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    gas95: trendValue(averages.gas95, index, dates.length, 0.018),
    diesel: trendValue(averages.diesel, index, dates.length, 0.02),
    dieselPlus: trendValue(averages.dieselPlus, index, dates.length, 0.022)
  }));
}

function buildEstimatedBrentMap(dates) {
  const values = new Map();
  dates.forEach((day, index) => {
    const value = trendValue(82, index, dates.length, 2.4, 2);
    if (value != null) values.set(dateKey(day), value);
  });
  return values;
}

function setChartSubtitle(text) {
  const subtitle = document.getElementById("chartSubtitle");
  if (subtitle) subtitle.textContent = text;
}

function getFuelPrice(station, fuel = activeFuel) {
  return station[fuel];
}

function priceClass(price, min, max) {
  if (price == null || max <= min) return "price-mid";
  const ratio = (price - min) / (max - min);
  if (ratio < 0.25) return "price-low";
  if (ratio > 0.75) return "price-high";
  return "price-mid";
}

function getAverage(fuel) {
  const values = stations.map(station => station[fuel]).filter(value => value != null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildBreakdown(fuel, avg) {
  const config = fuelConfig[fuel];
  const raw = avg * config.rawPct;
  const profit = avg * config.profitPct;
  const tax = Math.max(0, avg - raw - profit);
  const total = raw + tax + profit || 1;
  return [
    { key: "raw", label: "Materias primas", value: raw, pct: raw / total },
    { key: "tax", label: "Impuestos", value: tax, pct: tax / total },
    { key: "profit", label: "Beneficio bruto", value: profit, pct: profit / total }
  ];
}

function renderFuelCards() {
  Object.keys(fuelConfig).forEach(fuel => {
    const config = fuelConfig[fuel];
    const avg = getAverage(fuel);
    const avgNode = document.getElementById(config.avg);
    const barNode = document.getElementById(config.bar);
    const breakdownNode = document.getElementById(config.breakdown);

    if (!avgNode || !barNode || !breakdownNode) return;

    if (avg == null) {
      avgNode.textContent = "--";
      barNode.innerHTML = "";
      breakdownNode.innerHTML = `<div class="empty-message">Sin datos</div>`;
      return;
    }

    const breakdown = buildBreakdown(fuel, avg);
    avgNode.textContent = formatComma(avg, 3);
    barNode.innerHTML = breakdown.map(item =>
      `<span class="${item.key}" style="width:${(item.pct * 100).toFixed(1)}%"></span>`
    ).join("");
    breakdownNode.innerHTML = breakdown.map(item => `
      <div class="breakdown-row">
        <span class="breakdown-label"><i class="dot ${item.key}"></i>${item.label}</span>
        <span class="breakdown-value">${formatComma(item.value, 3)} €</span>
        <span class="breakdown-pct">${formatComma(item.pct * 100, 1)}%</span>
      </div>
    `).join("");
  });
}

function initMap() {
  if (!window.L) {
    document.getElementById("map").innerHTML = `<div class="empty-message">No se pudo cargar el mapa.</div>`;
    return;
  }

  map = L.map("map", { zoomControl: true }).setView([40.4168, -3.7038], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  map.on("moveend", renderStations);
}

function markerHtml(station, price, cls) {
  const logo = getLogoUrl(station.brand);
  return `
    <div class="custom-marker">
      <img class="marker-logo" src="${logo}" alt="" onerror="this.src='default.jpg'">
      <div class="marker-price ${cls}">${formatComma(price, 3)}</div>
    </div>
  `;
}

function popupHtml(station) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
  return `
    <div class="popup-gas">
      <div class="popup-head">
        <div class="popup-title-row">
          <span class="popup-brand">${station.brand}</span>
          <a class="route-button" href="${mapsUrl}" target="_blank" rel="noopener">Como llegar</a>
        </div>
        <div class="popup-sub">${station.address}, ${station.city}</div>
      </div>
      <div class="popup-prices">
        <div class="popup-row"><span>Gas 95</span><span class="popup-value">${formatComma(station.gas95, 3)} €</span></div>
        <div class="popup-row"><span>Diesel</span><span class="popup-value">${formatComma(station.diesel, 3)} €</span></div>
        <div class="popup-row"><span>Diesel +</span><span class="popup-value">${formatComma(station.dieselPlus, 3)} €</span></div>
      </div>
    </div>
  `;
}

function getMapVisibleWidthKm() {
  if (!map || typeof map.getBounds !== "function") return 0;
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  const west = L.latLng(center.lat, bounds.getWest());
  const east = L.latLng(center.lat, bounds.getEast());
  return west.distanceTo(east) / 1000;
}

function renderStations() {
  const list = document.getElementById("stationList");
  if (!list) return;

  const bounds = map ? map.getBounds() : null;
  const visibleWidthKm = getMapVisibleWidthKm();
  if (visibleWidthKm > 40) {
    visibleStations = [];
    list.innerHTML = `<div class="empty-message">Acerca el mapa a menos de 40 km para ver gasolineras.</div>`;
    if (markersLayer) markersLayer.clearLayers();
    return;
  }

  const valid = stations.filter(station => station.lat != null && station.lon != null && getFuelPrice(station) != null);
  visibleStations = valid.filter(station => !bounds || bounds.contains([station.lat, station.lon]));

  if (!visibleStations.length) {
    list.innerHTML = `<div class="empty-message">No hay gasolineras en esta zona.</div>`;
    if (markersLayer) markersLayer.clearLayers();
    return;
  }

  visibleStations.sort((a, b) => getFuelPrice(a) - getFuelPrice(b));
  const prices = visibleStations.map(station => getFuelPrice(station));
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (markersLayer) markersLayer.clearLayers();
  list.innerHTML = "";

  visibleStations.forEach(station => {
    const price = getFuelPrice(station);
    const cls = priceClass(price, min, max);
    const logo = getLogoUrl(station.brand);

    if (markersLayer) {
      const icon = L.divIcon({
        className: "",
        html: markerHtml(station, price, cls),
        iconSize: [54, 50],
        iconAnchor: [27, 25]
      });
      L.marker([station.lat, station.lon], { icon }).addTo(markersLayer).bindPopup(popupHtml(station));
    }

    const card = document.createElement("div");
    card.className = "station-card";
    card.innerHTML = `
      <img class="station-logo" src="${logo}" alt="" onerror="this.src='default.jpg'">
      <div>
        <div class="station-name">${station.brand}</div>
        <div class="station-address">${station.address}, ${station.city}</div>
      </div>
      <div class="station-price ${cls}">${formatComma(price, 3)}</div>
    `;
    card.addEventListener("click", () => {
      if (map) map.setView([station.lat, station.lon], 16);
    });
    list.appendChild(card);
  });
}

async function loadStations() {
  const cached = loadStationCache();
  if (cached && cached.length) {
    applyRawStations(cached);
    renderFuelCards();
    renderStations();
    buildHistory();
  }

  try {
    const payload = await fetchJsonReal(stationEndpoint);
    const list = Array.isArray(payload.ListaEESSPrecio) ? payload.ListaEESSPrecio : [];
    saveStationCache(list);
    applyRawStations(list);
    stationsLoadedFromLive = true;
  } catch (error) {
    if (!stations.length) {
      stations = fallbackStations.map(normalizeStation);
    }
  }

  renderFuelCards();
  renderStations();
  saveDailyAverageSnapshot();
  await buildHistory();
}

function selectFuel(fuel) {
  activeFuel = fuel;
  document.querySelectorAll(".fuel-button").forEach(button => {
    button.classList.toggle("active", button.dataset.fuel === fuel);
  });
  renderStations();
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function findCityMatch(query) {
  const cities = [...new Set(stations.map(station => station.city).filter(Boolean))];
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  // Prioriza coincidencias exactas y parciales antes de tolerar errores tipográficos.
  const directMatch = cities.find(city => normalizeSearchText(city) === normalizedQuery)
    || cities.find(city => normalizeSearchText(city).includes(normalizedQuery));
  if (directMatch) return directMatch;

  // Solo acepta errores pequeños para evitar enviar al usuario a una ciudad distinta.
  const candidates = cities
    .map(city => {
      const normalizedCity = normalizeSearchText(city);
      return { city, distance: levenshteinDistance(normalizedQuery, normalizedCity) };
    })
    .filter(item => {
      const length = Math.max(normalizedQuery.length, normalizeSearchText(item.city).length);
      const maxDistance = length >= 10 ? 2 : length >= 5 ? 1 : 0;
      return item.distance <= maxDistance;
    })
    .sort((a, b) => a.distance - b.distance);

  // Si hay empate entre varias ciudades, no adivina: no mueve el mapa.
  if (candidates.length > 1 && candidates[0].distance === candidates[1].distance) return null;
  return candidates[0]?.city || null;
}

function searchLocation(value) {
  const query = normalizeSearchText(value);
  if (!query) return;

  const cityMatch = findCityMatch(query);
  const match = (cityMatch
    ? stations.find(station => normalizeSearchText(station.city) === normalizeSearchText(cityMatch))
    : null)
    || stations.find(station => normalizeSearchText(station.cp) === query)
    || stations.find(station => normalizeSearchText(station.address).includes(query));

  if (match && map) {
    map.setView([match.lat, match.lon], 13);
  }
}

const HISTORY_START_DATE = "2026-10-10";

function chartLabel(dateString) {
  const parts = dateString.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "2-digit"
  });
}

function chartTodayKey() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

async function fetchStoredFuelHistory() {
  try {
    const response = await fetch("./data/fuel-history.json", { cache: "no-store" });
    if (!response.ok) return [];
    const payload = await response.json();
    return (Array.isArray(payload.days) ? payload.days : [])
      .filter(item => item && item.date >= HISTORY_START_DATE)
      .map(item => ({
        date: item.date,
        label: chartLabel(item.date),
        gas95: parsePrice(item.gas95),
        diesel: parsePrice(item.diesel),
        dieselPlus: parsePrice(item.dieselPlus)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

async function buildHistory() {
  const storedPoints = await fetchStoredFuelHistory();
  const today = chartTodayKey();
  const currentPoint = {
    date: today,
    label: chartLabel(today),
    gas95: getAverage("gas95"),
    diesel: getAverage("diesel"),
    dieselPlus: getAverage("dieselPlus")
  };
  const pointsByDate = new Map(storedPoints.map(point => [point.date, point]));
  if (stationsLoadedFromLive && today >= HISTORY_START_DATE && !pointsByDate.has(today) &&
      [currentPoint.gas95, currentPoint.diesel, currentPoint.dieselPlus].some(value => value != null)) {
    pointsByDate.set(today, currentPoint);
  }
  historyPoints = [...pointsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const subtitle = document.getElementById("chartSubtitle");
  if (!historyPoints.length) {
    if (subtitle) subtitle.textContent = "Esperando datos oficiales de hoy para iniciar el historial.";
  } else {
    if (subtitle) subtitle.textContent = "Datos diarios disponibles: " + historyPoints[0].label + " – " +
      historyPoints[historyPoints.length - 1].label + ". Solo medias reales; sin estimaciones.";
  }
  renderChart();
}

function renderChart() {
  const svg = document.getElementById("historyChart");
  const plot = document.getElementById("chartPlot");
  const tooltip = document.getElementById("chartTooltip");
  if (!svg || !plot) return;
  if (!historyPoints.length) {
    svg.setAttribute("viewBox", "0 0 680 380");
    svg.innerHTML = '<text x="340" y="185" text-anchor="middle" font-size="14" fill="#64748b">Esperando los primeros datos reales</text>';
    if (tooltip) tooltip.classList.remove("visible");
    return;
  }

  const width = Math.max(320, plot.clientWidth || 680);
  const height = Math.max(320, plot.clientHeight || 380);
  const padding = { top: 28, right: 24, bottom: 48, left: 62 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const allValues = historyPoints.flatMap(point => [point.gas95, point.diesel, point.dieselPlus])
    .filter(value => value != null && Number.isFinite(value));
  let min = allValues.length ? Math.floor(Math.min(...allValues) * 20) / 20 : 0;
  let max = allValues.length ? Math.ceil(Math.max(...allValues) * 20) / 20 : 1;
  if (max <= min) {
    min = Math.max(0, min - 0.05);
    max += 0.05;
  }
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
  const x = index => padding.left + plotWidth * (historyPoints.length <= 1 ? 0.5 : index / (historyPoints.length - 1));
  const y = value => padding.top + ((max - value) / (max - min)) * plotHeight;

  const grid = ticks.map(value => {
    const yy = y(value);
    return '<line x1="' + padding.left + '" y1="' + yy + '" x2="' + (width - padding.right) +
      '" y2="' + yy + '" stroke="rgba(100,116,139,.25)" stroke-width="1"/>' +
      '<text x="' + (padding.left - 10) + '" y="' + (yy + 4) +
      '" text-anchor="end" font-size="11" fill="#64748b">' + value.toFixed(3) + '</text>';
  }).join("");

  const labelStep = Math.max(1, Math.ceil(historyPoints.length / 8));
  const labels = historyPoints.map((point, index) => {
    if (index % labelStep !== 0 && index !== historyPoints.length - 1) return "";
    return '<text x="' + x(index) + '" y="' + (height - 16) +
      '" text-anchor="middle" font-size="10" fill="#64748b">' + point.label + '</text>';
  }).join("");

  const series = [
    { key: "gas95", color: "#16a34a" },
    { key: "diesel", color: "#f59e0b" },
    { key: "dieselPlus", color: "#dc2626" }
  ];
  const paths = series.map(item => {
    const points = historyPoints.map((point, index) => ({
      x: x(index), y: point[item.key] == null ? null : y(point[item.key])
    })).filter(point => point.y != null && Number.isFinite(point.y));
    if (!points.length) return "";
    const dots = points.map(point => '<circle cx="' + point.x + '" cy="' + point.y +
      '" r="3.2" fill="' + item.color + '"/>').join("");
    if (points.length === 1) return dots;
    const path = points.map((point, index) => (index === 0 ? "M" : "L") + " " +
      point.x.toFixed(2) + " " + point.y.toFixed(2)).join(" ");
    return '<path d="' + path + '" fill="none" stroke="' + item.color +
      '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' + dots;
  }).join("");

  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  svg.innerHTML = '<rect width="' + width + '" height="' + height + '" fill="transparent"/>' + grid +
    '<line x1="' + padding.left + '" y1="' + (height - padding.bottom) + '" x2="' +
    (width - padding.right) + '" y2="' + (height - padding.bottom) + '" stroke="#94a3b8"/>' +
    '<line x1="' + padding.left + '" y1="' + padding.top + '" x2="' + padding.left +
    '" y2="' + (height - padding.bottom) + '" stroke="#94a3b8"/>' + labels + paths;
  bindChartTooltip(plot, padding, width, historyPoints);
}

function bindChartTooltip(plot, padding, width, points) {
  const tooltip = document.getElementById("chartTooltip");
  if (!tooltip) return;
  plot.onmouseleave = () => tooltip.classList.remove("visible");
  plot.onmousemove = event => {
    const rect = plot.getBoundingClientRect();
    const left = (padding.left / width) * rect.width;
    const right = rect.width - (padding.right / width) * rect.width;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - left) / Math.max(1, right - left)));
    const index = points.length <= 1 ? 0 : Math.round(ratio * (points.length - 1));
    const point = points[index];
    const rows = [
      ["Gasolina 95", "#16a34a", point.gas95],
      ["Diésel", "#f59e0b", point.diesel],
      ["Diésel prémium", "#dc2626", point.dieselPlus]
    ];
    tooltip.innerHTML = '<div class="tooltip-date">' + point.label + '</div>' + rows.map(row =>
      '<div class="tooltip-row"><span class="tooltip-label"><i class="tooltip-dot" style="background:' +
      row[1] + '"></i>' + row[0] + '</span><span class="tooltip-value">' +
      (row[2] == null ? "Sin datos" : Number(row[2]).toFixed(3) + " €/L") + '</span></div>'
    ).join("");
    tooltip.style.left = Math.max(8, Math.min(rect.width - 220, event.clientX - rect.left - 100)) + "px";
    tooltip.style.top = "14px";
    tooltip.classList.add("visible");
  };
}

function bindEvents() {
  document.querySelectorAll(".fuel-button").forEach(button => {
    button.addEventListener("click", () => selectFuel(button.dataset.fuel));
  });
  document.getElementById("searchForm").addEventListener("submit", event => {
    event.preventDefault();
    searchLocation(document.getElementById("searchInput").value);
  });
  window.addEventListener("resize", renderChart);
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  bindEvents();
  loadStations();
});
