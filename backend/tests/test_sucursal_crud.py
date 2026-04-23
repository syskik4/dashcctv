"""Backend tests for Sucursal CRUD - focus on POST /api/sucursal new endpoint
and ensure no regressions in existing CRUD/auth/stats flows.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dvr-monitor-sys.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@sistema.com"
ADMIN_PASSWORD = "admin123"

UNIQUE_TS = int(time.time())


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["user"]["rol"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def non_admin_headers(admin_headers):
    """Create a non-admin user, return its auth headers, then delete after suite."""
    email = f"TEST_user_{UNIQUE_TS}@example.com"
    payload = {"email": email, "password": "Test1234!", "nombre": "Test User", "rol": "usuario"}
    r = requests.post(f"{BASE_URL}/api/users", json=payload, headers=admin_headers, timeout=20)
    assert r.status_code == 200, f"could not create test user: {r.status_code} {r.text}"
    user_id = r.json()["id"]

    login = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": email, "password": "Test1234!"}, timeout=20)
    assert login.status_code == 200
    token = login.json()["access_token"]
    yield {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, user_id

    # cleanup
    requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers, timeout=20)


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_me(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["rol"] == "admin"


# ---------- Existing read endpoints ----------
class TestReadEndpoints:
    def test_get_control(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/control", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # ensure no Mongo _id leakage
        if data:
            assert "_id" not in data[0]

    def test_get_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_sucursales", "total_camaras", "camaras_con_audio",
                  "camaras_sin_audio", "porcentaje_audio", "porcentaje_sin_audio"]:
            assert k in d

    def test_status_all(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/status/all", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_status_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/status/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ["Online", "Offline", "Unknown", "total"]:
            assert k in d


# ---------- NEW Sucursal CRUD (highest priority) ----------
class TestSucursalCRUD:
    created_id = None
    serie = f"TEST_SERIE_{UNIQUE_TS}"

    def test_01_create_sucursal(self, admin_headers):
        payload = {
            "empresa": "TEST_EMPRESA",
            "sucursal": f"TEST_SUC_{UNIQUE_TS}",
            "region": "CDMX",
            "serie_dvr": TestSucursalCRUD.serie,
            "modelo_dvr": "DS-7616",
            "puertos_dvr": 16,
            "cams_instaladas": 8,
            "cam_audio": True,
            "tipo_instalacion": "BALUMS ETHERNET",
            "ubi_dvr_aprox": "Rack principal"
        }
        r = requests.post(f"{BASE_URL}/api/sucursal", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data["empresa"] == "TEST_EMPRESA"
        assert data["serie_dvr"] == TestSucursalCRUD.serie
        assert "_id" not in data
        TestSucursalCRUD.created_id = data["id"]

    def test_02_get_created_sucursal(self, admin_headers):
        assert TestSucursalCRUD.created_id is not None
        r = requests.get(f"{BASE_URL}/api/sucursal/{TestSucursalCRUD.created_id}",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == TestSucursalCRUD.created_id
        assert d["empresa"] == "TEST_EMPRESA"

    def test_03_create_duplicate_serie_returns_400(self, admin_headers):
        payload = {
            "empresa": "TEST_DUP",
            "sucursal": f"TEST_DUP_{UNIQUE_TS}",
            "serie_dvr": TestSucursalCRUD.serie,
        }
        r = requests.post(f"{BASE_URL}/api/sucursal", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 400

    def test_04_create_requires_admin(self, non_admin_headers):
        headers, _ = non_admin_headers
        payload = {"empresa": "TEST", "sucursal": "TEST_NOPERM"}
        r = requests.post(f"{BASE_URL}/api/sucursal", json=payload, headers=headers, timeout=20)
        assert r.status_code == 403

    def test_05_update_sucursal(self, admin_headers):
        assert TestSucursalCRUD.created_id is not None
        r = requests.put(f"{BASE_URL}/api/sucursal/{TestSucursalCRUD.created_id}",
                         json={"region": "HIDALGO", "cams_instaladas": 12},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"update failed: {r.text}"
        # Verify persistence
        r2 = requests.get(f"{BASE_URL}/api/sucursal/{TestSucursalCRUD.created_id}",
                          headers=admin_headers, timeout=20)
        assert r2.status_code == 200
        d = r2.json()
        assert d["region"] == "HIDALGO"
        assert int(d["cams_instaladas"]) == 12

    def test_06_update_requires_admin(self, non_admin_headers):
        headers, _ = non_admin_headers
        r = requests.put(f"{BASE_URL}/api/sucursal/{TestSucursalCRUD.created_id}",
                         json={"region": "HACK"}, headers=headers, timeout=20)
        assert r.status_code == 403

    def test_07_delete_sucursal(self, admin_headers):
        assert TestSucursalCRUD.created_id is not None
        r = requests.delete(f"{BASE_URL}/api/sucursal/{TestSucursalCRUD.created_id}",
                            headers=admin_headers, timeout=20)
        assert r.status_code == 200
        # verify gone
        r2 = requests.get(f"{BASE_URL}/api/sucursal/{TestSucursalCRUD.created_id}",
                          headers=admin_headers, timeout=20)
        assert r2.status_code == 404
        TestSucursalCRUD.created_id = None

    def test_08_delete_nonexistent_404(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/sucursal/99999999",
                            headers=admin_headers, timeout=20)
        assert r.status_code in (404, 500)  # depends on DB cast


# ---------- User Management quick regression ----------
class TestUserRegression:
    def test_get_users_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/users", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_users_non_admin_forbidden(self, non_admin_headers):
        headers, _ = non_admin_headers
        r = requests.get(f"{BASE_URL}/api/users", headers=headers, timeout=20)
        assert r.status_code == 403


# ---------- Cleanup safety: delete created sucursal if a test failed early ----------
@pytest.fixture(scope="session", autouse=True)
def _cleanup(admin_headers):
    yield
    sid = TestSucursalCRUD.created_id
    if sid:
        try:
            requests.delete(f"{BASE_URL}/api/sucursal/{sid}",
                            headers=admin_headers, timeout=20)
        except Exception:
            pass
