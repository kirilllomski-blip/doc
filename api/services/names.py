from __future__ import annotations

import re

# Comprehensive Cyrillic + Latin regex
_NAME_RE = re.compile(r"^[\u0400-\u04FFa-zA-Z-]+$")


def normalize_fio(value: str) -> str:
    parts = [part for part in value.strip().split() if part]
    if len(parts) < 2:
        raise ValueError("Введите как минимум фамилию и имя (например, Иванов Иван)")
    if len(parts) > 4:
        raise ValueError("Слишком длинное ФИО (максимум 4 слова)")
    for part in parts:
        if not _NAME_RE.fullmatch(part):
            raise ValueError(f"В ФИО допустимы только буквы: {part}")

    formatted = []
    for part in parts:
        if "-" in part:
            sub = "-".join(s[:1].upper() + s[1:].lower() for s in part.split("-"))
            formatted.append(sub)
        else:
            formatted.append(part[:1].upper() + part[1:].lower())
    return " ".join(formatted)


def buyer_initials(fio: str) -> str:
    parts = fio.strip().split()
    if len(parts) == 0:
        return ""
    if len(parts) == 1:
        return parts[0][:1].upper() + parts[0][1:].lower()
    if len(parts) == 2:
        surname, name = parts[0], parts[1]
        return f"{name[0].upper()}.{surname}"
    surname, name, patronymic = parts[0], parts[1], parts[2]
    return f"{name[0].upper()}.{patronymic[0].upper()}.{surname}"


def normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in value if ch.isdigit())
    if digits.startswith("80") and len(digits) == 11:
        digits = "375" + digits[2:]
    elif len(digits) == 9 and digits[:2] in ("25", "29", "33", "44", "17"):
        digits = "375" + digits

    if digits.startswith("375") and len(digits) == 12:
        code = digits[3:5]
        p1 = digits[5:8]
        p2 = digits[8:10]
        p3 = digits[10:12]
        return f"+375 ({code}) {p1}-{p2}-{p3}"

    if len(digits) < 9 or len(digits) > 15:
        raise ValueError("Проверьте номер телефона: укажите корректный номер (+375...)")
    return "+" + digits if value.strip().startswith("+") else digits


def normalize_address(value: str) -> str:
    address = " ".join(value.strip().split())
    if not address:
        raise ValueError("Укажите адрес доставки или монтажа")
    lowered = address.lower()
    belarus = "республика беларусь"
    if belarus not in lowered:
        address = "Республика Беларусь, " + address.lstrip(", ")
    return address


def safe_filename(value: str) -> str:
    forbidden = '<>:"/\\|?*\n\r\t'
    result = value
    for char in forbidden:
        result = result.replace(char, "-")
    return " ".join(result.split()).strip(" .")
