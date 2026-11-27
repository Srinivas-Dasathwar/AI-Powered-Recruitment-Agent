
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..schemas.user import UserCreate, UserLogin
from ..security import create_access_token


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    email = str(user_data.email).strip().lower()

    existing_user = db.query(User).filter(
        User.email == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    try:
        hashed_password = pwd_context.hash(user_data.password)

        new_user = User(
            name=user_data.name,
            email=email,
            password_hash=hashed_password,
            role="applicant"
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "message": "User registered successfully",
            "user_id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role
        }

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    except Exception:
        db.rollback()
        logger.exception("User registration failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later."
        )


@router.post("/login")
def login(
    user_data: UserLogin,
    db: Session = Depends(get_db)
):
    email = str(user_data.email).strip().lower()

    user = db.query(User).filter(
        User.email == email
    ).first()

    # Use a generic response for missing users and incorrect passwords.
    password_valid = False

    if user:
        try:
            password_valid = pwd_context.verify(
                user_data.password,
                user.password_hash
            )
        except (ValueError, TypeError):
            logger.warning(
                "Password hash verification failed for an account."
            )

    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email
        }
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):
    return {
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }
