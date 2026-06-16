const stationEndpoint = "https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestres/";
const fuelHistoryEndpoint = "https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestresHist/";
const yahooBrentQuoteUrl = "https://es.finance.yahoo.com/quote/BZ=F/";
const yahooBrentUrl = "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F";
const corsProxyUrl = "https://api.allorigins.win/raw?url=";
const stationCacheKey = "pag3.stations.v1";
const stationCacheDateKey = "pag3.stationsDate.v1";
const historyCacheKey = "pag3.history.v4";
const historyCacheDateKey = "pag3.historyDate.v4";

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

async function fetchTextReal(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.text();
  } catch (directError) {
    const proxyResponse = await fetch(`${corsProxyUrl}${encodeURIComponent(url)}`, { cache: "no-store" });
    if (!proxyResponse.ok) throw directError;
    return proxyResponse.text();
  }
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

function saveHistoryCache(points) {
  try {
    localStorage.setItem(historyCacheKey, JSON.stringify(points));
    localStorage.setItem(historyCacheDateKey, todayKey());
  } catch {
  }
}

function loadHistoryCache() {
  try {
    if (localStorage.getItem(historyCacheDateKey) !== todayKey()) return null;
    const raw = localStorage.getItem(historyCacheKey);
    if (!raw) return null;
    const points = JSON.parse(raw);
    return isUsableHistory(points) ? points : null;
  } catch {
    return null;
  }
}

function isUsableHistory(points) {
  return Array.isArray(points) &&
    points.length >= 2 &&
    points.some(point => point && (point.gas95 != null || point.diesel != null || point.dieselPlus != null || point.brent != null));
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
  if (visibleWidthKm > 20) {
    visibleStations = [];
    list.innerHTML = `<div class="empty-message">Acerca el mapa a menos de 20 km para ver gasolineras.</div>`;
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

  visibleStations.slice(0, 250).forEach(station => {
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
  } catch (error) {
    if (!stations.length) {
      stations = fallbackStations.map(normalizeStation);
    }
  }

  renderFuelCards();
  renderStations();
  await buildHistory();
}

function selectFuel(fuel) {
  activeFuel = fuel;
  document.querySelectorAll(".fuel-button").forEach(button => {
    button.classList.toggle("active", button.dataset.fuel === fuel);
  });
  renderStations();
}

function searchLocation(value) {
  const query = value.trim().toLowerCase();
  if (!query) return;

  const match = stations.find(station =>
    station.city.toLowerCase() === query ||
    station.cp === query ||
    station.address.toLowerCase().includes(query)
  ) || stations.find(station => station.city.toLowerCase().includes(query));

  if (match && map) {
    map.setView([match.lat, match.lon], 13);
  }
}

async function fetchBrentSeries(start, end) {
  return fetchBrentFromYahoo(start, end);
}

async function fetchBrentFromYahoo(start, end) {
  try {
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor((end.getTime() + 86400000) / 1000);
    const url = `${yahooBrentUrl}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;
    const json = await fetchJsonReal(url);
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const values = new Map();
    timestamps.forEach((timestamp, index) => {
      const close = closes[index];
      if (close == null) return;
      const key = new Date(timestamp * 1000).toISOString().slice(0, 10);
      values.set(key, Number(close));
    });
    return values;
  } catch {
    return new Map();
  }
}

function averageFromRawList(rawList, field) {
  const values = rawList
    .filter(item => item && item["Tipo Venta"] === "P")
    .map(item => parsePrice(item[field]))
    .filter(value => value != null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function fetchFuelHistoryDay(day) {
  const payload = await fetchJsonReal(`${fuelHistoryEndpoint}${dateForApi(day)}`);
  const list = Array.isArray(payload.ListaEESSPrecio) ? payload.ListaEESSPrecio : [];
  return {
    gas95: averageFromRawList(list, fuelConfig.gas95.field),
    diesel: averageFromRawList(list, fuelConfig.diesel.field),
    dieselPlus: averageFromRawList(list, fuelConfig.dieselPlus.field)
  };
}

async function fetchFuelHistorySeries(dates) {
  const result = new Map();
  let cursor = 0;
  const workers = Array.from({ length: 5 }, async () => {
    while (cursor < dates.length) {
      const index = cursor;
      cursor += 1;
      const day = dates[index];
      try {
        result.set(dateKey(day), await fetchFuelHistoryDay(day));
      } catch {
        result.set(dateKey(day), null);
      }
    }
  });
  await Promise.all(workers);
  return result;
}

function buildCurrentAverageHistory(dates) {
  const averages = {
    gas95: getAverage("gas95"),
    diesel: getAverage("diesel"),
    dieselPlus: getAverage("dieselPlus")
  };
  return dates.map(day => ({
    date: dateKey(day),
    label: day.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    brent: null,
    gas95: averages.gas95,
    diesel: averages.diesel,
    dieselPlus: averages.dieselPlus
  }));
}

async function buildHistory() {
  const cached = loadHistoryCache();
  if (cached && cached.length) {
    historyPoints = cached;
    renderChart();
  }

  const today = new Date();
  const dates = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (29 - index));
    return day;
  });

  if (!historyPoints.length) {
    historyPoints = buildCurrentAverageHistory(dates);
    renderChart();
  }

  const [brentMap, fuelHistoryMap] = await Promise.all([
    fetchBrentSeries(dates[0], dates[dates.length - 1]),
    fetchFuelHistorySeries(dates)
  ]);
  let carryBrent = null;
  let carryFuel = {
    gas95: getAverage("gas95"),
    diesel: getAverage("diesel"),
    dieselPlus: getAverage("dieselPlus")
  };

  const nextPoints = dates.map(day => {
    const key = dateKey(day);
    if (brentMap.has(key)) carryBrent = brentMap.get(key);
    const realFuel = fuelHistoryMap.get(key);
    if (realFuel && (realFuel.gas95 || realFuel.diesel || realFuel.dieselPlus)) {
      carryFuel = {
        gas95: realFuel.gas95 ?? carryFuel.gas95,
        diesel: realFuel.diesel ?? carryFuel.diesel,
        dieselPlus: realFuel.dieselPlus ?? carryFuel.dieselPlus
      };
    }
    return {
      date: key,
      label: day.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
      brent: carryBrent,
      gas95: carryFuel.gas95,
      diesel: carryFuel.diesel,
      dieselPlus: carryFuel.dieselPlus
    };
  });

  if (isUsableHistory(nextPoints)) {
    historyPoints = nextPoints;
  }
  saveHistoryCache(historyPoints);
  renderChart();
}

function scale(values, step, digits) {
  const usable = values.filter(value => value != null && Number.isFinite(value));
  if (!usable.length) return { min: 0, max: step, ticks: [0, step], digits };
  const min = Math.floor(Math.min(...usable) / step) * step;
  let max = Math.ceil(Math.max(...usable) / step) * step;
  if (max <= min) max = min + step;
  const ticks = [];
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toFixed(digits)));
  }
  return { min, max, ticks, digits };
}

function smoothPath(points) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const s = 0.16;
    const cp1x = p1.x + (p2.x - p0.x) * s;
    const cp1y = p1.y + (p2.y - p0.y) * s;
    const cp2x = p2.x - (p3.x - p1.x) * s;
    const cp2y = p2.y - (p3.y - p1.y) * s;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

function renderChart() {
  const svg = document.getElementById("historyChart");
  const plot = document.getElementById("chartPlot");
  if (!svg || !plot || !historyPoints.length) return;

  const width = Math.max(680, plot.clientWidth || 680);
  const height = Math.max(380, plot.clientHeight || 380);
  const padding = { top: 28, right: 58, bottom: 42, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const fuelScale = scale(historyPoints.flatMap(point => [point.gas95, point.diesel, point.dieselPlus]), 0.05, 3);
  const brentScale = scale(historyPoints.map(point => point.brent), 5, 0);
  const x = index => padding.left + (plotWidth * index) / Math.max(1, historyPoints.length - 1);
  const yFuel = value => padding.top + ((fuelScale.max - value) / (fuelScale.max - fuelScale.min)) * plotHeight;
  const yBrent = value => padding.top + ((brentScale.max - value) / (brentScale.max - brentScale.min)) * plotHeight;

  const grid = fuelScale.ticks.map(tick => {
    const y = yFuel(tick);
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(100,116,139,.38)" stroke-width="1.6"/>
      <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" font-weight="700" fill="#475569">${tick.toFixed(3)}</text>`;
  }).join("");
  const rightAxis = brentScale.ticks.map(tick => {
    const y = yBrent(tick);
    return `<text x="${width - padding.right + 10}" y="${y + 4}" font-size="11" font-weight="700" fill="#92400e">${tick}</text>`;
  }).join("");
  const xTicks = historyPoints.filter((_, index) => index % 3 === 0 || index === historyPoints.length - 1).map((point, index) => {
    const originalIndex = historyPoints.indexOf(point);
    const tx = x(originalIndex);
    return `<line x1="${tx}" y1="${height - padding.bottom}" x2="${tx}" y2="${height - padding.bottom + 5}" stroke="#94a3b8"/>
      <text x="${tx}" y="${height - 14}" text-anchor="middle" font-size="10" fill="#64748b">${point.label}</text>`;
  }).join("");
  const verticalGrid = Array.from({ length: 15 }, (_, index) => {
    const gx = padding.left + (plotWidth * index) / 14;
    return `<line x1="${gx}" y1="${padding.top}" x2="${gx}" y2="${height - padding.bottom}" stroke="rgba(148,163,184,.10)" stroke-width="1"/>`;
  }).join("");

  const series = [
    { key: "brent", color: "#334155", y: yBrent, width: 2.6 },
    { key: "gas95", color: "#16a34a", y: yFuel, width: 2.8 },
    { key: "diesel", color: "#f59e0b", y: yFuel, width: 2.8 },
    { key: "dieselPlus", color: "#dc2626", y: yFuel, width: 2.8 }
  ];
  const lines = series.map(item => {
    const coords = historyPoints
      .map((point, index) => ({ x: x(index), y: point[item.key] == null ? null : item.y(point[item.key]) }))
      .filter(point => point.y != null && Number.isFinite(point.y));
    const dots = coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="2.6" fill="${item.color}"/>`).join("");
    if (coords.length < 2) return dots;
    return `<path d="${smoothPath(coords)}" fill="none" stroke="${item.color}" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join("");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `<rect width="${width}" height="${height}" fill="transparent"/>${grid}${verticalGrid}${rightAxis}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#94a3b8"/>
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#94a3b8"/>
    <line x1="${width - padding.right}" y1="${padding.top}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#cbd5e1"/>
    ${xTicks}${lines}`;

  bindChartTooltip(plot, padding, width, historyPoints);
}

function bindChartTooltip(plot, padding, width, points) {
  const tooltip = document.getElementById("chartTooltip");
  if (!tooltip) return;

  plot.onmouseleave = () => tooltip.classList.remove("visible");
  plot.onmousemove = event => {
    const rect = plot.getBoundingClientRect();
    const plotLeft = (padding.left / width) * rect.width;
    const plotRight = rect.width - (padding.right / width) * rect.width;
    const usable = Math.max(1, plotRight - plotLeft);
    const localX = Math.max(plotLeft, Math.min(plotRight, event.clientX - rect.left));
    const ratio = (localX - plotLeft) / usable;
    const index = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
    const point = points[index];
    const left = Math.max(8, Math.min(rect.width - 210, localX - 96));

    tooltip.innerHTML = `
      <div class="tooltip-date">${point.label}</div>
      ${[
        ["Brent", "#334155", point.brent == null ? "--" : `${point.brent.toFixed(2)} $`],
        ["Gas 95", "#16a34a", point.gas95 == null ? "--" : `${point.gas95.toFixed(3)} €/L`],
        ["Diesel", "#f59e0b", point.diesel == null ? "--" : `${point.diesel.toFixed(3)} €/L`],
        ["Diesel +", "#dc2626", point.dieselPlus == null ? "--" : `${point.dieselPlus.toFixed(3)} €/L`]
      ].map(row => `
        <div class="tooltip-row">
          <span class="tooltip-label"><i class="tooltip-dot" style="background:${row[1]}"></i>${row[0]}</span>
          <span class="tooltip-value">${row[2]}</span>
        </div>
      `).join("")}
    `;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = "14px";
    tooltip.classList.add("visible");
  };
}

function bindEvents() {
  document.querySelectorAll(".fuel-button").forEach(button => {
    button.addEventListener("click", () => selectFuel(button.dataset.fuel));
  });
  document.getElementById("reloadButton").addEventListener("click", () => loadStations());
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

