import requests
import sys
import json
from datetime import datetime, timezone, timedelta

class ArtistCalendarAPITester:
    def __init__(self, base_url="https://gig-planner.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.artist_token = None
        self.artist2_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, message="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {message}")
        
        self.test_results.append({
            'name': name,
            'success': success,
            'message': message,
            'response_data': response_data
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = response.text

            if success:
                self.log_test(name, True, f"Status: {response.status_code}", response_data)
                return True, response_data
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}. Response: {response_data}")
                return False, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@demo.app", "password": "demo123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            return True
        return False

    def test_artist_login(self):
        """Test artist login"""
        success, response = self.run_test(
            "Artist Login (DJ Alex)",
            "POST",
            "auth/login",
            200,
            data={"email": "dj.alex@demo.app", "password": "demo123"}
        )
        if success and 'access_token' in response:
            self.artist_token = response['access_token']
            return True
        return False

    def test_artist2_login(self):
        """Test second artist login"""
        success, response = self.run_test(
            "Artist Login (Marie Beats)",
            "POST",
            "auth/login",
            200,
            data={"email": "marie.beats@demo.app", "password": "demo123"}
        )
        if success and 'access_token' in response:
            self.artist2_token = response['access_token']
            return True
        return False

    def test_auth_me(self, token, expected_role, test_name):
        """Test /auth/me endpoint"""
        headers = {'Authorization': f'Bearer {token}'}
        success, response = self.run_test(
            f"Get Current User ({test_name})",
            "GET",
            "auth/me",
            200,
            headers=headers
        )
        if success and response.get('role') == expected_role:
            return True
        return False

    def test_artist_profile_operations(self):
        """Test artist profile CRUD operations"""
        if not self.artist_token:
            self.log_test("Artist Profile Operations", False, "No artist token available")
            return False

        headers = {'Authorization': f'Bearer {self.artist_token}'}
        
        # Test get profile
        success, profile = self.run_test(
            "Get Artist Profile",
            "GET",
            "profile",
            200,
            headers=headers
        )
        
        if success:
            # Test update profile
            update_data = {
                "nom_de_scene": "DJ Alex Updated",
                "telephone": "+33123456789",
                "lien": "https://djalex.com"
            }
            success, _ = self.run_test(
                "Update Artist Profile",
                "POST",
                "profile",
                200,
                data=update_data,
                headers=headers
            )
            return success
        
        return False

    def test_availability_day_operations(self):
        """Test new availability day operations (full days only)"""
        if not self.artist_token:
            self.log_test("Availability Day Operations", False, "No artist token available")
            return False

        headers = {'Authorization': f'Bearer {self.artist_token}'}
        
        # Test toggle availability day (add)
        tomorrow = (datetime.now() + timedelta(days=1)).date()
        toggle_data = {
            "date": tomorrow.isoformat(),
            "note": "Test availability day",
            "color": "#3b82f6"
        }
        
        success, toggle_response = self.run_test(
            "Toggle Availability Day (Add)",
            "POST",
            "availability-days/toggle",
            200,
            data=toggle_data,
            headers=headers
        )
        
        if not success:
            return False
        
        # Verify it was added
        if toggle_response.get('action') != 'added' or not toggle_response.get('available'):
            self.log_test("Toggle Availability Day (Add)", False, f"Unexpected response: {toggle_response}")
            return False
        
        # Get availability days
        success, availability_days = self.run_test(
            "Get Artist Availability Days",
            "GET",
            "availability-days",
            200,
            headers=headers
        )
        
        if not success:
            return False
        
        # Test toggle availability day (remove)
        success, toggle_response = self.run_test(
            "Toggle Availability Day (Remove)",
            "POST",
            "availability-days/toggle",
            200,
            data={"date": tomorrow.isoformat()},
            headers=headers
        )
        
        if not success:
            return False
        
        # Verify it was removed
        if toggle_response.get('action') != 'removed' or toggle_response.get('available'):
            self.log_test("Toggle Availability Day (Remove)", False, f"Unexpected response: {toggle_response}")
            return False
        
        return True

    def test_availability_day_validation(self):
        """Test availability day validation rules"""
        if not self.artist_token:
            self.log_test("Availability Day Validation", False, "No artist token available")
            return False

        headers = {'Authorization': f'Bearer {self.artist_token}'}
        
        # Test past date (should fail)
        yesterday = (datetime.now() - timedelta(days=1)).date()
        past_date_data = {
            "date": yesterday.isoformat(),
            "note": "Should fail - past date"
        }
        
        success, _ = self.run_test(
            "Toggle Past Date (Should Fail)",
            "POST",
            "availability-days/toggle",
            400,  # Should fail with 400
            data=past_date_data,
            headers=headers
        )
        
        if not success:
            return False
        
        # Test too far future date (should fail)
        far_future = (datetime.now() + timedelta(days=19*30)).date()  # 19 months
        far_future_data = {
            "date": far_future.isoformat(),
            "note": "Should fail - too far in future"
        }
        
        success, _ = self.run_test(
            "Toggle Far Future Date (Should Fail)",
            "POST",
            "availability-days/toggle",
            400,  # Should fail with 400
            data=far_future_data,
            headers=headers
        )
        
        return success

    def test_availability_day_admin_view(self):
        """Test admin view of availability days"""
        if not self.admin_token:
            self.log_test("Admin Availability Day View", False, "No admin token available")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Get all availability days (admin view)
        success, availability_days = self.run_test(
            "Get All Availability Days (Admin)",
            "GET",
            "availability-days",
            200,
            headers=headers
        )
        
        if not success:
            return False
        
        # Test get artists available on specific date
        test_date = "2024-09-23"  # From the test data mentioned
        success, artists = self.run_test(
            "Get Artists Available on Date",
            "GET",
            f"availability-days/{test_date}",
            200,
            headers=headers
        )
        
        return success

    def test_csv_export(self):
        """Test CSV export functionality"""
        if not self.admin_token:
            self.log_test("CSV Export", False, "No admin token available")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test CSV export
        success, csv_data = self.run_test(
            "Export CSV",
            "GET",
            "export/csv",
            200,
            headers=headers
        )
        
        if success and 'csv_content' in csv_data:
            return True
        
        return False

    def test_admin_operations(self):
        """Test admin-only operations"""
        if not self.admin_token:
            self.log_test("Admin Operations", False, "No admin token available")
            return False

        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Get all artists
        success, artists = self.run_test(
            "Get All Artists (Admin)",
            "GET",
            "artists",
            200,
            headers=headers
        )
        
        if not success:
            return False
        
        # Get all availability days (admin view)
        success, availability_days = self.run_test(
            "Get All Availability Days (Admin)",
            "GET",
            "availability-days",
            200,
            headers=headers
        )
        
        if not success:
            return False
        
        # Create invitation
        invitation_data = {
            "email": f"test.artist.{datetime.now().strftime('%H%M%S')}@demo.app"
        }
        
        success, invitation = self.run_test(
            "Create Invitation",
            "POST",
            "invitations",
            200,
            data=invitation_data,
            headers=headers
        )
        
        if not success:
            return False
        
        # Get invitations
        success, invitations = self.run_test(
            "Get Invitations",
            "GET",
            "invitations",
            200,
            headers=headers
        )
        
        return success

    def test_security_permissions(self):
        """Test security and permission restrictions"""
        if not self.artist_token or not self.admin_token:
            self.log_test("Security Tests", False, "Missing tokens")
            return False

        artist_headers = {'Authorization': f'Bearer {self.artist_token}'}
        
        # Test artist trying to access admin endpoints
        success, _ = self.run_test(
            "Artist Access to Admin Artists Endpoint (Should Fail)",
            "GET",
            "artists",
            403,  # Should be forbidden
            headers=artist_headers
        )
        
        if not success:
            return False
        
        success, _ = self.run_test(
            "Artist Access to Invitations (Should Fail)",
            "GET",
            "invitations",
            403,  # Should be forbidden
            headers=artist_headers
        )
        
        return success

    def test_invitation_verification(self):
        """Test invitation token verification"""
        # Test with invalid token
        success, _ = self.run_test(
            "Verify Invalid Invitation Token",
            "GET",
            "invitations/verify/invalid-token-123",
            400,  # Should fail
        )
        
        return success

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Artist Calendar API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests
        if not self.test_admin_login():
            print("❌ Admin login failed, stopping tests")
            return False
        
        if not self.test_artist_login():
            print("❌ Artist login failed, stopping tests")
            return False
        
        if not self.test_artist2_login():
            print("❌ Second artist login failed, continuing with other tests")
        
        # Test auth/me endpoints
        self.test_auth_me(self.admin_token, "admin", "Admin")
        self.test_auth_me(self.artist_token, "artist", "Artist")
        
        # Test artist operations
        self.test_artist_profile_operations()
        self.test_availability_day_operations()
        self.test_availability_day_validation()
        
        # Test admin operations
        self.test_admin_operations()
        self.test_availability_day_admin_view()
        self.test_csv_export()
        
        # Test security
        self.test_security_permissions()
        
        # Test invitation verification
        self.test_invitation_verification()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['name']}: {test['message']}")
        
        print("\n" + "=" * 60)

def main():
    tester = ArtistCalendarAPITester()
    
    try:
        tester.run_all_tests()
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
    finally:
        tester.print_summary()
    
    # Return exit code based on test results
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())