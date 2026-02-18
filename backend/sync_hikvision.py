"""
Script de sincronización con Hik-Connect
Este script debe ejecutarse localmente o en un servidor con Chrome instalado.
Sincroniza el estado de los dispositivos (Online/Offline) con Supabase.
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
from supabase import create_client
from dotenv import load_dotenv

# Cargar variables de entorno desde .env.hikvision
load_dotenv('.env.hikvision')

# ============================================
# CONFIGURACIÓN - MODIFICA ESTAS VARIABLES
# ============================================

# Supabase - Obtener de: https://supabase.com/dashboard/project/TU_PROYECTO/settings/api
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://miyvtmjwcdzbftixhety.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")  # ← REQUERIDO: Tu API Key de Supabase

# Hik-Connect - Tus credenciales de login
HIK_USER = os.getenv("HIK_USER", "")  # ← REQUERIDO: Tu usuario de Hik-Connect
HIK_PASS = os.getenv("HIK_PASS", "")  # ← REQUERIDO: Tu contraseña de Hik-Connect

# URL de la página de dispositivos de Hik-Connect
URL_HIK = "https://ius.hik-connect.com/views/main/index.html#/common/personal/DeviceManagement"

# Intervalo de sincronización en segundos (5 minutos por defecto)
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "300"))

# ============================================
# FUNCIONES DEL SCRIPT
# ============================================

def iniciar_driver():
    """Inicializa el driver de Chrome con opciones configuradas"""
    print("🔧 Iniciando navegador Chrome...")
    options = Options()
    options.add_argument("--headless")  # Sin interfaz gráfica
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    
    try:
        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options
        )
        print("✅ Navegador iniciado correctamente")
        return driver
    except Exception as e:
        print(f"❌ Error al iniciar Chrome: {e}")
        print("\n📋 Asegúrate de tener Chrome instalado:")
        print("   - Windows: Descarga desde https://www.google.com/chrome/")
        print("   - Linux: sudo apt install google-chrome-stable")
        print("   - Mac: brew install --cask google-chrome")
        return None


def login_hik_connect(driver):
    """Realiza el login en Hik-Connect"""
    try:
        print("🌐 Navegando a Hik-Connect...")
        driver.get(URL_HIK)
        time.sleep(5)
        
        wait = WebDriverWait(driver, 15)
        
        # Campo de usuario
        print("📝 Ingresando credenciales...")
        user_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[type='text'], input[placeholder*='user'], input[placeholder*='email']")
        ))
        user_input.clear()
        user_input.send_keys(HIK_USER)
        
        # Campo de contraseña
        pass_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        pass_input.clear()
        pass_input.send_keys(HIK_PASS)
        
        # Botón de login
        time.sleep(1)
        login_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], .login-btn, button.btn-primary")
        login_btn.click()
        
        time.sleep(10)
        print("✅ Login exitoso en Hik-Connect")
        return True
        
    except Exception as e:
        print(f"❌ Error en login: {e}")
        # Guardar screenshot para debug
        try:
            driver.save_screenshot("error_login.png")
            print("📸 Screenshot guardado en error_login.png")
        except:
            pass
        return False


def obtener_estados_dispositivos(driver):
    """Obtiene el estado de los dispositivos desde la tabla de Hik-Connect"""
    dispositivos = []
    
    try:
        print("🔍 Buscando dispositivos...")
        wait = WebDriverWait(driver, 10)
        
        # Esperar a que cargue la tabla
        time.sleep(5)
        
        # Buscar filas de la tabla (ajustar selectores según la página real)
        filas = driver.find_elements(By.CSS_SELECTOR, ".el-table__row, tr[class*='row'], .device-row")
        
        for fila in filas:
            try:
                columnas = fila.find_elements(By.TAG_NAME, "td")
                if len(columnas) > 0:
                    # Obtener nombre del dispositivo
                    nombre = columnas[0].text.strip()
                    if not nombre:
                        continue
                    
                    # Buscar el status (buscar en todas las columnas por texto Online/Offline)
                    status_text = fila.text
                    esta_online = "Online" in status_text or "En línea" in status_text or "Conectado" in status_text
                    
                    dispositivos.append({
                        "nombre": nombre,
                        "status": "Online" if esta_online else "Offline"
                    })
                    
            except Exception as e:
                continue
        
        print(f"✅ Encontrados {len(dispositivos)} dispositivos")
        return dispositivos
        
    except Exception as e:
        print(f"❌ Error obteniendo dispositivos: {e}")
        return []


def actualizar_supabase(supabase, dispositivos):
    """Actualiza el estado de los dispositivos en Supabase"""
    actualizados = 0
    timestamp = datetime.now().isoformat()
    
    print("💾 Actualizando base de datos...")
    
    for disp in dispositivos:
        try:
            # Buscar en la tabla Control por nombre de sucursal
            resultado = supabase.table("Control").update({
                "status": disp["status"],
                "last_check": timestamp
            }).eq("sucursal", disp["nombre"]).execute()
            
            if resultado.data:
                actualizados += 1
                icono = "🟢" if disp["status"] == "Online" else "🔴"
                print(f"   {icono} {disp['nombre']}: {disp['status']}")
                
        except Exception as e:
            print(f"   ⚠️ Error actualizando {disp['nombre']}: {e}")
    
    return actualizados


def sync_status():
    """Función principal de sincronización"""
    
    print("\n" + "="*60)
    print("   SINCRONIZACIÓN HIK-CONNECT → SUPABASE")
    print("="*60 + "\n")
    
    # Validar credenciales
    errores = []
    if not SUPABASE_KEY:
        errores.append("❌ SUPABASE_KEY no configurada")
    if not HIK_USER:
        errores.append("❌ HIK_USER no configurado")
    if not HIK_PASS:
        errores.append("❌ HIK_PASS no configurado")
    
    if errores:
        print("⚠️ ERRORES DE CONFIGURACIÓN:")
        for error in errores:
            print(f"   {error}")
        print("\n📝 Configura las variables en el archivo .env.hikvision")
        print("   o directamente en este script (líneas 25-30)")
        return
    
    print("📋 Configuración:")
    print(f"   - Supabase URL: {SUPABASE_URL}")
    print(f"   - Hik-Connect User: {HIK_USER}")
    print(f"   - Intervalo: {SYNC_INTERVAL//60} minutos")
    print()
    
    # Crear cliente de Supabase
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Conexión a Supabase establecida")
    except Exception as e:
        print(f"❌ Error conectando a Supabase: {e}")
        return
    
    # Iniciar driver
    driver = iniciar_driver()
    if not driver:
        return
    
    try:
        # Login en Hik-Connect
        if not login_hik_connect(driver):
            return
        
        while True:
            print(f"\n{'='*60}")
            print(f"🕐 Sincronización: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*60)
            
            # Obtener estados de dispositivos
            dispositivos = obtener_estados_dispositivos(driver)
            
            if dispositivos:
                # Actualizar Supabase
                actualizados = actualizar_supabase(supabase, dispositivos)
                print(f"\n✅ Sincronización completada: {actualizados} registros actualizados")
            else:
                print("⚠️ No se encontraron dispositivos para sincronizar")
            
            print(f"\n⏳ Próxima sincronización en {SYNC_INTERVAL//60} minutos...")
            print("   (Presiona Ctrl+C para detener)")
            time.sleep(SYNC_INTERVAL)
            
            # Refrescar la página para actualizar estados
            print("\n🔄 Refrescando página...")
            driver.refresh()
            time.sleep(10)
            
    except KeyboardInterrupt:
        print("\n\n✅ Sincronización detenida por el usuario")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        print("🔒 Cerrando navegador...")
        driver.quit()


# ============================================
# EJECUCIÓN DEL SCRIPT
# ============================================

if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════════════════╗
    ║     SCRIPT DE SINCRONIZACIÓN HIK-CONNECT → SUPABASE        ║
    ╠════════════════════════════════════════════════════════════╣
    ║  REQUISITOS:                                               ║
    ║  1. Python 3.8+                                            ║
    ║  2. Google Chrome instalado                                ║
    ║  3. Credenciales configuradas (ver abajo)                  ║
    ╠════════════════════════════════════════════════════════════╣
    ║  CONFIGURACIÓN:                                            ║
    ║  Opción A: Editar archivo .env.hikvision                   ║
    ║  Opción B: Editar variables en este script (líneas 25-30)  ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    sync_status()
