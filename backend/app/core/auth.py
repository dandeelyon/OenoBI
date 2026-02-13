from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Annotated

from app.core.security import decode_access_token
from app.db.database import get_async_db
from app.db.models.user import User
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/backend-api/token") # Needs to match router prefix

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_async_db)]
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    token_data = TokenData(email=email)
    
    user_query = await db.execute(select(User).where(User.email == token_data.email))
    user = user_query.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
):
    # You can add more checks here, e.g., for user being active/enabled
    return current_user
