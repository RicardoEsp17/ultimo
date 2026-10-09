#!/usr/bin/env python3
"""Actualiza el histórico diario con medias calculadas desde la API oficial española."""
import json
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestresHist/"
OUTPUT = Path("data/fuel-history.json")
FIELDS = {
    "gas95": "Precio Gasolina 95 E5",
    "diesel": "Precio Gasoleo A",
    "dieselPlus": "Precio Gasoleo Premium",
}


def parse_price(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def fetch_day(day):
    url = API + day.strftime("%d-%m-%Y")
    request = urllib.request.Request(url, headers={"User-Agent": "ultimo-fuel-history/1.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8-sig"))
    stations = payload.get("ListaEESSPrecio", [])
    result = {"date": day.isoformat()}
    for key, field in FIELDS.items():
        prices = [
            price for item in stations
            if item.get("Tipo Venta") == "P"
            for price in [parse_price(item.get(field))]
            if price is not None and price > 0
        ]
        result[key] = round(sum(prices) / len(prices), 6) if prices else None
    result["stations"] = len(stations)
    return result


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        try:
            existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            existing = {}
    else:
        existing = {}

    by_date = {
        item["date"]: item
        for item in existing.get("days", [])
        if isinstance(item, dict) and item.get("date")
    }
    today = datetime.now(ZoneInfo("Europe/Madrid")).date()

    # Backfill the most recent 30 days on first run, then refresh the same
    # window daily so that delayed official data is picked up when published.
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        try:
            item = fetch_day(day)
            if any(item.get(key) is not None for key in FIELDS):
                by_date[day.isoformat()] = item
                print(f"{day.isoformat()}: medias actualizadas")
            else:
                print(f"{day.isoformat()}: la API no devuelve precios; se conserva el dato anterior")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError) as error:
            print(f"{day.isoformat()}: error al consultar API: {error}")
        time.sleep(0.35)

    # Keep a year of daily records; the graph displays the latest 30.
    cutoff = today - timedelta(days=364)
    days = [by_date[key] for key in sorted(by_date) if date.fromisoformat(key) >= cutoff]
    output = {
        "source": "Ministerio para la Transición Ecológica y el Reto Demográfico - API de precios de carburantes",
        "updatedAt": datetime.now(ZoneInfo("Europe/Madrid")).isoformat(timespec="seconds"),
        "days": days,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardados {len(days)} días en {OUTPUT}")


if __name__ == "__main__":
    main()
