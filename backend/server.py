from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Cookie, Header, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date
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
import aiofiles
import shutil

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# FastAPI setup
app = FastAPI(title="EasyBookEvent - Calendrier Artistes")
api_router = APIRouter(prefix="/api")

# Static files setup - serve uploads via API route to work with ingress
@api_router.get("/uploads/{file_path:path}")
async def serve_uploaded_file(file_path: str):
    """Serve uploaded files via API route"""
    full_path = UPLOADS_DIR / file_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    
    # Determine media type
    media_type = "image/jpeg"
    if file_path.lower().endswith('.png'):
        media_type = "image/png"
    elif file_path.lower().endswith('.jpg') or file_path.lower().endswith('.jpeg'):
        media_type = "image/jpeg"
    
    return FileResponse(full_path, media_type=media_type)

# Keep original static mount for direct backend access (development)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Configuration
DEFAULT_TZ = "Europe/Paris"
MIN_MONTHS_AHEAD = 12
MAX_MONTHS_AHEAD = 18
NOTES_MAX_LEN = 280
BIO_MAX_LEN = 500

# File upload configuration
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_GALLERY_IMAGES = 5

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

class ArtistCategory(str, Enum):
    DJ = "DJ"
    GROUPE = "Groupe"

class InvitationStatus(str, Enum):
    SENT = "envoyée"
    ACCEPTED = "acceptée"
    EXPIRED = "expirée"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: UserRole
    email: EmailStr
    password_hash: str
    email_verified_at: Optional[datetime] = None
    timezone: str = DEFAULT_TZ
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    timezone: str = DEFAULT_TZ

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ArtistProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    nom_de_scene: str  # Required
    telephone: Optional[str] = None
    lien: Optional[str] = None
    tarif_soiree: Optional[str] = None  # "500 € / set" or similar
    category: Optional[ArtistCategory] = None  # DJ or Groupe
    logo_url: Optional[str] = None  # Path to uploaded logo
    gallery_urls: List[str] = Field(default_factory=list)  # List of gallery image paths
    bio: Optional[str] = Field(None, max_length=BIO_MAX_LEN)  # Short bio, max 500 chars
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ArtistProfileCreate(BaseModel):
    nom_de_scene: str
    telephone: Optional[str] = None
    lien: Optional[str] = None
    tarif_soiree: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=BIO_MAX_LEN)

class ArtistProfileUpdate(BaseModel):
    nom_de_scene: Optional[str] = None
    telephone: Optional[str] = None
    lien: Optional[str] = None
    tarif_soiree: Optional[str] = None
    category: Optional[ArtistCategory] = None
    bio: Optional[str] = Field(None, max_length=BIO_MAX_LEN)

class Invitation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    status: InvitationStatus = InvitationStatus.SENT
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvitationCreate(BaseModel):
    email: EmailStr

class BlockedDate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: date  # YYYY-MM-DD format
    note: Optional[str] = Field(None, max_length=NOTES_MAX_LEN)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('date')
    def validate_date_not_past(cls, v):
        today = date.today()
        if v < today:
            raise ValueError('Impossible de bloquer une date passée')
        return v

class BlockedDateCreate(BaseModel):
    date: date
    note: Optional[str] = Field(None, max_length=NOTES_MAX_LEN)
    
    @validator('date')
    def validate_date_not_past(cls, v):
        today = date.today()
        if v < today:
            raise ValueError('Impossible de bloquer une date passée')
        return v

class AvailabilityDay(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    artist_id: str
    date: date  # YYYY-MM-DD format, no time
    note: Optional[str] = Field(None, max_length=NOTES_MAX_LEN)
    color: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('date')
    def validate_date_not_past(cls, v):
        today = date.today()
        if v < today:
            raise ValueError('Impossible de créer une disponibilité sur une date passée')
        
        max_date = today + timedelta(days=MAX_MONTHS_AHEAD * 30)
        if v > max_date:
            raise ValueError(f'Disponibilité trop lointaine (maximum {MAX_MONTHS_AHEAD} mois)')
        
        return v

class AvailabilityDayCreate(BaseModel):
    date: date
    note: Optional[str] = Field(None, max_length=NOTES_MAX_LEN)
    color: Optional[str] = None

class AvailabilityDayToggle(BaseModel):
    date: date
    note: Optional[str] = Field(None, max_length=NOTES_MAX_LEN)
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
    tarif_soiree: Optional[str] = None
    logo_url: Optional[str] = None
    gallery_urls: List[str] = Field(default_factory=list)
    bio: Optional[str] = None
    category: Optional[ArtistCategory] = None
    availability_count: int = 0

# File upload utilities
async def save_uploaded_file(file: UploadFile, subfolder: str = "") -> str:
    """Save uploaded file and return the relative path"""
    # Validate file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Type de fichier non autorisé. Utilisez : {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create subfolder if specified
    save_dir = UPLOADS_DIR
    if subfolder:
        save_dir = save_dir / subfolder
        save_dir.mkdir(exist_ok=True)
    
    file_path = save_dir / unique_filename
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Fichier trop volumineux. Maximum {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        await f.write(content)
    
    # Return relative path for URL (using API route)
    relative_path = f"/api/uploads/{subfolder}/{unique_filename}" if subfolder else f"/api/uploads/{unique_filename}"
    return relative_path

def remove_file(file_path: str):
    """Remove file from filesystem"""
    try:
        full_path = ROOT_DIR / file_path
        if full_path.exists():
            full_path.unlink()
    except Exception as e:
        print(f"Error removing file {file_path}: {e}")

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
            subject="Invitation - EasyBookEvent",
            html_content=f"""
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">EasyBookEvent</h1>
                        <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Calendrier des disponibilités artistes</p>
                    </div>
                    <div style="padding: 30px; background: white;">
                        <h2 style="color: #333; margin-bottom: 20px;">Vous êtes invité(e) à rejoindre EasyBookEvent</h2>
                        <p style="color: #666; line-height: 1.6;">
                            Vous avez été invité(e) à créer votre profil artiste et à gérer vos disponibilités 
                            sur notre plateforme. Vous pourrez :
                        </p>
                        <ul style="color: #666; line-height: 1.8;">
                            <li>Créer votre profil complet (nom, tarifs, photos, bio)</li>
                            <li>Indiquer vos disponibilités par journées entières</li>
                            <li>Gérer votre calendrier jusqu'à 18 mois à l'avance</li>
                        </ul>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{invitation_link}" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                      color: white; 
                                      padding: 15px 30px; 
                                      text-decoration: none; 
                                      border-radius: 8px; 
                                      font-weight: bold;
                                      display: inline-block;">
                                Créer mon profil artiste
                            </a>
                        </div>
                        <p style="color: #888; font-size: 14px; text-align: center;">
                            Ce lien expire dans 7 jours.
                        </p>
                    </div>
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
    if not invitation:
        raise HTTPException(status_code=400, detail="Token d'invitation invalide ou expiré")
    
    # Handle timezone-aware datetime comparison
    expires_at = invitation['expires_at']
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
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

@api_router.delete("/invitations/{invitation_id}")
async def delete_invitation(invitation_id: str, current_user: User = Depends(get_current_admin)):
    invitation = await db.invitations.find_one({"id": invitation_id})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    await db.invitations.delete_one({"id": invitation_id})
    return {"message": "Invitation supprimée"}

# Artist profile endpoints
@api_router.post("/profile", response_model=ArtistProfile)
async def create_or_update_profile(profile_data: ArtistProfileCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes peuvent créer un profil")
    
    # Check if profile exists
    existing_profile = await db.artist_profiles.find_one({"user_id": current_user.id})
    
    if existing_profile:
        # Update existing profile
        update_data = profile_data.dict()
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.artist_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": update_data}
        )
        updated_profile = await db.artist_profiles.find_one({"user_id": current_user.id})
        updated_profile.pop('_id', None)
        return ArtistProfile(**updated_profile)
    else:
        # Create new profile
        profile = ArtistProfile(user_id=current_user.id, **profile_data.dict())
        profile_dict = profile.dict()
        await db.artist_profiles.insert_one(profile_dict)
        return profile

@api_router.get("/profile", response_model=ArtistProfile)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes ont un profil")
    
    profile = await db.artist_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil non trouvé")
    
    profile.pop('_id', None)
    return ArtistProfile(**profile)

# File upload endpoints
@api_router.post("/profile/upload-logo")
async def upload_logo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes peuvent uploader des fichiers")
    
    # Get current profile
    profile = await db.artist_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil non trouvé")
    
    # Remove old logo if exists
    if profile.get('logo_url'):
        remove_file(profile['logo_url'])
    
    # Save new logo
    logo_url = await save_uploaded_file(file, "logos")
    
    # Update profile
    await db.artist_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"logo_url": logo_url, "message": "Logo uploadé avec succès"}

@api_router.post("/profile/upload-gallery")
async def upload_gallery_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes peuvent uploader des fichiers")
    
    # Get current profile
    profile = await db.artist_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil non trouvé")
    
    # Check gallery limit
    current_gallery = profile.get('gallery_urls', [])
    if len(current_gallery) >= MAX_GALLERY_IMAGES:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {MAX_GALLERY_IMAGES} images autorisées dans la galerie"
        )
    
    # Save new image
    image_url = await save_uploaded_file(file, "gallery")
    
    # Update profile
    new_gallery = current_gallery + [image_url]
    await db.artist_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": {"gallery_urls": new_gallery, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"image_url": image_url, "message": "Image ajoutée à la galerie"}

@api_router.delete("/profile/remove-gallery/{image_index}")
async def remove_gallery_image(image_index: int, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes peuvent modifier leur galerie")
    
    # Get current profile
    profile = await db.artist_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil non trouvé")
    
    current_gallery = profile.get('gallery_urls', [])
    if image_index < 0 or image_index >= len(current_gallery):
        raise HTTPException(status_code=400, detail="Index d'image invalide")
    
    # Remove file and update gallery
    image_to_remove = current_gallery[image_index]
    remove_file(image_to_remove)
    
    new_gallery = current_gallery[:image_index] + current_gallery[image_index + 1:]
    await db.artist_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": {"gallery_urls": new_gallery, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Image supprimée de la galerie"}

# Artists management (Admin only)
@api_router.get("/artists", response_model=List[ArtistWithProfile])
async def get_all_artists(current_user: User = Depends(get_current_admin)):
    artists_cursor = db.users.find({"role": UserRole.ARTIST})
    artists = await artists_cursor.to_list(1000)
    
    result = []
    for artist in artists:
        profile = await db.artist_profiles.find_one({"user_id": artist['id']})
        
        # Count availability days
        availability_count = await db.availability_days.count_documents({"artist_id": artist['id']})
        
        if profile:
            profile.pop('_id', None)
            result.append(ArtistWithProfile(
                id=artist['id'],
                email=artist['email'],
                nom_de_scene=profile.get('nom_de_scene', ''),
                telephone=profile.get('telephone'),
                lien=profile.get('lien'),
                tarif_soiree=profile.get('tarif_soiree'),
                logo_url=profile.get('logo_url'),
                gallery_urls=profile.get('gallery_urls', []),
                bio=profile.get('bio'),
                category=profile.get('category'),
                availability_count=availability_count
            ))
        else:
            result.append(ArtistWithProfile(
                id=artist['id'],
                email=artist['email'],
                nom_de_scene='',
                availability_count=availability_count
            ))
    
    return result

@api_router.get("/artists/{artist_id}/profile", response_model=ArtistProfile)
async def get_artist_profile(artist_id: str, current_user: User = Depends(get_current_admin)):
    """Get detailed artist profile (admin only)"""
    profile = await db.artist_profiles.find_one({"user_id": artist_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil artiste non trouvé")
    
    profile.pop('_id', None)
    
    # Ensure required fields have default values
    if 'nom_de_scene' not in profile or not profile['nom_de_scene']:
        profile['nom_de_scene'] = 'Profil incomplet'
    
    return ArtistProfile(**profile)

@api_router.put("/artists/{artist_id}/profile", response_model=ArtistProfile)
async def update_artist_profile_admin(
    artist_id: str, 
    profile_data: ArtistProfileUpdate, 
    current_user: User = Depends(get_current_admin)
):
    """Update artist profile (admin only)"""
    # Check if artist exists
    artist = await db.users.find_one({"id": artist_id, "role": UserRole.ARTIST})
    if not artist:
        raise HTTPException(status_code=404, detail="Artiste non trouvé")
    
    # Check if profile exists
    existing_profile = await db.artist_profiles.find_one({"user_id": artist_id})
    if not existing_profile:
        raise HTTPException(status_code=404, detail="Profil artiste non trouvé")
    
    # Update profile
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.artist_profiles.update_one(
        {"user_id": artist_id},
        {"$set": update_data}
    )
    
    # Return updated profile
    updated_profile = await db.artist_profiles.find_one({"user_id": artist_id})
    updated_profile.pop('_id', None)
    
    # Ensure required fields have default values
    if 'nom_de_scene' not in updated_profile or not updated_profile['nom_de_scene']:
        updated_profile['nom_de_scene'] = 'Profil incomplet'
    
    return ArtistProfile(**updated_profile)

@api_router.patch("/artists/{artist_id}/category")
async def update_artist_category(
    artist_id: str, 
    category_data: dict,
    current_user: User = Depends(get_current_admin)
):
    """Update artist category (admin only)"""
    category = category_data.get("category")
    
    # Validate category
    if category not in [ArtistCategory.DJ, ArtistCategory.GROUPE]:
        raise HTTPException(status_code=400, detail="Catégorie invalide. Utilisez 'DJ' ou 'Groupe'")
    
    # Check if artist exists
    artist = await db.users.find_one({"id": artist_id, "role": UserRole.ARTIST})
    if not artist:
        raise HTTPException(status_code=404, detail="Artiste non trouvé")
    
    # Update or create profile with category
    result = await db.artist_profiles.update_one(
        {"user_id": artist_id},
        {
            "$set": {
                "category": category,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    return {"message": f"Catégorie mise à jour : {category}", "category": category}

@api_router.delete("/artists/{artist_id}")
async def delete_artist(artist_id: str, current_user: User = Depends(get_current_admin)):
    """Delete artist and all related data (admin only)"""
    # Check if artist exists
    artist = await db.users.find_one({"id": artist_id, "role": UserRole.ARTIST})
    if not artist:
        raise HTTPException(status_code=404, detail="Artiste non trouvé")
    
    # Delete all artist's availability days
    availability_result = await db.availability_days.delete_many({"artist_id": artist_id})
    
    # Delete artist profile
    profile_result = await db.artist_profiles.delete_one({"user_id": artist_id})
    
    # Delete the user account
    user_result = await db.users.delete_one({"id": artist_id})
    
    # Optionally delete related invitations (sent to this email)
    await db.invitations.delete_many({"email": artist['email']})
    
    return {
        "message": "Artiste supprimé avec succès",
        "deleted_availabilities": availability_result.deleted_count,
        "deleted_profile": profile_result.deleted_count > 0,
        "deleted_user": user_result.deleted_count > 0
    }

# Blocked Dates endpoints (Admin only)
@api_router.post("/blocked-dates", response_model=BlockedDate)
async def create_blocked_date(blocked_data: BlockedDateCreate, current_user: User = Depends(get_current_admin)):
    # Check if date is already blocked
    existing = await db.blocked_dates.find_one({"date": blocked_data.date.isoformat()})
    if existing:
        raise HTTPException(status_code=400, detail="Cette date est déjà bloquée")
    
    # Create blocked date
    blocked_date_dict = {
        "id": str(uuid.uuid4()),
        "date": blocked_data.date.isoformat(),
        "note": blocked_data.note or "",
        "created_at": datetime.now(timezone.utc)
    }
    await db.blocked_dates.insert_one(blocked_date_dict)
    
    # Remove existing artist availabilities for this date
    result = await db.availability_days.delete_many({"date": blocked_data.date.isoformat()})
    if result.deleted_count > 0:
        print(f"Removed {result.deleted_count} artist availabilities for blocked date {blocked_data.date}")
    
    blocked_date_dict.pop('_id', None)
    return BlockedDate(**blocked_date_dict)

@api_router.get("/blocked-dates", response_model=List[Dict[str, Any]])
async def get_blocked_dates(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    blocked_dates = await db.blocked_dates.find(query).to_list(1000)
    result = []
    for blocked in blocked_dates:
        blocked.pop('_id', None)
        result.append(blocked)
    
    return result

@api_router.put("/blocked-dates/{blocked_id}", response_model=BlockedDate)
async def update_blocked_date(blocked_id: str, blocked_data: BlockedDateCreate, current_user: User = Depends(get_current_admin)):
    blocked_date = await db.blocked_dates.find_one({"id": blocked_id})
    if not blocked_date:
        raise HTTPException(status_code=404, detail="Date bloquée non trouvée")
    
    # Update blocked date
    update_data = {
        "date": blocked_data.date.isoformat(),
        "note": blocked_data.note or ""
    }
    
    await db.blocked_dates.update_one(
        {"id": blocked_id},
        {"$set": update_data}
    )
    
    updated_blocked = await db.blocked_dates.find_one({"id": blocked_id})
    updated_blocked.pop('_id', None)
    return BlockedDate(**updated_blocked)

@api_router.delete("/blocked-dates/{blocked_id}")
async def delete_blocked_date(blocked_id: str, current_user: User = Depends(get_current_admin)):
    blocked_date = await db.blocked_dates.find_one({"id": blocked_id})
    if not blocked_date:
        raise HTTPException(status_code=404, detail="Date bloquée non trouvée")
    
    await db.blocked_dates.delete_one({"id": blocked_id})
    return {"message": "Date bloquée supprimée"}

# Utility function to check if a date is blocked
async def is_date_blocked(date_str: str) -> bool:
    blocked = await db.blocked_dates.find_one({"date": date_str})
    return blocked is not None
@api_router.post("/availability-days/toggle", response_model=Dict[str, Any])
async def toggle_availability_day(day_data: AvailabilityDayToggle, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(status_code=403, detail="Seuls les artistes peuvent gérer leurs disponibilités")
    
    # Validate date (not in the past, within allowed window)
    today = date.today()
    if day_data.date < today:
        raise HTTPException(status_code=400, detail="Impossible de créer une disponibilité sur une date passée")
    
    max_date = today + timedelta(days=MAX_MONTHS_AHEAD * 30)
    if day_data.date > max_date:
        raise HTTPException(status_code=400, detail=f"Disponibilité trop lointaine (maximum {MAX_MONTHS_AHEAD} mois)")
    
    date_str = day_data.date.isoformat()
    
    # Check if date is blocked by admin
    if await is_date_blocked(date_str):
        raise HTTPException(status_code=400, detail="Cette date est bloquée par l'administrateur")
    
    # Check if availability already exists
    existing = await db.availability_days.find_one({
        "artist_id": current_user.id,
        "date": date_str
    })
    
    if existing:
        # Remove availability (toggle OFF)
        await db.availability_days.delete_one({"artist_id": current_user.id, "date": date_str})
        return {"action": "removed", "date": date_str, "available": False}
    else:
        # Add availability (toggle ON)
        availability_dict = {
            "id": str(uuid.uuid4()),
            "artist_id": current_user.id,
            "date": date_str,
            "note": day_data.note or "",
            "color": day_data.color or "#3b82f6",
            "created_at": datetime.now(timezone.utc)
        }
        await db.availability_days.insert_one(availability_dict)
        
        # Remove _id for return
        availability_dict.pop('_id', None)
        return {"action": "added", "date": date_str, "available": True, "availability": availability_dict}

@api_router.get("/availability-days", response_model=List[Dict[str, Any]])
async def get_availability_days(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.ARTIST:
        # Artists can only see their own availability days
        query = {"artist_id": current_user.id}
        
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            if "date" in query:
                query["date"]["$lte"] = end_date
            else:
                query["date"] = {"$lte": end_date}
        
        availability_days = await db.availability_days.find(query).to_list(1000)
        result = []
        for day in availability_days:
            # Remove MongoDB _id field and ensure proper data types
            day.pop('_id', None)
            result.append(day)
        return result
    
    else:
        # Admin can see all availability days with artist info
        query = {}
        
        if start_date:
            query["date"] = {"$gte": start_date}
        if end_date:
            if "date" in query:
                query["date"]["$lte"] = end_date
            else:
                query["date"] = {"$lte": end_date}
        
        availability_days = await db.availability_days.find(query).to_list(1000)
        
        result = []
        for day in availability_days:
            # Get artist profile
            profile = await db.artist_profiles.find_one({"user_id": day['artist_id']})
            user = await db.users.find_one({"id": day['artist_id']})
            
            # Remove MongoDB _id field and add artist info
            day.pop('_id', None)
            day['artist_name'] = profile.get('nom_de_scene') if profile else (user.get('email') if user else 'Artiste inconnu')
            day['artist_email'] = user.get('email') if user else ''
            day['artist_category'] = profile.get('category') if profile else None
            
            result.append(day)
        
        return result

@api_router.get("/availability-days/{day_date}", response_model=List[ArtistWithProfile])
async def get_artists_available_on_date(day_date: str, current_user: User = Depends(get_current_admin)):
    """Get list of artists available on a specific date (admin only)"""
    try:
        target_date = datetime.strptime(day_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez YYYY-MM-DD")
    
    # Find all availability days for this date
    availability_days = await db.availability_days.find({"date": day_date}).to_list(1000)
    
    available_artists = []
    for day in availability_days:
        # Get artist profile
        profile = await db.artist_profiles.find_one({"user_id": day['artist_id']})
        user = await db.users.find_one({"id": day['artist_id']})
        
        if user and profile:
            profile.pop('_id', None)
            available_artists.append(ArtistWithProfile(
                id=user['id'],
                email=user['email'],
                nom_de_scene=profile.get('nom_de_scene', ''),
                telephone=profile.get('telephone'),
                lien=profile.get('lien'),
                tarif_soiree=profile.get('tarif_soiree'),
                logo_url=profile.get('logo_url'),
                gallery_urls=profile.get('gallery_urls', []),
                bio=profile.get('bio'),
                availability_count=0  # Not needed in this context
            ))
    
    return available_artists

@api_router.delete("/availability-days/{day_id}")
async def delete_availability_day(day_id: str, current_user: User = Depends(get_current_user)):
    availability_day = await db.availability_days.find_one({"id": day_id})
    if not availability_day:
        raise HTTPException(status_code=404, detail="Disponibilité non trouvée")
    
    # Check permissions
    if current_user.role == UserRole.ARTIST and availability_day['artist_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres disponibilités")
    
    await db.availability_days.delete_one({"id": day_id})
    return {"message": "Disponibilité supprimée"}

# Verification endpoint for invitation tokens
@api_router.get("/invitations/verify/{token}")
async def verify_invitation_token(token: str):
    invitation = await db.invitations.find_one({"token": token, "status": InvitationStatus.SENT})
    if not invitation:
        raise HTTPException(status_code=400, detail="Token d'invitation invalide ou expiré")
    
    # Handle timezone-aware datetime comparison
    expires_at = invitation['expires_at']
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token d'invitation invalide ou expiré")
    
    return {"valid": True, "email": invitation['email']}

# Export endpoints
@api_router.get("/export/csv")
async def export_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    artist_ids: Optional[str] = None,
    current_user: User = Depends(get_current_admin)
):
    """Export availability days and blocked dates to CSV format"""
    import csv
    from io import StringIO
    
    query = {}
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    # Get availability days
    availability_days = await db.availability_days.find(query).to_list(1000)
    
    # Get blocked dates
    blocked_dates = await db.blocked_dates.find(query).to_list(1000)
    
    # Create CSV content
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Nom Artiste", "Email", "Tarif Soirée", "Note"])
    
    # Add availability days
    for day in availability_days:
        profile = await db.artist_profiles.find_one({"user_id": day['artist_id']})
        user = await db.users.find_one({"id": day['artist_id']})
        
        artist_name = profile.get('nom_de_scene') if profile else (user.get('email') if user else 'Artiste inconnu')
        artist_email = user.get('email') if user else ''
        tarif_soiree = profile.get('tarif_soiree', '') if profile else ''
        
        writer.writerow([
            day['date'],
            'Disponibilité',
            artist_name,
            artist_email,
            tarif_soiree,
            day.get('note', '')
        ])
    
    # Add blocked dates
    for blocked in blocked_dates:
        writer.writerow([
            blocked['date'],
            'Date bloquée',
            'Administration',
            'admin@easybookevent.app',
            '',
            blocked.get('note', '')
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    return {"csv_content": csv_content, "filename": f"disponibilites_et_blocages_{datetime.now().strftime('%Y%m%d')}.csv"}

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