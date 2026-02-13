from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    access_token = Column(String, nullable=True) # For session management, can store JWT

    def __repr__(self):
        return f"<User(email='{self.email}')>"