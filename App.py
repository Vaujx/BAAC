from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash, make_response
import os
from dotenv import load_dotenv
import google.generativeai as genai
import psycopg2
from psycopg2 import pool
import psycopg2.extras
from datetime import datetime, timedelta
import logging
import re
import json
import jwt
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from werkzeug.security import generate_password_hash, check_password_hash
from auth_utils import hash_password, verify_password, generate_token, verify_token, verify_google_token
from barangay_data import (
    BARANGAY_OFFICIALS_INFO, 
    AVAILABLE_DOCUMENTS, 
    is_about_officials, 
    is_about_population, 
    detect_document_type
)
from notable_places import handle_place_request, is_place_request, get_random_images, NOTABLE_PLACES

from barangay_history import get_relevant_info

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables from the .env file for local development
# This will be ignored in production where environment variables are set in Render
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24).hex())  # Use environment variable if available
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)  # Session expires after 1 hour

# Email configuration
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587 
EMAIL_ADDRESS = 'baac.ai.zambales@gmail.com'
EMAIL_PASSWORD = 'vntq tvkq cvjx vcbi'  # App password

# Load the GEMINI_API_KEY from environment variables
api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    logger.error(f"Environment keys: {list(os.environ.keys())}")  # Debug log
    logger.error("API key is missing. Please set GEMINI_API_KEY in your Railway environment variables.")
    raise ValueError("API key is missing. Please set GEMINI_API_KEY in your Railway environment variables.")

# Configure the Gemini API client - using the older API style
genai.configure(api_key=api_key)

# Model configuration - removed response_mime_type
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
}

# Create the model instance
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash", 
    generation_config=generation_config,
)

# Admin credentials from environment variables
ADMIN_KEY = os.getenv("ADMIN_KEY", "EASTER")
ADMIN_PASS = os.getenv("ADMIN_PASS", "EGG")

# Database URL - get from environment or use default for development
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:nqosxoobTbnoRKfMtxDLWoLgjmuXzxsV@crossover.proxy.rlwy.net:55420/railway")

# PostgreSQL connection pool
try:
    connection_pool = pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=DATABASE_URL
    )
    logger.info("PostgreSQL connection pool created successfully")
except Exception as e:
    logger.error(f"Error creating PostgreSQL connection pool: {e}")
    raise

# Get connection from pool
def get_connection():
    try:
        connection = connection_pool.getconn()
        return connection
    except Exception as e:
        logger.error(f"Error getting connection from pool: {e}")
        return None

# Return connection to pool
def return_connection(connection):
    connection_pool.putconn(connection)

# Email verification functions
def send_verification_email(email, username, verification_token):
    """Send verification email to user"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = email
        msg['Subject'] = "BAAC - Verify Your Email Address"
        
        # Create verification URL
        verification_url = f"{request.url_root}verify-email/{verification_token}"
        
        # Email body
        body = f"""
        <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Welcome to BAAC!</h2>
                <p>Hello {username},</p>
                <p>Thank you for registering with BAAC (Barangay Amungan Assistant Chatbot). To complete your registration, please verify your email address by clicking the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
                </div>
                
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #3498db;">{verification_url}</p>
                
                <p><strong>Note:</strong> This verification link will expire in 24 hours.</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #7f8c8d; font-size: 12px;">
                    This email was sent by BAAC (Barangay Amungan Assistant Chatbot). If you didn't create an account, please ignore this email.
                </p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_ADDRESS, email, text)
        server.quit()
        
        logger.info(f"Verification email sent to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {str(e)}")
        return False

def send_password_reset_email(email, username, reset_token):
    """Send password reset email to user"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = email
        msg['Subject'] = "BAAC - Password Reset Request"
        
        # Create reset URL
        reset_url = f"{request.url_root}reset_password/{reset_token}"
        
        # Email body
        body = f"""
        <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e53935;">Password Reset Request</h2>
                <p>Hello {username},</p>
                <p>We received a request to reset your password for your BAAC (Barangay Amungan Assistant Chatbot) account. If you made this request, please click the button below to reset your password:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="background-color: #e53935; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                </div>
                
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #e53935;">{reset_url}</p>
                
                <p><strong>Important:</strong></p>
                <ul>
                    <li>This password reset link will expire in 1 hour for security reasons</li>
                    <li>You can only use this link once</li>
                    <li>If you didn't request this password reset, please ignore this email</li>
                </ul>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #7f8c8d; font-size: 12px;">
                    This email was sent by BAAC (Barangay Amungan Assistant Chatbot). If you didn't request a password reset, please ignore this email and your password will remain unchanged.
                </p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_ADDRESS, email, text)
        server.quit()
        
        logger.info(f"Password reset email sent to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return False

def generate_verification_token():
    """Generate a secure verification token"""
    return secrets.token_urlsafe(32)

def verify_email_token(verification_token):
    """Verify user email with token"""
    connection = get_connection()
    if connection is None:
        return False, "Database connection failed"
        
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Find user with verification token
        cursor.execute('''
            SELECT id, name, email, verification_expires 
            FROM app_users 
            WHERE verification_token = %s AND is_verified = FALSE
        ''', (verification_token,))
        
        user = cursor.fetchone()
        
        if not user:
            return False, "Invalid or expired verification token"
        
        user_id, username, email, verification_expires = user
        
        # Check if token has expired
        if datetime.now() > verification_expires:
            return False, "Verification token has expired"
        
        # Update user as verified
        cursor.execute('''
            UPDATE app_users 
            SET is_verified = TRUE, verification_token = NULL, verification_expires = NULL
            WHERE id = %s
        ''', (user_id,))
        
        connection.commit()
        
        logger.info(f"User {username} ({email}) verified successfully")
        return True, f"Email verified successfully! You can now log in with your account."
        
    except Exception as e:
        logger.error(f"Error verifying email: {str(e)}")
        connection.rollback()
        return False, "An error occurred during verification"
    finally:
        cursor.close()
        return_connection(connection)

# Function to get user by email
def get_user_by_email(email):
    connection = get_connection()
    if connection is None:
        return None
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        query = "SELECT * FROM app_users WHERE email = %s"
        cursor.execute(query, (email,))
        user = cursor.fetchone()
        
        if user:
            return dict(user)
        return None
    except Exception as e:
        logger.error(f"Error getting user by email: {e}")
        return None
    finally:
        cursor.close()
        return_connection(connection)

# Function to log conversations
def log_conversation(user_input, ai_response, user_id=None):
    connection = get_connection()
    if connection is None:
        return

    try:
        cursor = connection.cursor()
        query = "INSERT INTO conversation_logs (user_input, ai_response, timestamp, user_id) VALUES (%s, %s, %s, %s)"
        values = (user_input, ai_response, datetime.now(), user_id)
        cursor.execute(query, values)
        connection.commit()
    except Exception as e:
        logger.error(f"Error logging conversation: {e}")
        connection.rollback()
    finally:
        cursor.close()
        return_connection(connection)

def log_website_visit():
    connection = get_connection()
    if connection is None:
        return

    try:
        cursor = connection.cursor()
        # PostgreSQL doesn't have ON DUPLICATE KEY UPDATE, use INSERT ... ON CONFLICT instead
        query = """
        INSERT INTO website_visits (visit_date, visit_count)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT (visit_date) 
        DO UPDATE SET visit_count = website_visits.visit_count + 1
        """
        cursor.execute(query)
        connection.commit()
    except Exception as e:
        logger.error(f"Error logging website visit: {e}")
        connection.rollback()
    finally:
        cursor.close()
        return_connection(connection)

def log_document_request(document_type):
    connection = get_connection()
    if connection is None:
        return

    try:
        cursor = connection.cursor()
        # PostgreSQL version of ON DUPLICATE KEY UPDATE
        query = """
        INSERT INTO document_requests (request_date, document_type, request_count)
        VALUES (CURRENT_DATE, %s, 1)
        ON CONFLICT (request_date, document_type) 
        DO UPDATE SET request_count = document_requests.request_count + 1
        """
        cursor.execute(query, (document_type,))
        connection.commit()
    except Exception as e:
        logger.error(f"Error logging document request: {e}")
        connection.rollback()
    finally:
        cursor.close()
        return_connection(connection)

# FIXED: Function to get document status by reference ID
def get_document_status(reference_id):
    connection = get_connection()
    if connection is None:
        logger.error("Failed to get database connection in get_document_status")
        return None

    cursor = None
    try:
        logger.info(f"Checking status for reference ID: {reference_id}")
        
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Extract the numeric part of the reference ID
        doc_id = reference_id.split('-')[1] if '-' in reference_id else reference_id
        logger.info(f"Extracted document ID: {doc_id}")
        
        # FIXED: Get the document details - use document_types instead of document_type
        query = """
        SELECT id, 
               CASE 
                   WHEN document_types IS NOT NULL THEN document_types
                   ELSE ARRAY['Unknown']
               END as document_types,
               name, status, pickup_date, submission_date
        FROM document_submissions
        WHERE id = %s
        """
        cursor.execute(query, (doc_id,))
        result = cursor.fetchone()
        
        if result:
            result_dict = dict(result)
            # Convert array to string for display
            if isinstance(result_dict['document_types'], list):
                result_dict['document_type'] = ', '.join(result_dict['document_types'])
            else:
                result_dict['document_type'] = str(result_dict['document_types'])
            logger.info(f"Found document: {result_dict}")
            return result_dict
        
        logger.warning(f"No document found with ID {doc_id}")
        return None
    except Exception as e:
        logger.error(f"Error getting document status: {e}")
        return None
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            return_connection(connection)

# Function to format response with proper HTML styling
def format_response_html(text):
    # Replace markdown bullet points (* Item) with HTML list items
    if '*' in text:
        # Check if the text contains bullet points
        lines = text.split('\n')
        in_list = False
        formatted_lines = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('*'):
                if not in_list:
                    # Start a new list
                    formatted_lines.append('<ul class="list-disc pl-5 space-y-2">')
                    in_list = True
                # Convert the bullet point to an HTML list item with styling
                item_text = line[1:].strip()
                formatted_lines.append(f'<li class="text-base">{item_text}</li>')
            else:
                if in_list:
                    # Close the list
                    formatted_lines.append('</ul>')
                    in_list = False
                formatted_lines.append(line)
        
        if in_list:
            # Close the list if it's still open
            formatted_lines.append('</ul>')
        
        return '\n'.join(formatted_lines)

    # If no bullet points, return the original text
    return text

# Load admin credentials from database
def load_admin_credentials():
    global ADMIN_KEY, ADMIN_PASS

    connection = get_connection()
    if connection is None:
        logger.warning("Could not load admin credentials from database, using defaults")
        return
        
    try:
        cursor = connection.cursor()
        
        # Check if env_variables table exists
        cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'env_variables'
        );
        """)
        
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            logger.info("env_variables table does not exist, using default admin credentials")
            return
            
        # Get ADMIN_KEY
        cursor.execute("SELECT value FROM env_variables WHERE key = 'ADMIN_KEY'")
        admin_key_row = cursor.fetchone()
        
        # Get ADMIN_PASS
        cursor.execute("SELECT value FROM env_variables WHERE key = 'ADMIN_PASS'")
        admin_pass_row = cursor.fetchone()
        
        if admin_key_row and admin_pass_row:
            ADMIN_KEY = admin_key_row[0]
            ADMIN_PASS = admin_pass_row[0]
            logger.info("Admin credentials loaded from database")
    except Exception as e:
        logger.error(f"Error loading admin credentials: {e}")
    finally:
        cursor.close()
        return_connection(connection)
        
# Function to generate AI insights for the report
def generate_ai_insights(start_date, end_date, total_visits, total_requests, document_types_data, status_data):
    try:
        # Format the data for the AI
        document_types_summary = ", ".join([f"{doc['document_type']}: {doc['total_requests']}" for doc in document_types_data])
        status_summary = ", ".join([f"{status['status']}: {status['count']}" for status in status_data])
        
        # Create prompt for the AI
        prompt = f"""
        As a data analyst for Barangay Amungan, analyze this data from {start_date} to {end_date}:
        
        Total website visits: {total_visits}
        Total document requests: {total_requests}
        
        Document requests by type:
        {document_types_summary}
        
        Document status:
        {status_summary}
        
        Provide 3-5 key insights about this data, including trends, patterns, and recommendations for the barangay.
        Keep your analysis concise and focused on actionable insights.
        """
        
        # Generate AI response
        response = model.generate_content(prompt)
        
        # Format the response with HTML
        insights_html = response.text.replace("\n", "<br>")
        
        return insights_html
    except Exception as e:
        logger.error(f"Error generating AI insights: {e}")
        return "<p>Unable to generate AI insights for this report.</p>"

# Function to manage conversation history
def manage_conversation_history(user_input, ai_response):
    # Initialize conversation history if it doesn't exist
    if 'conversation_history' not in session:
        session['conversation_history'] = []
    
    # Add the new exchange to the history
    session['conversation_history'].append({
        'user': user_input,
        'ai': ai_response
    })
    
    # Limit the history to the last 10 exchanges to avoid context window limits
    if len(session['conversation_history']) > 10:
        session['conversation_history'] = session['conversation_history'][-10:]
    
    # Save the session
    session.modified = True

# Function to get conversation history as a formatted string for the AI context
def get_conversation_history_context():
    if 'conversation_history' not in session or not session['conversation_history']:
        return ""
    
    context = "\nRecent conversation history:\n"
    for exchange in session['conversation_history']:
        # Strip HTML tags for cleaner context
        ai_response = re.sub(r'<.*?>', '', exchange['ai'])
        context += f"User: {exchange['user']}\nBAAC: {ai_response}\n\n"
    
    return context

# Function to get chat history context for a specific chat
def get_chat_history_context(chat_id, user_id):
    connection = get_connection()
    if connection is None:
        return ""
        
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*) FROM chat_histories
        WHERE id = %s AND user_id = %s AND is_active = TRUE
        """
        cursor.execute(verify_query, (chat_id, user_id))
        count = cursor.fetchone()[0]
        
        if count == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return ""
        
        # Get the most recent messages (limit to last 10 for context window)
        query = """
        SELECT is_user, message
        FROM chat_messages
        WHERE chat_id = %s
        ORDER BY timestamp DESC
        LIMIT 10
        """
        cursor.execute(query, (chat_id,))
        
        messages = cursor.fetchall()
        
        if not messages:
            return ""
        
        # Format the messages for context
        context = "\nRecent conversation history:\n"
        
        # Reverse the messages to get chronological order
        for message in reversed(messages):
            is_user = message['is_user']
            msg_text = message['message']
            
            # Strip HTML tags for cleaner context
            msg_text = re.sub(r'<.*?>', '', msg_text)
            
            if is_user:
                context += f"User: {msg_text}\n"
            else:
                context += f"BAAC: {msg_text}\n\n"
        
        return context
    except Exception as e:
        logger.error(f"Error getting chat history context: {e}")
        return ""
    finally:
        cursor.close()
        return_connection(connection)

# Function to save a message to a chat
def save_message_to_chat(chat_id, user_id, user_message, ai_message):
    connection = get_connection()
    if connection is None:
        logger.error("Failed to get database connection in save_message_to_chat")
        return False
    
    try:
        cursor = connection.cursor()
        
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*) FROM chat_histories
        WHERE id = %s AND user_id = %s AND is_active = TRUE
        """
        cursor.execute(verify_query, (chat_id, user_id))
        count = cursor.fetchone()[0]
        
        if count == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return False
        
        # Save user message
        user_query = """
        INSERT INTO chat_messages (chat_id, is_user, message)
        VALUES (%s, TRUE, %s)
        """
        cursor.execute(user_query, (chat_id, user_message))
        
        # Save AI message
        ai_query = """
        INSERT INTO chat_messages (chat_id, is_user, message)
        VALUES (%s, FALSE, %s)
        """
        cursor.execute(ai_query, (chat_id, ai_message))
        
        # Update the chat's updated_at timestamp
        update_query = """
        UPDATE chat_histories
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """
        cursor.execute(update_query, (chat_id,))
        
        connection.commit()
        return True
    except Exception as e:
        logger.error(f"Error saving message to chat: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        return_connection(connection)

# Function to get messages for a specific chat
def get_chat_messages_by_id(chat_id, user_id):
    connection = get_connection()
    if connection is None:
        return []
        
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*) FROM chat_histories
        WHERE id = %s AND user_id = %s AND is_active = TRUE
        """
        cursor.execute(verify_query, (chat_id, user_id))
        count = cursor.fetchone()[0]
        
        if count == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return []
        
        # Get the chat messages
        query = """
        SELECT id, is_user, message, timestamp
        FROM chat_messages
        WHERE chat_id = %s
        ORDER BY timestamp ASC
        """
        cursor.execute(query, (chat_id,))
        
        messages = []
        for row in cursor.fetchall():
            message = dict(row)
            # Format dates for JSON
            if message.get('timestamp'):
                message['timestamp'] = message['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
            
            messages.append(message)
        
        return messages
    except Exception as e:
        logger.error(f"Error fetching chat messages: {e}")
        return []
    finally:
        cursor.close()
        return_connection(connection)

# Function to create chat history tables
def create_chat_history_tables():
    connection = get_connection()
    if connection is None:
        logger.error("Failed to get database connection to create chat history tables")
        return
    
    try:
        cursor = connection.cursor()
        
        # Create chat_histories table if it doesn't exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_histories (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT TRUE
        )
        """)
        
        # Check if chat_messages table exists
        cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'chat_messages'
        );
        """)
        
        table_exists = cursor.fetchone()[0]
        
        # Only create the chat_messages table if it doesn't exist
        if not table_exists:
            logger.info("Creating chat_messages table...")
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                is_user BOOLEAN NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT chat_messages_chat_id_fkey
                FOREIGN KEY (chat_id) REFERENCES chat_histories(id) ON DELETE CASCADE
            );
            """)
            
            # Create index on chat_id for better performance
            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
            """)
        else:
            logger.info("chat_messages table already exists, skipping creation")
        
        # Add foreign key constraint for chat_histories if it doesn't exist
        cursor.execute("""
        SELECT COUNT(*)
        FROM information_schema.table_constraints
        WHERE constraint_name = 'chat_histories_user_id_fkey'
        AND table_name = 'chat_histories'
        """)
        
        if cursor.fetchone()[0] == 0:
            logger.info("Adding foreign key constraint to chat_histories table...")
            cursor.execute("""
            ALTER TABLE chat_histories
            ADD CONSTRAINT chat_histories_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
            """)
        
        connection.commit()
        logger.info("Chat history tables verified successfully")
    except Exception as e:
        logger.error(f"Error verifying chat history tables: {e}")
        connection.rollback()
    finally:
        cursor.close()
        return_connection(connection)

# Function to update user table for email verification
def update_user_table_for_verification():
    connection = get_connection()
    if connection is None:
        logger.error("Failed to get database connection to update user table")
        return
    
    try:
        cursor = connection.cursor()
        
        # Check if verification columns exist
        cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'app_users' AND column_name IN ('is_verified', 'verification_token', 'verification_expires', 'reset_token', 'reset_expires')
        """)
        
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        # Add missing columns
        if 'is_verified' not in existing_columns:
            cursor.execute("ALTER TABLE app_users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE")
            logger.info("Added is_verified column to app_users table")
        
        if 'verification_token' not in existing_columns:
            cursor.execute("ALTER TABLE app_users ADD COLUMN verification_token TEXT")
            logger.info("Added verification_token column to app_users table")
        
        if 'verification_expires' not in existing_columns:
            cursor.execute("ALTER TABLE app_users ADD COLUMN verification_expires TIMESTAMP")
            logger.info("Added verification_expires column to app_users table")
            
        if 'reset_token' not in existing_columns:
            cursor.execute("ALTER TABLE app_users ADD COLUMN reset_token TEXT")
            logger.info("Added reset_token column to app_users table")
        
        if 'reset_expires' not in existing_columns:
            cursor.execute("ALTER TABLE app_users ADD COLUMN reset_expires TIMESTAMP")
            logger.info("Added reset_expires column to app_users table")
        
        connection.commit()
        logger.info("User table updated for email verification and password reset")
    except Exception as e:
        logger.error(f"Error updating user table for verification: {e}")
        connection.rollback()
    finally:
        cursor.close()
        return_connection(connection)

# Function to get user by Google ID
def get_user_by_google_id(google_id):
    connection = get_connection()
    if connection is None:
        return None
        
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        query = "SELECT * FROM app_users WHERE oauth_id = %s AND oauth_provider = 'google'"
        cursor.execute(query, (google_id,))
        user = cursor.fetchone()
        
        if user:
            return dict(user)
        return None
    except Exception as e:
        logger.error(f"Error getting user by Google ID: {e}")
        return None
    finally:
        cursor.close()
        return_connection(connection)

# Function to create a new user
def create_user(name, email, password_hash=None, oauth_provider=None, oauth_id=None, profile_pic=None, is_verified=False, verification_token=None, verification_expires=None):
    connection = get_connection()
    if connection is None:
        return None
        
    try:
        cursor = connection.cursor()
        query = """
        INSERT INTO app_users (name, email, password_hash, oauth_provider, oauth_id, profile_pic, is_verified, verification_token, verification_expires, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        values = (name, email, password_hash, oauth_provider, oauth_id, profile_pic, is_verified, verification_token, verification_expires, datetime.now())
        cursor.execute(query, values)
        user_id = cursor.fetchone()[0]
        connection.commit()
        
        return user_id
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        connection.rollback()
        return None
    finally:
        cursor.close()
        return_connection(connection)

# Function to store OAuth token
def store_oauth_token(user_id, provider, token):
    connection = get_connection()
    if connection is None:
        return False
        
    try:
        cursor = connection.cursor()
        
        # Check if oauth_tokens table exists
        cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'oauth_tokens'
        );
        """)
        
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            # Create the oauth_tokens table if it doesn't exist
            cursor.execute("""
            CREATE TABLE oauth_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                provider VARCHAR(50) NOT NULL,
                token TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
        # Insert or update the token
        cursor.execute("""
        INSERT INTO oauth_tokens (user_id, provider, token)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id, provider) 
        DO UPDATE SET token = EXCLUDED.token
        """, (user_id, provider, token))
        
        connection.commit()
        return True
    except Exception as e:
        logger.error(f"Error storing OAuth token: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        return_connection(connection)

# Function to get user by ID
def get_user_by_id(user_id):
    connection = get_connection()
    if connection is None:
        return None
        
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        query = "SELECT * FROM app_users WHERE id = %s"
        cursor.execute(query, (user_id,))
        user = cursor.fetchone()
        
        if user:
            return dict(user)
        return None
    except Exception as e:
        logger.error(f"Error getting user by ID: {e}")
        return None
    finally:
        cursor.close()
        return_connection(connection)

# Function to create a new chat history
def create_chat_history(user_id, title="New Chat"):
    connection = get_connection()
    if connection is None:
        return None
    
    try:
        cursor = connection.cursor()
        query = """
        INSERT INTO chat_histories (user_id, title, created_at, updated_at, is_active)
        VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, TRUE)
        RETURNING id
        """
        cursor.execute(query, (user_id, title))
        chat_id = cursor.fetchone()[0]
        connection.commit()
        return chat_id
    except Exception as e:
        logger.error(f"Error creating chat history: {e}")
        connection.rollback()
        return None
    finally:
        cursor.close()
        return_connection(connection)

# Function to get all active chats for a user
def get_user_chats(user_id):
    connection = get_connection()
    if connection is None:
        return []
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        query = """
        SELECT id, title, created_at, updated_at
        FROM chat_histories
        WHERE user_id = %s AND is_active = TRUE
        ORDER BY updated_at DESC
        """
        cursor.execute(query, (user_id,))
        
        chats = []
        for row in cursor.fetchall():
            chat = dict(row)
            # Format dates for JSON
            if chat.get('created_at'):
                chat['created_at'] = chat['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if chat.get('updated_at'):
                chat['updated_at'] = chat['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
            
            chats.append(chat)
        
        return chats
    except Exception as e:
        logger.error(f"Error getting user chats: {e}")
        return []
    finally:
        cursor.close()
        return_connection(connection)

# Function to update a chat's title
def update_chat_title(chat_id, user_id, title):
    connection = get_connection()
    if connection is None:
        return False
    
    try:
        cursor = connection.cursor()
        
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*) FROM chat_histories
        WHERE id = %s AND user_id = %s AND is_active = TRUE
        """
        cursor.execute(verify_query, (chat_id, user_id))
        count = cursor.fetchone()[0]
        
        if count == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return False
        
        # Update the title
        update_query = """
        UPDATE chat_histories
        SET title = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """
        cursor.execute(update_query, (title, chat_id))
        
        connection.commit()
        return True
    except Exception as e:
        logger.error(f"Error updating chat title: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        return_connection(connection)

# Function to delete a chat (soft delete)
def delete_chat(chat_id, user_id):
    connection = get_connection()
    if connection is None:
        return False
    
    try:
        cursor = connection.cursor()
        
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*) FROM chat_histories
        WHERE id = %s AND user_id = %s AND is_active = TRUE
        """
        cursor.execute(verify_query, (chat_id, user_id))
        count = cursor.fetchone()[0]
        
        if count == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return False
        
        # Soft delete the chat
        delete_query = """
        UPDATE chat_histories
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """
        cursor.execute(delete_query, (chat_id,))
        
        connection.commit()
        return True
    except Exception as e:
        logger.error(f"Error deleting chat: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        return_connection(connection)

# Authentication middleware
def auth_required(f):
    def decorated_function(*args, **kwargs):
        # Check if user is logged in via session
        if 'user_id' in session:
            return f(*args, **kwargs)
            
        # Check if user is logged in via cookie
        token = request.cookies.get('auth_token')
        if token:
            payload = verify_token(token)
            if payload:
                # Set session variables
                session['user_id'] = payload['user_id']
                session['email'] = payload['email']
                session['name'] = payload['name']
                return f(*args, **kwargs)
        
        # User is not logged in, redirect to login page
        return redirect(url_for('login'))
    
    # Preserve the function name
    decorated_function.__name__ = f.__name__
    return decorated_function

# Function to check if user is logged in
def is_user_logged_in():
    # Check if user is logged in via session
    if 'user_id' in session:
        return True
        
    # Check if user is logged in via cookie
    token = request.cookies.get('auth_token')
    if token:
        payload = verify_token(token)
        if payload:
            # Set session variables
            session['user_id'] = payload['user_id']
            session['email'] = payload['email']
            session['name'] = payload['name']
            return True
    
    return False

# Route for the index page (UI interface)
@app.route('/')
def index():
    log_website_visit()
    
    # Check if user is logged in
    user = None
    if 'user_id' in session:
        user_id = session['user_id']
        user = get_user_by_id(user_id)
    
    return render_template('index.html', user=user)

# Route for login page
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        # Validate input
        if not email or not password:
            flash('Email and password are required', 'danger')
            return render_template('login.html')
        
        # Get user by email
        user = get_user_by_email(email)
        if not user or not user['password_hash'] or not verify_password(user['password_hash'], password):
            flash('Invalid email or password', 'danger')
            return render_template('login.html')
        
        # Check if email is verified
        if not user.get('is_verified', False):
            flash('Please verify your email address before logging in. Check your inbox for the verification link.', 'warning')
            return render_template('login.html')
        
        # Set session variables
        session['user_id'] = user['id']
        session['email'] = user['email']
        session['name'] = user['name']
        
        # Generate JWT token
        token = generate_token(user['id'], user['email'], user['name'])
        
        # Create response with redirect
        response = make_response(redirect(url_for('index')))
        
        # Set cookie with token
        response.set_cookie(
            'auth_token', 
            token, 
            max_age=7*24*60*60,  # 7 days
            httponly=True,
            secure=True if not app.debug else False,
            samesite='Lax'
        )
        
        return response
    
    return render_template('login.html')

@app.route('/toggle_chat_history', methods=['POST'])
def toggle_chat_history():
    # Store the visibility state in the session
    if 'chat_history_visible' not in session:
        session['chat_history_visible'] = True
    else:
        session['chat_history_visible'] = not session['chat_history_visible']
    
    session.modified = True
    
    return jsonify({
        "success": True, 
        "visible": session['chat_history_visible']
    })

# Route for registration page
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validate input
        if not name or not email or not password or not confirm_password:
            flash('All fields are required', 'danger')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return render_template('register.html')
        
        if len(password) < 6:
            flash('Password must be at least 6 characters long', 'danger')
            return render_template('register.html')
        
        # Check if user already exists
        existing_user = get_user_by_email(email)
        if existing_user:
            flash('Email already registered', 'danger')
            return render_template('register.html')
        
        # Hash password
        password_hash = hash_password(password)
        
        # Generate verification token
        verification_token = generate_verification_token()
        verification_expires = datetime.now() + timedelta(hours=24)
        
        # Create user (not verified initially)
        user_id = create_user(
            name, 
            email, 
            password_hash, 
            is_verified=False, 
            verification_token=verification_token, 
            verification_expires=verification_expires
        )
        
        if not user_id:
            flash('Registration failed', 'danger')
            return render_template('register.html')
        
        # Send verification email
        if send_verification_email(email, name, verification_token):
            flash('Registration successful! Please check your email to verify your account before logging in.', 'success')
        else:
            flash('Registration successful but failed to send verification email. Please contact support.', 'warning')
        
        return redirect(url_for('login'))
    
    return render_template('register.html')

# Route for email verification
@app.route('/verify-email/<token>')
def verify_email_route(token):
    """Email verification route"""
    success, message = verify_email_token(token)
    
    return render_template('email_verified.html', success=success, message=message)

# Route to resend verification email
@app.route('/resend-verification', methods=['POST'])
def resend_verification():
    """Resend verification email"""
    email = request.form.get('email', '').strip()
    
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'})
    
    try:
        connection = get_connection()
        if connection is None:
            return jsonify({'success': False, 'message': 'Database connection failed'})
        
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Find unverified user with this email
        cursor.execute('''
            SELECT id, name FROM app_users 
            WHERE email = %s AND is_verified = FALSE
        ''', (email,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'success': False, 'message': 'No unverified account found with this email'})
        
        user_id, username = user
        
        # Generate new verification token
        verification_token = generate_verification_token()
        verification_expires = datetime.now() + timedelta(hours=24)
        
        # Update user with new token
        cursor.execute('''
            UPDATE app_users 
            SET verification_token = %s, verification_expires = %s
            WHERE id = %s
        ''', (verification_token, verification_expires, user_id))
        
        connection.commit()
        
        # Send verification email
        if send_verification_email(email, username, verification_token):
            return jsonify({'success': True, 'message': 'Verification email sent successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to send verification email'})
            
    except Exception as e:
        logger.error(f"Error resending verification: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred'})
    finally:
        cursor.close()
        return_connection(connection)

# Route for Google authentication
@app.route('/google_auth', methods=['POST'])
def google_auth():
    data = request.json
    credential = data.get('credential')
    
    if not credential:
        return jsonify({'success': False, 'error': 'No credential provided'})
    
    # Verify Google token
    user_info = verify_google_token(credential)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid Google token'})
    
    # Check if user exists
    user = get_user_by_google_id(user_info['google_id'])
    
    if not user:
        # Check if email already exists
        email_user = get_user_by_email(user_info['email'])
        
        if email_user:
            # Update existing user with Google info
            connection = get_connection()
            if connection:
                try:
                    cursor = connection.cursor()
                    query = """
                    UPDATE app_users 
                    SET oauth_provider = 'google', oauth_id = %s, profile_pic = %s, is_verified = TRUE
                    WHERE id = %s
                    """
                    cursor.execute(query, (user_info['google_id'], user_info.get('picture'), email_user['id']))
                    connection.commit()
                    
                    user_id = email_user['id']
                    name = email_user['name']
                    email = email_user['email']
                except Exception as e:
                    logger.error(f"Error updating user with Google info: {e}")
                    connection.rollback()
                    return jsonify({'success': False, 'error': 'Failed to update user'})
                finally:
                    cursor.close()
                    return_connection(connection)
        else:
            # Create new user (Google users are automatically verified)
            user_id = create_user(
                user_info['name'],
                user_info['email'],
                None,
                'google',
                user_info['google_id'],
                user_info.get('picture'),
                is_verified=True  # Google users are automatically verified
            )
            
            if not user_id:
                return jsonify({'success': False, 'error': 'Failed to create user'})
                
            name = user_info['name']
            email = user_info['email']
    else:
        user_id = user['id']
        name = user['name']
        email = user['email']
    
    # Store token
    store_oauth_token(user_id, 'google', credential)
    
    # Set session variables
    session['user_id'] = user_id
    session['email'] = email
    session['name'] = name
    
    # Generate JWT token
    token = generate_token(user_id, email, name)
    
    # Create response
    response = jsonify({'success': True, 'redirect': url_for('index')})
    
    # Set cookie with token
    response.set_cookie(
        'auth_token', 
        token, 
        max_age=7*24*60*60,  # 7 days
        httponly=True,
        secure=True if not app.debug else False,
        samesite='Lax'
    )
    
    return response

# Route for forgot password page
@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        
        if not email:
            flash('Email address is required', 'danger')
            return render_template('forgot_password.html')
        
        # Check if user exists (but don't reveal if email exists for security)
        user = get_user_by_email(email)
        
        if user and user.get('is_verified', False):
            # Generate password reset token
            reset_token = generate_verification_token()
            reset_expires = datetime.now() + timedelta(hours=1)  # 1 hour expiry
            
            # Store reset token in database
            connection = get_connection()
            if connection:
                try:
                    cursor = connection.cursor()
                    query = """
                    UPDATE app_users 
                    SET reset_token = %s, reset_expires = %s
                    WHERE email = %s
                    """
                    cursor.execute(query, (reset_token, reset_expires, email))
                    connection.commit()
                    
                    # Send password reset email
                    if send_password_reset_email(email, user['name'], reset_token):
                        logger.info(f"Password reset email sent to {email}")
                    else:
                        logger.error(f"Failed to send password reset email to {email}")
                        
                except Exception as e:
                    logger.error(f"Error storing reset token: {e}")
                    connection.rollback()
                finally:
                    cursor.close()
                    return_connection(connection)
        
        # Always show success message for security (don't reveal if email exists)
        return render_template('forgot_password.html', success=True)
    
    return render_template('forgot_password.html')

# Route for password reset with token
@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if request.method == 'POST':
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not password or not confirm_password:
            flash('Both password fields are required', 'danger')
            return render_template('reset_password.html', token=token)
        
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return render_template('reset_password.html', token=token)
        
        if len(password) < 6:
            flash('Password must be at least 6 characters long', 'danger')
            return render_template('reset_password.html', token=token)
        
        # Verify reset token
        connection = get_connection()
        if connection is None:
            flash('Database connection failed', 'danger')
            return render_template('reset_password.html', error=True, error_message="Database connection failed")
        
        try:
            cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
            
            # Find user with valid reset token
            cursor.execute('''
                SELECT id, name, email, reset_expires 
                FROM app_users 
                WHERE reset_token = %s AND reset_expires > %s
            ''', (token, datetime.now()))
            
            user = cursor.fetchone()
            
            if not user:
                return render_template('reset_password.html', error=True, error_message="This password reset link is invalid or has expired.")
            
            user_id, username, email, reset_expires = user
            
            # Hash new password
            password_hash = hash_password(password)
            
            # Update user password and clear reset token
            cursor.execute('''
                UPDATE app_users 
                SET password_hash = %s, reset_token = NULL, reset_expires = NULL
                WHERE id = %s
            ''', (password_hash, user_id))
            
            connection.commit()
            
            logger.info(f"Password reset successful for user {username} ({email})")
            return render_template('reset_password.html', success=True)
            
        except Exception as e:
            logger.error(f"Error resetting password: {str(e)}")
            connection.rollback()
            flash('An error occurred while resetting your password', 'danger')
            return render_template('reset_password.html', token=token)
        finally:
            cursor.close()
            return_connection(connection)
    
    # GET request - verify token and show form
    connection = get_connection()
    if connection is None:
        return render_template('reset_password.html', error=True, error_message="Database connection failed")
    
    try:
        cursor = connection.cursor()
        
        # Check if token is valid
        cursor.execute('''
            SELECT COUNT(*) FROM app_users 
            WHERE reset_token = %s AND reset_expires > %s
        ''', (token, datetime.now()))
        
        count = cursor.fetchone()[0]
        
        if count == 0:
            return render_template('reset_password.html', error=True, error_message="This password reset link is invalid or has expired.")
        
        return render_template('reset_password.html', token=token)
        
    except Exception as e:
        logger.error(f"Error verifying reset token: {e}")
        return render_template('reset_password.html', error=True, error_message="An error occurred while verifying the reset link.")
    finally:
        cursor.close()
        return_connection(connection)

# Route for logout
@app.route('/user_logout')
def user_logout():
    # Clear session
    session.pop('user_id', None)
    session.pop('email', None)
    session.pop('name', None)
    
    # Create response with redirect
    response = make_response(redirect(url_for('index')))
    
    # Clear auth cookie
    response.delete_cookie('auth_token')
    
    return response

# Route to clear conversation history
@app.route('/clear_conversation', methods=['POST'])
def clear_conversation():
    if 'conversation_history' in session:
        session['conversation_history'] = []
        session.modified = True
    return jsonify({"success": True, "message": "Conversation history cleared"})

# Route to handle API calls and process user queries
@app.route('/get_response', methods=['POST'])
def get_response():
    data = request.json
    user_prompt = data.get('prompt', '')
    chat_id = data.get('chat_id')  # New parameter for chat history
    is_direct_document_request = data.get('isDirectDocumentRequest', False)
    contains_document_type = data.get('containsDocumentType', False)
    contains_document_word = data.get('containsDocumentWord', False)
    contains_interrogative = data.get('containsInterrogative', False)
    starts_with_interrogative = data.get('startsWithInterrogative', False)
    requested_doc_type = data.get('requestedDocType')

    if not user_prompt:
        return jsonify({"error": "Prompt is required"}), 400

    try:
        # Get user ID if logged in
        user_id = session.get('user_id')
        is_logged_in = is_user_logged_in()

        # Try to get historical/geographic/demographic data from barangay_history.py
        from barangay_history import get_relevant_info
        relevant_info = get_relevant_info(user_prompt)
        if relevant_info:
            combined_text = "<br><br>".join([f"<h4>{title}</h4><p>{info.strip()}</p>" for title, info in relevant_info])

            # Optionally log or save
            if chat_id and user_id:
                save_message_to_chat(chat_id, user_id, user_prompt, combined_text)
            else:
                manage_conversation_history(user_prompt, combined_text)

            log_conversation(user_prompt, combined_text, user_id)
            return jsonify({"response": combined_text})
        
        # Check for admin authentication but have AI respond naturally
        parts = user_prompt.split()
        if len(parts) == 2 and parts[0] == ADMIN_KEY and parts[1] == ADMIN_PASS:
            # Log admin access attempt
            log_conversation(user_prompt, "I understand you're asking about administrative access. Let me check that for you.", user_id)
            session['admin_authenticated'] = True
            return jsonify({"response": "ADMIN_AUTHENTICATED"})
        
        # Check if this is a request for notable places
        if is_place_request(user_prompt):
            # Check if user is asking for all places or a specific place
            user_prompt_lower = user_prompt.lower()
            
            # Keywords that indicate they want to see all places
            all_places_keywords = [
                "all places", "lahat ng lugar", "mga lugar", "notable places", 
                "tourist spots", "landmarks", "mga landmark", "show me places",
                "pictures of places", "images of places", "mga larawan ng lugar"
            ]
            
            # Check if they want to see all places
            wants_all_places = any(keyword in user_prompt_lower for keyword in all_places_keywords)
            
            if wants_all_places:
                # Show one image from each of the 7 places
                all_place_images = []
                place_descriptions = []
                
                for place_name in NOTABLE_PLACES.keys():
                    # Get one random image for each place
                    images = get_random_images(place_name, 1)
                    if images:
                        all_place_images.extend(images)
                        place_descriptions.append(f"<strong>{place_name.title()}</strong>")
                
                if all_place_images:
                    # Create image HTML
                    image_html = ""
                    for i, img_path in enumerate(all_place_images):
                        image_html += f'<img src="/{img_path}" alt="Notable place in Amungan" style="width: 300px; height: 200px; object-fit: cover; margin: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.3s;" onclick="if(this.style.position === \'fixed\'){{ this.style = \'\'; this.style.width = \'300px\'; this.style.height = \'200px\'; this.style.objectFit = \'cover\'; this.style.margin = \'10px\'; this.style.borderRadius = \'8px\'; this.style.boxShadow = \'0 2px 4px rgba(0,0,0,0.1)\'; this.style.cursor = \'pointer\'; this.style.transition = \'all 0.3s\'; }} else {{ this.style.position = \'fixed\'; this.style.top = \'50%\'; this.style.left = \'50%\'; this.style.transform = \'translate(-50%, -50%)\'; this.style.width = \'90%\'; this.style.height = \'auto\'; this.style.zIndex = \'1000\'; this.style.borderRadius = \'8px\'; this.style.boxShadow = \'0 4px 10px rgba(0,0,0,0.5)\'; this.style.cursor = \'pointer\'; this.style.transition = \'all 0.3s\'; }}">'
                        if (i + 1) % 3 == 0:  # Add line break every 3 images
                            image_html += "<br>"
                    
                    response_text = f"""
                    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                        <p>Here are the notable places in Barangay Amungan! These are some of the important landmarks and locations that serve our community:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            {image_html}
                        </div>
                        <p>The places shown include: {', '.join(place_descriptions)}. Each of these locations plays an important role in the daily life and development of our barangay.</p>
                        <p>If you'd like to see more pictures of a specific place, just ask me about it!</p>
                    </div>
                    """
                    
                    # Save to chat history if chat_id is provided and user is logged in
                    if chat_id and user_id:
                        save_message_to_chat(chat_id, user_id, user_prompt, response_text)
                    else:
                        # Add to session-based conversation history
                        manage_conversation_history(user_prompt, response_text)
                    
                    log_conversation(user_prompt, response_text, user_id)
                    return jsonify({"response": response_text})
            else:
                # Handle specific place request
                place_result = handle_place_request(user_prompt)
                
                if place_result:
                    # Create image HTML
                    image_html = ""
                    for img_path in place_result['image_paths']:
                        image_html += f'<img src="/{img_path}" alt="Notable place in Amungan" style="width: 300px; height: 200px; object-fit: cover; margin: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.3s;" onclick="if(this.style.position === \'fixed\'){{ this.style = \'\'; this.style.width = \'300px\'; this.style.height = \'200px\'; this.style.objectFit = \'cover\'; this.style.margin = \'10px\'; this.style.borderRadius = \'8px\'; this.style.boxShadow = \'0 2px 4px rgba(0,0,0,0.1)\'; this.style.cursor = \'pointer\'; this.style.transition = \'all 0.3s\'; }} else {{ this.style.position = \'fixed\'; this.style.top = \'50%\'; this.style.left = \'50%\'; this.style.transform = \'translate(-50%, -50%)\'; this.style.width = \'90%\'; this.style.height = \'auto\'; this.style.zIndex = \'1000\'; this.style.borderRadius = \'8px\'; this.style.boxShadow = \'0 4px 10px rgba(0,0,0,0.5)\'; this.style.cursor = \'pointer\'; this.style.transition = \'all 0.3s\'; }}">'
                    
                    response_text = f"""
                    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                        <p>{place_result['text']}</p>
                        <div style="text-align: center; margin: 20px 0;">
                            {image_html}
                        </div>
                        <p>If you'd like to see other notable places in Barangay Amungan, just ask me to show you all the places!</p>
                    </div>
                    """
                    
                    # Save to chat history if chat_id is provided and user is logged in
                    if chat_id and user_id:
                        save_message_to_chat(chat_id, user_id, user_prompt, response_text)
                    else:
                        # Add to session-based conversation history
                        manage_conversation_history(user_prompt, response_text)
                    
                    log_conversation(user_prompt, response_text, user_id)
                    return jsonify({"response": response_text})
        
        # Check if this is a reference number query
        user_prompt_lower = user_prompt.lower()
        if "ref-" in user_prompt_lower or "reference" in user_prompt_lower:
            # Extract reference number using a simple approach
            words = user_prompt_lower.split()
            reference_id = None
            
            for word in words:
                if word.startswith("ref-"):
                    reference_id = word
                    break
            
            if not reference_id:
                # Try to find any word that contains numbers and might be a reference
                for word in words:
                    if "ref" in word or any(char.isdigit() for char in word):
                        reference_id = word
                        break
            
            if reference_id:
                # Clean up the reference ID
                reference_id = ''.join(char for char in reference_id if char.isalnum() or char == '-')
                logger.info(f"Extracted reference ID from user prompt: {reference_id}")
                
                # Get document status
                doc_status = get_document_status(reference_id)
                
                if doc_status:
                    status = doc_status['status']
                    document_type = doc_status['document_type'].title()
                    
                    if status == 'Approved':
                        response_text = f"""
                        <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                            <p>Good news! Your request for a {document_type} with reference number <strong>{reference_id}</strong> has been <span style="color: green; font-weight: bold;">APPROVED</span>.</p>
                            <p>You can now visit the Barangay Amungan Hall to claim your document. Please bring a valid ID for verification.</p>
                            <p>Office hours: Monday to Friday, 8:00 AM to 5:00 PM</p>
                        </div>
                        """
                    elif status == 'Rejected':
                        response_text = f"""
                        <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                            <p>I'm sorry to inform you that your request for a {document_type} with reference number <strong>{reference_id}</strong> has been <span style="color: red; font-weight: bold;">REJECTED</span>.</p>
                            <p>For more information about why your request was rejected, please visit the Barangay Amungan Hall or contact the barangay office.</p>
                            <p>Office hours: Monday to Friday, 8:00 AM to 5:00 PM</p>
                            <p>Contact number: (123) 456-7890</p>
                        </div>
                        """
                    elif status == 'Claimed':
                        pickup_date = doc_status['pickup_date'].strftime('%B %d, %Y') if doc_status['pickup_date'] else 'Not recorded'
                        response_text = f"""
                        <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                            <p>Our records show that your {document_type} with reference number <strong>{reference_id}</strong> has already been <span style="color: blue; font-weight: bold;">CLAIMED</span> on {pickup_date}.</p>
                            <p>If you have any questions or concerns, please visit the Barangay Amungan Hall or contact the barangay office.</p>
                        </div>
                        """
                    else:  # Pending or any other status
                        submission_date = doc_status['submission_date'].strftime('%B %d, %Y')
                        response_text = f"""
                        <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                            <p>Your request for a {document_type} with reference number <strong>{reference_id}</strong> is currently <span style="color: orange; font-weight: bold;">PENDING</span>.</p>
                            <p>Request date: {submission_date}</p>
                            <p>Please check back later or visit the Barangay Amungan Hall for updates on your request.</p>
                            <p>Office hours: Monday to Friday, 8:00 AM to 5:00 PM</p>
                        </div>
                        """
                    
                    # Save to chat history if chat_id is provided and user is logged in
                    if chat_id and user_id:
                        save_message_to_chat(chat_id, user_id, user_prompt, response_text)
                    else:
                        # Add to session-based conversation history
                        manage_conversation_history(user_prompt, response_text)
                    
                    log_conversation(user_prompt, response_text, user_id)
                    return jsonify({"response": response_text})
                else:
                    response_text = f"""
                    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                        <p>I couldn't find any document request with the reference number <strong>{reference_id}</strong>.</p>
                        <p>Please check if you've entered the correct reference number. The format should be REF-[number], for example, REF-123.</p>
                        <p>If you're sure the reference number is correct, please visit the Barangay Amungan Hall for assistance.</p>
                    </div>
                    """
                    
                    # Save to chat history if chat_id is provided and user is logged in
                    if chat_id and user_id:
                        save_message_to_chat(chat_id, user_id, user_prompt, response_text)
                    else:
                        # Add to session-based conversation history
                        manage_conversation_history(user_prompt, response_text)
                    
                    log_conversation(user_prompt, response_text, user_id)
                    return jsonify({"response": response_text})
        
        # Check if this is a general document inquiry without specifying a type
        if contains_document_word and not contains_document_type:
            # For general document inquiries, suggest all document types
            context = """You are BAAC (Barangay Amungan Assistant Chatbot), an assistant chatbot for Barangay Amungan, Iba, Zambales.
            Always provide helpful and informative responses. Format your response in a clear and professional manner.
            
            IMPORTANT: Use HTML formatting for lists and structured content. For lists, use <ul> and <li> tags instead of asterisks or bullet points.
            For example, instead of:
            * Item 1
            * Item 2
            
            Use:
            <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            </ul>
        
            Answer The user in the language they used.
            If users ask in ilocano or zambal respond accordingly but still with respect.
            If users ask about requesting documents, inform them that you can only process requests for Barangay Clearance, Barangay Indigency, and Barangay Residency.
            If users ask about checking document status, ask them to provide their reference number (e.g., REF-123)."""
            
            # Add conversation history from the specific chat if available
            if chat_id and user_id:
                context += get_chat_history_context(chat_id, user_id)
            else:
                # Otherwise use session-based conversation history
                context += get_conversation_history_context()
            
            context += f"\nUser: {user_prompt}\nBAAC: "

            # Using the older API style but without response_mime_type
            response = model.generate_content(context)
            
            # Format the response with HTML
            formatted_response = format_response_html(response.text)
            
            response_text = f"""
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                {formatted_response}
            </div>
            """

            # Save to chat history if chat_id is provided and user is logged in
            if chat_id and user_id:
                save_message_to_chat(chat_id, user_id, user_prompt, response_text)
            else:
                # Add to session-based conversation history
                manage_conversation_history(user_prompt, response_text)
            
            # Log the conversation
            log_conversation(user_prompt, response_text, user_id)
            
            # Return the AI response along with a suggestion for all document types
            return jsonify({
                "response": response_text,
                "suggestAllDocuments": True
            })
        
        # Check if this is a direct document request or if a specific document type was mentioned
        # But make sure it's not an interrogative question
        if is_direct_document_request and not starts_with_interrogative:
            # Use the requested document type from the frontend if available
            requested_document = requested_doc_type
            
            # If not available, try to detect it from the prompt
            if not requested_document:
                requested_document = detect_document_type(user_prompt)
            
            if requested_document:
                # Check if user is logged in
                if not is_logged_in:
                    # User is not logged in, return a response with login/signup buttons
                    response_text = f"""
                    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                        <p>I'd be happy to help you request a {requested_document.title()}. However, you need to be logged in to submit document requests.</p>
                        <div class="auth-buttons-container" style="margin-top: 15px; display: flex; gap: 10px;">
                            <button onclick="window.location.href='/login'" class="auth-button login-button" style="background-color: #4CAF50; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold;">Login</button>
                            <button onclick="window.location.href='/register'" class="auth-button register-button" style="background-color: #2196F3; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold;">Sign Up</button>
                        </div>
                        <p style="margin-top: 10px; font-size: 0.9em; color: #666;">Creating an account allows you to track the status of your document requests and access your request history.</p>
                    </div>
                    """
                    
                    # Add to session-based conversation history
                    manage_conversation_history(user_prompt, response_text)
                    
                    # Log the conversation
                    log_conversation(user_prompt, response_text, None)
                    
                    return jsonify({
                        "response": response_text,
                        "requiresAuth": True,
                        "documentType": requested_document
                    })
                
                # User is logged in, provide response with form button
                document_title = requested_document.title()
                log_document_request(document_title)
                
                # Create a response with form button
                response_text = f"""
                <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                    <p>I can help you request a <strong>{document_title}</strong>. This document is commonly used for various purposes such as employment, business permits, and other official transactions.</p>
                    <p>To proceed with your request, please click the button below to fill out the required information:</p>
                    <div style="margin: 20px 0; text-align: center;">
                        <button onclick="showDocumentForm('{requested_document}')" class="document-request-btn" style="background-color: #e53935; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.3s ease;">
                            📄 Request {document_title}
                        </button>
                    </div>
                    <p style="font-size: 14px; color: #666;">Processing time is typically 3-5 business days. You will receive a reference number to track your request.</p>
                </div>
                """
                
                # Save to chat history if chat_id is provided and user is logged in
                if chat_id and user_id:
                    save_message_to_chat(chat_id, user_id, user_prompt, response_text)
                else:
                    # Add to session-based conversation history
                    manage_conversation_history(user_prompt, response_text)
                
                return jsonify({
                    "response": response_text,
                    "showFormButton": True,
                    "formType": requested_document
                })
        
        # Check if query is about barangay officials or population
        if is_about_officials(user_prompt) or is_about_population(user_prompt):
            # Create a context with the correct officials and population information
            context = f"""You are BAAC (Barangay Amungan Assistant Chatbot), an assistant chatbot for Barangay Amungan, Iba, Zambales.
            Always provide helpful and informative responses. Format your response in a clear and professional manner.
            
            IMPORTANT: Use HTML formatting for lists and structured content. For lists, use <ul> and <li> tags instead of asterisks or bullet points.
            For example, instead of:
            * Item 1
            * Item 2
            
            Use:
            <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            </ul>
            
            Here is the accurate information about Barangay Amungan that you should use in your response:
            {BARANGAY_OFFICIALS_INFO}
            
            If the user is asking about the Punong Barangay, remember they might refer to this position as Captain, Kapitan, Cap, or Kap.
            If the user is asking about the Sangguniang Kabataan (SK), provide information about the SK officials listed above.
            If the user is asking about Purok Presidents or Purok Leaders, provide information about the specific purok they're asking about or list all 14 purok presidents.
            If the user is asking about population or demographics, provide the relevant information from the population data.
            """
            
            # Add conversation history from the specific chat if available
            if chat_id and user_id:
                context += get_chat_history_context(chat_id, user_id)
            else:
                # Otherwise use session-based conversation history
                context += get_conversation_history_context()
            
            context += f"\nUser: {user_prompt}\nBAAC:"
            
            # Generate response using the AI model with the officials information
            response = model.generate_content(context)
            
            # Format the response with HTML
            formatted_response = format_response_html(response.text)
            
            response_text = f"""
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                {formatted_response}
            </div>
            """
            
            # Save to chat history if chat_id is provided and user is logged in
            if chat_id and user_id:
                save_message_to_chat(chat_id, user_id, user_prompt, response_text)
            else:
                # Add to session-based conversation history
                manage_conversation_history(user_prompt, response_text)
            
            # Log the conversation
            log_conversation(user_prompt, response_text, user_id)
            
            return jsonify({"response": response_text})
        
        # For interrogative queries or general document inquiries, use the AI model
        context = """You are BAAC (Barangay Amungan Assistant Chatbot), an assistant chatbot for Barangay Amungan, Iba, Zambales.
        Always provide helpful and informative responses. Format your response in a clear and professional manner.
        You are a large language model trained by Students from President Ramon Magsaysay State University (PRMSU)
        You are a pre existing model that was trained by students as BAAC (Barangay Amungan Assistant Chatbot) to be able to assist residents and staff of the barangay
        IMPORTANT: Use HTML formatting for lists and structured content. For lists, use <ul> and <li> tags instead of asterisks or bullet points.
        For example, instead of:
        * Item 1
        * Item 2
        
        Use:
        <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        </ul>
        
        IMPORTANT: You will primarily use English or Tagalog Based on the user's question or prompt.
        Avoid sending the word "html" since it is somehow counts as error?
        Avoid sending ``html as response
        If users ask about requesting documents, inform them that you can only process requests for Barangay Clearance, Barangay Indigency, and Barangay Residency.
        If users ask about checking document status, ask them to provide their reference number (e.g., REF-123)."""
        
        # Add barangay officials and population information to the context
        context += f"""
        
        Here is the accurate information about Barangay Amungan that you should use if the user asks about officials, puroks, or population:
        {BARANGAY_OFFICIALS_INFO}
        """
        
        # Add notable places information to the context
        context += f"""
        
        If users ask about places, locations, or want to see pictures of notable places in Barangay Amungan, you can show them images of these locations:
        - Amungan Elementary School
        - Amungan Market  
        - Amungan National High School
        - Barangay Hall
        - Barangay Health Center
        - Plaza Mercado

        Important: The user might ask images in a different way refer to the view_keywords.
        """
        
        # Add conversation history from the specific chat if available
        if chat_id and user_id:
            context += get_chat_history_context(chat_id, user_id)
        else:
            # Otherwise use session-based conversation history
            context += get_conversation_history_context()
        
        context += f"\nUser: {user_prompt}\nBAAC: "

        # Using the older API style but without response_mime_type
        response = model.generate_content(context)
        
        # Format the response with HTML
        formatted_response = format_response_html(response.text)
        
        response_text = f"""
        <div class="ai-response" style="text-align: justify; line-height: 1.6;">
            {formatted_response}
        </div>
        """

        # Save to chat history if chat_id is provided and user is logged in
        if chat_id and user_id:
            save_message_to_chat(chat_id, user_id, user_prompt, response_text)
        else:
            # Add to session-based conversation history
            manage_conversation_history(user_prompt, response_text)

        # Check if we should suggest a form based on the AI response and user query
        result = {
            "response": response_text
        }
        
        # If the query contains a document type but wasn't handled as a direct request,
        # and the AI response mentions documents, suggest a form
        if contains_document_type and not is_direct_document_request:
            # Try to detect which document was mentioned
            doc_type = requested_doc_type or detect_document_type(user_prompt)
            
            if doc_type:
                # Check if the AI response mentions documents or the specific document type
                response_lower = response.text.lower()
                if (doc_type in response_lower or 
                    "document" in response_lower or 
                    "clearance" in response_lower or 
                    "indigency" in response_lower or 
                    "residency" in response_lower):
                    
                    # Check if user is logged in before suggesting the form
                    if is_logged_in:
                        result["suggestForm"] = True
                        result["formType"] = doc_type
                    else:
                        # User is not logged in, suggest login/signup
                        result["suggestAuth"] = True
                        result["documentType"] = doc_type

        # Log the conversation
        log_conversation(user_prompt, response_text, user_id)

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error in get_response: {str(e)}")
        return jsonify({"error": f"An error occurred while processing the request: {str(e)}"}), 500

# Route to submit document requests
@app.route('/submit_document', methods=['POST'])
@auth_required
def submit_document():
    data = request.json
    user_id = session.get('user_id')
    
    # Handle both single and multiple document requests
    document_types = data.get('document_types', [])
    if not document_types:
        # Fallback to single document for backward compatibility
        single_doc = data.get('documentType')
        if single_doc:
            document_types = [single_doc]
    
    date = data.get('date')
    name = data.get('name')
    purok = data.get('purok')
    purpose = data.get('purpose')
    copies = data.get('copies', 1)
    
    if not all([document_types, date, name, purok, purpose]):
        return jsonify({"error": "All fields are required"}), 400
    
    if not document_types:
        return jsonify({"error": "At least one document type must be selected"}), 400
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor()
        
        # Create the table with correct structure if it doesn't exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS document_submissions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            document_types TEXT[] NOT NULL,
            request_date DATE NOT NULL,
            name VARCHAR(255) NOT NULL,
            purok VARCHAR(100) NOT NULL,
            purpose TEXT NOT NULL,
            copies INTEGER DEFAULT 1,
            status VARCHAR(50) DEFAULT 'Pending',
            submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pickup_date DATE,
            notes TEXT
        )
        """)
        
        # Add foreign key constraint if it doesn't exist
        cursor.execute("""
        SELECT COUNT(*)
        FROM information_schema.table_constraints
        WHERE constraint_name = 'document_submissions_user_id_fkey'
        AND table_name = 'document_submissions'
        """)
        
        if cursor.fetchone()[0] == 0:
            try:
                cursor.execute("""
                ALTER TABLE document_submissions
                ADD CONSTRAINT document_submissions_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
                """)
            except Exception as e:
                logger.warning(f"Could not add foreign key constraint: {e}")
        
        # Insert document request with multiple document types
        query = """
        INSERT INTO document_submissions (user_id, document_types, request_date, name, purok, purpose, copies, status, submission_date)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'Pending', CURRENT_TIMESTAMP)
        RETURNING id
        """
        values = (user_id, document_types, date, name, purok, purpose, copies)
        cursor.execute(query, values)
        
        document_id = cursor.fetchone()[0]
        connection.commit()
        
        # Generate reference number
        reference_number = f"REF-{document_id}"
        
        # Create success response
        if len(document_types) == 1:
            doc_name = document_types[0].title()
            response_text = f"""
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                <p><strong>🎉 Document Request Submitted Successfully!</strong></p>
                <p>Your request for a <strong>{doc_name}</strong> has been submitted and is now being processed.</p>
                <p><strong>Reference Number:</strong> {reference_number}</p>
                <p>Please save this reference number for tracking your request status.</p>
                <p>You can check the status of your request by asking me about reference number {reference_number}.</p>
                <p><strong>Processing time:</strong> Typically 3-5 business days. You will be notified when your document is ready for pickup.</p>
            </div>
            """
        else:
            doc_list = ", ".join([doc.title() for doc in document_types])
            response_text = f"""
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                <p><strong>🎉 Multiple Document Requests Submitted Successfully!</strong></p>
                <p>Your requests for the following documents have been submitted and are now being processed:</p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    {"".join([f"<li><strong>{doc.title()}</strong></li>" for doc in document_types])}
                </ul>
                <p><strong>Reference Number:</strong> {reference_number}</p>
                <p>Please save this reference number for tracking your request status.</p>
                <p>You can check the status of your requests by asking me about reference number {reference_number}.</p>
                <p><strong>Processing time:</strong> Typically 3-5 business days. You will be notified when your documents are ready for pickup.</p>
            </div>
            """
        
        return jsonify({
            "success": True,
            "response": response_text,
            "reference_number": reference_number
        })
        
    except Exception as e:
        logger.error(f"Error submitting document: {e}")
        connection.rollback()
        return jsonify({"error": f"Failed to submit document request: {str(e)}"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route for admin page
@app.route('/admin')
def admin():
    if not session.get('admin_authenticated'):
        return redirect(url_for('index'))

    # Pass current date and date 7 days ago for the date range picker
    now = datetime.now()
    return render_template('admin.html', now=now, timedelta=timedelta)

# FIXED: Route to get document requests for admin dashboard
@app.route('/admin/document_requests')
def admin_document_requests():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401
        
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = connection.cursor()
        # FIXED: Use document_types instead of document_type
        query = """
        SELECT 
            ds.id, 
            CASE 
                WHEN ds.document_types IS NOT NULL THEN array_to_string(ds.document_types, ', ')
                ELSE 'Unknown'
            END as document_type,
            ds.request_date, 
            ds.name, 
            ds.purok, 
            ds.purpose, 
            ds.copies, 
            ds.submission_date, 
            ds.status, 
            ds.pickup_date, 
            ds.notes,
            au.name as user_name,
            au.email as user_email
        FROM document_submissions ds
        LEFT JOIN app_users au ON ds.user_id = au.id
        ORDER BY ds.submission_date DESC
        """
        cursor.execute(query)
        
        # Convert to dictionary format
        columns = [desc[0] for desc in cursor.description]
        document_requests = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Format dates for JSON
        for doc in document_requests:
            if doc.get('request_date'):
                doc['request_date'] = doc['request_date'].strftime('%Y-%m-%d')
            if doc.get('submission_date'):
                doc['submission_date'] = doc['submission_date'].strftime('%Y-%m-%d %H:%M:%S')
            if doc.get('pickup_date'):
                doc['pickup_date'] = doc['pickup_date'].strftime('%Y-%m-%d')
        
        return jsonify(document_requests)
    except Exception as e:
        logger.error(f"Error fetching document requests: {e}")
        return jsonify({"error": "Failed to fetch document requests"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route to update document status
@app.route('/admin/update_document_status', methods=['POST'])
def update_document_status():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    document_id = data.get('id')
    status = data.get('status')
    notes = data.get('notes', '')

    if not document_id or not status:
        return jsonify({"error": "Document ID and status are required"}), 400
        
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = connection.cursor()
        
        # If status is "Claimed", update pickup_date to current date
        if status == 'Claimed':
            query = """
            UPDATE document_submissions
            SET status = %s, notes = %s, pickup_date = CURRENT_DATE
            WHERE id = %s
            """
            values = (status, notes, document_id)
        else:
            query = """
            UPDATE document_submissions
            SET status = %s, notes = %s
            WHERE id = %s
            """
            values = (status, notes, document_id)
            
        cursor.execute(query, values)
        connection.commit()
        
        return jsonify({"success": True, "message": f"Document status updated to {status}"})
    except Exception as e:
        logger.error(f"Error updating document status: {e}")
        connection.rollback()
        return jsonify({"error": "Failed to update document status"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route for checking if the user is logged in or not
@app.route('/api/user-status')
def user_status():
    return jsonify({
        'logged_in': is_user_logged_in(),
        'user_id': session.get('user_id'),
        'current_chat_id': session.get('current_chat_id')
    })

# Route for getting AI report
@app.route('/ai_report')
def ai_report():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401

    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = connection.cursor()
        query = """
        SELECT 
            COUNT(*) as total_conversations,
            DATE(timestamp) as date,
            AVG(LENGTH(user_input)) as avg_user_input_length,
            AVG(LENGTH(ai_response)) as avg_ai_response_length
        FROM conversation_logs
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
        LIMIT 7
        """
        cursor.execute(query)
        
        # Convert to dictionary format
        columns = [desc[0] for desc in cursor.description]
        report_data = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        return jsonify(report_data)
    except Exception as e:
        logger.error(f"Error generating AI report: {e}")
        return jsonify({"error": "Failed to generate report"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# FIXED: Route for admin stats
@app.route('/admin_stats')
def admin_stats():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401

    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = connection.cursor()
        
        # Get today's website visits
        cursor.execute("SELECT visit_count FROM website_visits WHERE visit_date = CURRENT_DATE")
        today_visits_row = cursor.fetchone()
        today_visits = today_visits_row[0] if today_visits_row else 0

        # Get today's document requests
        cursor.execute("SELECT SUM(request_count) as total_requests FROM document_requests WHERE request_date = CURRENT_DATE")
        today_requests_row = cursor.fetchone()
        today_requests = today_requests_row[0] if today_requests_row and today_requests_row[0] else 0

        # Get last 7 days of website visits
        cursor.execute("SELECT visit_date, visit_count FROM website_visits ORDER BY visit_date DESC LIMIT 7")
        visits_rows = cursor.fetchall()
        visits_data = [{"visit_date": row[0].strftime('%Y-%m-%d'), "visit_count": row[1]} for row in visits_rows]

        # Get last 7 days of document requests
        cursor.execute("""
        SELECT request_date, SUM(request_count) as total_requests 
        FROM document_requests 
        GROUP BY request_date 
        ORDER BY request_date DESC 
        LIMIT 7
        """)
        requests_rows = cursor.fetchall()
        requests_data = [{"request_date": row[0].strftime('%Y-%m-%d'), "total_requests": row[1]} for row in requests_rows]

        # FIXED: Get document requests by type - handle array format
        cursor.execute("""
        SELECT 
            UNNEST(document_types) as document_type, 
            COUNT(*) as total_requests 
        FROM document_submissions 
        WHERE submission_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY UNNEST(document_types)
        ORDER BY total_requests DESC
        """)
        document_types_rows = cursor.fetchall()
        document_types_data = [{"document_type": row[0], "total_requests": row[1]} for row in document_types_rows]

        # Get document requests by status
        cursor.execute("""
        SELECT status, COUNT(*) as count
        FROM document_submissions
        GROUP BY status
        ORDER BY count DESC
        """)
        status_rows = cursor.fetchall()
        status_data = [{"status": row[0], "count": row[1]} for row in status_rows]

        # Get registered users count
        cursor.execute("SELECT COUNT(*) FROM app_users")
        users_count = cursor.fetchone()[0]

        # Get users by authentication method
        cursor.execute("""
        SELECT 
            CASE 
                WHEN oauth_provider IS NOT NULL THEN oauth_provider
                ELSE 'email'
            END as auth_method,
            COUNT(*) as count
        FROM app_users
        GROUP BY auth_method
        """)
        auth_method_rows = cursor.fetchall()
        auth_method_data = [{"auth_method": row[0], "count": row[1]} for row in auth_method_rows]

        return jsonify({
            "today_visits": today_visits,
            "today_requests": today_requests,
            "visits_data": visits_data,
            "requests_data": requests_data,
            "document_types_data": document_types_data,
            "status_data": status_data,
            "users_count": users_count,
            "auth_method_data": auth_method_data
        })
    except Exception as e:
        logger.error(f"Error fetching admin stats: {e}")
        return jsonify({"error": "Failed to fetch stats"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route for logging out
@app.route('/logout')
def logout():
    session.pop('admin_authenticated', None)
    return redirect(url_for('index'))

# Route to update admin credentials
@app.route('/admin/update_credentials', methods=['POST'])
def update_admin_credentials():
    # Add the global declaration at the beginning of the function
    global ADMIN_KEY, ADMIN_PASS

    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    current_key = data.get('currentKey')
    current_pass = data.get('currentPass')
    new_key = data.get('newKey')
    new_pass = data.get('newPass')

    # Verify current credentials
    if current_key != ADMIN_KEY or current_pass != ADMIN_PASS:
        return jsonify({"error": "Current credentials are incorrect"}), 400

    # Update environment variables in the database
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = connection.cursor()
        
        # Check if env_variables table exists, create if not
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS env_variables (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL
        )
        """)
        
        # Update ADMIN_KEY
        cursor.execute("""
        INSERT INTO env_variables (key, value)
        VALUES ('ADMIN_KEY', %s)
        ON CONFLICT (key) 
        DO UPDATE SET value = %s
        """, (new_key, new_key))
        
        # Update ADMIN_PASS
        cursor.execute("""
        INSERT INTO env_variables (key, value)
        VALUES ('ADMIN_PASS', %s)
        ON CONFLICT (key) 
        DO UPDATE SET value = %s
        """, (new_pass, new_pass))
        
        connection.commit()
        
        # Update global variables
        ADMIN_KEY = new_key
        ADMIN_PASS = new_pass
        
        return jsonify({"success": True, "message": "Admin credentials updated successfully"})
    except Exception as e:
        logger.error(f"Error updating admin credentials: {e}")
        connection.rollback()
        return jsonify({"error": "Failed to update admin credentials"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route to generate custom date range report
@app.route('/admin/custom_report', methods=['POST'])
def custom_report():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    start_date = data.get('startDate')
    end_date = data.get('endDate')

    if not start_date or not end_date:
        return jsonify({"error": "Start date and end date are required"}), 400
        
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = connection.cursor()
        
        # Get website visits for the date range
        cursor.execute("""
        SELECT visit_date, visit_count 
        FROM website_visits 
        WHERE visit_date BETWEEN %s AND %s
        ORDER BY visit_date
        """, (start_date, end_date))
        
        visits_data = []
        total_visits = 0
        for row in cursor.fetchall():
            visit_date = row[0].strftime('%Y-%m-%d')
            visit_count = row[1]
            total_visits += visit_count
            visits_data.append({"visit_date": visit_date, "visit_count": visit_count})
        
        # Get document requests by type for the date range
        cursor.execute("""
        SELECT document_type, SUM(request_count) as total_requests 
        FROM document_requests 
        WHERE request_date BETWEEN %s AND %s
        GROUP BY document_type
        ORDER BY total_requests DESC
        """, (start_date, end_date))
        
        document_types_data = []
        total_requests = 0
        for row in cursor.fetchall():
            document_type = row[0]
            request_count = row[1]
            total_requests += request_count
            document_types_data.append({"document_type": document_type, "total_requests": request_count})
        
        # Get document status counts for the date range
        cursor.execute("""
        SELECT status, COUNT(*) as count
        FROM document_submissions
        WHERE submission_date::date BETWEEN %s AND %s
        GROUP BY status
        ORDER BY count DESC
        """, (start_date, end_date))
        
        status_data = []
        total_documents = 0
        for row in cursor.fetchall():
            status = row[0]
            count = row[1]
            total_documents += count
            status_data.append({"status": status, "count": count})
        
        # Get top user queries for the date range
        cursor.execute("""
        SELECT user_input as query, COUNT(*) as count
        FROM conversation_logs
        WHERE timestamp::date BETWEEN %s AND %s
        GROUP BY user_input
        ORDER BY count DESC
        LIMIT 10
        """, (start_date, end_date))
        
        top_queries = []
        for row in cursor.fetchall():
            query = row[0]
            count = row[1]
            # Skip admin login attempts and very short queries
            if len(query) > 5 and ADMIN_KEY not in query and ADMIN_PASS not in query:
                top_queries.append({"query": query, "count": count})
        
        # Get user registration data for the date range
        cursor.execute("""
        SELECT DATE(created_at) as reg_date, COUNT(*) as count
        FROM app_users
        WHERE created_at::date BETWEEN %s AND %s
        GROUP BY reg_date
        ORDER BY reg_date
        """, (start_date, end_date))
        
        user_reg_data = []
        total_new_users = 0
        for row in cursor.fetchall():
            reg_date = row[0].strftime('%Y-%m-%d')
            count = row[1]
            total_new_users += count
            user_reg_data.append({"reg_date": reg_date, "count": count})
        
        # Generate AI insights based on the data
        ai_insights = generate_ai_insights(
            start_date, 
            end_date, 
            total_visits, 
            total_requests, 
            document_types_data, 
            status_data
        )
        
        return jsonify({
            "success": True,
            "totalVisits": total_visits,
            "totalRequests": total_requests,
            "totalDocuments": total_documents,
            "totalNewUsers": total_new_users,
            "visitsData": visits_data,
            "documentTypesData": document_types_data,
            "statusData": status_data,
            "topQueries": top_queries,
            "userRegData": user_reg_data,
            "aiInsights": ai_insights
        })
    except Exception as e:
        logger.error(f"Error generating custom report: {e}")
        return jsonify({"error": f"Failed to generate report: {str(e)}"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# FIXED: Route to get user profile
@app.route('/user/profile')
@auth_required
def user_profile():
    user_id = session.get('user_id')
    user = get_user_by_id(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Get user's document requests
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        # FIXED: Use document_types instead of document_type ; added notes
        query = """
            SELECT 
                id,
                CASE 
                    WHEN document_types IS NOT NULL 
                        THEN array_to_string(document_types, ', ')
                    ELSE 'Unknown'
                END as document_type,
                request_date,
                submission_date,
                status,
                notes
            FROM document_submissions
            WHERE user_id = %s
            ORDER BY submission_date DESC
        """
        cursor.execute(query, (user_id,))
        
        # Convert to dictionary format
        document_requests = []
        for row in cursor.fetchall():
            doc = dict(row)
            # Format dates for JSON
            if doc.get('request_date'):
                doc['request_date'] = doc['request_date'].strftime('%Y-%m-%d')
            if doc.get('submission_date'):
                doc['submission_date'] = doc['submission_date'].strftime('%Y-%m-%d %H:%M:%S')
            
            # Add reference number format
            doc['reference_number'] = f"REF-{doc['id']}"
            
            document_requests.append(doc)
        
        # Remove sensitive information
        user.pop('password_hash', None)
        
        return jsonify({
            "user": user,
            "document_requests": document_requests
        })
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        return jsonify({"error": "Failed to fetch user profile"}), 500
    finally:
        cursor.close()
        return_connection(connection)
        
# Route for admin replies (save into notes column)
@app.route('/admin/reply', methods=['POST'])
@auth_required   # keep if only admins should use this
def add_admin_reply():
    request_id = request.form.get('request_id')
    reply_text = request.form.get('reply')

    if not request_id or not reply_text:
        return jsonify({"error": "Missing request_id or reply"}), 400

    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = connection.cursor()

        # Update the notes column (instead of admin_reply)
        cursor.execute("""
            UPDATE document_submissions
            SET notes = %s
            WHERE id = %s
        """, (reply_text, request_id))

        if cursor.rowcount == 0:
            return jsonify({"error": "Request not found"}), 404

        connection.commit()
        return jsonify({"success": True, "message": "Reply saved in notes"})

    except Exception as e:
        connection.rollback()
        return jsonify({"error": f"Failed to save reply: {str(e)}"}), 500
    finally:
        cursor.close()
        return_connection(connection)
        
# Route to update user profile
@app.route('/user/update_profile', methods=['POST'])
@auth_required
def update_profile():
    user_id = session.get('user_id')
    data = request.json
    
    name = data.get('name')
    
    if not name:
        return jsonify({"error": "Name is required"}), 400
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor()
        query = """
        UPDATE app_users
        SET name = %s
        WHERE id = %s
        """
        cursor.execute(query, (name, user_id))
        connection.commit()
        
        # Update session
        session['name'] = name
        
        return jsonify({"success": True, "message": "Profile updated successfully"})
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        connection.rollback()
        return jsonify({"error": "Failed to update profile"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route to change password
@app.route('/user/change_password', methods=['POST'])
@auth_required
def change_password():
    user_id = session.get('user_id')
    data = request.json
    
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({"error": "Current password and new password are required"}), 400
    
    # Get user
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Check if user has a password (might be OAuth user)
    if not user.get('password_hash'):
        return jsonify({"error": "Cannot change password for OAuth users"}), 400
    
    # Verify current password
    if not verify_password(user['password_hash'], current_password):
        return jsonify({"error": "Current password is incorrect"}), 400
    
    # Hash new password
    password_hash = hash_password(new_password)
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor()
        query = """
        UPDATE app_users
        SET password_hash = %s
        WHERE id = %s
        """
        cursor.execute(query, (password_hash, user_id))
        connection.commit()
        
        return jsonify({"success": True, "message": "Password changed successfully"})
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        connection.rollback()
        return jsonify({"error": "Failed to change password"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# New routes for chat history feature

# Route to get all chat histories for a user
@app.route('/user/chats')
@auth_required
def get_user_chats_route():
    user_id = session.get('user_id')
    
    # Log the request for debugging
    logger.info(f"Getting all chats for user {user_id}")
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        query = """
        SELECT id, title, created_at, updated_at
        FROM chat_histories
        WHERE user_id = %s AND is_active = TRUE
        ORDER BY updated_at DESC
        """
        cursor.execute(query, (user_id,))
        
        chats = []
        for row in cursor.fetchall():
            chat = dict(row)
            # Format dates for JSON
            if chat.get('created_at'):
                chat['created_at'] = chat['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if chat.get('updated_at'):
                chat['updated_at'] = chat['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
            
            chats.append(chat)
        
        # Include visibility state in the response
        visibility = session.get('chat_history_visible', True)
        
        # Log success
        logger.info(f"Successfully retrieved {len(chats)} chats for user {user_id}")
        
        return jsonify({
            "success": True,
            "chats": chats,
            "visible": visibility
        })
    except Exception as e:
        logger.error(f"Error fetching user chats: {e}")
        return jsonify({"error": f"Failed to fetch chats: {str(e)}"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route to create a new chat
@app.route('/user/chats/new', methods=['POST'])
@auth_required
def create_new_chat():
    user_id = session.get('user_id')
    data = request.json
    title = data.get('title', 'New Chat')
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor()
        query = """
        INSERT INTO chat_histories (user_id, title)
        VALUES (%s, %s)
        RETURNING id
        """
        cursor.execute(query, (user_id, title))
        chat_id = cursor.fetchone()[0]
        connection.commit()
        
        return jsonify({
            "success": True, 
            "chat_id": chat_id,
            "title": title
        })
    except Exception as e:
        logger.error(f"Error creating new chat: {e}")
        connection.rollback()
        return jsonify({"error": "Failed to create new chat"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route to rename a chat
@app.route('/user/chats/<int:chat_id>/rename', methods=['POST'])
@auth_required
def rename_chat(chat_id):
    user_id = session.get('user_id')
    data = request.json
    new_title = data.get('title')
    
    if not new_title:
        return jsonify({"error": "Title is required"}), 400
    
    # Log the request for debugging
    logger.info(f"Renaming chat {chat_id} to '{new_title}' for user {user_id}")
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor()
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*) FROM chat_histories
        WHERE id = %s AND user_id = %s AND is_active = TRUE
        """
        cursor.execute(verify_query, (chat_id, user_id))
        count = cursor.fetchone()[0]
        
        if count == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return jsonify({"error": "Chat not found or access denied"}), 404
        
        # Update the chat title
        query = """
        UPDATE chat_histories
        SET title = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s AND user_id = %s
        """
        cursor.execute(query, (new_title, chat_id, user_id))
        connection.commit()
        
        # Log success
        logger.info(f"Successfully renamed chat {chat_id} to '{new_title}'")
        
        return jsonify({
            "success": True,
            "message": "Chat renamed successfully",
            "chat_id": chat_id,
            "title": new_title
        })
    except Exception as e:
        logger.error(f"Error renaming chat: {e}")
        connection.rollback()
        return jsonify({"error": f"Failed to rename chat: {str(e)}"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route to delete a chat
@app.route('/user/chats/<int:chat_id>/delete', methods=['POST'])
@auth_required
def delete_chat_route(chat_id):
    user_id = session.get('user_id')
    
    # Log the request for debugging
    logger.info(f"Deleting chat {chat_id} for user {user_id}")
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor()
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*) FROM chat_histories
        WHERE id = %s AND user_id = %s
        """
        cursor.execute(verify_query, (chat_id, user_id))
        count = cursor.fetchone()[0]
        
        if count == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return jsonify({"error": "Chat not found or access denied"}), 404
        
        # Delete the chat and its messages (relying on CASCADE)
        query = """
        DELETE FROM chat_histories
        WHERE id = %s AND user_id = %s
        """
        cursor.execute(query, (chat_id, user_id))
        connection.commit()
        
        # Log success
        logger.info(f"Successfully deleted chat {chat_id}")
        
        return jsonify({
            "success": True,
            "message": "Chat deleted successfully",
            "chat_id": chat_id
        })
    except Exception as e:
        logger.error(f"Error deleting chat: {e}")
        connection.rollback()
        return jsonify({"error": f"Failed to delete chat: {str(e)}"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Route to get chat messages
@app.route('/user/chats/<int:chat_id>/messages')
@auth_required
def get_chat_messages_route(chat_id):
    user_id = session.get('user_id')
    
    # Log the request for debugging
    logger.info(f"Getting messages for chat {chat_id} for user {user_id}")
    
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = connection.cursor()
        # First verify the chat belongs to the user
        verify_query = """
        SELECT COUNT(*), title FROM chat_histories
        WHERE id = %s AND user_id = %s AND is_active = TRUE
        GROUP BY title
        """
        cursor.execute(verify_query, (chat_id, user_id))
        result = cursor.fetchone()
        
        if not result or result[0] == 0:
            logger.error(f"Chat {chat_id} not found or does not belong to user {user_id}")
            return jsonify({"error": "Chat not found or access denied"}), 404
        
        chat_title = result[1]
        
        # Get the chat messages
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        query = """
        SELECT id, is_user, message, timestamp
        FROM chat_messages
        WHERE chat_id = %s
        ORDER BY timestamp ASC
        """
        cursor.execute(query, (chat_id,))
        
        messages = []
        for row in cursor.fetchall():
            message = dict(row)
            # Format dates for JSON
            if message.get('timestamp'):
                message['timestamp'] = message['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
            
            messages.append(message)
        
        # Log success
        logger.info(f"Successfully retrieved {len(messages)} messages for chat {chat_id}")
        
        return jsonify({
            "success": True,
            "chat_id": chat_id,
            "title": chat_title,
            "messages": messages
        })
    except Exception as e:
        logger.error(f"Error fetching chat messages: {e}")
        return jsonify({"error": f"Failed to fetch chat messages: {str(e)}"}), 500
    finally:
        cursor.close()
        return_connection(connection)

# Error handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500

# Add a diagnostic endpoint to check database connectivity and table structure
@app.route('/diagnostic/db-check')
def db_diagnostic():
    try:
        connection = get_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Failed to connect to database"}), 500
            
        cursor = connection.cursor()
        
        # Check if document_submissions table exists
        cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'document_submissions'
        );
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            return jsonify({
                "status": "error", 
                "message": "document_submissions table does not exist"
            }), 500
        
        # Check table structure
        cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'document_submissions';
        """)
        columns = cursor.fetchall()
        
        # Check if there are any records
        cursor.execute("SELECT COUNT(*) FROM document_submissions")
        record_count = cursor.fetchone()[0]
        
        # Get a sample record if available
        sample_record = None
        if record_count > 0:
            cursor.execute("SELECT * FROM document_submissions LIMIT 1")
            columns = [desc[0] for desc in cursor.description]
            sample_record = dict(zip(columns, cursor.fetchone()))
        
        return jsonify({
            "status": "success",
            "database_connected": True,
            "table_exists": table_exists,
            "table_columns": columns,
            "record_count": record_count,
            "sample_record": sample_record
        })
    except Exception as e:
        logger.error(f"Database diagnostic error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "database_connected": False
        }), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            return_connection(connection)

# Call this function after initializing the database connection
# Add this line after creating the connection_pool
load_admin_credentials()
create_chat_history_tables()
update_user_table_for_verification()

# Use PORT environment variable provided by Render
port = int(os.getenv("PORT", 8000))

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true', 
            host=os.getenv('FLASK_HOST', '0.0.0.0'), 
            port=port)
