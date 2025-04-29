from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
from dotenv import load_dotenv
import google.generativeai as genai
import mysql.connector
from mysql.connector import Error
from datetime import datetime

# Load environment variables from the .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.urandom(24)  # Set a secret key for sessions

# Load the GEMINI_API_KEY from environment variables
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("API key is missing. Please set GEMINI_API_KEY in your .env file.")

# Configure the Gemini API client
genai.configure(api_key=api_key)

# Model configuration
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

# Create the model instance
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp", 
    generation_config=generation_config,
)

# Database connection function
def create_db_connection():
    try:
        connection = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="baacdb"
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL database: {e}")
        return None

# Admin credentials (in a real-world scenario, these should be stored securely)
ADMIN_KEY = "EASTER"
ADMIN_PASS = "EGG"

# Function to log conversations
def log_conversation(user_input, ai_response):
    connection = create_db_connection()
    if connection is None:
        return

    try:
        cursor = connection.cursor()
        query = "INSERT INTO conversation_logs (user_input, ai_response, timestamp) VALUES (%s, %s, %s)"
        values = (user_input, ai_response, datetime.now())
        cursor.execute(query, values)
        connection.commit()
    except Error as e:
        print(f"Error logging conversation: {e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

def log_website_visit():
    connection = create_db_connection()
    if connection is None:
        return

    try:
        cursor = connection.cursor()
        query = """
        INSERT INTO website_visits (visit_date, visit_count)
        VALUES (CURDATE(), 1)
        ON DUPLICATE KEY UPDATE visit_count = visit_count + 1
        """
        cursor.execute(query)
        connection.commit()
    except Error as e:
        print(f"Error logging website visit: {e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

def log_document_request(document_type):
    connection = create_db_connection()
    if connection is None:
        return

    try:
        cursor = connection.cursor()
        query = """
        INSERT INTO document_requests (request_date, document_type, request_count)
        VALUES (CURDATE(), %s, 1)
        ON DUPLICATE KEY UPDATE request_count = request_count + 1
        """
        cursor.execute(query, (document_type,))
        connection.commit()
    except Error as e:
        print(f"Error logging document request: {e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

# Route for the index page (UI interface)
@app.route('/')
def index():
    log_website_visit()
    return render_template('index.html')

# Route to handle API calls and process user queries
@app.route('/get_response', methods=['POST'])
def get_response():
    user_prompt = request.json.get('prompt', '')
    
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
        
        # Check if this is a document request
        is_document_request = any(word in user_prompt.lower() for word in ['document', 'clearance', 'certificate', 'request'])
        
        if is_document_request:
            response_text = """
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                <p>Greetings! To assist you with your document request, I need some additional information. Please provide the following details:</p>
                
                <div class="requirements" style="margin: 15px 0; padding-left: 20px;">
                    <p><strong>1. Document needed:</strong><br>
                    <span style="color: #666;">(e.g., Barangay Clearance, Certificate of Indigency, etc.)</span></p>
                    
                    <p><strong>2. Purpose of the document:</strong><br>
                    <span style="color: #666;">(e.g., School enrollment, employment, financial assistance, etc.)</span></p>
                    
                    <p><strong>3. Residency status:</strong><br>
                    <span style="color: #666;">Are you a resident of Barangay Amungan?</span></p>
                    
                    <p><strong>4. Full name:</strong></p>
                    
                    <p><strong>5. Address in Barangay Amungan:</strong></p>
                    
                    <p><strong>6. Contact number:</strong><br>
                    <span style="color: #666;">(optional but helpful)</span></p>
                </div>
                
                <p>Once I have this information, I can guide you on the specific requirements and procedures for obtaining your requested document. Your cooperation in providing these details will help me serve you more efficiently.</p>
            </div>
            """
            # Log document request
            log_document_request("General Document")
        else:
            # Generate response for non-document queries
            context = """You are BAAC (Barangay Amungan Assistant Chatbot), an assistant chatbot for Barangay Amungan, Iba, Zambales.
            Always provide helpful and informative responses. Format your response in a clear and professional manner."""
            context += f"\nUser: {user_prompt}\nBAAC: "

            response = model.generate_content([context])
            response_text = f"""
            <div class="ai-response" style="text-align: justify; line-height: 1.6;">
                <p>{response.text}</p>
            </div>
            """

        # Log the conversation
        log_conversation(user_prompt, response_text)

        return jsonify({"response": response_text})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": f"An error occurred while processing the request: {str(e)}"}), 500
    
# Route for admin page
@app.route('/admin')
def admin():
    if not session.get('admin_authenticated'):
        return redirect(url_for('index'))
    return render_template('admin.html')

# Route for getting AI report
@app.route('/ai_report')
def ai_report():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401

    connection = create_db_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = connection.cursor(dictionary=True)
        query = """
        SELECT 
            COUNT(*) as total_conversations,
            DATE(timestamp) as date,
            AVG(CHAR_LENGTH(user_input)) as avg_user_input_length,
            AVG(CHAR_LENGTH(ai_response)) as avg_ai_response_length
        FROM conversation_logs
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
        LIMIT 7
        """
        cursor.execute(query)
        report_data = cursor.fetchall()
        return jsonify(report_data)
    except Error as e:
        print(f"Error generating AI report: {e}")
        return jsonify({"error": "Failed to generate report"}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/admin_stats')
def admin_stats():
    if not session.get('admin_authenticated'):
        return jsonify({"error": "Unauthorized"}), 401

    connection = create_db_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = connection.cursor(dictionary=True)
        
        # Get today's website visits
        cursor.execute("SELECT visit_count FROM website_visits WHERE visit_date = CURDATE()")
        today_visits = cursor.fetchone()
        today_visits = today_visits['visit_count'] if today_visits else 0

        # Get today's document requests
        cursor.execute("SELECT SUM(request_count) as total_requests FROM document_requests WHERE request_date = CURDATE()")
        today_requests = cursor.fetchone()
        today_requests = today_requests['total_requests'] if today_requests and today_requests['total_requests'] else 0

        # Get last 7 days of website visits
        cursor.execute("SELECT visit_date, visit_count FROM website_visits ORDER BY visit_date DESC LIMIT 7")
        visits_data = cursor.fetchall()

        # Get last 7 days of document requests
        cursor.execute("SELECT request_date, SUM(request_count) as total_requests FROM document_requests GROUP BY request_date ORDER BY request_date DESC LIMIT 7")
        requests_data = cursor.fetchall()

        return jsonify({
            "today_visits": today_visits,
            "today_requests": today_requests,
            "visits_data": visits_data,
            "requests_data": requests_data
        })
    except Error as e:
        print(f"Error fetching admin stats: {e}")
        return jsonify({"error": "Failed to fetch stats"}), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)