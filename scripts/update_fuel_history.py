#!/usr/bin/env python3
"""Guarda una media diaria de carburantes desde el día inicial del nuevo histórico."""
import json
import urllib.request
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

API_CURRENT = "https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestres/"
OUTPUT = Path("data/fuel-history.json")
START_DATE = date(2026, 10, 10)
FIELDS = {
    "gas95": "Precio Gasolina 95 E5",
    "diesel": "Precio Gasoleo A",
    "dieselPlus": "Precio Gasoleo Premium",
}


def parse_price(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        price = float(str(value).replace(",", "."))
        return price if price > 0 else None
    except ValueError:
        return None


def fetch_today(day):
    request = urllib.request.Request(
        API_CURRENT,
        headers={"User-Agent": "ultimo-fuel-history/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8-sig"))
    stations = payload.get("ListaEESSPrecio", [])
    result = {"date": day.isoformat()}
    for key, field in FIELDS.items():
        prices = [
            price
            for item in stations
            if item.get("Tipo Venta") == "P"
            for price in [parse_price(item.get(field))]
            if price is not None
        ]
        result[key] = round(sum(prices) / len(prices), 6) if prices else None
    result["stations"] = len(stations)
    return result


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        existing = {}

    today = datetime.now(ZoneInfo("Europe/Madrid")).date()
    if today < START_DATE:
        raise SystemExit(f"El histórico comienza el {START_DATE.isoformat()}.")

    # Descarta cualquier dato anterior al nuevo comienzo: no se inventa historia.
    by_date = {
        item["date"]: item
        for item in existing.get("days", [])
        if isinstance(item, dict)
        and item.get("date")
        and item["date"] >= START_DATE.isoformat()
    }

    try:
        item = fetch_today(today)
        if any(item.get(key) is not None for key in FIELDS):
            by_date[today.isoformat()] = item
            print(f"{today.isoformat()}: media oficial actualizada")
        else:
            print(f"{today.isoformat()}: la API no devolvió precios; se conserva el registro anterior")
    except Exception as error:
        print(f"No se pudo actualizar la media de hoy: {error}")
        if today.isoformat() not in by_date:
            raise

    days = [by_date[key] for key in sorted(by_date)]
    output = {
        "source": "API oficial de precios de carburantes del Gobierno de España",
        "startDate": START_DATE.isoformat(),
        "updatedAt": datetime.now(ZoneInfo("Europe/Madrid")).isoformat(timespec="seconds"),
        "days": days,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardados {len(days)} días desde {START_DATE.isoformat()}")


if __name__ == "__main__":
    main()
