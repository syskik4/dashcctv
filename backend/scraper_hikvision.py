"""
Script de Scraping Hik-Connect → Supabase
Extrae dispositivos de Hik-Connect y actualiza su status en Supabase usando
SQLAlchemy (pooler) directamente - NO requiere SUPABASE_KEY.
Usa cookies para mantener la sesión y evitar logins repetidos.
"""

import os
import json
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
from dotenv import load_dotenv

from db_sync import get_engine, bulk_update_devices

# Cargar variables de entorno (backend/.env + .env.hikvision si existe)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
if (ROOT_DIR / '.env.hikvision').exists():
    load_dotenv(ROOT_DIR / '.env.hikvision', override=False)

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rutas de archivos
COOKIES_FILE = ROOT_DIR / "cookies_hik.json"

# URLs de Hik-Connect
LOGIN_URL = "https://ius.hik-connect.com/views/login/index.html#/login"
DEVICE_MANAGEMENT_URL = "https://ius.hik-connect.com/views/main/index.html#/common/personal/DeviceManagement"
BASE_URL = "https://ius.hik-connect.com"

# Configuración
HIK_USER = os.getenv("HIK_USER", "")
HIK_PASS = os.getenv("HIK_PASS", "")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "300"))


# ---------------------------------------------------------------------------
# Configuración del driver
# ---------------------------------------------------------------------------

def setup_driver():
    """Configura el navegador Chrome con opciones anti-detección."""
    logger.info("🔧 Configurando navegador Chrome...")
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
    chrome_options.add_experimental_option('useAutomationExtension', False)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    logger.info("✅ Navegador iniciado correctamente")
    return driver


# ---------------------------------------------------------------------------
# Gestión de cookies
# ---------------------------------------------------------------------------

def save_cookies(driver, path: Path = COOKIES_FILE):
    """Guarda las cookies actuales del driver en disco."""
    try:
        cookies = driver.get_cookies()
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(cookies, f, indent=2, ensure_ascii=False)
        logger.info(f"✅ Cookies guardadas ({len(cookies)} cookies)")
    except Exception as e:
        logger.warning(f"⚠️ No se pudieron guardar las cookies: {e}")


def load_cookies(driver, path: Path = COOKIES_FILE) -> bool:
    """Carga cookies desde disco e intenta restaurar la sesión."""
    if not path.exists():
        logger.info("📝 No existe archivo de cookies previo.")
        return False
    try:
        with open(path, 'r', encoding='utf-8') as f:
            cookies = json.load(f)

        driver.get(BASE_URL)
        time.sleep(2)

        for cookie in cookies:
            cookie.pop('expiry', None)
            try:
                driver.add_cookie(cookie)
            except Exception:
                pass

        logger.info(f"✅ Cookies cargadas ({len(cookies)} cookies)")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Error al cargar cookies: {e}")
        return False


def delete_cookies_file(path: Path = COOKIES_FILE):
    """Borra el archivo de cookies."""
    try:
        if path.exists():
            path.unlink()
            logger.info("🗑️ Archivo de cookies eliminado (sesión inválida)")
    except Exception as e:
        logger.warning(f"⚠️ No se pudo eliminar el archivo de cookies: {e}")


def is_session_valid(driver) -> bool:
    """Verifica si la sesión cargada vía cookies sigue activa."""
    try:
        driver.get(DEVICE_MANAGEMENT_URL)
        time.sleep(4)
        if "login" in driver.current_url.lower():
            logger.info("⏰ Sesión de cookies expirada (redirigió al login)")
            return False
        logger.info("✅ Sesión restaurada por cookies es válida")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Error al verificar sesión: {e}")
        return False


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def accept_cookies(driver, wait):
    """Acepta el banner de cookies del sitio si está presente."""
    cookie_selectors = [
        "//div[contains(@class, 'app-cookie-container')]//button",
        "//button[contains(text(), 'Accept')]",
        "//button[contains(text(), 'Aceptar')]",
        "//div[contains(@class, 'cookie')]//button",
    ]
    for selector in cookie_selectors:
        try:
            btn = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.XPATH, selector))
            )
            btn.click()
            logger.info("✅ Banner de cookies aceptado")
            time.sleep(1)
            return True
        except TimeoutException:
            continue
    return False


def login(driver, wait, username, password) -> bool:
    """Realiza el login con usuario y contraseña."""
    try:
        logger.info("🔐 Intentando login con credenciales...")
        driver.get(LOGIN_URL)
        time.sleep(3)

        accept_cookies(driver, WebDriverWait(driver, 5))

        # Campo usuario
        username_selectors = [
            (By.CSS_SELECTOR, "input.el-input__inner[placeholder*='Account']"),
            (By.CSS_SELECTOR, "input.el-input__inner[placeholder*='Email']"),
            (By.CSS_SELECTOR, ".el-form-item:first-child input.el-input__inner"),
            (By.CSS_SELECTOR, "input[autocomplete='off'][title='Account/Email']"),
            (By.XPATH, "//input[contains(@placeholder, 'Account') or contains(@placeholder, 'Email')]"),
            (By.CSS_SELECTOR, ".el-input.el-input--prefix input"),
        ]
        username_field = None
        for sel_type, sel in username_selectors:
            try:
                username_field = wait.until(EC.presence_of_element_located((sel_type, sel)))
                if username_field:
                    break
            except TimeoutException:
                continue

        if not username_field:
            inputs = driver.find_elements(By.CSS_SELECTOR, "input.el-input__inner")
            for inp in inputs:
                if inp.is_displayed():
                    username_field = inp
                    break

        if not username_field:
            raise Exception("No se encontró el campo de usuario.")

        # Campo contraseña
        password_selectors = [
            (By.CSS_SELECTOR, "input.el-input__inner[type='password']"),
            (By.CSS_SELECTOR, "input[placeholder='Password']"),
            (By.XPATH, "//input[@type='password']"),
        ]
        password_field = None
        for sel_type, sel in password_selectors:
            try:
                password_field = driver.find_element(sel_type, sel)
                if password_field:
                    break
            except NoSuchElementException:
                continue

        if not password_field:
            raise Exception("No se encontró el campo de contraseña.")

        # Ingresar credenciales
        username_field.clear()
        username_field.send_keys(username)
        time.sleep(0.5)
        password_field.clear()
        password_field.send_keys(password)
        time.sleep(0.5)

        # Botón login
        login_btn_selectors = [
            (By.CSS_SELECTOR, "button.el-button.login-form-button"),
            (By.CSS_SELECTOR, "button.el-button--default[title='Login']"),
            (By.XPATH, "//button[contains(@class, 'login-form-button')]"),
            (By.XPATH, "//button[.//span[text()='Login']]"),
            (By.CSS_SELECTOR, ".el-form button.el-button"),
        ]
        login_btn = None
        for sel_type, sel in login_btn_selectors:
            try:
                btn = driver.find_element(sel_type, sel)
                if btn and btn.is_displayed():
                    login_btn = btn
                    break
            except NoSuchElementException:
                continue

        if login_btn:
            login_btn.click()
        else:
            password_field.submit()
        
        logger.info("📤 Formulario de login enviado")
        time.sleep(5)

        if "login" not in driver.current_url.lower() or "main" in driver.current_url.lower():
            logger.info("✅ Login exitoso")
            save_cookies(driver)
            return True
        else:
            logger.warning("⚠️ Posible fallo en login")
            return True

    except Exception as e:
        logger.error(f"❌ Error durante el login: {e}")
        return False


# ---------------------------------------------------------------------------
# Navegación y extracción
# ---------------------------------------------------------------------------

def navigate_to_device_management(driver, wait) -> bool:
    """Navega a la página de Device Management."""
    try:
        logger.info("🌐 Navegando a Device Management...")
        driver.get(DEVICE_MANAGEMENT_URL)
        time.sleep(3)
        wait.until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".el-table, .device-management-table, table")
            )
        )
        logger.info("✅ Página Device Management cargada")
        return True
    except Exception as e:
        logger.error(f"❌ Error al navegar a Device Management: {e}")
        return False


def click_load_more(driver, wait):
    """Hace clic en 'Load More' hasta que no haya más botón visible."""
    clicks = 0
    max_clicks = 20
    while clicks < max_clicks:
        try:
            load_more_selectors = [
                (By.XPATH, "//span[contains(text(), 'Load More')]"),
                (By.XPATH, "//a[contains(text(), 'Load More')]"),
                (By.XPATH, "//button[contains(text(), 'Load More')]"),
                (By.CSS_SELECTOR, ".load-more, [class*='load-more']"),
            ]
            load_more_btn = None
            for sel_type, sel in load_more_selectors:
                try:
                    for elem in driver.find_elements(sel_type, sel):
                        if elem.is_displayed():
                            load_more_btn = elem
                            break
                    if load_more_btn:
                        break
                except Exception:
                    continue

            if load_more_btn and load_more_btn.is_displayed():
                driver.execute_script("arguments[0].scrollIntoView();", load_more_btn)
                time.sleep(0.5)
                driver.execute_script("arguments[0].click();", load_more_btn)
                clicks += 1
                logger.info(f"📜 Clic en 'Load More' #{clicks}")
                time.sleep(2)
            else:
                break
        except Exception:
            break
    return clicks


def extract_devices(driver, wait):
    """Extrae los dispositivos de la tabla de Device Management."""
    devices = []
    try:
        time.sleep(5)
        rows = driver.find_elements(By.CSS_SELECTOR, ".el-table__row")
        logger.info(f"📊 Filas encontradas: {len(rows)}")
        
        for idx, row in enumerate(rows):
            try:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) >= 5:
                    alias = cells[0].text.strip()
                    domain = cells[1].text.strip()
                    serial_no = cells[2].text.strip()  # Device Serial No.
                    ip_port = cells[3].text.strip()
                    raw_status = cells[4].text.strip().lower()
                    status = "Online" if ("online" in raw_status or "en línea" in raw_status) else "Offline"
                    
                    devices.append({
                        "alias": alias,
                        "domain": domain,
                        "serie_dvr": serial_no,
                        "ip_port": ip_port,
                        "status": status,
                        "last_check": datetime.now(timezone.utc).isoformat()
                    })
                    
                    icono = "🟢" if status == "Online" else "🔴"
                    logger.info(f"   {icono} {alias} ({serial_no}): {status}")
            except Exception:
                continue
    except Exception as e:
        logger.error(f"❌ Error en extracción: {e}")
    return devices


# ---------------------------------------------------------------------------
# Actualización en Supabase
# ---------------------------------------------------------------------------

def update_supabase(engine, devices):
    """Actualiza dispositivos en Supabase usando SQLAlchemy (pooler)."""
    logger.info("\n💾 Actualizando Supabase via SQLAlchemy...")
    logger.info("-" * 60)
    resultado = bulk_update_devices(engine, devices)
    logger.info("-" * 60)
    logger.info(
        "📊 Resumen: %s actualizados, %s no encontrados",
        resultado["actualizados"],
        resultado["no_encontrados"],
    )
    if resultado["dispositivos_no_encontrados"]:
        logger.info("⚠️ No encontrados en Supabase:")
        for d in resultado["dispositivos_no_encontrados"]:
            logger.info("   - %s (Serial: %s)", d.get("alias", ""), d.get("serie_dvr", ""))
    return resultado


# ---------------------------------------------------------------------------
# Función principal
# ---------------------------------------------------------------------------

def run_scraper():
    """Función principal del scraper."""
    
    print("\n" + "="*60)
    print("   SCRAPER HIK-CONNECT → SUPABASE")
    print("   (Con persistencia de sesión mediante cookies)")
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
        print("\n📝 Configure las variables en backend/.env y .env.hikvision")
        return None
    
    print("📋 Configuración:")
    print(f"   - DB: Supabase via SQLAlchemy (pooler, usa DATABASE_URL)")
    print(f"   - Hik-Connect User: {HIK_USER}")
    print(f"   - Intervalo: {SYNC_INTERVAL//60} minutos")
    print()
    
    # Conectar a Supabase vía SQLAlchemy (NO requiere SUPABASE_KEY)
    try:
        engine = get_engine()
        logger.info("✅ Conexión a Supabase establecida (SQLAlchemy)")
    except Exception as e:
        logger.error(f"❌ Error conectando a Supabase: {e}")
        return None
    
    driver = None
    try:
        driver = setup_driver()
        wait = WebDriverWait(driver, 15)

        # Plan A: restaurar sesión con cookies
        session_ok = False
        if load_cookies(driver):
            session_ok = is_session_valid(driver)
            if not session_ok:
                delete_cookies_file()

        # Plan B: login completo
        if not session_ok:
            logger.info("🔄 Ejecutando login completo...")
            if not login(driver, wait, HIK_USER, HIK_PASS):
                logger.error("❌ Fallo en el login. Abortando.")
                return None
            if not navigate_to_device_management(driver, wait):
                logger.warning("⚠️ No se pudo navegar a Device Management")
        else:
            try:
                wait.until(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, ".el-table, .device-management-table, table")
                    )
                )
            except TimeoutException:
                navigate_to_device_management(driver, wait)

        # Loop de sincronización
        while True:
            print(f"\n{'='*60}")
            print(f"🕐 Sincronización: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*60)
            
            click_load_more(driver, wait)
            devices = extract_devices(driver, wait)

            if devices:
                result = update_supabase(engine, devices)
                print(f"\n✅ Sincronización completada: {result['actualizados']} actualizados")
            else:
                print("⚠️ No se encontraron dispositivos")

            print(f"\n⏳ Próxima sincronización en {SYNC_INTERVAL//60} minutos...")
            print("   (Presiona Ctrl+C para detener)")
            time.sleep(SYNC_INTERVAL)
            
            driver.refresh()
            time.sleep(10)

    except KeyboardInterrupt:
        print("\n\n✅ Scraper detenido por el usuario")
    except Exception as e:
        logger.error(f"❌ Error general: {e}")
    finally:
        if driver:
            try:
                driver.quit()
                logger.info("🔒 Navegador cerrado")
            except Exception:
                pass


if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════════════════╗
    ║     SCRAPER HIK-CONNECT → SUPABASE                         ║
    ║     Con persistencia de sesión (cookies)                   ║
    ╠════════════════════════════════════════════════════════════╣
    ║  CONFIGURACIÓN:                                            ║
    ║  - DATABASE_URL (en backend/.env - ya configurado)         ║
    ║  - HIK_USER     (en .env.hikvision)                        ║
    ║  - HIK_PASS     (en .env.hikvision)                        ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    run_scraper()
