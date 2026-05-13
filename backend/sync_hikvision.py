"""
Script de sincronización con Hik-Connect
Sincroniza el estado de los dispositivos (Online/Offline) con la base de datos
de Supabase usando SQLAlchemy (pooler) directamente - NO requiere SUPABASE_KEY.
"""

import time
import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from dotenv import load_dotenv
from pathlib import Path

from db_sync import get_engine, bulk_update_devices

# Cargar variables de entorno (backend/.env + .env.hikvision si existe)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
if (ROOT_DIR / '.env.hikvision').exists():
    load_dotenv(ROOT_DIR / '.env.hikvision', override=False)

# ============================================
# CONFIGURACIÓN
# ============================================
HIK_USER = os.getenv("HIK_USER", "")
HIK_PASS = os.getenv("HIK_PASS", "")
URL_HIK = "https://ius.hik-connect.com/views/main/index.html#/common/personal/DeviceManagement"
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "300"))


def iniciar_driver():
    """Inicializa el driver de Chrome"""
    print("🔧 Iniciando navegador Chrome...")
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    try:
        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options
        )
        print("✅ Navegador iniciado correctamente")
        return driver
    except Exception as e:
        print(f"❌ Error al iniciar Chrome: {e}")
        return None


def login_hik_connect(driver):
    """Realiza el login en Hik-Connect"""
    try:
        print("🌐 Navegando a Hik-Connect...")
        driver.get(URL_HIK)
        time.sleep(5)
        
        wait = WebDriverWait(driver, 15)
        
        print("📝 Ingresando credenciales...")
        user_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[type='text'], input[placeholder*='user'], input[placeholder*='email']")
        ))
        user_input.clear()
        user_input.send_keys(HIK_USER)
        
        pass_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        pass_input.clear()
        pass_input.send_keys(HIK_PASS)
        
        time.sleep(1)
        login_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], .login-btn, button.btn-primary")
        login_btn.click()
        
        time.sleep(10)
        print("✅ Login exitoso en Hik-Connect")
        return True
        
    except Exception as e:
        print(f"❌ Error en login: {e}")
        driver.save_screenshot("error_login.png")
        return False


def obtener_estados_dispositivos(driver):
    """Obtiene el estado de los dispositivos desde Hik-Connect"""
    dispositivos = []
    
    try:
        print("🔍 Buscando dispositivos...")
        time.sleep(3)
        
        # Buscar todas las filas de la tabla
        filas = driver.find_elements(By.CSS_SELECTOR, ".el-table__body tr, .el-table__row")
        
        print(f"   Filas encontradas: {len(filas)}")
        
        for fila in filas:
            try:
                celdas = fila.find_elements(By.TAG_NAME, "td")
                
                if len(celdas) >= 5:
                    # Columnas según la imagen:
                    # 0: Alias (nombre)
                    # 1: Device Domain
                    # 2: Device Serial No. (serie_dvr) ← ESTE ES EL QUE NECESITAMOS
                    # 3: IP/Port No.
                    # 4: Status
                    
                    alias = celdas[0].text.strip()
                    serial_no = celdas[2].text.strip()  # Device Serial No.
                    status_text = celdas[4].text.strip()  # Status
                    
                    if serial_no:
                        esta_online = "Online" in status_text
                        dispositivos.append({
                            "alias": alias,
                            "serie_dvr": serial_no,
                            "status": "Online" if esta_online else "Offline"
                        })
                        
            except Exception as e:
                continue
        
        print(f"✅ Encontrados {len(dispositivos)} dispositivos con Serial No.")
        return dispositivos
        
    except Exception as e:
        print(f"❌ Error obteniendo dispositivos: {e}")
        return []


def actualizar_supabase(engine, dispositivos):
    """Actualiza el estado en Supabase usando serie_dvr como identificador (SQLAlchemy directo)"""
    print("\n💾 Actualizando base de datos...")
    print("-" * 60)
    resultado = bulk_update_devices(engine, dispositivos)
    print("-" * 60)
    print(f"📊 Resumen: {resultado['actualizados']} actualizados, {resultado['no_encontrados']} no encontrados")
    if resultado['dispositivos_no_encontrados']:
        for d in resultado['dispositivos_no_encontrados']:
            print(f"   ⚠️ No encontrado: {d.get('alias','')} (Serial: {d.get('serie_dvr','')})")
    return resultado['actualizados']


def sync_status():
    """Función principal de sincronización"""
    
    print("\n" + "="*60)
    print("   SINCRONIZACIÓN HIK-CONNECT → SUPABASE")
    print("   (Matching por Device Serial No. / serie_dvr)")
    print("="*60 + "\n")
    
    # Validar credenciales
    errores = []
    if not HIK_USER:
        errores.append("❌ HIK_USER no configurado")
    if not HIK_PASS:
        errores.append("❌ HIK_PASS no configurado")
    if not os.getenv("DATABASE_URL"):
        errores.append("❌ DATABASE_URL no configurado en backend/.env")
    
    if errores:
        print("⚠️ ERRORES DE CONFIGURACIÓN:")
        for error in errores:
            print(f"   {error}")
        return
    
    print("📋 Configuración:")
    print(f"   - DB: Supabase via SQLAlchemy (pooler, usa DATABASE_URL)")
    print(f"   - Hik-Connect User: {HIK_USER}")
    print(f"   - Intervalo: {SYNC_INTERVAL//60} minutos")
    print(f"   - Matching por: serie_dvr (Device Serial No.)")
    print()
    
    # Conectar a Supabase vía SQLAlchemy (NO requiere SUPABASE_KEY)
    try:
        engine = get_engine()
        print("✅ Conexión a Supabase establecida (SQLAlchemy)")
    except Exception as e:
        print(f"❌ Error conectando a Supabase: {e}")
        return
    
    # Iniciar Chrome
    driver = iniciar_driver()
    if not driver:
        return
    
    try:
        if not login_hik_connect(driver):
            return
        
        while True:
            print(f"\n{'='*60}")
            print(f"🕐 Sincronización: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*60)
            
            dispositivos = obtener_estados_dispositivos(driver)
            
            if dispositivos:
                actualizados = actualizar_supabase(engine, dispositivos)
                print(f"\n✅ Sincronización completada: {actualizados} registros")
            else:
                print("⚠️ No se encontraron dispositivos")
            
            print(f"\n⏳ Próxima sincronización en {SYNC_INTERVAL//60} minutos...")
            print("   (Presiona Ctrl+C para detener)")
            time.sleep(SYNC_INTERVAL)
            
            driver.refresh()
            time.sleep(10)
            
    except KeyboardInterrupt:
        print("\n\n✅ Sincronización detenida")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════════════════╗
    ║     SYNC HIK-CONNECT → SUPABASE (v2.0)                     ║
    ║     Matching por: Device Serial No. → serie_dvr            ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    sync_status()
