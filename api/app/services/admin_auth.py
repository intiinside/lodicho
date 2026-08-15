"""Sesion de admin para el panel de carga de corpus.

Una sola clave compartida (ADMIN_PASSWORD), sin tabla de usuarios — es lo
que se decidio para arrancar, con la idea de pasar a un usuario por
persona si en algun momento hay mas de un revisor subiendo contenido.
El token es HMAC firmado, sin estado en el servidor (no hay tabla de
sesiones en Postgres): solo un timestamp de expiracion + firma.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import time

from app.config.settings import settings


def verificar_password(password: str) -> bool:
    if not settings.admin_password:
        return False
    return hmac.compare_digest(password, settings.admin_password)


def crear_sesion() -> str:
    expira_en = int(time.time()) + settings.admin_session_horas * 3600
    payload = str(expira_en).encode()
    firma = _firmar(payload)
    return f"{_b64(payload)}.{_b64(firma)}"


def verificar_sesion(token: str | None) -> bool:
    if not token:
        return False
    try:
        payload_b64, firma_b64 = token.split(".", 1)
        payload = _unb64(payload_b64)
        firma = _unb64(firma_b64)
        expira_en = int(payload.decode())
    except Exception:
        return False

    if not hmac.compare_digest(firma, _firmar(payload)):
        return False

    return time.time() < expira_en


def _firmar(payload: bytes) -> bytes:
    clave = settings.admin_session_secret.encode()
    return hmac.new(clave, payload, hashlib.sha256).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(data: str) -> bytes:
    relleno = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + relleno)
