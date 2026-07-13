from datetime import datetime, timedelta
from flask import Flask, session, redirect, url_for, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, logout_user, current_user
from config import config

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'warning'


def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    login_manager.init_app(app)

    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    TIMEOUT_MINUTES = 5

    @app.before_request
    def check_inactivity():
        # Skip static files and the login/logout routes themselves
        if request.endpoint in (None, 'static', 'auth.login', 'auth.logout'):
            return
        if not current_user.is_authenticated:
            return
        last = session.get('_last_active')
        now  = datetime.utcnow()
        if last:
            idle = now - datetime.fromisoformat(last)
            if idle > timedelta(minutes=TIMEOUT_MINUTES):
                logout_user()
                session.clear()
                return redirect(url_for('auth.login', reason='timeout'))
        session['_last_active'] = now.isoformat()
        session.modified = True

    @app.route('/api/ping')
    def session_ping():
        """Heartbeat endpoint — refreshes inactivity timer when user is active."""
        if current_user.is_authenticated:
            session['_last_active'] = datetime.utcnow().isoformat()
            session.modified = True
            return jsonify(ok=True)
        return jsonify(ok=False), 401

    from .auth import auth as auth_bp
    app.register_blueprint(auth_bp)

    from .main import main as main_bp
    app.register_blueprint(main_bp)

    from .couriers import couriers as couriers_bp
    app.register_blueprint(couriers_bp, url_prefix='/couriers')

    from .admin import admin as admin_bp
    app.register_blueprint(admin_bp, url_prefix='/admin')

    from .reports import reports as reports_bp
    app.register_blueprint(reports_bp, url_prefix='/reports')

    return app
