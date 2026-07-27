import os
from datetime import timedelta

_env = os.environ.get("APP_ENV", "local")
_db_pwd = "cotton123" if _env == "prod" else "1234"
_default_db_url = f"postgresql://postgres:{_db_pwd}@localhost:5432/ticketdb"

_database_url = os.environ.get("DATABASE_URL") or os.environ.get("SQLALCHEMY_DATABASE_URI") or _default_db_url
if _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql://", 1)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'cccd-dst-courier-2026-secure-key-xK9mP2nQ')
    REMEMBER_COOKIE_DURATION = timedelta(days=7)
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=5)
    SESSION_REFRESH_EACH_REQUEST = True

    SQLALCHEMY_DATABASE_URI = _database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
    }

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = _database_url

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = _database_url

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
