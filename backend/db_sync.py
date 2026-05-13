"""
Helper compartido para scripts externos (sync_hikvision.py / scraper_hikvision.py)
Usa SQLAlchemy con DATABASE_URL del archivo backend/.env (pooler de Supabase)
y elimina la dependencia de SUPABASE_KEY / supabase-py.
"""

import os
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

# Carga backend/.env (siempre) y permite sobrescribir con .env.hikvision si existe.
load_dotenv(ROOT_DIR / '.env')
if (ROOT_DIR / '.env.hikvision').exists():
    load_dotenv(ROOT_DIR / '.env.hikvision', override=False)


def get_engine() -> Engine:
    """Crea un Engine sincrónico contra el pooler de Supabase usando DATABASE_URL."""
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise RuntimeError(
            "DATABASE_URL no está configurado en backend/.env. "
            "Este script ahora usa SQLAlchemy directo al pooler de Supabase."
        )
    # SQLAlchemy + psycopg2 (sincrónico, no async) para CLIs.
    if url.startswith('postgresql+asyncpg://'):
        url = url.replace('postgresql+asyncpg://', 'postgresql://', 1)
    return create_engine(url, pool_pre_ping=True, pool_size=2, max_overflow=1)


def update_status_by_serie(engine: Engine, serie_dvr: str, status: str) -> Optional[Dict[str, Any]]:
    """
    Actualiza status+last_check en la tabla "Control" matcheando por serie_dvr.
    Retorna la fila actualizada o None si no existe.
    """
    now_iso = datetime.now(timezone.utc)
    with engine.begin() as conn:
        result = conn.execute(
            text('''
                UPDATE "Control"
                   SET status = :status, last_check = :last_check
                 WHERE serie_dvr = :serie
             RETURNING id, sucursal, empresa, serie_dvr, status, last_check
            '''),
            {"status": status, "last_check": now_iso, "serie": serie_dvr}
        )
        row = result.fetchone()
        if not row:
            return None
        return dict(zip(result.keys(), row))


def bulk_update_devices(engine: Engine, devices: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Actualiza masivamente status por serie_dvr.
    `devices` debe ser lista de dicts con al menos {serie_dvr, status, alias}.
    """
    actualizados = 0
    no_encontrados: List[Dict[str, Any]] = []

    for disp in devices:
        serie = disp.get("serie_dvr")
        status = disp.get("status", "Unknown")
        if not serie:
            continue
        try:
            updated = update_status_by_serie(engine, serie, status)
            if updated:
                actualizados += 1
                icono = "🟢" if status == "Online" else "🔴"
                logger.info(
                    "   %s %s (%s): %s",
                    icono,
                    updated.get("sucursal") or "N/A",
                    serie,
                    status,
                )
            else:
                no_encontrados.append(disp)
        except Exception as e:
            logger.error("   ❌ Error actualizando %s: %s", disp.get("alias", serie), e)

    return {
        "actualizados": actualizados,
        "no_encontrados": len(no_encontrados),
        "dispositivos_no_encontrados": no_encontrados,
    }
