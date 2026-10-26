from pydantic import BaseModel, ConfigDict
from typing import Optional


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    email: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    organization: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
