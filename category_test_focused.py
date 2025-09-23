#!/usr/bin/env python3
"""
Focused test for Artist Category Update functionality
Tests the complete data flow as requested in the review.
"""

import requests
import json
from datetime import datetime, timezone, timedelta

class CategoryUpdateTester:
    def __init__(self, base_url="https://gig-calendar-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.artist_token = None
        self.test_artist_id = None
        self.test_artist_email = None
        self.invitation_token = None

    def log_result(self, test_name, success, message="", data=None):
        """Log test result with details"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if message:
            print(f"    {message}")
        if data and isinstance(data, dict):
            print(f"    Data: {json.dumps(data, indent=2)}")
        print()

    def make_request(self, method, endpoint, data=None, headers=None, expected_status=200):
        """Make HTTP request and return success, response"""
        url = f"{self.api_url}/{endpoint}"
        request_headers = {'Content-Type': 'application/json'}
        if headers:
            request_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=request_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=request_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=request_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=request_headers)

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = response.text

            return success, response_data, response.status_code

        except Exception as e:
            return False, str(e), 0

    def setup_admin_login(self):
        """Login as admin"""
        print("🔐 Setting up admin login...")
        success, response, status = self.make_request(
            'POST', 'auth/login',
            data={"email": "admin@easybookevent.com", "password": "AdminSecure2024!"}
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.log_result("Admin Login", True, "Successfully logged in as admin")
            return True
        else:
            self.log_result("Admin Login", False, f"Failed with status {status}: {response}")
            return False

    def create_test_artist(self):
        """Create a test artist via invitation system"""
        print("👤 Creating test artist...")
        
        # Create unique email for test artist
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.test_artist_email = f"category.test.{timestamp}@easybookevent.com"
        
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Step 1: Create invitation
        success, invitation_response, status = self.make_request(
            'POST', 'invitations',
            data={"email": self.test_artist_email},
            headers=admin_headers
        )
        
        if not success:
            self.log_result("Create Invitation", False, f"Failed with status {status}: {invitation_response}")
            return False
        
        self.invitation_token = invitation_response.get('token')
        self.log_result("Create Invitation", True, f"Created invitation for {self.test_artist_email}")
        
        # Step 2: Register artist using invitation token
        success, register_response, status = self.make_request(
            'POST', f'auth/register?token={self.invitation_token}',
            data={
                "email": self.test_artist_email,
                "password": "testpassword123",
                "timezone": "Europe/Paris"
            }
        )
        
        if not success:
            self.log_result("Register Artist", False, f"Failed with status {status}: {register_response}")
            return False
        
        self.test_artist_id = register_response.get('id')
        self.log_result("Register Artist", True, f"Registered artist with ID: {self.test_artist_id}")
        
        # Step 3: Login as artist
        success, login_response, status = self.make_request(
            'POST', 'auth/login',
            data={"email": self.test_artist_email, "password": "testpassword123"}
        )
        
        if success and 'access_token' in login_response:
            self.artist_token = login_response['access_token']
            self.log_result("Artist Login", True, "Successfully logged in as artist")
            return True
        else:
            self.log_result("Artist Login", False, f"Failed with status {status}: {login_response}")
            return False

    def create_artist_profile(self):
        """Create artist profile"""
        print("📝 Creating artist profile...")
        
        artist_headers = {'Authorization': f'Bearer {self.artist_token}'}
        
        success, profile_response, status = self.make_request(
            'POST', 'profile',
            data={
                "nom_de_scene": "Test Category Artist",
                "telephone": "+33123456789",
                "lien": "https://testartist.com",
                "tarif_soiree": "500€",
                "bio": "Test artist for category update functionality"
            },
            headers=artist_headers
        )
        
        if success:
            self.log_result("Create Artist Profile", True, "Profile created successfully")
            return True
        else:
            self.log_result("Create Artist Profile", False, f"Failed with status {status}: {profile_response}")
            return False

    def test_category_update_endpoints(self):
        """Test the PATCH endpoint for category updates"""
        print("🎯 Testing Category Update Endpoints...")
        
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test 1: Update category to DJ
        success, dj_response, status = self.make_request(
            'PATCH', f'artists/{self.test_artist_id}/category',
            data={"category": "DJ"},
            headers=admin_headers
        )
        
        if success and dj_response.get('category') == 'DJ':
            self.log_result("Update Category to DJ", True, "Category successfully updated to DJ", dj_response)
        else:
            self.log_result("Update Category to DJ", False, f"Failed with status {status}: {dj_response}")
            return False
        
        # Test 2: Update category to Groupe
        success, groupe_response, status = self.make_request(
            'PATCH', f'artists/{self.test_artist_id}/category',
            data={"category": "Groupe"},
            headers=admin_headers
        )
        
        if success and groupe_response.get('category') == 'Groupe':
            self.log_result("Update Category to Groupe", True, "Category successfully updated to Groupe", groupe_response)
        else:
            self.log_result("Update Category to Groupe", False, f"Failed with status {status}: {groupe_response}")
            return False
        
        # Test 3: Test invalid category
        success, invalid_response, status = self.make_request(
            'PATCH', f'artists/{self.test_artist_id}/category',
            data={"category": "InvalidCategory"},
            headers=admin_headers,
            expected_status=400
        )
        
        if success:
            self.log_result("Invalid Category Test", True, "Correctly rejected invalid category", invalid_response)
        else:
            self.log_result("Invalid Category Test", False, f"Should have failed with 400, got {status}: {invalid_response}")
            return False
        
        return True

    def find_available_date(self):
        """Find an available date that's not blocked"""
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Get blocked dates
        success, blocked_dates, status = self.make_request(
            'GET', 'blocked-dates',
            headers=admin_headers
        )
        
        blocked_date_list = []
        if success:
            blocked_date_list = [bd.get('date') for bd in blocked_dates if bd.get('date')]
        
        # Try dates starting from 7 days from now
        for days_ahead in range(7, 30):  # Try up to 30 days ahead
            test_date = (datetime.now() + timedelta(days=days_ahead)).date()
            if test_date.isoformat() not in blocked_date_list:
                return test_date
        
        # If no available date found, return None
        return None

    def create_test_availability(self):
        """Create a test availability for the artist"""
        print("📅 Creating test availability...")
        
        artist_headers = {'Authorization': f'Bearer {self.artist_token}'}
        
        # Find an available date
        available_date = self.find_available_date()
        if not available_date:
            self.log_result("Create Test Availability", False, "No available dates found (all blocked)")
            return False
        
        success, availability_response, status = self.make_request(
            'POST', 'availability-days/toggle',
            data={
                "date": available_date.isoformat(),
                "note": "Test availability for category testing",
                "color": "#3b82f6"
            },
            headers=artist_headers
        )
        
        if success and availability_response.get('action') == 'added':
            self.log_result("Create Test Availability", True, f"Created availability for {available_date}", availability_response)
            return True
        else:
            self.log_result("Create Test Availability", False, f"Failed with status {status}: {availability_response}")
            return False

    def test_availability_days_category_field(self):
        """Test that availability-days endpoint returns artist_category field"""
        print("🔍 Testing availability-days endpoint for category field...")
        
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        success, availability_days, status = self.make_request(
            'GET', 'availability-days',
            headers=admin_headers
        )
        
        if not success:
            self.log_result("Get Availability Days", False, f"Failed with status {status}: {availability_days}")
            return False
        
        # Find our test artist's availability
        test_artist_availability = None
        for day in availability_days:
            if day.get('artist_id') == self.test_artist_id:
                test_artist_availability = day
                break
        
        if not test_artist_availability:
            self.log_result("Find Test Artist Availability", False, "No availability found for test artist")
            return False
        
        # Check if artist_category field exists
        if 'artist_category' in test_artist_availability:
            category = test_artist_availability.get('artist_category')
            self.log_result("Artist Category Field Present", True, f"Found artist_category: {category}", test_artist_availability)
            return True
        else:
            self.log_result("Artist Category Field Present", False, "artist_category field missing", test_artist_availability)
            return False

    def test_data_flow_synchronization(self):
        """Test complete data flow: create availability -> update category -> verify sync"""
        print("🔄 Testing complete data flow synchronization...")
        
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Step 1: Update category to DJ
        success, update_response, status = self.make_request(
            'PATCH', f'artists/{self.test_artist_id}/category',
            data={"category": "DJ"},
            headers=admin_headers
        )
        
        if not success:
            self.log_result("Update Category for Sync Test", False, f"Failed with status {status}: {update_response}")
            return False
        
        # Step 2: Get availability-days and verify category is updated
        success, availability_days, status = self.make_request(
            'GET', 'availability-days',
            headers=admin_headers
        )
        
        if not success:
            self.log_result("Get Updated Availability Days", False, f"Failed with status {status}: {availability_days}")
            return False
        
        # Find our test artist's availability and check category
        for day in availability_days:
            if day.get('artist_id') == self.test_artist_id:
                if day.get('artist_category') == 'DJ':
                    self.log_result("Category Synchronization", True, "Category properly synchronized in availability-days", day)
                    return True
                else:
                    self.log_result("Category Synchronization", False, f"Expected 'DJ', got '{day.get('artist_category')}'", day)
                    return False
        
        self.log_result("Category Synchronization", False, "Test artist availability not found")
        return False

    def run_complete_test(self):
        """Run the complete test suite"""
        print("🚀 Starting Artist Category Update Functionality Test")
        print("=" * 60)
        
        # Setup
        if not self.setup_admin_login():
            return False
        
        if not self.create_test_artist():
            return False
        
        if not self.create_artist_profile():
            return False
        
        # Core tests
        if not self.test_category_update_endpoints():
            return False
        
        if not self.create_test_availability():
            return False
        
        if not self.test_availability_days_category_field():
            return False
        
        if not self.test_data_flow_synchronization():
            return False
        
        print("🎉 ALL TESTS PASSED! Artist category update functionality is working correctly.")
        print("=" * 60)
        
        # Summary
        print("\n📋 TEST SUMMARY:")
        print("✅ PATCH /api/artists/{artist_id}/category - Working correctly")
        print("✅ Category validation (DJ/Groupe) - Working correctly") 
        print("✅ Invalid category rejection - Working correctly")
        print("✅ /api/availability-days returns artist_category field - Working correctly")
        print("✅ Category updates are synchronized in availability-days - Working correctly")
        print("✅ Complete data flow verification - Working correctly")
        
        return True

if __name__ == "__main__":
    tester = CategoryUpdateTester()
    success = tester.run_complete_test()
    exit(0 if success else 1)