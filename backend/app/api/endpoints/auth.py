from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select # <--- ADDED THIS IMPORT
from datetime import timedelta # <--- ADDED THIS IMPORT
from typing import Annotated

from app.db.database import get_async_db
from app.db.models.user import User
from app.schemas.auth import UserCreate, UserLogin, Token, UserResponse
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.auth import get_current_active_user
from app.config import settings

router = APIRouter()

# --- Utility to read allowlist ---
def read_allowlist() -> set[str]:
    try:
        # allowlist.txt is at the project root
        with open("allowlist.txt", "r") as f:
            emails = {line.strip().lower() for line in f if line.strip()}
        return emails
    except FileNotFoundError:
        print("allowlist.txt not found. No email restrictions will be applied for signup.")
        return set()

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup_user(
    user_data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    background_tasks: BackgroundTasks # For reading allowlist in background if it's large
):
    allowlist = read_allowlist() # Read allowlist synchronously for now, optimize later

    if user_data.email.lower() not in allowlist:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not in allowlist."
        )

    # Check if user already exists
    existing_user = await db.execute(select(User).where(User.email == user_data.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account with this email already exists."
        )
    print(f"""user: {user_data.email}, password: {user_data.password}""")
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserResponse(id=new_user.id, email=new_user.email)

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_async_db)]
):
    user_query = await db.execute(select(User).where(User.email == form_data.username))
    user = user_query.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=UserResponse)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    return UserResponse(id=current_user.id, email=current_user.email)
