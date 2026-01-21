from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Any
from collections import Counter

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase PostgreSQL connection
DATABASE_URL = os.environ.get('DATABASE_URL')
ASYNC_DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_size=10,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=False,
    echo=False,
    connect_args={
        "statement_cache_size": 0,
        "command_timeout": 30,
    }
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class ControlRecord(BaseModel):
    id: Optional[int] = None
    empresa: Optional[str] = None
    sucursal: Optional[str] = None
    serie_dvr: Optional[str] = None
    modelo_dvr: Optional[str] = None
    puertos_dvr: Optional[int] = None
    cams_instaladas: Optional[int] = None
    cam_audio: Optional[int] = None
    region: Optional[str] = None
    tipo_instalacion: Optional[str] = None

class DashboardStats(BaseModel):
    total_sucursales: int
    total_camaras: int
    camaras_con_audio: int
    camaras_sin_audio: int
    porcentaje_audio: float
    porcentaje_sin_audio: float

class RegionData(BaseModel):
    region: str
    count: int
    total_camaras: int

class TipoInstalacionData(BaseModel):
    tipo: str
    count: int

# Routes
@api_router.get("/")
async def root():
    return {"message": "Camera Control Dashboard API"}

@api_router.get("/control", response_model=List[dict])
async def get_all_control():
    """Get all records from Control table"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT * FROM \"Control\" ORDER BY id"))
        rows = result.fetchall()
        columns = result.keys()
        records = [dict(zip(columns, row)) for row in rows]
        return records

@api_router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get dashboard statistics"""
    async with AsyncSessionLocal() as session:
        # Get all records
        result = await session.execute(text("SELECT sucursal, cams_instaladas, cam_audio FROM \"Control\""))
        rows = result.fetchall()
        
        # Calculate stats
        sucursales = set()
        total_camaras = 0
        total_audio = 0
        
        for row in rows:
            sucursal, cams, audio = row
            if sucursal:
                sucursales.add(sucursal)
            if cams:
                total_camaras += int(cams)
            if audio:
                total_audio += int(audio)
        
        camaras_sin_audio = total_camaras - total_audio
        porcentaje_audio = (total_audio / total_camaras * 100) if total_camaras > 0 else 0
        porcentaje_sin_audio = (camaras_sin_audio / total_camaras * 100) if total_camaras > 0 else 0
        
        return DashboardStats(
            total_sucursales=len(sucursales),
            total_camaras=total_camaras,
            camaras_con_audio=total_audio,
            camaras_sin_audio=camaras_sin_audio,
            porcentaje_audio=round(porcentaje_audio, 1),
            porcentaje_sin_audio=round(porcentaje_sin_audio, 1)
        )

@api_router.get("/regions", response_model=List[RegionData])
async def get_regions_data():
    """Get data grouped by region for bar chart"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT region, COUNT(*) as count, COALESCE(SUM(cams_instaladas), 0) as total_cams FROM \"Control\" WHERE region IS NOT NULL GROUP BY region ORDER BY count DESC")
        )
        rows = result.fetchall()
        return [RegionData(region=row[0], count=row[1], total_camaras=int(row[2])) for row in rows]

@api_router.get("/tipos-instalacion", response_model=List[TipoInstalacionData])
async def get_tipos_instalacion():
    """Get data grouped by installation type for pie chart"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT tipo_instalacion, COUNT(*) as count FROM \"Control\" WHERE tipo_instalacion IS NOT NULL GROUP BY tipo_instalacion ORDER BY count DESC")
        )
        rows = result.fetchall()
        return [TipoInstalacionData(tipo=row[0], count=row[1]) for row in rows]

@api_router.get("/search")
async def search_by_sucursal(sucursal: str = Query(..., min_length=1)):
    """Search records by sucursal name"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT * FROM \"Control\" WHERE LOWER(sucursal) LIKE LOWER(:search)"),
            {"search": f"%{sucursal}%"}
        )
        rows = result.fetchall()
        columns = result.keys()
        records = [dict(zip(columns, row)) for row in rows]
        return records

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db():
    await engine.dispose()
