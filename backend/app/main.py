import base64
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .clerk_auth import get_current_user
from .config import get_settings
from .db import get_db, init_db
from .models import Generation, User
from .prompts import PROMPT_BY_REPORT, build_image_prompt
from .services import generate_styling_image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("styletwin")

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="StyleTwin API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ALLOWED_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def _validate_upload(file: UploadFile, data: bytes) -> str:
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(415, f"Unsupported image type: {file.content_type}")
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(413, f"Image too large (>{settings.max_upload_mb} MB)")
    return file.content_type or "image/png"


# ---------------------------- Schemas ----------------------------


class UserOut(BaseModel):
    id: int
    clerk_id: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    age: int | None = None
    gender: str | None = None
    image_url: str | None = None
    onboarded_at: Any = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    age: int | None = Field(default=None, ge=0, le=150)
    gender: str | None = Field(default=None, max_length=32)
    complete_onboarding: bool = False


class GenerationOut(BaseModel):
    id: int
    report_type: str
    size: str
    quality: str
    status: str
    created_at: Any
    image_b64: str | None = None
    image_mime: str = "image/png"

    class Config:
        from_attributes = True


# ---------------------------- Routes ----------------------------


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "image_model": settings.openai_image_model,
        "report_types": list(PROMPT_BY_REPORT.keys()),
        "auth_disabled": settings.auth_disabled,
    }


@app.get("/api/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@app.patch("/api/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    from datetime import datetime as _dt

    data = payload.model_dump(exclude_unset=True)
    complete = data.pop("complete_onboarding", False)
    for k, v in data.items():
        setattr(user, k, v)
    if complete and user.onboarded_at is None:
        user.onboarded_at = _dt.utcnow()
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@app.get("/api/me/generations", response_model=list[GenerationOut])
def list_my_generations(
    limit: int = 20,
    include_image: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GenerationOut]:
    limit = max(1, min(limit, 100))
    rows = (
        db.query(Generation)
        .filter(Generation.user_id == user.id)
        .order_by(Generation.created_at.desc())
        .limit(limit)
        .all()
    )
    out: list[GenerationOut] = []
    for g in rows:
        out.append(
            GenerationOut(
                id=g.id,
                report_type=g.report_type,
                size=g.size,
                quality=g.quality,
                status=g.status,
                created_at=g.created_at,
                image_b64=g.image_b64 if include_image else None,
                image_mime=g.image_mime,
            )
        )
    return out


@app.get("/api/me/generations/{gen_id}", response_model=GenerationOut)
def get_my_generation(
    gen_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationOut:
    g = (
        db.query(Generation)
        .filter(Generation.id == gen_id, Generation.user_id == user.id)
        .one_or_none()
    )
    if g is None:
        raise HTTPException(404, "Generation not found")
    return GenerationOut(
        id=g.id,
        report_type=g.report_type,
        size=g.size,
        quality=g.quality,
        status=g.status,
        created_at=g.created_at,
        image_b64=g.image_b64,
        image_mime=g.image_mime,
    )


@app.post("/api/report")
async def generate_report(
    portrait: UploadFile = File(...),
    report_type: str = Form("full_report"),
    size: str = Form("1024x1536"),
    quality: str = Form("high"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Generate a styling image and persist a Generation row for the authenticated user."""
    if report_type not in PROMPT_BY_REPORT:
        raise HTTPException(400, f"Unknown report_type: {report_type}")

    data = await portrait.read()
    mime = _validate_upload(portrait, data)
    prompt = build_image_prompt(report_type)

    gen = Generation(
        user_id=user.id,
        report_type=report_type,
        size=size,
        quality=quality,
        prompt=prompt,
        portrait_mime=mime,
        portrait_size_bytes=len(data),
        status="pending",
    )
    db.add(gen)
    db.commit()
    db.refresh(gen)

    try:
        out = generate_styling_image(
            report_type=report_type,
            image_bytes=data,
            mime_type=mime,
            size=size,
            quality=quality,
        )
    except Exception as e:
        log.exception("generate failed")
        gen.status = "failed"
        gen.error_message = str(e)[:1000]
        db.commit()
        raise HTTPException(502, f"Image generation failed: {e}")

    image_b64 = base64.b64encode(out).decode("ascii")
    gen.status = "success"
    gen.image_mime = "image/png"
    if settings.store_images_in_db:
        gen.image_b64 = image_b64
    db.commit()

    return {
        "id": gen.id,
        "report_type": report_type,
        "image_b64": image_b64,
        "mime_type": "image/png",
    }
