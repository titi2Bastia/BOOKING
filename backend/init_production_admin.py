#!/usr/bin/env python3
"""
Script to initialize production admin user only (no demo data)
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add the backend directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def init_production_admin():
    """Initialize production admin user only"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🚀 Initializing production environment...")
    
    # Clear all existing data for fresh start
    await db.users.delete_many({})
    await db.artist_profiles.delete_many({})
    await db.availability_days.delete_many({})
    await db.invitations.delete_many({})
    
    print("✅ Cleared all existing data")
    
    # Create admin user with default values for production
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@easybookevent.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'AdminSecure2024!')
    
    admin_user = {
        "id": "admin-production",
        "role": "admin",
        "email": admin_email,
        "password_hash": pwd_context.hash(admin_password),
        "email_verified_at": datetime.now(timezone.utc),
        "timezone": "Europe/Paris",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(admin_user)
    print(f"✅ Created admin user: {admin_email}")
    
    # Close connection
    client.close()
    
    print("\n🎉 Production environment initialized!")
    print("\n📝 Admin account:")
    print(f"   Email: {admin_email}")
    print(f"   Password: {admin_password}")
    print("\n🚀 The application is ready for production use!")
    print("\n📋 Next steps:")
    print("   1. Log in with your admin account")
    print("   2. Change the default password in your profile")
    print("   3. Start inviting artists via the admin interface")
    print("   4. Artists will receive emails to create their profiles")
    print("\n⚠️  IMPORTANT: Change the default admin password after first login!")

if __name__ == "__main__":
    asyncio.run(init_production_admin())