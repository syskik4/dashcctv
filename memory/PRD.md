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

## API Endpoints
- GET /api/stats - Estadísticas del dashboard
- GET /api/regions - Datos por región
- GET /api/tipos-instalacion - Tipos de instalación
- GET /api/control - Todos los registros
- GET /api/search?sucursal=X - Búsqueda

## Backlog (P0-P2)
### P1
- Exportar datos a Excel/CSV
- Filtros adicionales por empresa, región, fecha

### P2
- Autenticación de usuarios
- Dashboard de alertas
- Histórico de cambios
