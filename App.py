from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
from dotenv import load_dotenv
import google.generativeai as genai
import psycopg2
from psycopg2 import pool
import psycopg2.extras
from datetime import datetime, timedelta
import logging
import re

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
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24))  # Use environment variable if available

# Load the GEMINI_API_KEY from environment variables
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    logger.error("API key is missing. Please set GEMINI_API_KEY in your Render environment variables or .env file.")
    raise ValueError("API key is missing. Please set GEMINI_API_KEY in your Render environment variables or .env file.")

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

# Available document types
AVAILABLE_DOCUMENTS = ["barangay clearance", "barangay indigency", "barangay residency"]

# Admin credentials from environment variables
ADMIN_KEY = os.getenv("ADMIN_KEY", "EASTER")
ADMIN_PASS = os.getenv("ADMIN_PASS", "EGG")

# Database URL - get from environment or use default for development
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://root:Ep7Ql5c4D25GlHeIhpnVpwjEEzfJBgnj@dpg-d08ercngi27c738hbdog-a.oregon-postgres.render.com/baacdb")

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

# Function to log conversations
def log_conversation(user_input, ai_response):
    connection = get_connection()
    if connection is None:
        return

    try:
        cursor = connection.cursor()
        query = "INSERT INTO conversation_logs (user_input, ai_response, timestamp) VALUES (%s, %s, %s)"
        values = (user_input, ai_response, datetime.now())
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

# Function to get document status by reference ID
def get_document_status(reference_id):
    connection = get_connection()
    if connection is None:
        logger.error("Failed to get database connection in get_document_status")
        return None

    cursor = None
    try:
        # Log the reference ID for debugging
        logger.info(f"Checking status for reference ID: {reference_id}")
        
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Extract the numeric part of the reference ID (e.g., "REF-123" -> 123)
        doc_id = reference_id.split('-')[1] if '-' in reference_id else reference_id
        logger.info(f"Extracted document ID: {doc_id}")
        
        # First, check if the document exists
        check_query = "SELECT COUNT(*) FROM document_submissions WHERE id = %s"
        cursor.execute(check_query, (doc_id,))
        count = cursor.fetchone()[0]
        logger.info(f"Found {count} documents with ID {doc_id}")
        
        if count == 0:
            logger.warning(f"No document found with ID {doc_id}")
            return None
        
        # Now get the document details
        query = """
        SELECT id, document_type, name, status, pickup_date, submission_date
        FROM document_submissions
        WHERE id = %s
        """
        cursor.execute(query, (doc_id,))
        result = cursor.fetchone()
        
        if result:
            # Convert to dict and log for debugging
            result_dict = dict(result)
            logger.info(f"Found document: {result_dict}")
            return result_dict
        
        logger.warning(f"No document found with ID {doc_id} (after query)")
        return None
    except Exception as e:
        logger.error(f"Error getting document status: {e}")
        return None
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            return_connection(connection)

# Helper function to detect document type in a query
def detect_document_type(query):
    query_lower = query.lower()
    
    # Check for barangay clearance
    if "clearance" in query_lower:
        return "barangay clearance"
    
    # Check for barangay indigency (including common misspellings)
    if any(word in query_lower for word in ["indigency", "indengency", "indengecy", "indegency"]):
        return "barangay indigency"
    
    # Check for barangay residency
    if "residency" in query_lower:
        return "barangay residency"
    
    # If no specific document type is found, check for general document mentions
    for doc_type in AVAILABLE_DOCUMENTS:
        if doc_type in query_lower:
            return doc_type
    
    return None

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

# Route for the index page (UI interface)
@app.route('/')
def index():
    log_website_visit()
    return render_template('index.html')

# Route to handle API calls and process user queries
@app.route('/get_response', methods=['POST'])
def get_response():
    data = request.json
    user_prompt = data.get('prompt', '')
    is_direct_document_request = data.get('isDirectDocumentRequest', False)
    contains_document_type = data.get('containsDocumentType', False)
    contains_document_word = data.get('containsDocumentWord', False)
    contains_interrogative = data.get('containsInterrogative', False)
    starts_with_interrogative = data.get('startsWithInterrogative', False)
    requested_doc_type = data.get('requestedDocType')
    
    if not user_prompt:
        return jsonify({"error": "Prompt is required"}), 400

    try:
        # Check for admin authentication but have AI respond naturally
        parts = user_prompt.split()
        if len(parts) == 2 and parts[0] == ADMIN_KEY and parts[1] == ADMIN_PASS:
            # Log admin access attempt
            log_conversation(user_prompt, "I understand you're asking about administrative access. Let me check that for you.")
            session['admin_authenticated'] = True
            return jsonify({"response": "ADMIN_AUTHENTICATED"})
        
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
                    
                    log_conversation(user_prompt, response_text)
                    return jsonify({"response": response_text})
                else:
                    response_text = f"""
                    <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                        <p>I couldn't find any document request with the reference number <strong>{reference_id}</strong>.</p>
                        <p>Please check if you've entered the correct reference number. The format should be REF-[number], for example, REF-123.</p>
                        <p>If you're sure the reference number is correct, please visit the Barangay Amungan Hall for assistance.</p>
                    </div>
                    """
                    log_conversation(user_prompt, response_text)
                    return jsonify({"response": response_text})
        
        # Check if this is a general document inquiry without specifying a type
        if contains_document_word and not contains_document_type:
            # For general document inquiries, suggest all document types
            context = """You are BAAC (Barangay Amungan Assistant Chatbot), an assistant chatbot for Barangay Amungan, Iba, Zambales.
            Always provide helpful and informative responses. Format your response in a clear and professional manner.
            If users ask about requesting documents, inform them that you can only process requests for Barangay Clearance, Barangay Indigency, and Barangay Residency.
If users ask about checking document status, ask them to provide their reference number (e.g., REF-123)."""
            context += f"\nUser: {user_prompt}\nBAAC: "

            # Using the older API style but without response_mime_type
            response = model.generate_content(context)
            
            response_text = f"""
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                <p>{response.text}</p>
            </div>
            """

            # Log the conversation
            log_conversation(user_prompt, response_text)
            
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
                # Return document type to trigger form display on frontend
                document_title = requested_document.title()
                log_document_request(document_title)
                
                # Create a response with form trigger
                response_text = f"""
                <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                    <p>Thank you for your interest in requesting a {document_title}. Please fill out the form that appears below to proceed with your request.</p>
                </div>
                """
                
                return jsonify({
                    "response": response_text,
                    "showForm": True,
                    "formType": requested_document
                })
        
        # For interrogative queries or general document inquiries, use the AI model
        context = """You are BAAC (Barangay Amungan Assistant Chatbot), an assistant chatbot for Barangay Amungan, Iba, Zambales.
        Always provide helpful and informative responses. Format your response in a clear and professional manner.
        If users ask about requesting documents, inform them that you can only process requests for Barangay Clearance, Barangay Indigency, and Barangay Residency.
        If users ask about checking document status, ask them to provide their reference number (e.g., REF-123)."""
        context += f"\nUser: {user_prompt}\nBAAC: "

        # Using the older API style but without response_mime_type
        response = model.generate_content(context)
        
        response_text = f"""
        <div class="ai-response" style="text-align: justify; line-height: 1.6;">
            <p>{response.text}</p>
        </div>
        """

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
                    
                    result["suggestForm"] = True
                    result["formType"] = doc_type

        # Log the conversation
        log_conversation(user_prompt, response_text)

        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error in get_response: {str(e)}")
        return jsonify({"error": f"An error occurred while processing the request: {str(e)}"}), 500

# Route to handle document form submissions
@app.route('/submit_document', methods=['POST'])
def submit_document():
    try:
        form_data = request.json
        document_type = form_data.get('documentType')
        
        if not document_type:
            return jsonify({"error": "Document type is required"}), 400
            
        # Store document request in database
        connection = get_connection()
        if connection is None:
            return jsonify({"error": "Database connection failed"}), 500
            
        try:
            cursor = connection.cursor()
            
            # Different fields based on document type
            if document_type in ["barangay clearance", "barangay residency"]:
                query = """
                INSERT INTO document_submissions 
                (document_type, request_date, name, purok, purpose, submission_date, status)
                VALUES (%s, %s, %s, %s, %s, NOW(), 'Pending')
                RETURNING id
                """
                values = (
                    document_type,
                    form_data.get('date'),
                    form_data.get('name'),
                    form_data.get('purok'),
                    form_data.get('purpose')
                )
            elif document_type == "barangay indigency":
                query = """
                INSERT INTO document_submissions 
                (document_type, request_date, name, purok, purpose, copies, submission_date, status)
                VALUES (%s, %s, %s, %s, %s, %s, NOW(), 'Pending')
                RETURNING id
                """
                values = (
                    document_type,
                    form_data.get('date'),
                    form_data.get('name'),
                    form_data.get('purok'),
                    form_data.get('purpose'),
                    form_data.get('copies')
                )
            else:
                return jsonify({"error": "Invalid document type"}), 400
                
            cursor.execute(query, values)
            # Get the ID of the submitted document using RETURNING in PostgreSQL
            submission_id = cursor.fetchone()[0]
            connection.commit()
            
            response_text = f"""
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                <p>Thank you! Your {document_type.title()} request has been submitted successfully.</p>
                <p>Your request reference number is: <strong>REF-{submission_id}</strong></p>
                <p>Please keep this reference number to check the status of your request later.</p>
                <p>You can ask me anytime about the status of your request by providing this reference number.</p>
            </div>
            """
            
            # Log the conversation
            log_conversation(f"Document submission: {document_type}", response_text)
            
            return jsonify({
                "success": True,
                "response": response_text,
                "referenceNumber": f"REF-{submission_id}"
            })
            
        except Exception as e:
            logger.error(f"Error submitting document: {e}")
            connection.rollback()
            return jsonify({"error": "Failed to submit document request"}), 500
        finally:
            cursor.close()
            return_connection(connection)
                
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({"error": f"An error occurred while processing the request: {str(e)}"}), 500

# Route for admin page
@app.route('/admin')
def admin():
    if not session.get('admin_authenticated'):
        return redirect(url_for('index'))
    
    # Pass current date and date 7 days ago for the date range picker
    now = datetime.now()
    return render_template('admin.html', now=now, timedelta=timedelta)

# Route to get document requests for admin dashboard
@app.route('/admin/document_requests')
def admin_document_requests():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401
        
    connection = get_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = connection.cursor()
        query = """
        SELECT 
            id, 
            document_type, 
            request_date, 
            name, 
            purok, 
            purpose, 
            copies, 
            submission_date, 
            status, 
            pickup_date, 
            notes
        FROM document_submissions
        ORDER BY submission_date DESC
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
        visits_data = [{"visit_date": row[0], "visit_count": row[1]} for row in visits_rows]

        # Get last 7 days of document requests
        cursor.execute("""
        SELECT request_date, SUM(request_count) as total_requests 
        FROM document_requests 
        GROUP BY request_date 
        ORDER BY request_date DESC 
        LIMIT 7
        """)
        requests_rows = cursor.fetchall()
        requests_data = [{"request_date": row[0], "total_requests": row[1]} for row in requests_rows]

        # Get document requests by type
        cursor.execute("""
        SELECT document_type, SUM(request_count) as total_requests 
        FROM document_requests 
        WHERE request_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY document_type
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

        return jsonify({
            "today_visits": today_visits,
            "today_requests": today_requests,
            "visits_data": visits_data,
            "requests_data": requests_data,
            "document_types_data": document_types_data,
            "status_data": status_data
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
            "visitsData": visits_data,
            "documentTypesData": document_types_data,
            "statusData": status_data,
            "topQueries": top_queries,
            "aiInsights": ai_insights
        })
    except Exception as e:
        logger.error(f"Error generating custom report: {e}")
        return jsonify({"error": f"Failed to generate report: {str(e)}"}), 500
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

# Use PORT environment variable provided by Render
port = int(os.getenv("PORT", 8000))

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true', 
            host=os.getenv('FLASK_HOST', '0.0.0.0'), 
            port=port)
