from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Cookie, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import uuid
import secrets
from pathlib import Path
from dotenv import load_dotenv
import logging
from enum import Enum
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# FastAPI setup
app = FastAPI(title="Calendrier Disponibilités Artistes")
api_router = APIRouter(prefix="/api")

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    ARTIST = "artist"

class InvitationStatus(str, Enum):
    SENT = "envoyée"
    ACCEPTED = "acceptée"
    EXPIRED = "expirée"

class AvailabilityType(str, Enum):
    SLOT = "créneau"
    ALL_DAY = "journée_entière"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: UserRole
    email: EmailStr
    password_hash: str
    email_verified_at: Optional[datetime] = None
    timezone: str = "Europe/Paris"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    timezone: str = "Europe/Paris"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ArtistProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    nom_de_scene: str
    telephone: Optional[str] = None
    lien: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ArtistProfileCreate(BaseModel):
    nom_de_scene: str
    telephone: Optional[str] = None
    lien: Optional[str] = None

class Invitation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    status: InvitationStatus = InvitationStatus.SENT
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvitationCreate(BaseModel):
    email: EmailStr

class Availability(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    artist_id: str
    start_datetime: datetime
    end_datetime: datetime
    type: AvailabilityType
    note: Optional[str] = None
    recurrence_rule: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AvailabilityCreate(BaseModel):
    start_datetime: datetime
    end_datetime: datetime
    type: AvailabilityType
    note: Optional[str] = None
    recurrence_rule: Optional[str] = None
    color: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: str
    role: UserRole
    email: str
    timezone: str
    email_verified_at: Optional[datetime] = None

class ArtistWithProfile(BaseModel):
    id: str
    email: str
    nom_de_scene: str
    telephone: Optional[str] = None
    lien: Optional[str] = None

# Password utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# JWT utilities
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_token_from_header(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Type d'authentification invalide",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Format du token invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(token: str = Depends(get_token_from_header)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return User(**user)

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

# Email utilities
def send_invitation_email(email: str, token: str):
    """Send invitation email using SendGrid"""
    try:
        sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        invitation_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/invite/{token}"
        
        message = Mail(
            from_email=os.environ.get('SENDER_EMAIL', 'no-reply@easybookevent.app'),
            to_emails=email,
            subject="Invitation - Calendrier des Disponibilités",
            html_content=f"""
            <html>
                <body>
                    <h2>Vous êtes invité(e) à rejoindre le calendrier des disponibilités</h2>
                    <p>Cliquez sur le lien ci-dessous pour créer votre compte :</p>
                    <a href="{invitation_link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Créer mon compte
                    </a>
                    <p>Ce lien expire dans 7 jours.</p>
                </body>
            </html>
            """
        )
        
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

# Auth endpoints
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, token: str):
    # Verify invitation token
    invitation = await db.invitations.find_one({"token": token, "status": InvitationStatus.SENT})
    if not invitation or invitation['expires_at'] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token d'invitation invalide ou expiré")
    
    # Check if user already exists
    if await db.users.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        role=UserRole.ARTIST,
        email=user_data.email,
        password_hash=hashed_password,
        timezone=user_data.timezone
    )
    
    await db.users.insert_one(user.dict())
    
    # Mark invitation as accepted
    await db.invitations.update_one(
        {"token": token}, 
        {"$set": {"status": InvitationStatus.ACCEPTED}}
    )
    
    return UserResponse(**user.dict())

@api_router.post("/auth/login", response_model=Token)
async def login(form_data: UserLogin):
    user = await db.users.find_one({"email": form_data.email})
    if not user or not verify_password(form_data.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user['email']}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.dict())

# Invitation endpoints (Admin only)
@api_router.post("/invitations", response_model=Invitation)
async def create_invitation(invitation_data: InvitationCreate, current_user: User = Depends(get_current_admin)):
    # Check if invitation already exists
    existing = await db.invitations.find_one({"email": invitation_data.email, "status": InvitationStatus.SENT})
    if existing:
        raise HTTPException(status_code=400, detail="Une invitation est déjà en attente pour cet email")
    
    invitation = Invitation(email=invitation_data.email)
    await db.invitations.insert_one(invitation.dict())
    
    # Send email
    send_invitation_email(invitation.email, invitation.token)
    
    return invitation

@api_router.get("/invitations", response_model=List[Invitation])
async def get_invitations(current_user: User = Depends(get_current_admin)):
    invitations = await db.invitations.find().to_list(1000)
    return [Invitation(**inv) for inv in invitations]

# Artist profile endpoints
@api_router.post("/profile", response_model=ArtistProfile)
async def create_or_update_profile(profile_data: ArtistProfileCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes peuvent créer un profil")
    
    # Check if profile exists
    existing_profile = await db.artist_profiles.find_one({"user_id": current_user.id})
    
    if existing_profile:
        # Update existing profile
        await db.artist_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": profile_data.dict()}
        )
        updated_profile = await db.artist_profiles.find_one({"user_id": current_user.id})
        return ArtistProfile(**updated_profile)
    else:
        # Create new profile
        profile = ArtistProfile(user_id=current_user.id, **profile_data.dict())
        await db.artist_profiles.insert_one(profile.dict())
        return profile

@api_router.get("/profile", response_model=ArtistProfile)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes ont un profil")
    
    profile = await db.artist_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil non trouvé")
    
    return ArtistProfile(**profile)

# Artists management (Admin only)
@api_router.get("/artists", response_model=List[ArtistWithProfile])
async def get_all_artists(current_user: User = Depends(get_current_admin)):
    pipeline = [
        {"$match": {"role": UserRole.ARTIST}},
        {"$lookup": {
            "from": "artist_profiles",
            "localField": "id",
            "foreignField": "user_id",
            "as": "profile"
        }},
        {"$unwind": {"path": "$profile", "preserveNullAndEmptyArrays": True}}
    ]
    
    artists = await db.users.aggregate(pipeline).to_list(1000)
    result = []
    
    for artist in artists:
        profile = artist.get('profile', {})
        result.append(ArtistWithProfile(
            id=artist['id'],
            email=artist['email'],
            nom_de_scene=profile.get('nom_de_scene', ''),
            telephone=profile.get('telephone'),
            lien=profile.get('lien')
        ))
    
    return result

# Availability endpoints
@api_router.post("/availabilities", response_model=Availability)
async def create_availability(availability_data: AvailabilityCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes peuvent créer des disponibilités")
    
    # Validate dates
    if availability_data.start_datetime >= availability_data.end_datetime:
        raise HTTPException(status_code=400, detail="La date de fin doit être après la date de début")
    
    availability = Availability(artist_id=current_user.id, **availability_data.dict())
    await db.availabilities.insert_one(availability.dict())
    return availability

@api_router.get("/availabilities", response_model=List[Availability])
async def get_availabilities(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ARTIST:
        # Artists can only see their own availabilities
        availabilities = await db.availabilities.find({"artist_id": current_user.id}).to_list(1000)
    else:
        # Admin can see all availabilities
        availabilities = await db.availabilities.find().to_list(1000)
    
    return [Availability(**avail) for avail in availabilities]

@api_router.get("/availabilities/{availability_id}", response_model=Availability)
async def get_availability(availability_id: str, current_user: User = Depends(get_current_user)):
    availability = await db.availabilities.find_one({"id": availability_id})
    if not availability:
        raise HTTPException(status_code=404, detail="Disponibilité non trouvée")
    
    # Check permissions
    if current_user.role == UserRole.ARTIST and availability['artist_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez voir que vos propres disponibilités")
    
    return Availability(**availability)

@api_router.put("/availabilities/{availability_id}", response_model=Availability)
async def update_availability(availability_id: str, availability_data: AvailabilityCreate, current_user: User = Depends(get_current_user)):
    availability = await db.availabilities.find_one({"id": availability_id})
    if not availability:
        raise HTTPException(status_code=404, detail="Disponibilité non trouvée")
    
    # Check permissions
    if current_user.role == UserRole.ARTIST and availability['artist_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos propres disponibilités")
    
    # Validate dates
    if availability_data.start_datetime >= availability_data.end_datetime:
        raise HTTPException(status_code=400, detail="La date de fin doit être après la date de début")
    
    await db.availabilities.update_one(
        {"id": availability_id},
        {"$set": availability_data.dict()}
    )
    
    updated_availability = await db.availabilities.find_one({"id": availability_id})
    return Availability(**updated_availability)

@api_router.delete("/availabilities/{availability_id}")
async def delete_availability(availability_id: str, current_user: User = Depends(get_current_user)):
    availability = await db.availabilities.find_one({"id": availability_id})
    if not availability:
        raise HTTPException(status_code=404, detail="Disponibilité non trouvée")
    
    # Check permissions
    if current_user.role == UserRole.ARTIST and availability['artist_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres disponibilités")
    
    await db.availabilities.delete_one({"id": availability_id})
    return {"message": "Disponibilité supprimée"}

# Verification endpoint for invitation tokens
@api_router.get("/invitations/verify/{token}")
async def verify_invitation_token(token: str):
    invitation = await db.invitations.find_one({"token": token, "status": InvitationStatus.SENT})
    if not invitation or invitation['expires_at'] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token d'invitation invalide ou expiré")
    
    return {"valid": True, "email": invitation['email']}

# Include router
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()