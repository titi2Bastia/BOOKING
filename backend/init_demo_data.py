#!/usr/bin/env python3
"""
Script to initialize demo data for the artist calendar application (Full Days Only)
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta, date
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
    """Initialize demo data for full days only"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🚀 Initializing demo data for full-day availabilities...")
    
    # Clear existing data
    await db.users.delete_many({})
    await db.artist_profiles.delete_many({})
    await db.availability_days.delete_many({})  # New collection name
    await db.availabilities.delete_many({})      # Remove old availabilities
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
    
    # Create sample availability days (full days only)
    today = date.today()
    
    availability_days = [
        # DJ Alex - Weekend availabilities
        {
            "id": "day-001",
            "artist_id": "artist-001",
            "date": (today + timedelta(days=5)).isoformat(),  # Next Friday
            "note": "Disponible pour soirée club",
            "color": "#3b82f6",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "day-002",
            "artist_id": "artist-001",
            "date": (today + timedelta(days=6)).isoformat(),  # Next Saturday
            "note": "Libre pour événement privé",
            "color": "#10b981",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "day-003",
            "artist_id": "artist-001",
            "date": (today + timedelta(days=12)).isoformat(), # Week after next Friday
            "note": "Festival possible",
            "color": "#f59e0b",
            "created_at": datetime.now(timezone.utc)
        },
        
        # Marie Beats - Weekday and weekend availabilities
        {
            "id": "day-004",
            "artist_id": "artist-002",
            "date": (today + timedelta(days=7)).isoformat(),  # Next Sunday
            "note": "Disponible pour tournée",
            "color": "#8b5cf6",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "day-005",
            "artist_id": "artist-002",
            "date": (today + timedelta(days=10)).isoformat(), # Next Wednesday
            "note": "Concert acoustique",
            "color": "#ef4444",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "day-006",
            "artist_id": "artist-002",
            "date": (today + timedelta(days=14)).isoformat(), # Two weeks from now
            "note": "Mariage ou événement corporate",
            "color": "#06b6d4",
            "created_at": datetime.now(timezone.utc)
        },
        
        # Additional days for both artists
        {
            "id": "day-007",
            "artist_id": "artist-001",
            "date": (today + timedelta(days=21)).isoformat(), # Three weeks
            "note": "Libre",
            "color": "#3b82f6",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": "day-008",
            "artist_id": "artist-002",
            "date": (today + timedelta(days=28)).isoformat(), # Four weeks
            "note": "Showcase ou démonstration",
            "color": "#8b5cf6",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.availability_days.insert_many(availability_days)
    print("✅ Created sample availability days (full days only)")
    
    # Close connection
    client.close()
    
    print("\n🎉 Demo data initialization completed!")
    print("\n📝 Demo accounts:")
    print("   Admin: admin@demo.app (password: demo123)")
    print("   Artist 1: dj.alex@demo.app (password: demo123)")
    print("   Artist 2: marie.beats@demo.app (password: demo123)")
    print("\n🗓️ Sample availability days:")
    print("   DJ Alex: Next Friday, Saturday, and future dates")
    print("   Marie Beats: Next Sunday, Wednesday, and future dates")
    print("\n✨ Features:")
    print("   • Full-day availabilities only (no time slots)")
    print("   • Past dates are disabled for editing")
    print("   • Artists can plan up to 18 months ahead")
    print("   • Admin can see aggregated calendar view")
    print("\n🚀 You can now test the updated application!")

if __name__ == "__main__":
    asyncio.run(init_demo_data())