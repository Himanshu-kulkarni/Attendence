# DPGU STR Induction 2026 - QR Attendance System

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-316192.svg?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E.svg?style=flat&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

A modern, high-performance, and visually stunning QR code-based student attendance system built for **DPGU STR Induction 2026**. This system features a premium glassmorphic dark-theme UI, live camera-based QR code scanning, instant audio-visual HUD feedback, and a robust role-based access control system supporting an Admin and multiple Volunteers.

---

## Features

- ⚡ **Real-Time QR Code Scanning**: Utilizes the webcam camera stream to read QR codes and register attendance in milliseconds.
- 🎙️ **Text-To-Speech (TTS) & Audio Feedback**: Speaks the student's name/admission number upon successful scan and sounds synthesized warning/error beeps for duplicate scans or unrecognized students.
- 🔑 **Role-Based Access Control**:
  - **7 Roles**: 1 Admin role and 6 Volunteer roles (`Volunteer 1` to `Volunteer 6`).
  - **Permission Enforcement**: Only the Admin role can upload Excel rosters and clear the database. Volunteers can view stats, search the student roster, scan QR codes, and export reports.
- 📊 **Dynamic Dashboard HUD**:
  - Displays instant statistics (Total Students, Present Today, Absent Today, and Attendance Rate).
  - Displays formatted student information immediately after scanning.
  - Quick-searchable student roster filtered dynamically in the browser.
- 📥 **Roster Import & Export**:
  - **Excel Import**: Automatically maps name, email, phone number, admission number, department, email status, and QR card links from raw spreadsheets.
  - **Excel Export**: Exports a detailed, structured attendance report sheet with status ("PRESENT"/"ABSENT") and precise check-in timestamps.
- 🔒 **Secure Connection Mapping**: Supports production-grade secure SSL connections for PostgreSQL, with explicit parameter parsing for cross-platform compatibility.

---

## Tech Stack

### Backend
- **Core Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **WSGI/ASGI Server**: [Uvicorn](https://www.uvicorn.org/) (Local Dev), [Gunicorn](https://gunicorn.org/) (Production)
- **Data Processor**: [Pandas](https://pandas.pydata.org/) & [OpenPyXL](https://openpyxl.readthedocs.io/en/stable/) (Excel parsing)
- **Environment Management**: [Python-dotenv](https://github.com/theofidry/django-dotenv)

### Frontend
- **Structure & Interface**: Semantic HTML5 & Vanilla CSS (custom glassmorphism style sheet)
- **Logic**: Vanilla ES6+ JavaScript (Fetch API, DOM manipulation)
- **QR Code Scanning**: [Html5-Qrcode](https://github.com/mebjas/html5-qrcode) (highly optimized client-side decoder)
- **Typography**: [Outfit Google Font](https://fonts.google.com/specimen/Outfit)

### Database & Deployment
- **Database**: [PostgreSQL](https://www.postgresql.org/) (driver: `psycopg2-binary`)
- **Deployment Platform**: [Render](https://render.com) (infrastructure configuration in `render.yaml`)

---

## Project Structure

```text
├── backend/
│   ├── .env                  # Local environment configuration (git ignored)
│   ├── .env.example          # Sample environment template
│   ├── clear_db.py           # Command-line utility to purge and recreate PostgreSQL tables
│   ├── main.py               # Main FastAPI entry point (routes, auth, and DB logic)
│   └── requirements.txt      # Python package dependencies
├── frontend/
│   ├── app.js                # Core frontend controller (scan loop, API fetching, UI state)
│   ├── index.html            # Main SPA dashboard page and login layout
│   └── style.css             # Main stylesheet implementing dark theme and glassmorphism
├── LICENSE                   # Project software license
└── render.yaml               # Infrastructure-as-code for Render deployment
```

### Folder Responsibilities:
- **`backend/`**: Hosts server code. `main.py` runs the API, manages database queries, validates role credentials, and serves the static frontend assets. `clear_db.py` is a standalone database table reset script.
- **`frontend/`**: Hosts client-side files. `index.html` structure remains unified and uses styling-based toggles for state changes, `app.js` handles webcam access, handles sound synthesis, and tracks session variables.

---

## Architecture

The system operates as a single-page application (SPA). When the user opens the client:

```mermaid
sequenceDiagram
    participant Client as Web Browser
    participant API as FastAPI Backend
    participant DB as PostgreSQL Database

    Client->>Client: Check LocalStorage for Session
    alt Session Empty/Invalid
        Client->>Client: Show Glassmorphic Login Form
        Client->>API: POST /api/login (Role & Passcode)
        API-->>Client: Return session token if valid
    end
    Client->>Client: Load Dashboard view
    Client->>API: GET /api/stats & GET /api/students
    API->>DB: Query students and logs
    DB-->>API: Return rows
    API-->>Client: Populate stats & roster UI
```

### QR Scan Lifecycle:
1. Webcam captures the QR code, decoded on-the-fly by `html5-qrcode`.
2. The admission number is extracted and sent to `/api/attendance/mark` as a POST request.
3. The backend checks if the student exists in PostgreSQL, checks for duplicate scans today, saves the timestamp, and returns a JSON payload.
4. The client plays a synthesized audio response (beeps and TTS name readouts) and updates the HUD.

---

## Installation

### Prerequisites
- Python 3.11 or higher
- A PostgreSQL Database instance (local or hosted on Render)

### Setup Steps

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd Attendence
   ```

2. **Configure Environment Variables**:
   Create a `.env` file inside the `backend/` folder based on the example:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Open `backend/.env` and configure your credentials:
   ```env
   DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>?sslmode=require
   ADMIN_PASSCODE=admin2026
   VOL1_PASSCODE=vol1
   # (Optionally configure VOL2_PASSCODE to VOL6_PASSCODE)
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Initialize Database Tables**:
   Run the utility script to construct the PostgreSQL database structure:
   ```bash
   python backend/clear_db.py
   ```

5. **Start the Application**:
   Run the development server locally:
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
   Open your browser and navigate to **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**.

---

## Environment Variables

| Variable | Description | Default / Example |
|----------|-------------|-------------------|
| `DATABASE_URL` | Secure PostgreSQL connection string (supports SSL parameters). | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `ADMIN_PASSCODE` | The passcode required to access the Admin role workspace. | `admin2026` |
| `VOL1_PASSCODE` | The passcode required to login as Volunteer 1. | `vol1` |
| `VOL2_PASSCODE` to `VOL6_PASSCODE` | Individual passcodes for Volunteer roles 2 through 6. | `vol2` to `vol6` |

---

## API Documentation

<details>
<summary><strong>1. Portal Login (POST /api/login)</strong></summary>

- **Description**: Validates the passcode for a specific role and generates a temporary session token.
- **Authentication Required**: No.
- **Request Body**:
  ```json
  {
    "role": "admin",
    "passcode": "admin2026"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "token": "session_token_admin",
    "role": "admin"
  }
  ```
- **Errors**:
  - `400 Bad Request`: "Invalid role selected."
  - `401 Unauthorized`: "Incorrect passcode."
</details>

<details>
<summary><strong>2. Import Attendance Sheet (POST /api/upload)</strong></summary>

- **Description**: Uploads a spreadsheet containing student roster details. This operation wipes existing logs/student directories and populates new indices.
- **Authentication Required**: Yes (requires `Authorization` header set to `"session_token_admin"`).
- **Request Body**: Multipart form data with file key `"file"` (accepts `.xlsx`, `.xls` only).
- **Example Headers**:
  `Authorization: session_token_admin`
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Successfully imported 674 students."
  }
  ```
- **Errors**:
  - `400 Bad Request`: "Invalid file format." or column mapping failures.
  - `403 Forbidden`: "Unauthorized. Only Admin can upload data."
  - `500 Internal Server Error`: Excel parsing exceptions.
</details>

<details>
<summary><strong>3. Mark Attendance (POST /api/attendance/mark)</strong></summary>

- **Description**: Submits an admission number to log student attendance for the current day.
- **Authentication Required**: No.
- **Request Body**:
  ```json
  {
    "admission_no": "DPGU-2026-0042"
  }
  ```
- **Response (200 OK - New Check-In)**:
  ```json
  {
    "status": "success",
    "message": "Attendance marked for John Doe.",
    "student": {
      "admission_no": "DPGU-2026-0042",
      "name": "John Doe",
      "email": "johndoe@dpgu.edu",
      "mob_no": "9876543210",
      "department": "CSE",
      "email_status": "sent",
      "qr_link": "https://..."
    },
    "time": "2026-08-02 23:25:01"
  }
  ```
- **Response (200 OK - Already Marked Today)**:
  ```json
  {
    "status": "already_marked",
    "message": "Attendance already marked for John Doe today.",
    "student": { ... },
    "time": "2026-08-02 10:15:30"
  }
  ```
- **Errors**:
  - `404 Not Found`: "Student with admission number '<no>' not found."
</details>

<details>
<summary><strong>4. Get Roster Directory (GET /api/students)</strong></summary>

- **Description**: Returns all students together with their latest check-in timestamps.
- **Authentication Required**: No.
- **Response (200 OK)**:
  ```json
  [
    {
      "admission_no": "DPGU-2026-0042",
      "name": "John Doe",
      "email": "johndoe@dpgu.edu",
      "mob_no": "9876543210",
      "department": "CSE",
      "email_status": "sent",
      "qr_link": "https://...",
      "attended_at": "2026-08-02 23:25:01"
    }
  ]
  ```
</details>

<details>
<summary><strong>5. Get Statistics (GET /api/stats)</strong></summary>

- **Description**: Calculates total counts, present count, absent count, and check-in percentages for the current day.
- **Authentication Required**: No.
- **Response (200 OK)**:
  ```json
  {
    "total": 674,
    "present": 120,
    "absent": 554,
    "rate": 17.8
  }
  ```
</details>

<details>
<summary><strong>6. Export Report (GET /api/export)</strong></summary>

- **Description**: Generates and downloads a compiled Excel report containing student contact cards, attendance status, and check-in times.
- **Authentication Required**: No.
- **Response (200 OK)**: Binary file download (`Attendance_Report.xlsx`).
</details>

---

## Database Schema

```mermaid
erDiagram
    students {
        VARCHAR_255 admission_no PK
        VARCHAR_255 name
        VARCHAR_255 email
        VARCHAR_255 mob_no
        VARCHAR_255 department
        VARCHAR_255 email_status
        TEXT qr_link
    }
    attendance_logs {
        SERIAL id PK
        VARCHAR_255 admission_no FK
        VARCHAR_255 timestamp
    }
    students ||--o{ attendance_logs : "has logs"
```

### Tables Detail
1. **`students`**:
   - `admission_no` (VARCHAR(255), Primary Key): Unique registration/admission identifier.
   - `name`, `email`, `mob_no`, `department`, `email_status` (VARCHAR(255)): Student metadata.
   - `qr_link` (TEXT): URL referencing pre-generated student QR code cards.
2. **`attendance_logs`**:
   - `id` (SERIAL, Primary Key): Unique auto-increment index.
   - `admission_no` (VARCHAR(255), Foreign Key): References `students(admission_no)`.
   - `timestamp` (VARCHAR(255)): String representation of scan event time (`YYYY-MM-DD HH:MM:SS`).

---

## Authentication & Authorization

Authentication is designed to be lightweight, fast, and simple for deployment.
- **Session Tokens**: Authenticated roles receive a token formatted as `session_token_<role>` on successful login.
- **Frontend Storage**: The token and role are stored in `localStorage` (`sessionToken` and `userRole`). 
- **Role-Based Access Control (RBAC)**:
  - **Admin**: Full read-write permission.
  - **Volunteer**: Read-only directory permissions + read-write scanner logging permissions.
  - The client dynamically hides the `#uploadCard` interface if the stored role is not `"admin"`.
  - The backend checks the incoming HTTP request header `Authorization` inside `/api/upload` to block volunteer roles from uploading new rosters.

---

## Error Handling

- **Backend Exception Wrapper**: API endpoints are enclosed in `try-except` blocks. If an unhandled error occurs, a `500 Internal Server Error` is raised containing the specific traceback message.
- **Frontend Fallbacks**:
  - Unrecognized QR scans display a specialized crimson `NOT FOUND` banner on the HUD, alerting operators to double-check the student's entry in the roster.
  - Fetch network failures display descriptive warning toast components without interrupting the active live camera stream.

---

## Security

1. **CORS Configuration**: The app is configured with FastAPI's `CORSMiddleware` supporting all origins (`*`) during active development.
2. **PostgreSQL Parametrization**: All SQL queries utilize placeholder syntax `%s` (passing parameters as tuple arguments) to prevent SQL Injection attacks.
3. **Admin Token Authorization**: Crucial endpoints (like `/api/upload`) reject any request that does not include the correct Admin authorization token.

---

## Configuration

- **`requirements.txt`**: Manages backend environment packages (`fastapi`, `uvicorn`, `pandas`, `openpyxl`, `psycopg2-binary`, etc.).
- **`render.yaml`**: Outlines continuous integration structure. Declares a web service running on Python with uvicorn alongside a managed free-tier PostgreSQL instance.

---

## Running Tests

Currently, the codebase does not include automated unit tests. 

To run manual integration tests:
1. Open the application.
2. Enter an invalid passcode to verify authorization blocks.
3. Login as Volunteer 1 with passcode `vol1` and confirm the roster is searchable, stats render, but the spreadsheet uploader card is hidden.
4. Logout, re-login as Admin, and verify spreadsheet imports are active and fully operational.

---

## Deployment

The repository is fully configured for zero-configuration deployments on **Render**.

### Steps to Deploy:
1. Connect your GitHub repository to Render.
2. Render will automatically parse the `render.yaml` blueprint.
3. It will provision:
   - A PostgreSQL database instance.
   - A Python web service running FastAPI served by `gunicorn` (using Uvicorn workers).
   - Automatically configure environmental parameters routing internal database tokens.

---

## Future Improvements

- [ ] **Hashed Passcode Storage**: Hash the passcodes in the configuration file using secure algorithms (e.g., `bcrypt`) rather than raw string comparison.
- [ ] **JWT Session Signatures**: Upgrade role tokens to signed JSON Web Tokens (JWT) with automatic expiration limits to secure endpoints further.
- [ ] **Unit Tests**: Implement automated tests (e.g., using `pytest` and `httpx.AsyncClient`) for authentication validation, schema initialization, and scan check-ins.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Commit changes: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature/your-feature`.
5. Open a Pull Request.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Copyright (c) 2026 Himanshu Kulkarni.
