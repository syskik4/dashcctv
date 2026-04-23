# PRD - Sistema de Control de Cámaras Dashboard

## Fecha de Creación
2025-01-21

## Problem Statement Original
Dashboard moderno, responsivo y oscuro para sistema de control de cámaras conectado a Supabase. Incluye tarjetas de resumen, gráficas de barras/pastel, tabla interactiva y buscador por sucursal.

## User Personas
- **Administradores de Seguridad Corporativa**: Gestión y monitoreo de instalaciones de cámaras en múltiples sucursales
- **Gerentes Regionales**: Visualización de métricas por región

## Core Requirements
1. ✅ Conexión a Supabase (tabla Control)
2. ✅ Tarjetas de estadísticas (sucursales, cámaras, audio)
3. ✅ Gráfica de barras por región
4. ✅ Gráfica de pastel por tipo de instalación
5. ✅ Tabla interactiva con paginación y ordenamiento
6. ✅ Buscador por sucursal

## Tech Stack
- **Frontend**: React + Tailwind CSS + Recharts + Shadcn/UI
- **Backend**: FastAPI + SQLAlchemy (async)
- **Database**: Supabase PostgreSQL

## What's Been Implemented
- [2025-01-21] MVP completo del dashboard
  - 4 tarjetas de estadísticas con porcentajes y barras de progreso
  - Gráfica de barras mostrando distribución por región
  - Gráfica de pastel mostrando tipos de instalación
  - Tabla interactiva con 8 columnas, paginación y ordenamiento
  - Búsqueda por nombre de sucursal
  - Diseño dark mode con tema corporativo
- [2025-01-22] Autenticación JWT (admin@sistema.com / admin123), User Management CRUD, módulos Control Sucursales y Status Sucursales
- [2025-01-22] Scripts externos `sync_hikvision.py` y `scraper_hikvision.py` para Hik-Connect
- [2026-02-21] Feature "+ Nueva Sucursal" (POST /api/sucursal) - admin-only
  - Generación automática de IDs tipo 'A###' siguiendo la convención existente (MAX(id)+1)
  - Validación: duplicate serie_dvr returns 400
  - Pydantic field_validator: empty strings → None en todos los campos opcionales
  - cod_verif tipo Optional[int] (coerce numeric strings, alinea con columna INTEGER en Postgres)
  - Frontend: modal con 13 campos + data-testids
  - Validado E2E: 21/21 pytest + 2 flujos frontend (campos vacíos y campos completos)

## API Endpoints
- POST /api/auth/login, GET /api/auth/me
- GET /api/users, POST /api/users, PUT /api/users/{id}, DELETE /api/users/{id} (admin)
- GET /api/stats - Estadísticas del dashboard
- GET /api/regions - Datos por región
- GET /api/tipos-instalacion - Tipos de instalación
- GET /api/control - Todos los registros
- GET /api/search?sucursal=X - Búsqueda
- POST /api/sucursal (admin) - Crear nueva sucursal
- PUT /api/sucursal/{id} (admin) - Actualizar sucursal
- DELETE /api/sucursal/{id} (admin) - Eliminar sucursal
- GET /api/status/all, GET /api/status/stats

## Regression Test Suite
- `/app/backend/tests/test_sucursal_crud.py` - 21 tests (auth, reads, Sucursal CRUD, cod_verif coercion, empty-string normalization, user regression)

## Backlog (P0-P2)
### P1
- Exportar datos a Excel/CSV (el usuario lo declinó por ahora)
- Filtros adicionales por empresa, región, fecha
- Refactor `sync_hikvision.py` y `scraper_hikvision.py` para usar SQLAlchemy directamente (eliminar dependencia de SUPABASE_KEY)

### P2
- Dashboard de alertas
- Histórico de cambios
- Migrar `@app.on_event` deprecated → FastAPI lifespan
- Retornar 401 (en vez de 403) cuando falta header Authorization
- Fix Recharts ResponsiveContainer width(-1)/height(-1) console warnings
