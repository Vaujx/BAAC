# BAAC — Barangay Amungan Assistant Chatbot

BAAC is a Flask-based web application that acts as an AI-powered virtual assistant for **Barangay Amungan**. It combines a Google Gemini-powered chatbot with document request handling, barangay official/history information, resident accounts, and an admin dashboard for tracking usage and requests.

## Features

- **AI Chatbot** — Answers resident questions using Google's Gemini API (`gemini-2.0-flash`), with contextual knowledge about barangay officials, population data, history, and notable places.
- **Document Requests** — Detects document-related queries (e.g., barangay clearance, certificates) and lets residents submit and track requests via a reference ID.
- **User Accounts** — Registration and login with email/password (hashed) or Google OAuth, plus email verification and password reset flows.
- **Chat History** — Persists conversations per user so they can revisit past chats.
- **Admin Dashboard** — Tracks website visits and document request statistics, with AI-generated insights summarizing trends.
- **Email Notifications** — Sends verification and password-reset emails via SMTP (Gmail).

## Tech Stack

- **Backend:** Flask, Gunicorn
- **Database:** PostgreSQL (via `psycopg2`, connection pooling)
- **AI:** Google Generative AI (Gemini)
- **Auth:** JWT (`PyJWT`), `bcrypt`/Werkzeug password hashing, Google OAuth
- **Other:** `python-dotenv`, `pytz`, `requests`

## Project Structure

```
BAAC/
├── App.py                  # Main Flask application (routes, DB logic, email, chatbot)
├── auth_utils.py            # Password hashing, token generation/verification, Google auth
├── barangay_data.py         # Officials info, available documents, population/document detection helpers
├── barangay_history.py      # Barangay historical info lookup
├── notable_places.py        # Notable places data and request handling
├── static/                  # Static assets (CSS, JS, images)
├── templates/                # HTML templates (Jinja2)
├── requirements.txt          # Python dependencies
├── Procfile                  # Deployment entry point (e.g. Render/Heroku)
└── run.bat                   # Local run script (Windows)
```

## Getting Started

### Prerequisites

- Python 3.9+
- A PostgreSQL database
- A Google Gemini API key
- (Optional) Google OAuth credentials, a GitHub token, and a Gmail app password for email features

### Installation

```bash
git clone https://github.com/Vaujx/BAAC.git
cd BAAC
pip install -r requirements.txt
```

### Configuration

Create a `.env` file in the project root with the following variables:

```env
SECRET_KEY=your_flask_secret_key
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://user:password@host:port/dbname
GITHUB_TOKEN=your_github_token
GITHUB_REPO=Vaujx/BAAC
GITHUB_FILE=barangay_data.py
GITHUB_BRANCH=main
ADMIN_KEY=your_admin_key
ADMIN_PASS=your_admin_password
```

> ⚠️ **Security note:** The current `App.py` has some credentials (database URL, admin defaults, email app password) hardcoded as fallback values in the source. Before deploying or sharing this repo publicly, move all secrets to environment variables only, remove the hardcoded fallbacks, rotate any exposed credentials, and add `.env` to `.gitignore`.

### Run locally

```bash
python App.py
```

Or on Windows:

```bash
run.bat
```

The app will be available at `http://localhost:5000` by default.

### Deployment

This project includes a `Procfile`, so it's ready to deploy on platforms like **Render** or **Heroku** using Gunicorn:

```
web: gunicorn App:app
```

## License

No license specified yet. Consider adding one (e.g., MIT) if you plan to open-source this project.
