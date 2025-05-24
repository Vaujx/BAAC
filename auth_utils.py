import bcrypt
import jwt
import datetime
import os
import json
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

# JWT Secret Key
JWT_SECRET = os.getenv("JWT_SECRET", os.urandom(24).hex())

# Google OAuth credentials
GOOGLE_CLIENT_ID = "283845475740-5pdj60fgmsdvn034u4f3vea6lg1q1vqv.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET = "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"

def hash_password(password):
    """Hash a password for storing."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(stored_password, provided_password):
    """Verify a stored password against one provided by user"""
    return bcrypt.checkpw(provided_password.encode('utf-8'), stored_password.encode('utf-8'))

def generate_token(user_id, email, name):
    """Generate a JWT token for the user"""
    payload = {
        'user_id': user_id,
        'email': email,
        'name': name,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)  # Token expires in 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    """Verify a JWT token and return the payload if valid"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token has expired
    except jwt.InvalidTokenError:
        return None  # Invalid token

def verify_google_token(token):
    """Verify a Google ID token and return user info if valid"""
    try:
        # Specify the CLIENT_ID of the app that accesses the backend
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        
        # ID token is valid. Get the user's Google Account ID and email
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Wrong issuer.')
            
        return {
            'google_id': idinfo['sub'],
            'email': idinfo['email'],
            'name': idinfo.get('name', ''),
            'picture': idinfo.get('picture', '')
        }
    except ValueError:
        # Invalid token
        return None

def exchange_code_for_token(code, redirect_uri):
    """Exchange authorization code for tokens using client secret"""
    try:
        # Create a Flow instance with client credentials
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=["openid", "email", "profile"]
        )
        flow.redirect_uri = redirect_uri
        
        # Exchange authorization code for tokens
        flow.fetch_token(code=code)
        
        # Get credentials and user info
        credentials = flow.credentials
        
        # Get user info from Google
        response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {credentials.token}'}
        )
        
        if response.status_code == 200:
            user_info = response.json()
            return {
                'google_id': user_info['sub'],
                'email': user_info['email'],
                'name': user_info.get('name', ''),
                'picture': user_info.get('picture', ''),
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token
            }
        else:
            return None
    except Exception as e:
        print(f"Error exchanging code for token: {e}")
        return None
