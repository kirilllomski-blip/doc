from __future__ import annotations

from datetime import date


MONTHS_GENITIVE = {
    1: "января",
    2: "февраля",
    3: "марта",
    4: "апреля",
    5: "мая",
    6: "июня",
    7: "июля",
    8: "августа",
    9: "сентября",
    10: "октября",
    11: "ноября",
    12: "декабря",
}


def contract_date_text(value: date) -> str:
    return f"«{value.day:02d}» {MONTHS_GENITIVE[value.month]} {value.year} г."


def format_timestamp(value: str, timezone_name: str = "Europe/Minsk") -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo("UTC"))
    local = parsed.astimezone(ZoneInfo(timezone_name))
    return local.strftime("%d.%m.%Y %H:%M")
