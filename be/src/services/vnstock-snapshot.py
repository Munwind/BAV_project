import json
import os
import sys
from datetime import date, timedelta

# Configure runtime paths before importing vnstock/vnai modules
SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["MPLCONFIGDIR"] = os.path.join(SERVICE_DIR, ".mplconfig")
os.environ["HOME"] = SERVICE_DIR
os.environ["USERPROFILE"] = SERVICE_DIR

from vnstock.api.quote import Quote


def range_to_days(value: str) -> int:
    mapping = {
        "1d": 2,
        "5d": 10,
        "1mo": 35,
        "3mo": 100,
        "6mo": 200,
        "1y": 380,
        "2y": 760,
        "5y": 1900,
        "ytd": 180,
        "max": 3650,
    }
    return mapping.get((value or "").lower(), 35)


def interval_to_vnstock(value: str) -> str:
    mapping = {
        "1m": "1",
        "5m": "5",
        "15m": "15",
        "30m": "30",
        "60m": "60",
        "1h": "60",
        "1d": "1D",
        "1wk": "1W",
    }
    return mapping.get((value or "").lower(), "1D")


def pick_time(row):
    for key in ("time", "datetime", "date", "tradingDate"):
        if key in row and row[key] is not None:
            return str(row[key])
    return None


def to_float(value, fallback=0.0):
    try:
        if value is None:
            return fallback
        return float(value)
    except Exception:
        return fallback


def to_int(value, fallback=0):
    try:
        if value is None:
            return fallback
        return int(float(value))
    except Exception:
        return fallback


def build_symbol(provider_symbol: str, symbol: str, interval: str, day_range: str):
    quote = Quote(symbol=symbol, source="VCI", show_log=False)
    start = (date.today() - timedelta(days=range_to_days(day_range))).isoformat()
    tf = interval_to_vnstock(interval)
    df = quote.ohlcv(symbol=symbol, start=start, interval=tf)

    records = []
    if df is not None and len(df.index):
        records = df.to_dict("records")

    candles = []
    for idx, row in enumerate(records):
        open_v = to_float(row.get("open"))
        high_v = to_float(row.get("high"))
        low_v = to_float(row.get("low"))
        close_v = to_float(row.get("close"))
        if not all([open_v, high_v, low_v, close_v]):
            continue
        candles.append(
            {
                "ts": idx + 1,
                "time": pick_time(row),
                "open": round(open_v, 4),
                "high": round(high_v, 4),
                "low": round(low_v, 4),
                "close": round(close_v, 4),
                "volume": to_int(row.get("volume"), 0),
            }
        )

    last = candles[-1] if candles else None
    prev_close = candles[-2]["close"] if len(candles) > 1 else None

    return {
        "symbol": provider_symbol,
        "providerSymbol": provider_symbol,
        "currency": "VND",
        "exchange": "HOSE",
        "marketState": "REGULAR",
        "fetchedAt": date.today().isoformat(),
        "candles": candles,
        "quote": {
            **(last or {}),
            "regularMarketPrice": (last or {}).get("close"),
            "regularMarketTime": (last or {}).get("time"),
            "previousClose": prev_close,
        }
        if last
        else None,
    }


def main():
    symbols_raw = sys.argv[1] if len(sys.argv) > 1 else "VIC.VN,VNM.VN,FPT.VN,HPG.VN,VCB.VN"
    interval = sys.argv[2] if len(sys.argv) > 2 else "5m"
    day_range = sys.argv[3] if len(sys.argv) > 3 else "5d"

    symbols = [part.strip().upper() for part in symbols_raw.split(",") if part.strip()]
    symbols = symbols[:8]

    items = []
    errors = []
    for provider_symbol in symbols:
        stock_symbol = provider_symbol.split(".")[0]
        try:
            items.append(build_symbol(provider_symbol, stock_symbol, interval, day_range))
        except Exception as exc:
            errors.append({"symbol": provider_symbol, "error": str(exc)})

    payload = {
        "ok": True,
        "provider": "vnstock",
        "fetchedAt": date.today().isoformat(),
        "interval": interval,
        "range": day_range,
        "total": len(items),
        "items": items,
        "errors": errors,
    }
    print("__VNSTOCK_JSON__" + json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
