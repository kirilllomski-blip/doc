from __future__ import annotations

import os
import json
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

class DatabaseManager:
    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            # Check environment or default to local data/contracts.sqlite3
            env_path = os.getenv("DATABASE_PATH")
            if env_path:
                self.db_path = Path(env_path)
            else:
                # In serverless environments, writable dir is /tmp
                if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
                    self.db_path = Path("/tmp/icebel_contracts.sqlite3")
                else:
                    self.db_path = Path(__file__).resolve().parent.parent / "data" / "contracts.sqlite3"
        else:
            self.db_path = db_path

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS counters (
                    contract_date TEXT NOT NULL,
                    contract_type TEXT NOT NULL,
                    last_number INTEGER NOT NULL,
                    PRIMARY KEY (contract_date, contract_type)
                );

                CREATE TABLE IF NOT EXISTS contracts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    contract_number TEXT NOT NULL UNIQUE,
                    contract_date TEXT NOT NULL,
                    buyer_fio TEXT NOT NULL,
                    buyer_surname TEXT NOT NULL,
                    buyer_surname_fold TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL,
                    address TEXT NOT NULL,
                    items_json TEXT NOT NULL,
                    total_amount_cents INTEGER NOT NULL,
                    file_name TEXT NOT NULL,
                    drive_file_id TEXT,
                    drive_link TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_contracts_created_at
                    ON contracts(created_at DESC);
                """
            )

    def reserve_contract_number(self, day: date, contract_type: str = "retail") -> str:
        date_iso = day.isoformat()
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO counters (contract_date, contract_type, last_number)
                VALUES (?, ?, 1)
                ON CONFLICT(contract_date, contract_type)
                DO UPDATE SET last_number = counters.last_number + 1
                RETURNING last_number;
                """,
                (date_iso, contract_type),
            )
            row = cur.fetchone()
            if row:
                next_number = row[0]
            else:
                cur.execute(
                    "SELECT last_number FROM counters WHERE contract_date = ? AND contract_type = ?",
                    (date_iso, contract_type),
                )
                next_number = cur.fetchone()[0]

            suffix = "\u0420" if contract_type == "retail" else "\u041a"
            day_tag = day.strftime("%d%m%y")
            return f"{next_number:02d}-{day_tag}-{suffix}"

    def save_contract(
        self,
        contract_number: str,
        contract_date: date,
        buyer_fio: str,
        buyer_surname: str,
        phone: str,
        address: str,
        items: list[dict[str, Any]],
        total_amount_cents: int,
        file_name: str,
        drive_file_id: Optional[str] = None,
        drive_link: Optional[str] = None,
    ) -> int:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO contracts (
                    contract_number, contract_date, buyer_fio, buyer_surname,
                    buyer_surname_fold, phone, address, items_json,
                    total_amount_cents, file_name, drive_file_id, drive_link,
                    status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
                """,
                (
                    contract_number,
                    contract_date.isoformat(),
                    buyer_fio,
                    buyer_surname,
                    buyer_surname.casefold(),
                    phone,
                    address,
                    json.dumps(items, ensure_ascii=False),
                    total_amount_cents,
                    file_name,
                    drive_file_id,
                    drive_link,
                    now_iso,
                ),
            )
            return cur.lastrowid

    def list_contracts(self, limit: int = 50, search: Optional[str] = None) -> list[dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            if search and search.strip():
                query = search.strip().casefold()
                cur.execute(
                    """
                    SELECT id, contract_number, contract_date, buyer_fio, phone, address,
                           items_json, total_amount_cents, file_name, drive_link, created_at
                    FROM contracts
                    WHERE status = 'active' AND (
                        buyer_surname_fold LIKE ? OR
                        contract_number LIKE ? OR
                        phone LIKE ?
                    )
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (f"%{query}%", f"%{query}%", f"%{query}%", limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, contract_number, contract_date, buyer_fio, phone, address,
                           items_json, total_amount_cents, file_name, drive_link, created_at
                    FROM contracts
                    WHERE status = 'active'
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            rows = cur.fetchall()
            results = []
            for row in rows:
                results.append({
                    "id": row["id"],
                    "contract_number": row["contract_number"],
                    "contract_date": row["contract_date"],
                    "buyer_fio": row["buyer_fio"],
                    "phone": row["phone"],
                    "address": row["address"],
                    "items": json.loads(row["items_json"]),
                    "total_amount_cents": row["total_amount_cents"],
                    "file_name": row["file_name"],
                    "drive_link": row["drive_link"],
                    "created_at": row["created_at"],
                })
            return results
