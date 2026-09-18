from __future__ import annotations

import io
import os
import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Any, List, Optional
from urllib.parse import quote

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import DatabaseManager
from .services.dates import contract_date_text
from .services.document import ContractDocumentGenerator
from .services.drive import GoogleDriveService
from .services.money import format_money, money_in_words, parse_money_to_cents
from .services.names import buyer_initials, normalize_address, normalize_fio, normalize_phone, safe_filename

# Paths & Template Resolution
BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"


def get_template_path() -> Path:
    candidates = [
        Path(__file__).resolve().parent / "templates" / "retail_contract_template.docx",
        BASE_DIR / "templates" / "retail_contract_template.docx",
        Path("templates/retail_contract_template.docx").resolve(),
        Path("api/templates/retail_contract_template.docx").resolve(),
    ]
    for c in candidates:
        if c.exists():
            return c
    # Return standard as default
    return BASE_DIR / "templates" / "retail_contract_template.docx"


TEMPLATE_PATH = get_template_path()

# Initialize app
app = FastAPI(
    title="IceBel Contracts API",
    description="API for retail contract generation and Google Drive integration",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def resolve_vercel_routing(request: Request, call_next):
    """
    Handles Vercel URL rewrites gracefully:
    When Vercel rewrites /api/(.*) -> /api/index.py, Vercel supplies
    x-matched-path (e.g. /api/contracts/generate).
    This middleware restores the intended path so FastAPI matches routes correctly.
    """
    raw_path = request.scope.get("path", "")
    matched = (
        request.headers.get("x-matched-path")
        or request.headers.get("x-forwarded-uri")
        or request.headers.get("x-original-url")
    )
    if matched:
        clean_path = matched.split("?")[0]
        if clean_path and clean_path != raw_path:
            request.scope["path"] = clean_path

    # If raw path still points to index.py
    current_path = request.scope.get("path", "")
    if current_path in ("/api/index.py", "/index.py", "/api/index", "/index"):
        request.scope["path"] = "/api/status"

    return await call_next(request)


db_manager = DatabaseManager()
drive_service = GoogleDriveService()


class ContractItemModel(BaseModel):
    name: str = Field(..., min_length=1, description="Наименование товара")
    quantity: int = Field(1, ge=1, description="Количество")
    unit_price_cents: int = Field(..., ge=0, description="Цена за единицу в копейках")
    warranty_months: int = Field(12, ge=0, description="Срок гарантии в месяцах")


class ContractRequestModel(BaseModel):
    buyer_fio: str = Field(..., min_length=3, description="ФИО покупателя")
    phone: str = Field(..., min_length=5, description="Номер телефона")
    address: str = Field(..., min_length=3, description="Адрес доставки или монтажа")
    contract_date: Optional[str] = Field(None, description="Дата договора YYYY-MM-DD")
    contract_number: Optional[str] = Field(None, description="Номер договора если задан вручную")
    items: List[ContractItemModel] = Field(..., min_items=1, description="Список позиций спецификации")


# Define API endpoints using APIRouter
router = APIRouter()


@router.get("/status")
async def get_status():
    today = date.today()
    next_preview_number = f"XX-{today.strftime('%d%m%y')}-\u0420"
    tpl = get_template_path()
    return {
        "status": "online",
        "date": today.isoformat(),
        "preview_number_format": next_preview_number,
        "google_drive_configured": drive_service.is_configured(),
        "database": str(db_manager.db_path.name),
        "template_found": tpl.exists(),
        "template_path": str(tpl),
    }


@router.post("/preview")
async def preview_contract(payload: ContractRequestModel):
    try:
        norm_fio = normalize_fio(payload.buyer_fio)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Ошибка в ФИО: {e}")

    try:
        norm_phone = normalize_phone(payload.phone)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Ошибка в телефоне: {e}")

    try:
        norm_addr = normalize_address(payload.address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Ошибка в адресе: {e}")

    total_cents = sum(item.quantity * item.unit_price_cents for item in payload.items)
    words = money_in_words(total_cents)
    initials = buyer_initials(norm_fio)

    c_date = date.fromisoformat(payload.contract_date) if payload.contract_date else date.today()
    number = payload.contract_number or f"01-{c_date.strftime('%d%m%y')}-\u0420"
    filename = f"{initials} {number}.docx"

    return {
        "buyer_fio": norm_fio,
        "initials": initials,
        "phone": norm_phone,
        "address": norm_addr,
        "contract_date": c_date.isoformat(),
        "contract_date_text": contract_date_text(c_date),
        "contract_number": number,
        "filename": filename,
        "total_cents": total_cents,
        "total_formatted": format_money(total_cents),
        "total_words": words,
        "items_count": len(payload.items),
        "total_pieces": sum(item.quantity for item in payload.items),
    }


def _build_docx(payload: ContractRequestModel, contract_number: str, contract_date_obj: date) -> tuple[Path, str, int]:
    temp_dir = Path(tempfile.mkdtemp(prefix="icebel_"))
    tpl_path = get_template_path()
    if not tpl_path.exists():
        raise RuntimeError(f"Файл шаблона retail_contract_template.docx не найден ({tpl_path})")

    generator = ContractDocumentGenerator(tpl_path, temp_dir)

    norm_fio = normalize_fio(payload.buyer_fio)
    norm_phone = normalize_phone(payload.phone)
    norm_addr = normalize_address(payload.address)

    items_data = [item.model_dump() for item in payload.items]

    generated = generator.generate(
        contract_number=contract_number,
        contract_date=contract_date_obj,
        buyer_fio=norm_fio,
        phone=norm_phone,
        address=norm_addr,
        items=items_data,
    )
    return generated.path, generated.file_name, generated.total_cents


@router.post("/contracts/generate")
async def generate_contract_file(payload: ContractRequestModel):
    c_date = date.fromisoformat(payload.contract_date) if payload.contract_date else date.today()
    number = payload.contract_number
    if not number:
        number = db_manager.reserve_contract_number(c_date)

    try:
        doc_path, filename, total_cents = _build_docx(payload, number, c_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка формирования документа: {e}")

    doc_bytes = doc_path.read_bytes()
    try:
        doc_path.unlink(missing_ok=True)
        doc_path.parent.rmdir()
    except Exception:
        pass

    encoded_filename = quote(filename)
    return Response(
        content=doc_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "X-Contract-Number": quote(number),
        },
    )


@router.post("/contracts/save")
async def save_and_generate_contract(payload: ContractRequestModel):
    c_date = date.fromisoformat(payload.contract_date) if payload.contract_date else date.today()
    number = payload.contract_number or db_manager.reserve_contract_number(c_date)

    try:
        doc_path, filename, total_cents = _build_docx(payload, number, c_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации документа: {e}")

    drive_id = None
    drive_link = None

    if drive_service.is_configured():
        try:
            drive_id, drive_link = drive_service.upload_contract(doc_path, filename)
        except Exception as e:
            print(f"Drive upload error: {e}")

    norm_fio = normalize_fio(payload.buyer_fio)
    surname = norm_fio.split()[0]
    norm_phone = normalize_phone(payload.phone)
    norm_addr = normalize_address(payload.address)
    items_data = [item.model_dump() for item in payload.items]

    contract_id = db_manager.save_contract(
        contract_number=number,
        contract_date=c_date,
        buyer_fio=norm_fio,
        buyer_surname=surname,
        phone=norm_phone,
        address=norm_addr,
        items=items_data,
        total_amount_cents=total_cents,
        file_name=filename,
        drive_file_id=drive_id,
        drive_link=drive_link,
    )

    return {
        "success": True,
        "contract_id": contract_id,
        "contract_number": number,
        "filename": filename,
        "total_amount_cents": total_cents,
        "total_formatted": format_money(total_cents),
        "drive_link": drive_link,
        "download_url": f"/api/contracts/{contract_id}/download",
    }


@router.get("/contracts/{contract_id}/download")
async def download_saved_contract(contract_id: int):
    with db_manager._get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM contracts WHERE id = ?", (contract_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Договор не найден")

    import json
    payload = ContractRequestModel(
        buyer_fio=row["buyer_fio"],
        phone=row["phone"],
        address=row["address"],
        contract_date=row["contract_date"],
        contract_number=row["contract_number"],
        items=[ContractItemModel(**it) for it in json.loads(row["items_json"])],
    )
    c_date = date.fromisoformat(row["contract_date"])
    doc_path, filename, _ = _build_docx(payload, row["contract_number"], c_date)
    doc_bytes = doc_path.read_bytes()
    try:
        doc_path.unlink(missing_ok=True)
        doc_path.parent.rmdir()
    except Exception:
        pass

    encoded_filename = quote(filename)
    return Response(
        content=doc_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )


@router.get("/contracts")
async def list_contracts(search: Optional[str] = Query(None, description="Поиск по фамилии или номеру договора")):
    return db_manager.list_contracts(limit=50, search=search)


# Register routes BOTH with /api prefix AND without /api prefix
# This guarantees 100% compatibility with every Vercel routing configuration
app.include_router(router, prefix="/api")
app.include_router(router, prefix="")

# Serve frontend in local mode
if PUBLIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="public")
