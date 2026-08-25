"""HTTP only: parse, call AuthService, shape the response + refresh cookie."""

from fastapi import APIRouter, Request, Response, status

from app.core.config import get_settings
from app.core.deps import CurrentUser, DbSession
from app.core.ratelimit import LOGIN_LIMIT, limiter
from app.schemas.auth import LoginIn, MeUpdateIn, RegisterIn, TokenOut
from app.schemas.user import UserOut
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"  # only sent to auth endpoints, not every API call


def set_refresh_cookie(response: Response, raw: str) -> None:
    settings = get_settings()
    # No `domain`: defaults to the host the browser saw (the Vercel origin via the
    # proxy) so the cookie stays first-party. SameSite=Lax is then sufficient.
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw,
        max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,  # type: ignore[arg-type]
    )


def clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    # Attributes must match set_cookie exactly or the browser keeps the cookie.
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,  # type: ignore[arg-type]
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def register(data: RegisterIn, db: DbSession) -> UserOut:
    return UserOut.model_validate(AuthService(db).register(data))


@router.post("/login", response_model=TokenOut)
@limiter.limit(LOGIN_LIMIT)
def login(request: Request, response: Response, data: LoginIn, db: DbSession) -> TokenOut:
    access, expires_in, raw_refresh, user = AuthService(db).login(data.email, data.password)
    set_refresh_cookie(response, raw_refresh)
    return TokenOut(access_token=access, expires_in=expires_in, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenOut)
def refresh(request: Request, response: Response, db: DbSession) -> TokenOut:
    raw = request.cookies.get(REFRESH_COOKIE)
    access, expires_in, new_raw, user = AuthService(db).refresh(raw)
    set_refresh_cookie(response, new_raw)
    return TokenOut(access_token=access, expires_in=expires_in, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def logout(request: Request, response: Response, db: DbSession) -> None:
    AuthService(db).logout(request.cookies.get(REFRESH_COOKIE))
    clear_refresh_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(data: MeUpdateIn, user: CurrentUser, db: DbSession) -> UserOut:
    return UserOut.model_validate(AuthService(db).update_me(user, data))
