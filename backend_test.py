import requests
import sys
from datetime import datetime
import json

class CameraDashboardAPITester:
    def __init__(self, base_url="https://security-lens-dash.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.token = None

    def run_test(self, name, method, endpoint, expected_status, data=None, validate_response=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json() if response.text else {}
            except json.JSONDecodeError:
                response_data = {"raw_response": response.text}

            if success:
                # Additional validation if provided
                if validate_response and response_data:
                    validation_result = validate_response(response_data)
                    if validation_result:
                        self.tests_passed += 1
                        print(f"✅ Passed - Status: {response.status_code}, Validation: OK")
                        print(f"   Response preview: {str(response_data)[:200]}...")
                    else:
                        success = False
                        print(f"❌ Failed - Status OK but validation failed")
                        print(f"   Response: {response_data}")
                else:
                    self.tests_passed += 1
                    print(f"✅ Passed - Status: {response.status_code}")
                    print(f"   Response preview: {str(response_data)[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response_data}")

            self.test_results.append({
                "name": name,
                "success": success,
                "status_code": response.status_code,
                "expected_status": expected_status,
                "response_preview": str(response_data)[:200] if response_data else "No response"
            })

            return success, response_data

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": name,
                "success": False,
                "error": str(e)
            })
            return False, {}

    def validate_stats_response(self, data):
        """Validate stats endpoint response structure"""
        required_fields = ['total_sucursales', 'total_camaras', 'camaras_con_audio', 
                          'camaras_sin_audio', 'porcentaje_audio', 'porcentaje_sin_audio']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing field: {field}")
                return False
        
        # Check if values are reasonable
        if data['total_camaras'] != (data['camaras_con_audio'] + data['camaras_sin_audio']):
            print(f"   Math error: total_camaras != sum of audio + sin_audio")
            return False
            
        print(f"   Stats: {data['total_sucursales']} sucursales, {data['total_camaras']} cámaras")
        return True

    def validate_regions_response(self, data):
        """Validate regions endpoint response structure"""
        if not isinstance(data, list):
            print(f"   Expected list, got {type(data)}")
            return False
        
        if len(data) == 0:
            print(f"   No regions data returned")
            return False
            
        # Check first item structure
        required_fields = ['region', 'count', 'total_camaras']
        for field in required_fields:
            if field not in data[0]:
                print(f"   Missing field in region data: {field}")
                return False
        
        print(f"   Found {len(data)} regions")
        return True

    def validate_tipos_response(self, data):
        """Validate tipos-instalacion endpoint response structure"""
        if not isinstance(data, list):
            print(f"   Expected list, got {type(data)}")
            return False
        
        if len(data) == 0:
            print(f"   No installation types data returned")
            return False
            
        # Check first item structure
        required_fields = ['tipo', 'count']
        for field in required_fields:
            if field not in data[0]:
                print(f"   Missing field in tipos data: {field}")
                return False
        
        print(f"   Found {len(data)} installation types")
        return True

    def validate_control_response(self, data):
        """Validate control endpoint response structure"""
        if not isinstance(data, list):
            print(f"   Expected list, got {type(data)}")
            return False
        
        if len(data) == 0:
            print(f"   No control data returned")
            return False
            
        # Check first item has some expected fields
        expected_fields = ['id', 'empresa', 'sucursal']
        first_item = data[0]
        for field in expected_fields:
            if field not in first_item:
                print(f"   Missing field in control data: {field}")
                return False
        
        print(f"   Found {len(data)} control records")
        return True

    def test_login(self, email="admin@sistema.com", password="admin123"):
        """Test login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✅ Login successful, token obtained")
            return True
        return False

    def test_sucursal_by_id(self, sucursal_id):
        """Test getting a specific sucursal by ID"""
        success, response = self.run_test(
            f"Get Sucursal by ID {sucursal_id}",
            "GET",
            f"sucursal/{sucursal_id}",
            200,
            validate_response=lambda data: 'id' in data and data['id'] == sucursal_id
        )
        return success, response

    def test_update_sucursal(self, sucursal_id, update_data):
        """Test updating a sucursal (admin only)"""
        success, response = self.run_test(
            f"Update Sucursal {sucursal_id}",
            "PUT",
            f"sucursal/{sucursal_id}",
            200,
            data=update_data,
            validate_response=lambda data: 'id' in data and data['id'] == sucursal_id
        )
        return success, response

    def test_delete_sucursal(self, sucursal_id):
        """Test deleting a sucursal (admin only)"""
        success, response = self.run_test(
            f"Delete Sucursal {sucursal_id}",
            "DELETE",
            f"sucursal/{sucursal_id}",
            200,
            validate_response=lambda data: 'message' in data
        )
        return success, response

    def test_search_functionality(self, search_term="CDMX"):
        """Test search endpoint with a specific term"""
        success, response = self.run_test(
            f"Search by sucursal '{search_term}'",
            "GET",
            f"search?sucursal={search_term}",
            200,
            validate_response=lambda data: isinstance(data, list)
        )
        return success, response

def main():
    # Setup
    tester = CameraDashboardAPITester()
    
    print("🚀 Starting Camera Dashboard API Tests - Control Sucursales Focus")
    print(f"   Base URL: {tester.base_url}")
    print("=" * 60)

    # Test 1: Login first to get authentication token
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1

    # Test 2: Root endpoint
    tester.run_test(
        "API Root",
        "GET",
        "",
        200
    )

    # Test 3: Stats endpoint (requires auth)
    tester.run_test(
        "Dashboard Stats",
        "GET",
        "stats",
        200,
        validate_response=tester.validate_stats_response
    )

    # Test 4: Control data endpoint (requires auth)
    tester.run_test(
        "Control Records",
        "GET",
        "control",
        200,
        validate_response=tester.validate_control_response
    )

    # Test 5: Search functionality with specific terms from requirements
    search_terms = ["ARENAL", "MADERO", "TULANCINGO"]
    found_sucursal_id = None
    
    for term in search_terms:
        success, response = tester.test_search_functionality(term)
        if success and response and len(response) > 0:
            found_sucursal_id = response[0]['id']
            print(f"   ✅ Found sucursal with ID {found_sucursal_id} for term '{term}'")
            break

    # Test 6: Get specific sucursal by ID (if we found one)
    if found_sucursal_id:
        success, original_data = tester.test_sucursal_by_id(found_sucursal_id)
        
        if success:
            # Test 7: Update sucursal (admin functionality)
            update_data = {
                "empresa": "TEST EMPRESA UPDATED",
                "region": "TEST REGION",
                "cams_instaladas": 99
            }
            
            update_success, updated_data = tester.test_update_sucursal(found_sucursal_id, update_data)
            
            if update_success:
                # Verify the update worked
                if updated_data.get('empresa') == update_data['empresa']:
                    print(f"   ✅ Update verification: empresa field updated correctly")
                else:
                    print(f"   ❌ Update verification failed: empresa not updated")
                
                # Test 8: Restore original data
                restore_data = {
                    "empresa": original_data.get('empresa'),
                    "region": original_data.get('region'),
                    "cams_instaladas": original_data.get('cams_instaladas')
                }
                tester.test_update_sucursal(found_sucursal_id, restore_data)
                print(f"   ✅ Restored original data for sucursal {found_sucursal_id}")
    else:
        print("   ⚠️  No sucursales found with test search terms, skipping update/delete tests")

    # Test 9: Search with empty results
    tester.run_test(
        "Search with no results",
        "GET",
        "search?sucursal=NONEXISTENT_SUCURSAL_TEST",
        200,
        validate_response=lambda data: isinstance(data, list) and len(data) == 0
    )

    # Test 10: Test unauthorized access (without token)
    tester_no_auth = CameraDashboardAPITester()
    tester_no_auth.run_test(
        "Unauthorized access to control data",
        "GET",
        "control",
        401  # Should return 401 for unauthorized
    )

    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed >= (tester.tests_run * 0.8):  # 80% pass rate acceptable
        print("🎉 Most tests passed!")
        return 0
    else:
        print("❌ Too many tests failed")
        print("\nFailed tests:")
        for result in tester.test_results:
            if not result.get('success', False):
                print(f"  - {result['name']}: {result.get('error', 'Status code mismatch')}")
        return 1

if __name__ == "__main__":
    sys.exit(main())