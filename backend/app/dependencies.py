
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models.user import User
from .security import verify_access_token


security = HTTPBearer(auto_error=False)


def get_db():
    """Create and close a database session per request."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Validate the bearer token and return the active database user."""

    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized

    user_data = verify_access_token(credentials.credentials)

    if not user_data:
        raise unauthorized

    user = db.query(User).filter(
        User.id == user_data["user_id"]
    ).first()

    if user is None:
        raise unauthorized

    # Prevent a token from remaining valid after an email change.
    if user.email.strip().lower() != user_data["email"]:
        raise unauthorized

    return user


def require_role(required_role: str):
    """Create a dependency that enforces a specific user role."""

    def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:

        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource."
            )

        return current_user

    return role_checker


def require_applicant(
    current_user: User = Depends(require_role("applicant"))
) -> User:
    return current_user


def require_recruiter(
    current_user: User = Depends(require_role("recruiter"))
) -> User:
    return current_user
