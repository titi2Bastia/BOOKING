#!/usr/bin/env python3
"""
Comprehensive Invitation System Test
Tests the invitation system by:
1. Retrieving invitation token from MongoDB
2. Testing invitation verification endpoint
3. Testing valid and invalid token scenarios
4. Documenting exact error messages
"""

import requests
import pymongo
import json
from datetime import datetime, timezone

class InvitationSystemTester:
    def __init__(self, base_url="https://avail-dj.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.mongo_client = pymongo.MongoClient('mongodb://localhost:27017')
        self.db = self.mongo_client['artist_calendar']
        self.test_results = []
        
    def log_result(self, test_name, success, details):
        """Log test result with details"""
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        
    def retrieve_invitation_token(self, email):
        """Retrieve invitation token from MongoDB"""
        print(f"\n🔍 Retrieving invitation token for: {email}")
        
        invitation = self.db.invitations.find_one({'email': email})
        
        if invitation:
            # Handle timezone-aware datetime comparison
            expires_at = invitation['expires_at']
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            is_expired = expires_at < datetime.now(timezone.utc)
            
            print(f"   Email: {invitation['email']}")
            print(f"   Token: {invitation['token']}")
            print(f"   Status: {invitation['status']}")
            print(f"   Expires at: {invitation['expires_at']}")
            print(f"   Created at: {invitation['created_at']}")
            print(f"   Is Expired: {'Yes' if is_expired else 'No'}")
            
            self.log_result(
                f"Retrieve token for {email}",
                True,
                f"Token: {invitation['token']}, Status: {invitation['status']}, Expired: {is_expired}"
            )
            
            return invitation['token'], is_expired
        else:
            self.log_result(
                f"Retrieve token for {email}",
                False,
                "No invitation found in database"
            )
            return None, None
    
    def test_invitation_verification(self, token, should_succeed=True):
        """Test invitation verification endpoint"""
        endpoint = f"invitations/verify/{token}"
        url = f"{self.api_url}/{endpoint}"
        
        test_name = f"Verify invitation token ({'valid' if should_succeed else 'invalid'})"
        print(f"\n🔍 {test_name}")
        print(f"   URL: {url}")
        
        try:
            response = requests.get(url)
            
            print(f"   Status Code: {response.status_code}")
            
            try:
                response_data = response.json()
                print(f"   Response: {json.dumps(response_data, indent=2)}")
            except:
                response_data = response.text
                print(f"   Response: {response_data}")
            
            if should_succeed:
                success = response.status_code == 200 and isinstance(response_data, dict) and response_data.get('valid') == True
                if success:
                    self.log_result(test_name, True, f"Valid token verified successfully. Email: {response_data.get('email')}")
                else:
                    self.log_result(test_name, False, f"Expected success but got status {response.status_code}: {response_data}")
            else:
                success = response.status_code == 400
                if success:
                    error_message = response_data.get('detail', 'Unknown error') if isinstance(response_data, dict) else response_data
                    self.log_result(test_name, True, f"Invalid token correctly rejected. Error: {error_message}")
                else:
                    self.log_result(test_name, False, f"Expected 400 error but got status {response.status_code}: {response_data}")
            
            return success, response_data
            
        except Exception as e:
            self.log_result(test_name, False, f"Exception occurred: {str(e)}")
            return False, str(e)
    
    def test_invalid_token_scenarios(self):
        """Test various invalid token scenarios"""
        print(f"\n🔍 Testing invalid token scenarios")
        
        invalid_tokens = [
            ("completely-invalid-token", "Completely invalid token"),
            ("", "Empty token"),
            ("expired-token-123", "Non-existent token"),
            ("a" * 100, "Very long invalid token"),
            ("special-chars-!@#$%", "Token with special characters")
        ]
        
        all_passed = True
        error_messages = []
        
        for token, description in invalid_tokens:
            print(f"\n   Testing: {description}")
            success, response_data = self.test_invitation_verification(token, should_succeed=False)
            
            if not success:
                all_passed = False
            
            # Collect error message
            if isinstance(response_data, dict) and 'detail' in response_data:
                error_messages.append(f"{description}: {response_data['detail']}")
            elif isinstance(response_data, str):
                error_messages.append(f"{description}: {response_data}")
        
        return all_passed, error_messages
    
    def generate_invitation_url(self, token):
        """Generate complete invitation URL"""
        invitation_url = f"{self.base_url}/invite/{token}"
        print(f"\n🔗 Complete Invitation URL Structure:")
        print(f"   {invitation_url}")
        
        self.log_result(
            "Generate invitation URL",
            True,
            f"URL: {invitation_url}"
        )
        
        return invitation_url
    
    def run_comprehensive_test(self):
        """Run comprehensive invitation system test"""
        print("🚀 Starting Comprehensive Invitation System Test")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)
        
        # Step 1: Retrieve invitation token for artiste.test+1@easybookevent.com
        target_email = "artiste.test+1@easybookevent.com"
        token, is_expired = self.retrieve_invitation_token(target_email)
        
        if not token:
            print("❌ Cannot proceed without invitation token")
            return False
        
        # Step 2: Generate complete invitation URL
        invitation_url = self.generate_invitation_url(token)
        
        # Step 3: Test valid token verification
        if not is_expired:
            self.test_invitation_verification(token, should_succeed=True)
        else:
            print(f"\n⚠️ Token is expired, testing as invalid token")
            self.test_invitation_verification(token, should_succeed=False)
        
        # Step 4: Test invalid token scenarios
        invalid_tests_passed, error_messages = self.test_invalid_token_scenarios()
        
        # Step 5: Print comprehensive results
        self.print_comprehensive_results(target_email, token, invitation_url, error_messages)
        
        return True
    
    def print_comprehensive_results(self, email, token, invitation_url, error_messages):
        """Print comprehensive test results as requested"""
        print("\n" + "=" * 80)
        print("📋 COMPREHENSIVE INVITATION SYSTEM TEST RESULTS")
        print("=" * 80)
        
        print(f"\n🎯 TARGET EMAIL: {email}")
        print(f"🔑 INVITATION TOKEN: {token}")
        print(f"🔗 COMPLETE INVITATION URL: {invitation_url}")
        
        print(f"\n📊 TEST SUMMARY:")
        passed_tests = sum(1 for result in self.test_results if result['success'])
        total_tests = len(self.test_results)
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests}")
        print(f"   Failed: {total_tests - passed_tests}")
        print(f"   Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print(f"\n🔍 DETAILED TEST RESULTS:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"   {status} {result['test']}")
            if result['details']:
                print(f"      → {result['details']}")
        
        print(f"\n⚠️ ERROR MESSAGES FOR INVALID/EXPIRED TOKENS:")
        if error_messages:
            for error_msg in error_messages:
                print(f"   • {error_msg}")
        else:
            print("   No error messages collected")
        
        print(f"\n🔧 API ENDPOINT TESTED:")
        print(f"   GET {self.api_url}/invitations/verify/{{token}}")
        
        print("\n" + "=" * 80)
    
    def cleanup(self):
        """Cleanup resources"""
        if self.mongo_client:
            self.mongo_client.close()

def main():
    tester = InvitationSystemTester()
    
    try:
        tester.run_comprehensive_test()
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        tester.cleanup()

if __name__ == "__main__":
    main()