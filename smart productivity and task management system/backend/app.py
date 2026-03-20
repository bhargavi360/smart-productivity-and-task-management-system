from flask import Flask
from flask_cors import CORS
from database import init_db
from routes import api_bp
import os

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'super-secret-key' # Use env var in production

    # Initialize extensions
    CORS(app)
    init_db(app)

    # Register Blueprints
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/')
    def index():
        return {"message": "Welcome to Smart Productivity API", "status": "running"}

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
