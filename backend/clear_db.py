import os
import sqlite3
import urllib.parse
from dotenv import load_dotenv

# Load env variables
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

def clear_database():
    if DATABASE_URL:
        try:
            import psycopg2
            print("Connecting to PostgreSQL to clear data...")
            
            # Parse connection string
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
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS attendance_logs CASCADE;")
            cursor.execute("DROP TABLE IF EXISTS students CASCADE;")
            
            # Recreate tables immediately so database is empty but ready
            cursor.execute("""
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
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS attendance_logs (
                    id SERIAL PRIMARY KEY,
                    admission_no VARCHAR(255),
                    timestamp VARCHAR(255),
                    FOREIGN KEY(admission_no) REFERENCES students(admission_no)
                )
            """)
            
            conn.commit()
            cursor.close()
            conn.close()
            print("Successfully cleared all data (PostgreSQL database is now empty but structured).")
        except Exception as e:
            print(f"Error clearing PostgreSQL database: {e}")
    else:
        # Clear local SQLite database
        db_path = "attendance.db"
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
                print("Successfully deleted local SQLite database file (attendance.db).")
            except Exception as e:
                # If file is locked, try running queries
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    cursor.execute("DROP TABLE IF EXISTS attendance_logs;")
                    cursor.execute("DROP TABLE IF EXISTS students;")
                    
                    # Recreate
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS students (
                            admission_no TEXT PRIMARY KEY,
                            name TEXT,
                            email TEXT,
                            mob_no TEXT,
                            department TEXT,
                            email_status TEXT,
                            qr_link TEXT
                        )
                    """)
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS attendance_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            admission_no TEXT,
                            timestamp TEXT,
                            FOREIGN KEY(admission_no) REFERENCES students(admission_no)
                        )
                    """)
                    
                    conn.commit()
                    conn.close()
                    print("Successfully cleared all tables in local SQLite database.")
                except Exception as ex:
                    print(f"Error clearing SQLite tables: {ex}")
        else:
            print("No local SQLite database file found to delete.")

if __name__ == "__main__":
    clear_database()
