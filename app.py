# app.py - integrated with simple login (SQLite) for CalmChat
from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_cors import CORS
import os, base64, io, tempfile, subprocess
from werkzeug.security import check_password_hash
import sqlite3
import speech_recognition as sr  # ✅ added for mic feature

# try to import bot's generate_empathic_response
try:
    from bot import generate_empathic_response
except Exception as e:
    print("Warning: could not import bot.generate_empathic_response:", e)
    def generate_empathic_response(user_input, lang_name="English"):
        return "⚠ Bot not available (import error)."

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me-please")

DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

def get_user(username):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, username, password_hash FROM users WHERE username=?", (username,))
    row = c.fetchone()
    conn.close()
    return row

@app.route("/")
def index():
    # require login
    if not session.get("username"):
        return redirect(url_for("login"))
    return render_template("index.html")

@app.route("/login", methods=["GET","POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username","").strip()
        password = request.form.get("password","")
        user = get_user(username)
        if user:
            user_id, user_name, pw_hash = user
            if check_password_hash(pw_hash, password):
                session["username"] = user_name
                return redirect(url_for("index"))
            else:
                error = "Invalid password."
        else:
            error = "Username not found."
    return render_template("login.html", error=error)

@app.route("/logout")
def logout():
    session.pop("username", None)
    return redirect(url_for("login"))

@app.route("/api/chat", methods=["POST"])
def api_chat():
    if not session.get("username"):
        return jsonify({"error":"not_logged_in"}), 401
    data = request.get_json() or {}
    user_text = data.get("text","")
    lang = data.get("lang","English")
    reply = generate_empathic_response(user_text, lang)
    return jsonify({"reply": reply})


# ✅ Added Speech-to-Text Endpoint (WebM → WAV)
@app.route("/api/speech_to_text", methods=["POST"])
def speech_to_text():
    if not session.get("username"):
        return jsonify({"error": "not_logged_in"}), 401

    if "audio" not in request.files:
        return jsonify({"error": "no_audio"}), 400

    try:
        audio_file = request.files["audio"]

        # Save WebM temporarily
        temp_webm = tempfile.mktemp(suffix=".webm")
        audio_file.save(temp_webm)

        # Convert WebM → WAV using ffmpeg
        temp_wav = tempfile.mktemp(suffix=".wav")
        subprocess.run(["ffmpeg", "-y", "-i", temp_webm, temp_wav],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        # Recognize speech using Google Speech Recognition
        r = sr.Recognizer()
        with sr.AudioFile(temp_wav) as source:
            audio_data = r.record(source)
            text = r.recognize_google(audio_data)

        # Cleanup
        os.remove(temp_webm)
        os.remove(temp_wav)

        return jsonify({"text": text})

    except Exception as e:
        print("Speech-to-text error:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

