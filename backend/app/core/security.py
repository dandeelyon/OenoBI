from datetime import datetime, timedelta
from typing import Optional
import hashlib

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings # Will need SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.ALGORITHM
SECRET_KEY = settings.SECRET_KEY


def get_password_hash(password: str) -> str:
    print(f"Input password: {password[:20]}... (len={len(password)})")  # Debug
    password_bytes = hashlib.sha256(password.encode()).hexdigest()
    print(f"SHA256 hash: {password_bytes} (len={len(password_bytes)})")  # Debug
    return pwd_context.hash(password_bytes)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Pre-hash before verifying
    password_bytes = hashlib.sha256(plain_password.encode()).hexdigest()
    return pwd_context.verify(password_bytes, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        decoded_payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return decoded_payload
    except JWTError:
        return None