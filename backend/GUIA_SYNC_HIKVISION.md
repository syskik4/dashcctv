# 📋 GUÍA DE INSTALACIÓN Y USO - SYNC HIKVISION

## 🖥️ REQUISITOS PREVIOS

### 1. Python 3.8 o superior
Verificar instalación:
```bash
python --version
# o
python3 --version
```

### 2. Google Chrome instalado
- **Windows**: Descarga desde https://www.google.com/chrome/
- **Mac**: `brew install --cask google-chrome`
- **Linux (Ubuntu/Debian)**:
  ```bash
  wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo dpkg -i google-chrome-stable_current_amd64.deb
  sudo apt-get install -f
  ```

---

## 📥 PASO 1: DESCARGAR ARCHIVOS

Descarga estos dos archivos del proyecto:
- `sync_hikvision.py` (script principal)
- `.env.hikvision` (configuración)

---

## 📦 PASO 2: INSTALAR DEPENDENCIAS

Abre una terminal en la carpeta donde descargaste los archivos y ejecuta:

```bash
pip install selenium webdriver-manager supabase python-dotenv
```

O si usas pip3:
```bash
pip3 install selenium webdriver-manager supabase python-dotenv
```

---

## ⚙️ PASO 3: CONFIGURAR CREDENCIALES

### Opción A: Editar archivo .env.hikvision

Abre el archivo `.env.hikvision` y completa:

```env
# Supabase - Tu API Key
SUPABASE_URL=https://miyvtmjwcdzbftixhety.supabase.co
SUPABASE_KEY=tu_api_key_aqui  # ← Obtener de Supabase Dashboard

# Hik-Connect - Tus credenciales de login
HIK_USER=tu_usuario      # ← Tu email/usuario de Hik-Connect
HIK_PASS=tu_contraseña   # ← Tu contraseña de Hik-Connect

# Intervalo (opcional)
SYNC_INTERVAL=300  # 300 segundos = 5 minutos
```

### Dónde obtener el SUPABASE_KEY:
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a Settings → API
4. Copia el "anon public" key

### Opción B: Editar directamente el script

Si prefieres, edita las líneas 25-30 de `sync_hikvision.py`:

```python
SUPABASE_KEY = "tu_api_key_aqui"
HIK_USER = "tu_usuario"
HIK_PASS = "tu_contraseña"
```

---

## ▶️ PASO 4: EJECUTAR EL SCRIPT

### En Windows:
```bash
python sync_hikvision.py
```

### En Mac/Linux:
```bash
python3 sync_hikvision.py
```

---

## 🔄 EJECUCIÓN CONTINUA

El script se ejecutará en un loop infinito:
1. Hace login en Hik-Connect
2. Obtiene el estado de todos los dispositivos
3. Actualiza la base de datos de Supabase
4. Espera 5 minutos y repite

Para detener el script, presiona `Ctrl + C`

---

## 🖥️ EJECUTAR EN SERVIDOR (24/7)

### Opción A: Usando Screen (Linux)
```bash
# Instalar screen
sudo apt install screen

# Crear sesión
screen -S hikvision

# Ejecutar script
python3 sync_hikvision.py

# Desconectar (Ctrl+A, luego D)
# Reconectar: screen -r hikvision
```

### Opción B: Usando Systemd (Linux)
```bash
# Crear servicio
sudo nano /etc/systemd/system/hikvision-sync.service
```

Contenido del archivo:
```ini
[Unit]
Description=Hikvision Sync Service
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/al/script
ExecStart=/usr/bin/python3 /ruta/al/script/sync_hikvision.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Iniciar servicio
sudo systemctl start hikvision-sync
sudo systemctl enable hikvision-sync  # Inicio automático

# Ver logs
journalctl -u hikvision-sync -f
```

### Opción C: Tarea Programada (Windows)
1. Abre "Programador de tareas"
2. Crear tarea básica
3. Nombre: "Hikvision Sync"
4. Desencadenador: "Al iniciar el equipo"
5. Acción: Iniciar programa
6. Programa: `python` o `pythonw`
7. Argumentos: `C:\ruta\al\sync_hikvision.py`

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: Chrome not found
- Instala Google Chrome
- Verifica que esté en el PATH del sistema

### Error: Login failed
- Verifica que las credenciales sean correctas
- Revisa el archivo `error_login.png` generado

### Error: No se encontraron dispositivos
- Los selectores CSS pueden haber cambiado
- Contacta para actualizar el script

### Error: Supabase connection
- Verifica que el SUPABASE_KEY sea correcto
- Verifica conexión a internet

---

## 📞 SOPORTE

Si necesitas ayuda adicional, proporciona:
1. El mensaje de error exacto
2. El screenshot `error_login.png` (si existe)
3. Tu sistema operativo
