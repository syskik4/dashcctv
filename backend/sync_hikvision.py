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

# Cargar variables de entorno
load_dotenv()

# 1. Configuración de Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://miyvtmjwcdzbftixhety.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")  # Añade tu key aquí

# 2. Configuración de Hik-Connect
HIK_USER = os.getenv("HIK_USER", "")  # Usuario de Hik-Connect
HIK_PASS = os.getenv("HIK_PASS", "")  # Contraseña de Hik-Connect
URL_HIK = "https://ius.hik-connect.com/views/main/index.html#/common/personal/DeviceManagement"

# Intervalo de sincronización en segundos (5 minutos)
SYNC_INTERVAL = 300


def iniciar_driver():
    """Inicializa el driver de Chrome con opciones configuradas"""
    options = Options()
    options.add_argument("--headless")  # Ejecutar sin interfaz gráfica
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    return driver


def login_hik_connect(driver):
    """Realiza el login en Hik-Connect"""
    try:
        driver.get(URL_HIK)
        time.sleep(5)  # Esperar a que cargue la página
        
        # Encontrar campos de login
        wait = WebDriverWait(driver, 10)
        
        # Campo de usuario
        user_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text']")))
        user_input.clear()
        user_input.send_keys(HIK_USER)
        
        # Campo de contraseña
        pass_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        pass_input.clear()
        pass_input.send_keys(HIK_PASS)
        
        # Botón de login
        login_btn = driver.find_element(By.CLASS_NAME, "login-btn")
        login_btn.click()
        
        time.sleep(10)  # Esperar a que entre al dashboard
        print("✓ Login exitoso en Hik-Connect")
        return True
        
    except Exception as e:
        print(f"✗ Error en login: {e}")
        return False


def obtener_estados_dispositivos(driver):
    """Obtiene el estado de los dispositivos desde la tabla de Hik-Connect"""
    dispositivos = []
    
    try:
        wait = WebDriverWait(driver, 10)
        
        # Buscar todas las filas de la tabla de dispositivos
        filas = driver.find_elements(By.CLASS_NAME, "el-table__row")
        
        for fila in filas:
            try:
                columnas = fila.find_elements(By.TAG_NAME, "td")
                if len(columnas) > 0:
                    nombre = columnas[0].text.strip()  # Ajustar índice según tu tabla
                    
                    # Buscar el status (ajustar índice según la columna 'Online/Offline')
                    status_col = columnas[4] if len(columnas) > 4 else columnas[-1]
                    status_text = status_col.text.strip()
                    
                    # Normalizar status
                    esta_online = "Online" in status_text or "En línea" in status_text
                    
                    dispositivos.append({
                        "nombre": nombre,
                        "status": "Online" if esta_online else "Offline"
                    })
                    
            except Exception as e:
                continue
        
        print(f"✓ Se encontraron {len(dispositivos)} dispositivos")
        return dispositivos
        
    except Exception as e:
        print(f"✗ Error obteniendo dispositivos: {e}")
        return []


def actualizar_supabase(supabase, dispositivos):
    """Actualiza el estado de los dispositivos en Supabase"""
    actualizados = 0
    
    for disp in dispositivos:
        try:
            # Buscar en la tabla Control por nombre de sucursal
            resultado = supabase.table("Control").update({
                "status": disp["status"],
                "last_check": datetime.now().isoformat()
            }).eq("sucursal", disp["nombre"]).execute()
            
            if resultado.data:
                actualizados += 1
                print(f"  ✓ {disp['nombre']}: {disp['status']}")
                
        except Exception as e:
            print(f"  ✗ Error actualizando {disp['nombre']}: {e}")
    
    return actualizados


def sync_status():
    """Función principal de sincronización"""
    
    # Validar credenciales
    if not SUPABASE_KEY:
        print("✗ Error: SUPABASE_KEY no configurada")
        return
    
    if not HIK_USER or not HIK_PASS:
        print("✗ Error: Credenciales de Hik-Connect no configuradas")
        return
    
    # Crear cliente de Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Iniciar driver
    driver = iniciar_driver()
    
    try:
        # Login en Hik-Connect
        if not login_hik_connect(driver):
            return
        
        while True:
            print(f"\n{'='*50}")
            print(f"Sincronización iniciada: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*50)
            
            # Obtener estados de dispositivos
            dispositivos = obtener_estados_dispositivos(driver)
            
            if dispositivos:
                # Actualizar Supabase
                actualizados = actualizar_supabase(supabase, dispositivos)
                print(f"\n✓ Sincronización completada. {actualizados} registros actualizados.")
            else:
                print("✗ No se encontraron dispositivos para sincronizar")
            
            print(f"Próxima sincronización en {SYNC_INTERVAL//60} minutos...")
            time.sleep(SYNC_INTERVAL)
            
            # Refrescar la página para actualizar estados
            driver.refresh()
            time.sleep(10)
            
    except KeyboardInterrupt:
        print("\n✓ Sincronización detenida por el usuario")
    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════════════╗
    ║     SCRIPT DE SINCRONIZACIÓN HIK-CONNECT → SUPABASE    ║
    ╠════════════════════════════════════════════════════════╣
    ║  Antes de ejecutar, configura las variables:           ║
    ║  - SUPABASE_URL                                        ║
    ║  - SUPABASE_KEY                                        ║
    ║  - HIK_USER                                            ║
    ║  - HIK_PASS                                            ║
    ╚════════════════════════════════════════════════════════╝
    """)
    sync_status()
