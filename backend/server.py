from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
import bcrypt
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase PostgreSQL connection
DATABASE_URL = os.environ.get('DATABASE_URL')
ASYNC_DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

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

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nombre: str
    rol: str = "usuario"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    nombre: str
    rol: str
    activo: bool
    created_at: Optional[str] = None

class UserUpdate(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

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

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text('SELECT id, email, nombre, rol, activo FROM usuarios WHERE id = :id'),
                {"id": int(user_id)}
            )
            user = result.fetchone()
            if not user:
                raise HTTPException(status_code=401, detail="Usuario no encontrado")
            if not user[4]:
                raise HTTPException(status_code=401, detail="Usuario desactivado")
            return {"id": user[0], "email": user[1], "nombre": user[2], "rol": user[3], "activo": user[4]}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["rol"] != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return current_user

# Initialize users table
@app.on_event("startup")
async def create_users_table():
    async with AsyncSessionLocal() as session:
        # Create usuarios table if not exists
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                rol VARCHAR(50) DEFAULT 'usuario',
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        await session.commit()
        
        # Add status columns to Control table if not exist
        try:
            await session.execute(text("""
                ALTER TABLE "Control" 
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Unknown',
                ADD COLUMN IF NOT EXISTS last_check TIMESTAMP
            """))
            await session.commit()
        except Exception as e:
            print(f"Columns may already exist: {e}")
        
        # Check if admin exists, if not create default admin
        result = await session.execute(
            text("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1")
        )
        if not result.fetchone():
            admin_hash = hash_password("admin123")
            await session.execute(
                text("""
                    INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
                    VALUES (:email, :password, :nombre, :rol, true)
                    ON CONFLICT (email) DO NOTHING
                """),
                {"email": "admin@sistema.com", "password": admin_hash, "nombre": "Administrador", "rol": "admin"}
            )
            await session.commit()

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    async with AsyncSessionLocal() as session:
        # Check if email exists
        result = await session.execute(
            text("SELECT id FROM usuarios WHERE email = :email"),
            {"email": user_data.email}
        )
        if result.fetchone():
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
        
        # Create user
        password_hash = hash_password(user_data.password)
        result = await session.execute(
            text("""
                INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
                VALUES (:email, :password, :nombre, :rol, true)
                RETURNING id, email, nombre, rol, activo, created_at
            """),
            {"email": user_data.email, "password": password_hash, "nombre": user_data.nombre, "rol": user_data.rol}
        )
        user = result.fetchone()
        await session.commit()
        
        token = create_access_token({"sub": str(user[0])})
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=user[0], email=user[1], nombre=user[2], 
                rol=user[3], activo=user[4], 
                created_at=user[5].isoformat() if user[5] else None
            )
        )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id, email, password_hash, nombre, rol, activo, created_at FROM usuarios WHERE email = :email"),
            {"email": credentials.email}
        )
        user = result.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")
        
        if not verify_password(credentials.password, user[2]):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")
        
        if not user[5]:
            raise HTTPException(status_code=401, detail="Usuario desactivado")
        
        token = create_access_token({"sub": str(user[0])})
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=user[0], email=user[1], nombre=user[3], 
                rol=user[4], activo=user[5],
                created_at=user[6].isoformat() if user[6] else None
            )
        )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# User Management Routes (Admin only)
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id, email, nombre, rol, activo, created_at FROM usuarios ORDER BY id")
        )
        users = result.fetchall()
        return [
            UserResponse(
                id=u[0], email=u[1], nombre=u[2], rol=u[3], activo=u[4],
                created_at=u[5].isoformat() if u[5] else None
            ) for u in users
        ]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id FROM usuarios WHERE email = :email"),
            {"email": user_data.email}
        )
        if result.fetchone():
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
        
        password_hash = hash_password(user_data.password)
        result = await session.execute(
            text("""
                INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
                VALUES (:email, :password, :nombre, :rol, true)
                RETURNING id, email, nombre, rol, activo, created_at
            """),
            {"email": user_data.email, "password": password_hash, "nombre": user_data.nombre, "rol": user_data.rol}
        )
        user = result.fetchone()
        await session.commit()
        
        return UserResponse(
            id=user[0], email=user[1], nombre=user[2], rol=user[3], activo=user[4],
            created_at=user[5].isoformat() if user[5] else None
        )

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, user_data: UserUpdate, current_user: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        # Build update query dynamically
        updates = []
        params = {"id": user_id}
        
        if user_data.nombre is not None:
            updates.append("nombre = :nombre")
            params["nombre"] = user_data.nombre
        if user_data.rol is not None:
            updates.append("rol = :rol")
            params["rol"] = user_data.rol
        if user_data.activo is not None:
            updates.append("activo = :activo")
            params["activo"] = user_data.activo
        
        if not updates:
            raise HTTPException(status_code=400, detail="No hay datos para actualizar")
        
        query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id = :id RETURNING id, email, nombre, rol, activo, created_at"
        result = await session.execute(text(query), params)
        user = result.fetchone()
        await session.commit()
        
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        return UserResponse(
            id=user[0], email=user[1], nombre=user[2], rol=user[3], activo=user[4],
            created_at=user[5].isoformat() if user[5] else None
        )

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("DELETE FROM usuarios WHERE id = :id RETURNING id"),
            {"id": user_id}
        )
        deleted = result.fetchone()
        await session.commit()
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        return {"message": "Usuario eliminado correctamente"}

# Dashboard Routes
@api_router.get("/")
async def root():
    return {"message": "Camera Control Dashboard API"}

@api_router.get("/control", response_model=List[dict])
async def get_all_control(current_user: dict = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(text('SELECT * FROM "Control" ORDER BY id'))
        rows = result.fetchall()
        columns = result.keys()
        records = [dict(zip(columns, row)) for row in rows]
        return records

@api_router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(text('SELECT sucursal, cams_instaladas, cam_audio FROM "Control"'))
        rows = result.fetchall()
        
        sucursales = set()
        total_camaras = 0
        sucursales_con_audio = 0
        sucursales_sin_audio = 0
        
        for row in rows:
            sucursal, cams, audio = row
            if sucursal:
                sucursales.add(sucursal)
            if cams:
                total_camaras += int(cams)
            if audio and int(audio) > 0:
                sucursales_con_audio += 1
            else:
                sucursales_sin_audio += 1
        
        total_registros = len(rows)
        porcentaje_audio = (sucursales_con_audio / total_registros * 100) if total_registros > 0 else 0
        porcentaje_sin_audio = (sucursales_sin_audio / total_registros * 100) if total_registros > 0 else 0
        
        return DashboardStats(
            total_sucursales=len(sucursales),
            total_camaras=total_camaras,
            camaras_con_audio=sucursales_con_audio,
            camaras_sin_audio=sucursales_sin_audio,
            porcentaje_audio=round(porcentaje_audio, 1),
            porcentaje_sin_audio=round(porcentaje_sin_audio, 1)
        )

@api_router.get("/regions", response_model=List[RegionData])
async def get_regions_data(current_user: dict = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('SELECT region, COUNT(*) as count, COALESCE(SUM(cams_instaladas), 0) as total_cams FROM "Control" WHERE region IS NOT NULL GROUP BY region ORDER BY count DESC')
        )
        rows = result.fetchall()
        return [RegionData(region=row[0], count=row[1], total_camaras=int(row[2])) for row in rows]

@api_router.get("/tipos-instalacion", response_model=List[TipoInstalacionData])
async def get_tipos_instalacion(current_user: dict = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('SELECT tipo_instalacion, COUNT(*) as count FROM "Control" WHERE tipo_instalacion IS NOT NULL GROUP BY tipo_instalacion ORDER BY count DESC')
        )
        rows = result.fetchall()
        return [TipoInstalacionData(tipo=row[0], count=row[1]) for row in rows]

@api_router.get("/search")
async def search_by_sucursal(sucursal: str = Query(..., min_length=1), current_user: dict = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('SELECT * FROM "Control" WHERE LOWER(sucursal) LIKE LOWER(:search)'),
            {"search": f"%{sucursal}%"}
        )
        rows = result.fetchall()
        columns = result.keys()
        records = [dict(zip(columns, row)) for row in rows]
        return records

@api_router.get("/sucursal/{sucursal_id}")
async def get_sucursal_by_id(sucursal_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single sucursal by ID"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('SELECT * FROM "Control" WHERE id = :id'),
            {"id": sucursal_id}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        columns = result.keys()
        return dict(zip(columns, row))

class SucursalUpdate(BaseModel):
    empresa: Optional[str] = None
    sucursal: Optional[str] = None
    serie_dvr: Optional[str] = None
    modelo_dvr: Optional[str] = None
    puertos_dvr: Optional[int] = None
    cams_instaladas: Optional[int] = None
    cam_audio: Optional[int] = None
    region: Optional[str] = None
    tipo_instalacion: Optional[str] = None
    cod_verif: Optional[str] = None
    usuario: Optional[str] = None
    password: Optional[str] = None
    ubi_dvr_aprox: Optional[str] = None

@api_router.put("/sucursal/{sucursal_id}")
async def update_sucursal(sucursal_id: str, data: SucursalUpdate, current_user: dict = Depends(require_admin)):
    """Update a sucursal (admin only)"""
    async with AsyncSessionLocal() as session:
        # Build update query dynamically
        updates = []
        params = {"id": sucursal_id}
        
        update_fields = data.model_dump(exclude_unset=True)
        for field, value in update_fields.items():
            if value is not None:
                updates.append(f"{field} = :{field}")
                params[field] = value
        
        if not updates:
            raise HTTPException(status_code=400, detail="No hay datos para actualizar")
        
        query = f'UPDATE "Control" SET {", ".join(updates)} WHERE id = :id RETURNING *'
        result = await session.execute(text(query), params)
        row = result.fetchone()
        await session.commit()
        
        if not row:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        
        columns = result.keys()
        return dict(zip(columns, row))

@api_router.delete("/sucursal/{sucursal_id}")
async def delete_sucursal(sucursal_id: str, current_user: dict = Depends(require_admin)):
    """Delete a sucursal (admin only)"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('DELETE FROM "Control" WHERE id = :id RETURNING id'),
            {"id": sucursal_id}
        )
        deleted = result.fetchone()
        await session.commit()
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        
        return {"message": "Sucursal eliminada correctamente"}

# Status Sucursales Endpoints
@api_router.get("/status/all")
async def get_all_status(current_user: dict = Depends(get_current_user)):
    """Get status of all sucursales"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('SELECT id, empresa, sucursal, region, status, last_check FROM "Control" ORDER BY status DESC, sucursal')
        )
        rows = result.fetchall()
        columns = result.keys()
        return [dict(zip(columns, row)) for row in rows]

@api_router.get("/status/stats")
async def get_status_stats(current_user: dict = Depends(get_current_user)):
    """Get status statistics"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('SELECT status, COUNT(*) as count FROM "Control" GROUP BY status')
        )
        rows = result.fetchall()
        
        stats = {"Online": 0, "Offline": 0, "Unknown": 0, "total": 0}
        for row in rows:
            status_val = row[0] or "Unknown"
            count = row[1]
            if status_val in stats:
                stats[status_val] = count
            else:
                stats["Unknown"] += count
            stats["total"] += count
        
        return stats

class StatusUpdate(BaseModel):
    status: str
    
@api_router.put("/status/{sucursal_id}")
async def update_status(sucursal_id: str, data: StatusUpdate, current_user: dict = Depends(require_admin)):
    """Update status of a sucursal (admin only)"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text('UPDATE "Control" SET status = :status, last_check = :last_check WHERE id = :id RETURNING id, sucursal, status, last_check'),
            {"id": sucursal_id, "status": data.status, "last_check": datetime.now(timezone.utc)}
        )
        row = result.fetchone()
        await session.commit()
        
        if not row:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        
        return {"id": row[0], "sucursal": row[1], "status": row[2], "last_check": row[3].isoformat() if row[3] else None}

@api_router.post("/status/sync-manual")
async def manual_sync_status(current_user: dict = Depends(require_admin)):
    """Trigger manual status update (simulated - real sync requires external script)"""
    return {
        "message": "Para sincronizar con Hik-Connect, ejecute el script sync_hikvision.py localmente",
        "script_path": "/app/backend/sync_hikvision.py",
        "instructions": [
            "1. Configure las variables HIK_USER y HIK_PASS",
            "2. Configure SUPABASE_KEY",
            "3. Ejecute: python sync_hikvision.py"
        ]
    }

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
