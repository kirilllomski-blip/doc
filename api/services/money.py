from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re

from num2words import num2words


class MoneyError(ValueError):
    pass


def parse_money_to_cents(value: str) -> int:
    cleaned = value.strip().replace("\u00a0", "").replace(" ", "")
    if not cleaned:
        raise MoneyError("Введите стоимость")

    # Последний разделитель считается десятичным. Остальные — разделители тысяч.
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    else:
        cleaned = cleaned.replace(",", ".")

    if not re.fullmatch(r"\d+(?:\.\d{1,2})?", cleaned):
        raise MoneyError("Стоимость должна выглядеть так: 13706,50")

    try:
        amount = Decimal(cleaned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except InvalidOperation as exc:
        raise MoneyError("Не удалось распознать стоимость") from exc

    if amount <= 0:
        raise MoneyError("Стоимость должна быть больше нуля")
    if amount > Decimal("999999999.99"):
        raise MoneyError("Слишком большая стоимость")
    return int(amount * 100)


def format_money(cents: int) -> str:
    rubles, kopecks = divmod(int(cents), 100)
    return f"{rubles:,}".replace(",", " ") + f",{kopecks:02d}"


def _plural(number: int, forms: tuple[str, str, str]) -> str:
    n = abs(number) % 100
    n1 = n % 10
    if 11 <= n <= 19:
        return forms[2]
    if n1 == 1:
        return forms[0]
    if 2 <= n1 <= 4:
        return forms[1]
    return forms[2]


def money_in_words(cents: int) -> str:
    rubles, kopecks = divmod(int(cents), 100)
    words = num2words(rubles, lang="ru")
    words = words[:1].upper() + words[1:]
    ruble_form = _plural(
        rubles,
        ("белорусский рубль", "белорусских рубля", "белорусских рублей"),
    )
    kopeck_form = _plural(kopecks, ("копейка", "копейки", "копеек"))
    return f"{words} {ruble_form} {kopecks:02d} {kopeck_form}"
