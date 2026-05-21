from pathlib import Path
import os
from urllib.parse import urlparse
import dj_database_url

# ------------------------------
# BASE DIR
# ------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_VERSION = 2

# ------------------------------
# SECURITY & PLATFORM DETECTION
# ------------------------------
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")

# Detect if we are running on Vercel
VERCEL = os.environ.get("VERCEL") == "1"

DEBUG = os.environ.get("DEBUG", "True") == "True" if not VERCEL else False

# ------------------------------
# HOSTS & CSRF
# ------------------------------
if VERCEL:
    # Vercel provides the current deployment URL via VERCEL_URL
    VERCEL_URL = os.environ.get("VERCEL_URL")
    ALLOWED_HOSTS = [".vercel.app"]
    if VERCEL_URL:
        ALLOWED_HOSTS.append(VERCEL_URL)
        
    CSRF_TRUSTED_ORIGINS = ["https://*.vercel.app"]
else:
    ALLOWED_HOSTS = os.environ.get(
        "ALLOWED_HOSTS", "127.0.0.1,localhost"
    ).split(",")
    CSRF_TRUSTED_ORIGINS = os.environ.get(
        "CSRF_TRUSTED_ORIGINS",
        "http://127.0.0.1,http://localhost"
    ).split(",")

# ------------------------------
# 🚨 CRITICAL FIX FOR PROXY (CSRF + HTTPS)
# ------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SAMESITE = "Lax"

# (Optional – helps during debugging, safe to remove later)
WHITENOISE_MAX_AGE = 0

# ------------------------------
# MEDIA (Vercel has a read-only filesystem; uploads require S3/Cloudinary)
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
    "channels",  # Note: Channels/WebSockets won't work in serverless mode
]

# ------------------------------
# MIDDLEWARE
# ------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
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
# ASGI is pulled out because Vercel builds deploy around WSGI serverless entry points
# ASGI_APPLICATION = "ksitm_vlcp.asgi.application" 

# ------------------------------
# DATABASE (Use live database string on Vercel)
# ------------------------------
DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600, # Recommended for remote serverless database connections
    )
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
# CHANNELS (Disabled for Vercel Serverless environment)
# ------------------------------
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
# CORS (testing only)
# ------------------------------
CORS_ALLOW_ALL_ORIGINS = True