import base64
import io
import logging

from openai import OpenAI, OpenAIError

from .config import get_settings
from .prompts import build_image_prompt

log = logging.getLogger(__name__)


def _client() -> OpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=settings.openai_api_key)


def generate_styling_image(
    *,
    report_type: str,
    image_bytes: bytes,
    mime_type: str,
    size: str = "1024x1536",
    quality: str = "high",
) -> bytes:
    """Generate the styling image with gpt-image-2 using the portrait as identity reference."""
    settings = get_settings()
    prompt = build_image_prompt(report_type)

    client = _client()

    ext = "png" if mime_type == "image/png" else ("jpg" if mime_type in ("image/jpeg", "image/jpg") else "png")
    file_tuple = (f"portrait.{ext}", io.BytesIO(image_bytes), mime_type)

    kwargs: dict = {
        "model": settings.openai_image_model,
        "image": file_tuple,
        "prompt": prompt,
        "size": size,
        "n": 1,
    }
    if quality:
        kwargs["quality"] = quality

    try:
        result = client.images.edit(**kwargs)
    except TypeError as e:
        # Older openai SDKs don't accept "quality" on images.edit — retry without it.
        if "quality" in str(e) and "quality" in kwargs:
            log.warning("openai SDK does not accept quality= on images.edit; retrying without it")
            kwargs.pop("quality", None)
            result = client.images.edit(**kwargs)
        else:
            raise
    except OpenAIError:
        log.exception("Image generation failed")
        raise

    data0 = result.data[0]
    if getattr(data0, "b64_json", None):
        return base64.b64decode(data0.b64_json)

    url = getattr(data0, "url", None)
    if url:
        import httpx
        r = httpx.get(url, timeout=60)
        r.raise_for_status()
        return r.content

    raise RuntimeError("Image API returned no data")
