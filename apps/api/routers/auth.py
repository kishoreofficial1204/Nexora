"""
Authentication Router for Nexora.
Provides JWT authentication, httpOnly cookie issuance, and user profile retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from apps.api.db.database import get_db
from apps.api.models.user import User
from apps.api.schemas.auth import LoginRequest, TokenResponse, UserOut
from apps.api.core.security import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(login_req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_req.email).first()
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact AICTE administrator."
        )

    token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})

    # Set secure httpOnly cookie
    response.set_cookie(
        key="nexora_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production HTTPS
        max_age=8 * 3600
    )

    return TokenResponse(
        access_token=token,
        role=user.role,
        full_name=user.full_name,
        email=user.email
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("nexora_token")
    return {"message": "Logged out successfully."}
