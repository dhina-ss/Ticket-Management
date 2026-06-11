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
    host = '122.165.253.167' if args.env == 'prod' else 'localhost'
    print(f"Starting Waitress server on {host}:{port} in {args.env} mode...")
    
    try:
        serve(app, host=host, port=port)
    except Exception as e:
        if args.env == 'prod':
            print(f"Warning: Could not bind directly to {host} ({e}). Falling back to 0.0.0.0...")
            serve(app, host='0.0.0.0', port=port)
        else:
            raise e
