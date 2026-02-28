// =======================================================
// PART 1: PENDING ENROLLMENT LIST (Approval Workflow)
// =======================================================

document.addEventListener('DOMContentLoaded', function() {
    loadEnrollmentData();
});

// --- LOAD DATA FROM API ---
function loadEnrollmentData() {
    fetch('/api/enrollment/pending')
        .then(res => res.json())
        .then(data => {
            // 1. Clear existing tables
            document.querySelectorAll('.year-table tbody').forEach(el => el.innerHTML = '');

            // 2. Populate Tables
            if (data.length === 0) {
                return;
            }

            data.forEach(student => {
                // Determine target table based on current year level
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';

                const tbody = document.getElementById(`enrollment-tbody-${yearIndex}`);
                
                if (tbody) {
                    const row = document.createElement('tr');
                    row.className = 'student-row';

                    // --- LOGIC: Check Decision (Retained vs Promoted) ---
                    let actionHtml = '';
                    if (student.decision === 'Retained') {
                        actionHtml = '<span style="color:#d32f2f; font-weight:bold;">RETAINED (SAME YEAR)</span>';
                    } else {
                        actionHtml = '<span style="color:#166534; font-weight:bold;">PROMOTING TO NEXT YEAR</span>';
                    }

                    // Store data for the modal
                    row.onclick = (e) => openEnrollmentModal(e, {
                        id: student.id,
                        name: student.name,
                        program: student.program,
                        type: student.type, 
                        year: student.year_level,
                        standing: student.year_level, 
                        decision: student.decision,
                        hasWarnings: student.hasWarnings
                    });

                    row.innerHTML = `
                        <td>${student.id}</td>
                        <td class="student-name">${student.name}</td>
                        <td>${student.program}</td>
                        <td><span class="status-pill pending">Pending</span></td>
                        <td class="promote-text">${actionHtml}</td>
                    `;
                    tbody.appendChild(row);
                    
                    // Open the accordion so the user sees the new item
                    tbody.closest('.year-accordion').classList.remove('collapsed');
                }
            });
        })
        .catch(err => console.error("Error loading enrollment data:", err));
}

// --- CONFIRMATION MODAL & API CALL ---
function openEnrollmentModal(event, data) {
    if (event) event.stopPropagation();
    
    // UI Updates - Text details
    document.getElementById('modalStudentId').innerText = data.id || '-';
    document.getElementById('modalStudentName').innerText = data.name || '-';
    document.getElementById('modalStudentProgram').innerText = data.program || '-';
    document.getElementById('modalStudentYear').innerText = data.year || '-';
    document.getElementById('modalStudentStanding').innerText = data.standing || '-';
    
    // UI Update - Student Type Badge
    const typeLabel = data.type || 'Regular';
    const typeClass = typeLabel.toLowerCase() === 'irregular' ? 'irregular' : 'regular';
    document.getElementById('modalStudentType').innerHTML = `<span class="status-pill ${typeClass}">${typeLabel}</span>`;
    
    // UI Update - Decision Badge (Promote vs Retain)
    const decisionEl = document.getElementById('modalStudentDecision');
    const isRetained = data.decision === 'Retained';
    const decisionIcon = isRetained ? "bx-minus-circle" : "bx-chevrons-up";
    const decisionClass = isRetained ? "badge-retain" : "badge-promote";
    const decisionText = isRetained ? "RETAINED" : "PROMOTING TO NEXT YEAR";
    
    // Change background of the full-width card depending on decision
    const fullCard = decisionEl.closest('.detail-card.full-width');
    if (isRetained) {
        fullCard.style.background = "#fff1f2";
        fullCard.style.borderColor = "#fecdd3";
    } else {
        fullCard.style.background = "#f0fdf4";
        fullCard.style.borderColor = "#bbf7d0";
    }

    decisionEl.innerHTML = `
        <span class="badge-status ${decisionClass}">
            <i class='bx ${decisionIcon}'></i> ${decisionText}
        </span>
    `;

    // Show the modal
    document.getElementById('enrollmentModal').classList.add('active');

    // Attach ID to Confirm Button
    const btn = document.getElementById('btn-confirm-enroll');
    btn.setAttribute('data-id', data.id);
}

function closeEnrollmentModal() { 
    document.getElementById('enrollmentModal').classList.remove('active'); 
}

function confirmSingleEnrollment() {
    const btn = document.getElementById('btn-confirm-enroll');
    const studentId = btn.getAttribute('data-id');
    
    if (!studentId) return;

    btn.innerText = "Processing...";
    btn.disabled = true;

    // CALL API
    fetch('/api/enrollment/confirm', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: studentId}) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert(`Student successfully enrolled! Status: ${data.status}`);
            closeEnrollmentModal();
            
            // 1. Refresh THIS module (Enrollment)
            loadEnrollmentData(); 
            
            // 2. DIRECT UPDATE: Refresh the NEXT module (Enlistment)
            if (typeof loadEnlistmentData === 'function') {
                loadEnlistmentData();
            }

            // 3. Update Student Journey
            if (typeof loadStudentJourney === 'function') {
                loadStudentJourney();
            }

        } else {
            alert("Error: " + data.error);
        }
    })
    .catch(err => alert("Server Error"))
    .finally(() => {
       btn.innerHTML = "<i class='bx bx-check-circle'></i> Approve Enrollment";
        btn.disabled = false;
    });
}

// --- ACCORDION & FILTER ---
function toggleAccordion(element) {
    element.parentElement.classList.toggle('collapsed');
}

function filterEnrollment() {
    const input = document.getElementById('enrollmentSearch');
    const filter = input.value.toUpperCase();
    const rows = document.querySelectorAll('.year-table tbody tr');
    rows.forEach(row => {
        if(row.innerText.toUpperCase().indexOf(filter) > -1) {
            row.style.display = "";
            row.closest('.year-accordion').classList.remove('collapsed');
        } else {
            row.style.display = "none";
        }
    });
}


// =======================================================
// PART 2: UPLOAD WIZARD
// =======================================================

let currentStep = 1;
let uploadedWorkbook = null;
let uploadedData = [];
let fileHeaders = [];

function handleUpload() {
    currentStep = 1;
    uploadedData = [];
    fileHeaders = [];
    document.getElementById('uploadModal').classList.add('active');
    updateStepUI();
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    const fileInput = document.getElementById('modalFileInput');
    if(fileInput) fileInput.value = '';
    resetDropZone(); 
}

// --- FILE HANDLING ---

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        showLoadingState(); 
        setTimeout(() => processExcelFile(file), 100); 
    }
    e.target.value = ''; 
}

function dropHandler(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        showLoadingState();
        const file = e.dataTransfer.files[0];
        setTimeout(() => processExcelFile(file), 100);
    }
}

function dragOverHandler(e) { e.preventDefault(); e.currentTarget.classList.add('dragover'); }
function dragLeaveHandler(e) { e.preventDefault(); e.currentTarget.classList.remove('dragover'); }

function showLoadingState() {
    const zone = document.querySelector('.drag-drop-zone');
    if(zone) {
        zone.innerHTML = `<div class="loader"></div><h4 style="margin-top:15px; color:#666">Processing File...</h4>`;
        zone.style.pointerEvents = 'none';
    }
}

function resetDropZone() {
    const zone = document.querySelector('.drag-drop-zone');
    if(zone) {
        zone.style.pointerEvents = 'auto';
        zone.innerHTML = `
            <input type="file" id="modalFileInput" hidden onchange="handleFileSelect(event)" accept=".xlsx, .xls">
            <i class='bx bx-upload upload-icon-large'></i>
            <h3>Drag and drop file here, or click to browse</h3>
            <p>Accepted formats: XLSX, XLS</p>
        `;
    }
}

// --- EXCEL PARSING ---
function processExcelFile(file) {
    if (typeof XLSX === 'undefined') {
        alert("Error: The Excel processing library (SheetJS) failed to load.");
        resetDropZone();
        return;
    }

    const reader = new FileReader();    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            uploadedWorkbook = workbook;
            
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            const jsonData = XLSX.utils.sheet_to_json(sheet, {header: 1});
            
            if (jsonData && jsonData.length > 0) {
                fileHeaders = jsonData[0]; 
                uploadedData = XLSX.utils.sheet_to_json(sheet);
                
                // Success
                setTimeout(() => {
                    nextStep();
                    resetDropZone(); 
                }, 500);
            } else {
                alert("The uploaded Excel file appears to be empty.");
                resetDropZone();
            }
        } catch (error) {
            console.error("SheetJS Error:", error);
            alert("Error reading file. Please ensure it is a valid .xlsx or .xls file.");
            resetDropZone();
        }
    };

    reader.onerror = function() {
        alert("Failed to read file from disk.");
        resetDropZone();
    };

    reader.readAsArrayBuffer(file);
}

function updateMappingUI() {
    document.getElementById('detected-columns-text').innerText = fileHeaders.join(", ");
    const selects = document.querySelectorAll('.map-select');
    selects.forEach(select => {
        select.innerHTML = '<option value="">Select Column...</option>';
        const key = select.getAttribute('data-key').toLowerCase();
        fileHeaders.forEach(header => {                               
            const option = document.createElement('option');
            option.value = header;
            option.innerText = header;
            const h = header.toLowerCase().replace(/[^a-z]/g, '');
            if (h.includes(key) || key.includes(h)) option.selected = true;
            select.appendChild(option);
        });
    });
}

function updatePreviewTable() {
    const tbody = document.getElementById('preview-table-body');
    const countEl = document.getElementById('preview-count');
    tbody.innerHTML = '';
    countEl.innerText = `${uploadedData.length} Records Found`;
    
    const mappings = {};
    document.querySelectorAll('.map-select').forEach(sel => {
        mappings[sel.getAttribute('data-key')] = sel.value;
    });

    uploadedData.slice(0, 100).forEach((row, index) => {
        const tr = document.createElement('tr');
        const getVal = (key) => {
            const colName = mappings[key];
            return colName ? (row[colName] || '-') : '-';
        };
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><i class='bx bxs-check-circle' style='color:#2e7d32; font-size:1.2rem;'></i></td>
            <td>${getVal('lastname')}</td>
            <td>${getVal('firstname')}</td>
            <td>${getVal('middlename')}</td>
            <td>${getVal('program')}</td>
            <td>${getVal('email')}</td>
            <td>${getVal('contact')}</td>
            <td>${getVal('address')}</td>
            <td>${getVal('birthdate')}</td>
            <td>${getVal('gender')}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- WIZARD NAVIGATION ---
function nextStep() {
    if (currentStep === 3) {
        submitEnrollment();
    } else if (currentStep < 4) {
        currentStep++;
        if (currentStep === 2) updateMappingUI();
        if (currentStep === 3) updatePreviewTable();
        updateStepUI();
    } else {
        closeUploadModal();
    }
}

function submitEnrollment() {
    const btn = document.getElementById('btn-next');
    const originalText = btn.innerText;
    btn.innerText = "Importing...";
    btn.disabled = true;

    // 1. GATHER DATA
    const mappings = {};
    document.querySelectorAll('.map-select').forEach(sel => {
        if(sel.value) mappings[sel.getAttribute('data-key')] = sel.value;
    });

    const payload = uploadedData.map(row => {
        return {
            student_id: row[mappings['student_id']] || null,
            lastname: row[mappings['lastname']] || '',
            firstname: row[mappings['firstname']] || '',
            middlename: row[mappings['middlename']] || '',
            program: row[mappings['program']] || 'BSCpE',
            email: row[mappings['email']] || '',
            contact: row[mappings['contact']] || '',
            address: row[mappings['address']] || '',
            gender: row[mappings['gender']] || ''
        };
    });

    // 2. SEND TO SERVER
    fetch('/api/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('success-message').innerText = 
                `${data.count} students successfully enrolled!`;
            
            // Move to Success Step
            currentStep++;
            updateStepUI();
            
            // Refresh Pending List
            loadEnrollmentData(); 
        } else {
            alert("Import Failed: " + (data.message || "Unknown error"));
        }
    })
    .catch(err => {
        console.error(err);
        alert("Server Error: Unable to save students.");
    })
    .finally(() => {
        btn.innerText = originalText;
        btn.disabled = false;
    });
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepUI();
    }
}

function updateStepUI() {
    [1,2,3,4].forEach(n => document.getElementById(`step-${n}`).style.display = 'none');
    document.getElementById(`step-${currentStep}`).style.display = 'block';

    for(let i=1; i<=4; i++) {
        const icon = document.getElementById(`step-icon-${i}`);
        icon.className = 'step-indicator'; icon.innerHTML = i;
        if(i === currentStep) icon.classList.add('active');
        else if (i < currentStep) { icon.innerHTML = "<i class='bx bx-check'></i>"; icon.style.background = '#4caf50'; icon.style.color = 'white'; }
    }

    const nextBtn = document.getElementById('btn-next');
    const cancelBtn = document.querySelector('.btn-cancel-custom');
    cancelBtn.style.display = 'block';

    if(currentStep === 1) {
        nextBtn.style.display = 'none';
        cancelBtn.innerText = "Cancel"; cancelBtn.onclick = closeUploadModal;
    } else if (currentStep === 2) {
        nextBtn.style.display = 'block'; nextBtn.innerText = "Continue to Preview"; nextBtn.style.background = "#90242d";
        cancelBtn.innerText = "Back"; cancelBtn.onclick = prevStep;
    } else if (currentStep === 3) {
        nextBtn.innerText = "Import Records"; nextBtn.style.background = "#90242d";
        cancelBtn.innerText = "Back"; cancelBtn.onclick = prevStep;
    } else if (currentStep === 4) {
        nextBtn.innerText = "Done"; nextBtn.style.background = "#90242d";
        cancelBtn.style.display = 'none'; nextBtn.onclick = closeUploadModal;
    }
}