import argparse
import os
from waitress import serve

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run the production server.')
    parser.add_argument('-e', '--env', choices=['local', 'prod'], default='local', help='Environment (local or prod)')
    args = parser.parse_args()

    # Set environment variable BEFORE importing app to ensure database.py sees it
    os.environ['APP_ENV'] = args.env
    
    from app import app
    
    port = 443
    host = '0.0.0.0' if args.env == 'prod' else 'localhost'
    print(f"Starting Waitress server on {host}:{port} in {args.env} mode...")
    
    serve(app, host=host, port=port)
