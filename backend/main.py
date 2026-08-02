import os
import sqlite3
import urllib.parse
from datetime import datetime
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Header
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load local environment variables from .env file
load_dotenv()

# Simple authentication configuration
VALID_CREDENTIALS = {
    "admin": os.environ.get("ADMIN_PASSCODE", "admin2026"),
    "volunteer_1": os.environ.get("VOL1_PASSCODE", "vol1"),
    "volunteer_2": os.environ.get("VOL2_PASSCODE", "vol2"),
    "volunteer_3": os.environ.get("VOL3_PASSCODE", "vol3"),
    "volunteer_4": os.environ.get("VOL4_PASSCODE", "vol4"),
    "volunteer_5": os.environ.get("VOL5_PASSCODE", "vol5"),
    "volunteer_6": os.environ.get("VOL6_PASSCODE", "vol6"),
}


# Check for PostgreSQL database URL (Render default)
DATABASE_URL = os.environ.get("DATABASE_URL")

# Try importing psycopg2 if PostgreSQL is configured
if DATABASE_URL:
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        psycopg2 = None
else:
    psycopg2 = None

app = FastAPI(title="QR Attendance System")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "attendance.db"

# Normalizes Render postgres:// URL to postgresql://
def get_postgresql_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is missing.")
    
    # Parse the connection string explicitly for maximum compatibility
    result = urllib.parse.urlparse(DATABASE_URL)
    username = result.username
    password = result.password
    database = result.path[1:]
    hostname = result.hostname
    port = result.port or 5432
    
    # Extract query parameters for sslmode
    query_params = urllib.parse.parse_qs(result.query)
    sslmode = query_params.get('sslmode', ['require'])[0]
    
    conn = psycopg2.connect(
        database=database,
        user=username,
        password=password,
        host=hostname,
        port=port,
        sslmode=sslmode
    )
    return conn

# General connection interface
class DBConn:
    def __init__(self):
        self.conn = get_postgresql_connection()
        # Use RealDictCursor to match dict key-value access behavior
        self.cursor = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    def execute(self, query: str, params: tuple = ()):
        self.cursor.execute(query, params)
        return self.cursor

    def fetchall(self):
        rows = self.cursor.fetchall()
        return [dict(r) for r in rows]

    def fetchone(self):
        row = self.cursor.fetchone()
        if row:
            return dict(row)
        return None

    def commit(self):
        self.conn.commit()

    def close(self):
        self.cursor.close()
        self.conn.close()

def init_db():
    db = DBConn()
    
    # Students table
    db.execute("""
        CREATE TABLE IF NOT EXISTS students (
            admission_no VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255),
            mob_no VARCHAR(255),
            department VARCHAR(255),
            email_status VARCHAR(255),
            qr_link TEXT
        )
    """)
    
    # Attendance logs table
    db.execute("""
        CREATE TABLE IF NOT EXISTS attendance_logs (
            id SERIAL PRIMARY KEY,
            admission_no VARCHAR(255),
            timestamp VARCHAR(255),
            FOREIGN KEY(admission_no) REFERENCES students(admission_no)
        )
    """)
        
    db.commit()
    db.close()

init_db()

class LoginRequest(BaseModel):
    role: str
    passcode: str

@app.post("/api/login")
async def login(req: LoginRequest):
    role = req.role.strip().lower()
    passcode = req.passcode.strip()
    
    if role not in VALID_CREDENTIALS:
        raise HTTPException(status_code=400, detail="Invalid role selected.")
    
    if VALID_CREDENTIALS[role] == passcode:
        return {"status": "success", "token": f"session_token_{role}", "role": role}
    else:
        raise HTTPException(status_code=401, detail="Incorrect passcode.")

# Helper to map Excel columns robustly
def find_column(columns, candidates):
    for candidate in candidates:
        for col in columns:
            if candidate.lower() in str(col).lower():
                return col
    return None

@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...), authorization: str = Header(None)):
    if not authorization or authorization != "session_token_admin":
        raise HTTPException(status_code=403, detail="Unauthorized. Only Admin can upload data.")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel sheet.")
    
    try:
        # Save temporary file
        temp_path = "temp_uploaded.xlsx"
        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Load Excel using Pandas
        df = pd.read_excel(temp_path)
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        cols = df.columns.tolist()
        
        # Map fields
        name_col = find_column(cols, ["name", "student name", "student_name"])
        email_col = find_column(cols, ["email", "mail"])
        mob_col = find_column(cols, ["mob", "mobile", "phone", "contact"])
        admission_col = find_column(cols, ["admission", "admission_no", "roll", "uid"])
        dept_col = find_column(cols, ["dept", "department", "branch"])
        status_col = find_column(cols, ["status", "email_status", "email status"])
        qr_col = find_column(cols, ["qr", "qr_link", "qr card link", "link"])

        if not admission_col:
            raise HTTPException(status_code=400, detail="Could not identify 'Admission No' column in the Excel file.")

        # Ensure tables exist (handles case where tables were dropped by clearing script)
        init_db()

        db = DBConn()
        
        # Clear existing students and logs for a clean upload (Delete child table first)
        db.execute("DELETE FROM attendance_logs")
        db.execute("DELETE FROM students")
        
        inserted_count = 0
        for _, row in df.iterrows():
            admission_no = str(row[admission_col]).strip() if pd.notna(row[admission_col]) else None
            if not admission_no or admission_no.lower() == 'nan':
                continue
                
            name = str(row[name_col]).strip() if name_col and pd.notna(row[name_col]) else "Unknown"
            email = str(row[email_col]).strip() if email_col and pd.notna(row[email_col]) else ""
            mob = str(row[mob_col]).strip() if mob_col and pd.notna(row[mob_col]) else ""
            dept = str(row[dept_col]).strip() if dept_col and pd.notna(row[dept_col]) else ""
            email_status = str(row[status_col]).strip() if status_col and pd.notna(row[status_col]) else ""
            qr_link = str(row[qr_col]).strip() if qr_col and pd.notna(row[qr_col]) else ""
            
            # Use postgresql conflict syntax
            db.execute("""
                INSERT INTO students (admission_no, name, email, mob_no, department, email_status, qr_link)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (admission_no) DO UPDATE SET 
                    name = EXCLUDED.name, email = EXCLUDED.email, mob_no = EXCLUDED.mob_no, 
                    department = EXCLUDED.department, email_status = EXCLUDED.email_status, qr_link = EXCLUDED.qr_link
            """, (admission_no, name, email, mob, dept, email_status, qr_link))
                
            inserted_count += 1
            
        db.commit()
        db.close()
        
        return {"status": "success", "message": f"Successfully imported {inserted_count} students."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing Excel: {str(e)}")

class MarkAttendanceRequest(BaseModel):
    admission_no: str

@app.post("/api/attendance/mark")
async def mark_attendance(req: MarkAttendanceRequest):
    admission_no = req.admission_no.strip()
    db = DBConn()
    
    # Check if student exists
    db.execute("SELECT * FROM students WHERE admission_no = %s", (admission_no,))
    student = db.fetchone()
    
    if not student:
        # Fallback search - sometimes the QR code might contain a URL or sub-string containing the admission number
        # We'll search if the admission_no is contained in any student's admission_no or vice versa
        db.execute("SELECT * FROM students")
        all_students = db.fetchall()
        matched_student = None
        for s in all_students:
            s_adm = s["admission_no"].strip().lower()
            req_adm = admission_no.lower()
            if req_adm in s_adm or s_adm in req_adm:
                matched_student = s
                admission_no = s["admission_no"]  # Normalize to the database value
                break
        
        if not matched_student:
            db.close()
            raise HTTPException(status_code=404, detail=f"Student with admission number '{admission_no}' not found.")
        student = matched_student

    # Check if already marked present today
    today_str = datetime.now().strftime("%Y-%m-%d")
    db.execute("""
        SELECT * FROM attendance_logs 
        WHERE admission_no = %s AND timestamp LIKE %s
    """, (admission_no, f"{today_str}%"))
    existing_log = db.fetchone()
    
    if existing_log:
        db.close()
        return {
            "status": "already_marked",
            "message": f"Attendance already marked for {student['name']} today.",
            "student": student,
            "time": existing_log["timestamp"]
        }
        
    # Mark present
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.execute("""
        INSERT INTO attendance_logs (admission_no, timestamp)
        VALUES (%s, %s)
    """, (admission_no, now_str))
    
    db.commit()
    db.close()
    
    return {
        "status": "success",
        "message": f"Attendance marked for {student['name']}.",
        "student": student,
        "time": now_str
    }

@app.get("/api/students")
async def get_students():
    db = DBConn()
    # Distinct logs select for SQLite vs Postgres
    db.execute("""
        SELECT s.*, l.timestamp as attended_at
        FROM students s
        LEFT JOIN (
            SELECT admission_no, MAX(timestamp) as timestamp 
            FROM attendance_logs 
            GROUP BY admission_no
        ) l ON s.admission_no = l.admission_no
        ORDER BY s.name ASC
    """)
    students = db.fetchall()
    db.close()
    return students

@app.get("/api/stats")
async def get_stats():
    db = DBConn()
    
    db.execute("SELECT COUNT(*) as count FROM students")
    total_row = db.fetchone()
    total_students = total_row["count"] if total_row else 0
    
    today_str = datetime.now().strftime("%Y-%m-%d")
    db.execute("SELECT COUNT(DISTINCT admission_no) as count FROM attendance_logs WHERE timestamp LIKE %s", (f"{today_str}%",))
    present_row = db.fetchone()
    present_today = present_row["count"] if present_row else 0
    
    absent_today = total_students - present_today
    present_rate = round((present_today / total_students * 100), 1) if total_students > 0 else 0
    
    db.close()
    return {
        "total": total_students,
        "present": present_today,
        "absent": absent_today,
        "rate": present_rate
    }

@app.get("/api/export")
async def export_attendance():
    db = DBConn()
    db.execute("""
        SELECT s.admission_no as "Admission No", 
               s.name as "Name of Student", 
               s.email as "Email Id", 
               s.mob_no as "Mob No", 
               s.department as "Department",
               CASE WHEN l.timestamp IS NOT NULL THEN 'PRESENT' ELSE 'ABSENT' END as "Attendance Status",
               l.timestamp as "Attended At"
        FROM students s
        LEFT JOIN (
            SELECT admission_no, MAX(timestamp) as timestamp 
            FROM attendance_logs 
            GROUP BY admission_no
        ) l ON s.admission_no = l.admission_no
        ORDER BY s.name ASC
    """)
    
    rows = db.fetchall()
    db.close()
    
    if not rows:
        raise HTTPException(status_code=400, detail="No student data to export.")
        
    df = pd.DataFrame(rows)
    export_path = "Attendance_Report.xlsx"
    df.to_excel(export_path, index=False)
    
    return FileResponse(export_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=export_path)

# Serve Frontend static assets
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    @app.get("/")
    async def root_fallback():
        return {"message": "Attendance API is running. Frontend folder is missing."}
