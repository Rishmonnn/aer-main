// --- ACCORDION & FILTER ---
function toggleAccordion(element) {
    element.parentElement.classList.toggle('collapsed');
}

function filterEnrollment() {
    const input = document.getElementById('enrollmentSearch');
    const filter = input.value.toUpperCase();
    const rows = document.querySelectorAll('.year-table tbody tr');
    rows.forEach(row => {
        const txt = row.cells[0].textContent + " " + row.cells[1].textContent;
        if (txt.toUpperCase().indexOf(filter) > -1) {
            row.style.display = "";
            row.closest('.year-accordion').classList.remove('collapsed');
        } else {
            row.style.display = "none";
        }
    });
}

// --- CONFIRMATION MODAL ---
function openEnrollmentModal(event, data) {
    if (event) event.stopPropagation();
    document.getElementById('modalStudentId').innerText = data.id || '-';
    document.getElementById('modalStudentName').innerText = data.name || '-';
    document.getElementById('modalStudentProgram').innerText = data.program || '-';
    document.getElementById('modalStudentYear').innerText = data.year || '-';
    document.getElementById('modalStudentStanding').innerText = data.standing || '-';
    
    const typeEl = document.getElementById('modalStudentType');
    typeEl.innerText = data.type;
    typeEl.className = `status-pill ${data.type.toLowerCase()}`;
    
    const decEl = document.getElementById('modalStudentDecision');
    if (data.decision === 'Retained') {
        decEl.innerText = `Retained at ${data.year}`;
        decEl.style.color = '#d32f2f';
    } else {
        decEl.innerText = 'Promoted to Next Year';
        decEl.style.color = '#2e7d32';
    }
    const warningContainer = document.getElementById('modalWarnings');
    warningContainer.style.display = data.hasWarnings ? 'block' : 'none';
    document.getElementById('enrollmentModal').classList.add('active');
}
function closeEnrollmentModal() { document.getElementById('enrollmentModal').classList.remove('active'); }

// --- UPLOAD WIZARD & EXCEL LOGIC ---
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
    document.getElementById('modalFileInput').value = '';
    resetDropZone(); // Ensure UI is reset on close
}

// --- FILE HANDLING FIXES ---

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        showLoadingState(); 
        setTimeout(() => processExcelFile(file), 100); // Slight delay to allow UI to render spinner
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
    // 1. Check if Library is Loaded
    if (typeof XLSX === 'undefined') {
        alert("Error: The Excel processing library (SheetJS) failed to load.\n\nPlease check your internet connection (CDN requires internet) or verify the script tag in program-head.html.");
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
            alert("Error reading file. Please ensure it is a valid .xlsx or .xls file, and not a CSV or other format.");
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
        // TRIGGER API CALL
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

    // 1. GATHER DATA BASED ON MAPPINGS
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

    // 2. SEND TO FLASK SERVER
    fetch('/api/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Update Success Message
            document.getElementById('success-message').innerText = 
                `${data.count} students successfully enrolled!`;
            
            // Move to Success Step
            currentStep++;
            updateStepUI();
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