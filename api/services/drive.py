from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Optional

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
SCOPES = ["https://www.googleapis.com/auth/drive"]


class GoogleDriveService:
    def __init__(
        self,
        *,
        auth_mode: str = "service_account",
        folder_id: Optional[str] = None,
        oauth_client_file: Optional[Path] = None,
        oauth_token_file: Optional[Path] = None,
        service_account_file: Optional[Path] = None,
        service_account_json_str: Optional[str] = None,
    ):
        self.auth_mode = auth_mode or os.getenv("GOOGLE_AUTH_MODE", "service_account")
        self.folder_id = folder_id or os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
        self.oauth_client_file = oauth_client_file or Path(os.getenv("GOOGLE_OAUTH_CLIENT_FILE", "credentials/google-oauth-client.json"))
        self.oauth_token_file = oauth_token_file or Path(os.getenv("GOOGLE_OAUTH_TOKEN_FILE", "credentials/google-oauth-token.json"))
        self.service_account_file = service_account_file or Path(os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "credentials/google-service-account.json"))
        self.service_account_json_str = service_account_json_str or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")

    def is_configured(self) -> bool:
        if not self.folder_id:
            return False
        try:
            import google.auth
        except ImportError:
            return False

        if self.auth_mode == "service_account":
            return bool(self.service_account_json_str) or (self.service_account_file and self.service_account_file.exists())
        if self.auth_mode == "oauth":
            return (self.oauth_token_file and self.oauth_token_file.exists()) or bool(os.getenv("GOOGLE_OAUTH_TOKEN_JSON"))
        return False

    def _credentials(self):
        try:
            from google.oauth2 import service_account
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
        except ImportError as e:
            raise RuntimeError("Модуль google-auth не установлен. Установите: pip install google-api-python-client google-auth") from e

        if self.auth_mode == "service_account":
            if self.service_account_json_str and self.service_account_json_str.strip().startswith("{"):
                data = json.loads(self.service_account_json_str)
                return service_account.Credentials.from_service_account_info(data, scopes=SCOPES)
            if self.service_account_file and self.service_account_file.exists():
                return service_account.Credentials.from_service_account_file(
                    str(self.service_account_file), scopes=SCOPES
                )
            raise RuntimeError("Google Service Account credentials not found")

        token_json_str = os.getenv("GOOGLE_OAUTH_TOKEN_JSON")
        if token_json_str and token_json_str.strip().startswith("{"):
            info = json.loads(token_json_str)
            credentials = Credentials.from_authorized_user_info(info, SCOPES)
            if credentials and credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
            return credentials

        if self.oauth_token_file and self.oauth_token_file.exists():
            credentials = Credentials.from_authorized_user_file(
                str(self.oauth_token_file), SCOPES
            )
            if credentials and credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
                self.oauth_token_file.write_text(credentials.to_json(), encoding="utf-8")
            return credentials

        raise RuntimeError("Google OAuth credentials not found or expired")

    def _client(self):
        try:
            from googleapiclient.discovery import build
        except ImportError as e:
            raise RuntimeError("Пакет google-api-python-client не установлен.") from e

        return build(
            "drive",
            "v3",
            credentials=self._credentials(),
            cache_discovery=False,
        )

    def upload_contract(self, file_path: Path, file_name: str) -> tuple[str, str]:
        if not self.folder_id:
            raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is not configured")

        from googleapiclient.http import MediaFileUpload

        client = self._client()
        media = MediaFileUpload(
            str(file_path),
            mimetype=DOCX_MIME,
            resumable=False,
        )
        metadata = {
            "name": file_name,
            "parents": [self.folder_id],
        }
        file = (
            client.files()
            .create(
                body=metadata,
                media_body=media,
                fields="id, webViewLink",
                supportsAllDrives=True,
            )
            .execute()
        )
        return file["id"], file.get("webViewLink", "")
