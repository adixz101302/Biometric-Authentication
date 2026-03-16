import os
import io
import base64
import numpy as np
import cv2
from flask import Flask, render_template, request, jsonify, session, redirect, url_for

# Import custom modules
import database
import biometrics

app = Flask(__name__)
# Configurations
app.config['SECRET_KEY'] = 'super-secret-key-change-in-production'
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')

# Initialize DB on startup
database.init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/register', methods=['GET'])
def register_page():
    return render_template('register.html')

@app.route('/login', methods=['GET'])
def login_page():
    return render_template('login.html')

@app.route('/admin', methods=['GET'])
def admin_page():
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login_page'))
    return render_template('admin.html')

@app.route('/admin_login', methods=['GET', 'POST'])
def admin_login_page():
    error = None
    if request.method == 'POST':
        password = request.form.get('password')
        if password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return redirect(url_for('admin_page'))
        else:
            error = "Invalid Credentials"
    return render_template('admin_login.html', error=error)

@app.route('/admin_logout')
def admin_logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('home'))

def base64_to_cv2(base64_string):
    """Converts a base64 encoded image string to a cv2 image."""
    try:
        # Check if the string has a header (e.g. data:image/jpeg;base64,)
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"Error decoding image: {e}")
        return None

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    images_base64 = data.get('images', [])

    if not name or not email or len(images_base64) < 1:
        return jsonify({"success": False, "message": "Missing name, email, or images"}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # Check if user already exists
    user = cursor.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if user:
        return jsonify({"success": False, "message": "Email already registered"}), 400

    encodings = []
    
    for b64 in images_base64:
        img = base64_to_cv2(b64)
        if img is not None:
            encoding, error = biometrics.encode_face(img)
            if encoding is not None:
                encodings.append(encoding)
    
    if len(encodings) == 0:
        return jsonify({"success": False, "message": "No valid faces detected in the provided images."}), 400

    # Average the encodings
    avg_encoding = np.mean(encodings, axis=0)

    # Convert to bytes and encrypt
    encoding_bytes = avg_encoding.tobytes()
    encrypted_encoding = biometrics.encrypt_data(encoding_bytes)

    # Store user
    cursor.execute('INSERT INTO users (name, email, encrypted_encoding) VALUES (?, ?, ?)',
                  (name, email, encrypted_encoding))
    new_user_id = cursor.lastrowid
    
    # Log registration
    cursor.execute('INSERT INTO auth_logs (user_id, action, status) VALUES (?, ?, ?)',
                  (new_user_id, 'register', 'success'))
    
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "User registered successfully!"})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    email = data.get('email')
    image_base64 = data.get('image')

    if not email or not image_base64:
        return jsonify({"success": False, "message": "Missing email or image"}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()

    user = cursor.execute('SELECT id, encrypted_encoding FROM users WHERE email = ?', (email,)).fetchone()
    
    if not user:
        # To prevent user enumeration, we might still process the image or sleep, but for simplicity:
        return jsonify({"success": False, "message": "Access Denied"}), 401

    user_id = user['id']
    
    # Check attempts
    recent_logs = cursor.execute('''
        SELECT status FROM auth_logs 
        WHERE user_id = ? AND action = 'login' 
        ORDER BY timestamp DESC LIMIT 3
    ''', (user_id,)).fetchall()
    
    failed_attempts = 0
    for log in recent_logs:
        if log['status'] == 'denied':
            failed_attempts += 1
        else:
            break
            
    if failed_attempts >= 3:
        return jsonify({"success": False, "message": "Account locked due to too many failed attempts. Try again later."}), 403

    # Decode image and process face
    img = base64_to_cv2(image_base64)
    if img is None:
        return jsonify({"success": False, "message": "Invalid image data"}), 400

    encoding_to_check, error = biometrics.encode_face(img)
    
    if error:
        cursor.execute('INSERT INTO auth_logs (user_id, action, status) VALUES (?, ?, ?)',
                      (user_id, 'login', 'denied'))
        conn.commit()
        return jsonify({"success": False, "message": f"Access Denied: {error}"}), 401

    # Decrypt stored encoding
    encrypted_encoding = user['encrypted_encoding']
    try:
        decrypted_bytes = biometrics.decrypt_data(encrypted_encoding)
        stored_encoding = np.frombuffer(decrypted_bytes, dtype=np.float64)
    except Exception as e:
        print(f"Decryption error: {e}")
        return jsonify({"success": False, "message": "System error processing biometric data"}), 500

    is_match, distance = biometrics.match_face(stored_encoding, encoding_to_check)

    if is_match:
        cursor.execute('INSERT INTO auth_logs (user_id, action, status) VALUES (?, ?, ?)',
                      (user_id, 'login', 'success'))
        conn.commit()
        # In a real app, generate JWT or session here
        return jsonify({"success": True, "message": "Access Granted"})
    else:
        cursor.execute('INSERT INTO auth_logs (user_id, action, status) VALUES (?, ?, ?)',
                      (user_id, 'login', 'denied'))
        conn.commit()
        return jsonify({"success": False, "message": "Access Denied: Biometric data does not match"}), 401

@app.route('/api/logs', methods=['GET'])
def get_logs():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    conn = database.get_db_connection()
    logs = conn.execute('''
        SELECT users.name, users.email, auth_logs.action, auth_logs.status, auth_logs.timestamp 
        FROM auth_logs 
        LEFT JOIN users ON auth_logs.user_id = users.id 
        ORDER BY auth_logs.timestamp DESC LIMIT 100
    ''').fetchall()
    conn.close()
    
    return jsonify([dict(row) for row in logs])

@app.route('/api/users', methods=['GET'])
def get_users():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    conn = database.get_db_connection()
    users = conn.execute('SELECT id, name, email, created_at FROM users').fetchall()
    conn.close()
    return jsonify([dict(row) for row in users])

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM auth_logs WHERE user_id = ?', (user_id,))
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "User deleted"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
