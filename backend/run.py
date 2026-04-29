import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    reload = os.environ.get("UVICORN_RELOAD", "true").lower() in {"1", "true", "yes"}
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=reload)
