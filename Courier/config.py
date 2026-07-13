import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'cccd-dst-courier-2026-secure-key-xK9mP2nQ')
    REMEMBER_COOKIE_DURATION = timedelta(days=7)
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=5)
    SESSION_REFRESH_EACH_REQUEST = True

    # MySQL on LAN server – falls back to local SQLite when server unreachable
    DB_HOST = os.environ.get('DB_HOST', '192.168.29.39')
    DB_PORT = int(os.environ.get('DB_PORT', 3306))
    DB_NAME = os.environ.get('DB_NAME', 'courier_db')
    DB_USER = os.environ.get('DB_USER', 'courier_user')
    DB_PASS = os.environ.get('DB_PASS', 'Courier@2026')

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
        'connect_args': {'connect_timeout': 5},
    }

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///courier_dev.db'
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
    }

class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
