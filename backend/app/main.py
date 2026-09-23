"""Entrypoint FastAPI LoraField: setup app, include router, dan serving SPA."""

import logging
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


# Logging dikonfigurasi sebelum modul app lain di-import supaya log startup ikut tertangkap.
LOG_DIR = Path(__file__).resolve().parents[1] / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

_log_format = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
_file_handler = RotatingFileHandler(
    LOG_DIR / "app.log",
    maxBytes=10 * 1024 * 1024,
    backupCount=5,
    encoding="utf-8",
)
_file_handler.setFormatter(_log_format)
_file_handler.setLevel(logging.INFO)

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(_log_format)
_console_handler.setLevel(logging.INFO)

logging.basicConfig(level=logging.INFO, handlers=[_file_handler, _console_handler], force=True)

logger = logging.getLogger("lorafield")

from .config import settings  # noqa: E402
from .database import init_db  # noqa: E402
from .deps import client_ip  # noqa: E402
from .routers import auth, farms, gateways, logs, nodes, utils  # noqa: E402


FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

_DEV_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
_extra_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
_CORS_ORIGINS = list(dict.fromkeys(_DEV_ORIGINS + _extra_origins))


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY tidak dikonfigurasi. "
            "Tambahkan JWT_SECRET_KEY ke file .env sebelum menjalankan server."
        )
    init_db()
    logger.info(
        "LoraField backend startup: dist_dir=%s cors_origins=%d",
        FRONTEND_DIST_DIR.exists(),
        len(_CORS_ORIGINS),
    )
    yield


app = FastAPI(
    title="LoraField Backend",
    description="API untuk dashboard monitoring pertanian LoraField.",
    version="1.3.0",
    lifespan=lifespan,
)

# Asset hasil build Vite dari frontend/dist/.
if FRONTEND_DIST_DIR.exists():
    dist_assets = FRONTEND_DIST_DIR / "assets"
    if dist_assets.exists():
        app.mount("/assets", StaticFiles(directory=str(dist_assets)), name="dist-assets")
    dist_static = FRONTEND_DIST_DIR / "static"
    if dist_static.exists():
        app.mount("/static", StaticFiles(directory=str(dist_static)), name="dist-static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all untuk error tak terduga. Log full traceback, return generic 500
    ke client supaya tidak bocor stack trace."""
    logger.exception(
        "Unhandled exception | %s %s | ip=%s",
        request.method,
        request.url.path,
        client_ip(request),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Terjadi kesalahan internal. Tim kami sudah dinotifikasi."},
    )


app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(gateways.router)
app.include_router(nodes.router)
app.include_router(logs.router)
app.include_router(utils.router)


def _serve_react_index() -> FileResponse | None:
    if not FRONTEND_DIST_DIR.exists():
        return None
    index_path = FRONTEND_DIST_DIR / "index.html"
    if not index_path.exists():
        return None
    return FileResponse(index_path)


@app.get("/")
def root():
    react_index = _serve_react_index()
    if react_index is not None:
        return react_index
    return {"service": "LoraField Backend", "status": "ready", "health": "/health"}


@app.get("/{page_name}.html")
def static_html_page(page_name: str):
    # Kompat URL lama berakhiran .html: arahkan ke React index (routing client-side).
    react_index = _serve_react_index()
    if react_index is not None:
        return react_index
    raise HTTPException(status_code=404, detail="Halaman tidak ditemukan")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Catch-all SPA wajib terdaftar paling akhir, setelah semua include_router di atas,
# supaya tidak menelan route API.
@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    if full_path.startswith(("api/", "docs", "redoc", "openapi", "health")):
        raise HTTPException(status_code=404, detail="Not found")
    react_index = _serve_react_index()
    if react_index is not None:
        return react_index
    raise HTTPException(status_code=404, detail="Not found")
