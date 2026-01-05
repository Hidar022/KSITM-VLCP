from pathlib import Path
import os
from urllib.parse import urlparse

# ------------------------------
# BASE DIR
# ------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# ------------------------------
# SECURITY
# ------------------------------
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")

# Detect if we are on Railway
RAILWAY = os.environ.get("RAILWAY_ENV")  # Railway automatically sets this env

DEBUG = os.environ.get("DEBUG", "True") == "True" if not RAILWAY else False

# ------------------------------
# HOSTS & CSRF
# ------------------------------
if RAILWAY:
    # Production on Railway
    ALLOWED_HOSTS = [".railway.app"]
    CSRF_TRUSTED_ORIGINS = ["https://*.railway.app"]
else:
    # Local development
    ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    CSRF_TRUSTED_ORIGINS = os.environ.get(
        "CSRF_TRUSTED_ORIGINS", "http://127.0.0.1,http://localhost"
    ).split(",")

# ------------------------------
# MEDIA
# ------------------------------
MEDIA_URL = os.environ.get("MEDIA_URL", "/media/")
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# ------------------------------
# APPS
# ------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Your apps
    "main",

    # Third-party
    "widget_tweaks",
    "channels",
]

# ------------------------------
# MIDDLEWARE
# ------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",  # CSRF protection
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ------------------------------
# URLS AND TEMPLATES
# ------------------------------
ROOT_URLCONF = "ksitm_vlcp.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "ksitm_vlcp.wsgi.application"
ASGI_APPLICATION = "ksitm_vlcp.asgi.application"

# ------------------------------
# DATABASE
# ------------------------------
import dj_database_url

DATABASES = {
    "default": dj_database_url.config(default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
}

# ------------------------------
# PASSWORD VALIDATION
# ------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ------------------------------
# INTERNATIONALIZATION
# ------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ------------------------------
# STATIC FILES
# ------------------------------
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "main" / "static"] if DEBUG else []
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ------------------------------
# CHANNELS (Redis)
# ------------------------------
REDIS_URL = os.environ.get("REDIS_URL")

if REDIS_URL:
    redis_url = urlparse(REDIS_URL)
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [
                    f"{redis_url.scheme}://:{redis_url.password}@{redis_url.hostname}:{redis_url.port}/0"
                ],
            },
        },
    }
else:
    # Local dev fallback
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# ------------------------------
# EMAIL
# ------------------------------
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "no-reply@example.com"

# ------------------------------
# LOGIN / LOGOUT
# ------------------------------
LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/dashboard/"
LOGOUT_REDIRECT_URL = "/login/"

# ------------------------------
# CORS (optional)
# ------------------------------
CORS_ALLOW_ALL_ORIGINS = True  # for testing, can restrict later
