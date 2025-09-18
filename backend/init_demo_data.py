#!/usr/bin/env python3
"""
Script to initialize demo data for the artist calendar application
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
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

async def init_demo_data():
    """Initialize demo data"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🚀 Initializing demo data...")
    
    # Clear existing data
    await db.users.delete_many({})
    await db.artist_profiles.delete_many({})
    await db.availabilities.delete_many({})
    await db.invitations.delete_many({})
    
    print("✅ Cleared existing data")
    
    # Create admin user
    admin_user = {
        "id": "admin-001",
        "role": "admin",
        "email": "admin@demo.app",
        "password_hash": pwd_context.hash("demo123"),
        "email_verified_at": datetime.now(timezone.utc),
        "timezone": "Europe/Paris",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(admin_user)
    print("✅ Created admin user: admin@demo.app")
    
    # Create artist users
    artist_users = [
        {
            "id": "artist-001",
            "role": "artist",
            "email": "dj.alex@demo.app",
            "password_hash": pwd_context.hash("demo123"),
            "email_verified_at": datetime.now(timezone.utc),
            "timezone": "Europe/Paris",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "artist-002",
            "role": "artist",
            "email": "marie.beats@demo.app",
            "password_hash": pwd_context.hash("demo123"),
            "email_verified_at": datetime.now(timezone.utc),
            "timezone": "Europe/Paris",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.users.insert_many(artist_users)
    print("✅ Created artist users: dj.alex@demo.app, marie.beats@demo.app")
    
    # Create artist profiles
    artist_profiles = [
        {
            "id": "profile-001",
            "user_id": "artist-001",
            "nom_de_scene": "DJ Alex",
            "telephone": "+33 6 12 34 56 78",
            "lien": "https://soundcloud.com/dj-alex",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "profile-002",
            "user_id": "artist-002",
            "nom_de_scene": "Marie Beats",
            "telephone": "+33 6 98 76 54 32",
            "lien": "https://instagram.com/marie.beats",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.artist_profiles.insert_many(artist_profiles)
    print("✅ Created artist profiles")
    
    # Create sample availabilities
    # Get dates for this week and next week
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    availabilities = [
        # DJ Alex - Weekend gig
        {
            "id": "avail-001",
            "artist_id": "artist-001",
            "start_datetime": (today + timedelta(days=5, hours=18)).isoformat(),  # Friday 18:00
            "end_datetime": (today + timedelta(days=6, hours=2)).isoformat(),     # Saturday 02:00
            "type": "créneau",
            "note": "Soirée club - Musique électronique",
            "color": "#3b82f6",
            "created_at": datetime.now(timezone.utc)
        },
        # DJ Alex - Saturday evening
        {
            "id": "avail-002",
            "artist_id": "artist-001",
            "start_datetime": (today + timedelta(days=6, hours=20)).isoformat(),  # Saturday 20:00
            "end_datetime": (today + timedelta(days=7, hours=1)).isoformat(),     # Sunday 01:00
            "type": "créneau",
            "note": "Disponible pour événement privé",
            "color": "#10b981",
            "created_at": datetime.now(timezone.utc)
        },
        # Marie Beats - Full day availability
        {
            "id": "avail-003",
            "artist_id": "artist-002",
            "start_datetime": (today + timedelta(days=7)).isoformat(),            # Next Sunday
            "end_datetime": (today + timedelta(days=8)).isoformat(),              # Next Monday
            "type": "journée_entière",
            "note": "Disponible pour tournée - Flexible sur les horaires",
            "color": "#8b5cf6",
            "created_at": datetime.now(timezone.utc)
        },
        # Marie Beats - Wednesday evening
        {
            "id": "avail-004",
            "artist_id": "artist-002",
            "start_datetime": (today + timedelta(days=10, hours=19)).isoformat(), # Next Wednesday 19:00
            "end_datetime": (today + timedelta(days=10, hours=23)).isoformat(),   # Next Wednesday 23:00
            "type": "créneau",
            "note": "Concert acoustique possible",
            "color": "#f59e0b",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.availabilities.insert_many(availabilities)
    print("✅ Created sample availabilities")
    
    # Close connection
    client.close()
    
    print("\n🎉 Demo data initialization completed!")
    print("\n📝 Demo accounts:")
    print("   Admin: admin@demo.app (password: demo123)")
    print("   Artist 1: dj.alex@demo.app (password: demo123)")
    print("   Artist 2: marie.beats@demo.app (password: demo123)")
    print("\n🚀 You can now test the application!")

if __name__ == "__main__":
    asyncio.run(init_demo_data())