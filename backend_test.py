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

    def test_search_functionality(self, search_term="CDMX"):
        """Test search endpoint with a specific term"""
        success, response = self.run_test(
            f"Search by sucursal '{search_term}'",
            "GET",
            f"search?sucursal={search_term}",
            200,
            validate_response=lambda data: isinstance(data, list)
        )
        return success

def main():
    # Setup
    tester = CameraDashboardAPITester()
    
    print("🚀 Starting Camera Dashboard API Tests")
    print(f"   Base URL: {tester.base_url}")
    print("=" * 60)

    # Test 1: Root endpoint
    tester.run_test(
        "API Root",
        "GET",
        "",
        200
    )

    # Test 2: Stats endpoint
    tester.run_test(
        "Dashboard Stats",
        "GET",
        "stats",
        200,
        validate_response=tester.validate_stats_response
    )

    # Test 3: Regions endpoint
    tester.run_test(
        "Regions Data",
        "GET",
        "regions",
        200,
        validate_response=tester.validate_regions_response
    )

    # Test 4: Installation types endpoint
    tester.run_test(
        "Installation Types",
        "GET",
        "tipos-instalacion",
        200,
        validate_response=tester.validate_tipos_response
    )

    # Test 5: Control data endpoint
    tester.run_test(
        "Control Records",
        "GET",
        "control",
        200,
        validate_response=tester.validate_control_response
    )

    # Test 6: Search functionality
    tester.test_search_functionality("CDMX")
    tester.test_search_functionality("HIDALGO")

    # Test 7: Search with empty results
    tester.run_test(
        "Search with no results",
        "GET",
        "search?sucursal=NONEXISTENT",
        200,
        validate_response=lambda data: isinstance(data, list)
    )

    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        print("\nFailed tests:")
        for result in tester.test_results:
            if not result.get('success', False):
                print(f"  - {result['name']}: {result.get('error', 'Status code mismatch')}")
        return 1

if __name__ == "__main__":
    sys.exit(main())