// Global Variables
let html5QrcodeScanner = null;
let voiceEnabled = true;
let studentsList = [];
let scanDebounce = false;
let userRole = localStorage.getItem("userRole") || null;
let sessionToken = localStorage.getItem("sessionToken") || null;

// Audio Feedback Context (Synthesized beep sound for feedback)
function playBeep(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'success') {
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'warning') {
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } else { // error
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        }
    } catch (e) {
        console.warn("Audio Context beep failed", e);
    }
}

// Text-to-Speech Output
function speakText(text) {
    if (!voiceEnabled) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Find a suitable English voice if available
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en'));
    if (enVoice) {
        utterance.voice = enVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3500);
}

// Session Authentication Helper
function checkAuth() {
    userRole = localStorage.getItem("userRole");
    sessionToken = localStorage.getItem("sessionToken");
    
    const loginScreen = document.getElementById("loginScreen");
    const dashboardContainer = document.getElementById("dashboardContainer");
    const uploadCard = document.getElementById("uploadCard");
    const userBadge = document.getElementById("userBadge");
    
    if (!sessionToken || !userRole) {
        loginScreen.classList.remove("hidden");
        dashboardContainer.classList.add("hidden");
        // Clear passcode input
        document.getElementById("loginPasscode").value = "";
        return false;
    } else {
        loginScreen.classList.add("hidden");
        dashboardContainer.classList.remove("hidden");
        
        // Show role formatted
        userBadge.textContent = userRole.replace("_", " ");
        
        // Hide upload card for volunteers
        if (userRole === "admin") {
            uploadCard.classList.remove("hidden");
        } else {
            uploadCard.classList.add("hidden");
        }
        return true;
    }
}

// Authentication Handlers
async function handleLogin() {
    const roleSelect = document.getElementById("loginRole");
    const passcodeInput = document.getElementById("loginPasscode");
    const role = roleSelect.value;
    const passcode = passcodeInput.value.trim();
    
    if (!passcode) {
        showToast("Please enter a passcode", "error");
        return;
    }
    
    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ role, passcode })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem("userRole", data.role);
            localStorage.setItem("sessionToken", data.token);
            passcodeInput.value = "";
            showToast("Login successful!", "success");
            
            if (checkAuth()) {
                fetchStats();
                fetchStudents();
            }
        } else {
            showToast(data.detail || "Incorrect passcode", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Server connection failed", "error");
    }
}

function handleLogout() {
    localStorage.removeItem("userRole");
    localStorage.removeItem("sessionToken");
    checkAuth();
    showToast("Logged out successfully", "success");
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    // Populate voice voices list (async load)
    window.speechSynthesis.onvoiceschanged = () => {};
    
    if (checkAuth()) {
        // Initial fetch
        fetchStats();
        fetchStudents();
    }
    
    // Setup File Upload
    setupFileUpload();
    
    // Setup Interactive Elements
    setupActionListeners();
});

// Setup Action Listeners
function setupActionListeners() {
    // Login submit listeners
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('loginPasscode').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Logout listener
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Start Scan Button
    document.getElementById('startScanBtn').addEventListener('click', startScanner);
    
    // Manual check-in
    document.getElementById('manualSubmitBtn').addEventListener('click', handleManualSubmit);
    document.getElementById('manualAdmInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleManualSubmit();
    });
    
    // Voice Toggle
    const voiceBtn = document.getElementById('voiceToggle');
    voiceBtn.addEventListener('click', () => {
        voiceEnabled = !voiceEnabled;
        if (voiceEnabled) {
            voiceBtn.classList.remove('muted');
            voiceBtn.innerHTML = '<span class="voice-icon">🔊</span> Voice Enabled';
            speakText("Voice output enabled");
        } else {
            voiceBtn.classList.add('muted');
            voiceBtn.innerHTML = '<span class="voice-icon">🔇</span> Voice Muted';
            window.speechSynthesis.cancel();
        }
    });
    
    // Search Bar Filter
    document.getElementById('searchBar').addEventListener('input', (e) => {
        filterAndRenderTable(e.target.value);
    });
    
    // Export Excel Button
    document.getElementById('exportBtn').addEventListener('click', () => {
        window.open('/api/export', '_blank');
    });
}

// Stats & Roster fetching
async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('statTotal').textContent = data.total;
        document.getElementById('statPresent').textContent = data.present;
        document.getElementById('statAbsent').textContent = data.absent;
        document.getElementById('statRate').textContent = `${data.rate}%`;
    } catch (e) {
        console.error("Failed to load statistics", e);
    }
}

async function fetchStudents() {
    try {
        const res = await fetch('/api/students');
        studentsList = await res.json();
        filterAndRenderTable(document.getElementById('searchBar').value);
    } catch (e) {
        console.error("Failed to load students roster", e);
    }
}

function filterAndRenderTable(query = '') {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';
    
    const filtered = studentsList.filter(student => {
        const matchStr = `${student.name} ${student.admission_no} ${student.department} ${student.email}`.toLowerCase();
        return matchStr.includes(query.toLowerCase());
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center empty-state">No matching students found.</td></tr>`;
        return;
    }
    
    filtered.forEach(student => {
        const row = document.createElement('tr');
        
        const attended = student.attended_at;
        const statusBadge = attended 
            ? '<span class="badge badge-present">Present</span>' 
            : '<span class="badge badge-absent">Absent</span>';
            
        row.innerHTML = `
            <td><strong>${student.name}</strong></td>
            <td><code>${student.admission_no}</code></td>
            <td>${student.department || '-'}</td>
            <td>${student.email || '-'}</td>
            <td>${statusBadge}</td>
            <td>${attended ? formatTimestamp(attended) : '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

function formatTimestamp(tsStr) {
    try {
        const date = new Date(tsStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
        return tsStr;
    }
}

// File Drag & Drop + Upload setup
function setupFileUpload() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const uploadProgress = document.getElementById('uploadProgress');
    
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUpload(e.target.files[0]);
        }
    });
    
    async function handleUpload(file) {
        uploadPrompt.style.display = 'none';
        uploadProgress.style.display = 'block';
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': sessionToken
                },
                body: formData
            });
            
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, 'success');
                speakText("Excel sheet imported successfully.");
                fetchStats();
                fetchStudents();
            } else {
                showToast(data.detail || "Failed to parse spreadsheet.", 'error');
            }
        } catch (e) {
            showToast("Network error uploading spreadsheet.", "error");
        } finally {
            uploadPrompt.style.display = 'block';
            uploadProgress.style.display = 'none';
        }
    }
}

// Manual Check-in handler
async function handleManualSubmit() {
    const input = document.getElementById('manualAdmInput');
    const val = input.value.trim();
    if (!val) return;
    
    input.value = '';
    await markAttendanceAPI(val);
}

// Start Camera QR Code Scanner
function startScanner() {
    document.getElementById('scannerOverlay').style.display = 'none';
    
    const hudCard = document.getElementById('hudCard');
    const hudStatus = document.getElementById('hudStatus');
    const hudStatusText = document.getElementById('hudStatusText');
    const hudIndicator = hudStatus.querySelector('.hud-indicator');
    
    hudIndicator.className = 'hud-indicator scanning';
    hudStatusText.textContent = "Scanning Active";
    
    // Create Scanner Instance
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error("Camera startup error", err);
        showToast("Could not access webcam camera.", "error");
        stopScanner();
    });
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById('scannerOverlay').style.display = 'flex';
            const hudStatusText = document.getElementById('hudStatusText');
            const hudIndicator = document.querySelector('.hud-indicator');
            hudIndicator.className = 'hud-indicator idle';
            hudStatusText.textContent = "Ready to Scan";
        }).catch(err => {
            console.error("Failed to stop scanner", err);
        });
    }
}

// Handle QR scan match
function onScanSuccess(decodedText, decodedResult) {
    if (scanDebounce) return;
    scanDebounce = true;
    
    // Process matching Admission No
    markAttendanceAPI(decodedText).finally(() => {
        // Debounce scanner for 2.5 seconds to prevent multi-triggering
        setTimeout(() => {
            scanDebounce = false;
        }, 2500);
    });
}

function onScanFailure(error) {
    // Silent fail scanning logs (fires constantly during seek)
}

// Submit Scanned Admission No to backend
async function markAttendanceAPI(admissionNo) {
    const hudContent = document.getElementById('hudContent');
    const hudIndicator = document.querySelector('.hud-indicator');
    const hudStatusText = document.getElementById('hudStatusText');
    
    try {
        const res = await fetch('/api/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admission_no: admissionNo })
        });
        
        const data = await res.json();
        
        if (res.status === 404) {
            playBeep('error');
            hudIndicator.className = 'hud-indicator error';
            hudStatusText.textContent = "Error";
            
            // Format spoken output
            const speakMsg = `Admission number not found.`;
            speakText(speakMsg);
            
            hudContent.innerHTML = `
                <div class="hud-student-info">
                    <span class="hud-success-banner exists" style="background:rgba(255, 62, 62, 0.15); color:var(--accent-red)">NOT FOUND</span>
                    <h4>Unknown QR Code</h4>
                    <p style="color:var(--text-secondary)">Scanned value: <code>${admissionNo}</code></p>
                    <p style="font-size:0.85rem; margin-top:0.5rem; color:var(--accent-red)">Make sure this student belongs to the imported database sheet.</p>
                </div>
            `;
            return;
        }
        
        if (!res.ok) {
            throw new Error(data.detail || "Server error");
        }
        
        const student = data.student;
        
        if (data.status === 'already_marked') {
            playBeep('warning');
            hudIndicator.className = 'hud-indicator warning';
            hudStatusText.textContent = "Warning";
            
            // Format spoken output
            const speakMsg = `${student.name} already marked.`;
            speakText(speakMsg);
            
            hudContent.innerHTML = `
                <div class="hud-student-info">
                    <span class="hud-success-banner exists">ALREADY PRESENT</span>
                    <h4>${student.name}</h4>
                    <p style="color:var(--text-secondary)">${student.department || 'No Department'}</p>
                    <div class="hud-details-grid">
                        <div class="hud-detail-item">
                            <span>Admission No</span>
                            <span>${student.admission_no}</span>
                        </div>
                        <div class="hud-detail-item">
                            <span>Logged At</span>
                            <span>${formatTimestamp(data.time)}</span>
                        </div>
                    </div>
                </div>
            `;
            showToast(`${student.name} already checked in.`, 'error');
            
        } else if (data.status === 'success') {
            playBeep('success');
            hudIndicator.className = 'hud-indicator success';
            hudStatusText.textContent = "Success";
            
            // Format spoken output (Reads us the admission number and name)
            const speakMsg = `Admission number ${student.admission_no.split('-').pop()} checked in. ${student.name}.`;
            speakText(speakMsg);
            
            hudContent.innerHTML = `
                <div class="hud-student-info">
                    <span class="hud-success-banner new">ATTENDANCE LOGGED</span>
                    <h4>${student.name}</h4>
                    <p style="color:var(--text-secondary)">${student.department || 'No Department'}</p>
                    <div class="hud-details-grid">
                        <div class="hud-detail-item">
                            <span>Admission No</span>
                            <span>${student.admission_no}</span>
                        </div>
                        <div class="hud-detail-item">
                            <span>Logged At</span>
                            <span>${formatTimestamp(data.time)}</span>
                        </div>
                    </div>
                </div>
            `;
            showToast(`Attendance logged: ${student.name}`, 'success');
            
            // Reload stats and student lists
            fetchStats();
            fetchStudents();
        }
        
    } catch (e) {
        console.error(e);
        playBeep('error');
        hudIndicator.className = 'hud-indicator error';
        hudStatusText.textContent = "Server Error";
        speakText("Network error occurred.");
        
        hudContent.innerHTML = `
            <div class="hud-student-info">
                <h4>System Error</h4>
                <p style="color:var(--text-secondary)">${e.message || "Failed to reach backend api."}</p>
            </div>
        `;
    }
}
