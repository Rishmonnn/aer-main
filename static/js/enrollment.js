// =======================================================
// PART 1: PENDING ENROLLMENT LIST (Approval Workflow)
// =======================================================

document.addEventListener('DOMContentLoaded', function() {
    loadEnrollmentData();
});

// --- LOAD DATA FROM API ---
// --- LOAD DATA FROM API ---
function loadEnrollmentData() {
    fetch('/api/enrollment/pending')
        .then(res => res.json())
        .then(data => {
            // 1. Clear existing tables
            [1, 2, 3, 4].forEach(i => {
                const tbody = document.getElementById(`enrollment-tbody-${i}`);
                if (tbody) tbody.innerHTML = '';
            });

            // 2. Setup Analytics and Grouping
            const summaryContainer = document.getElementById('enrollmentSummaryCards');
            if (summaryContainer) summaryContainer.style.display = 'grid';
            
            let promoteCount = 0;
            let reviewCount = 0;
            const groupedData = { '1': [], '2': [], '3': [], '4': [] };

            data.forEach(student => {
                // Group by year
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';
                
                groupedData[yearIndex].push(student);

                // Tally Analytics
                if (student.decision === 'Retained') reviewCount++;
                else promoteCount++;
            });

            // Update DOM Cards
            if(document.getElementById('count-total')) document.getElementById('count-total').innerText = data.length;
            if(document.getElementById('count-promote')) document.getElementById('count-promote').innerText = promoteCount;
            if(document.getElementById('count-review')) document.getElementById('count-review').innerText = reviewCount;

            // 3. Populate Tables or Empty States
            [1, 2, 3, 4].forEach(i => {
                const tbody = document.getElementById(`enrollment-tbody-${i}`);
                const students = groupedData[i.toString()];

                if (!tbody) return;

                if (students.length === 0) {
                    // Inject Empty State
                    const yearLabel = i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : '4th';
                    tbody.innerHTML = `
                        <tr class="empty-state-row">
                            <td colspan="6">
                                <i class='bx bx-check-circle'></i>
                                All caught up! No ${yearLabel} Year students pending enrollment.
                            </td>
                        </tr>
                    `;
                } else {
                    // Populate Real Data
                    students.forEach(student => {
                        const row = document.createElement('tr');
                        row.className = 'student-row';

                        // Logic for Remarks Tag
                        let remarksHtml = student.decision === 'Retained' 
                            ? '<span class="tag critical"><i class="bx bx-error-circle"></i> Retained</span>' 
                            : '<span class="tag success"><i class="bx bx-check"></i> Cleared</span>';

                        // Store data for the modal
                        const studentDataStr = JSON.stringify({
                            id: student.id, name: student.name, program: student.program, type: student.type, 
                            year: student.year_level, standing: student.year_level, decision: student.decision, hasWarnings: student.hasWarnings,
                            email: student.email, contact: student.contact, failed_subjects: student.failed_subjects
                        }).replace(/"/g, '&quot;');

                        row.onclick = (e) => openEnrollmentModal(e, JSON.parse(studentDataStr.replace(/&quot;/g, '"')));

                        row.innerHTML = `
                            <td style="text-align: center;" onclick="event.stopPropagation()">
                                <input type="checkbox" class="student-cb" value="${student.id}" onchange="updateBulkEnrollButton()">
                            </td>
                            <td><strong>${student.id}</strong></td>
                            <td class="student-name">${student.name}</td>
                            <td>${student.program}</td>
                            <td>${remarksHtml}</td>
                            <td>
                                <div class="quick-actions" onclick="event.stopPropagation()">
                                    <button class="btn-icon view" title="View Details" onclick="openEnrollmentModal(event, ${studentDataStr})"><i class='bx bx-show'></i></button>
                                    <button class="btn-icon approve" title="Quick Approve" onclick="quickApprove('${student.id}')"><i class='bx bx-check'></i></button>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                    
                    // Open accordion if it has data
                    tbody.closest('.year-accordion').classList.remove('collapsed');
                }
            });
        })
        .catch(err => console.error("Error loading enrollment data:", err));
}

// --- NEW QUICK ACTION FUNCTION ---
function quickApprove(studentId) {
    if(!confirm(`Are you sure you want to approve student ${studentId}?`)) return;

    fetch('/api/enrollment/confirm', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: studentId}) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            // Refresh tables across modules
            loadEnrollmentData(); 
            if (typeof loadEnlistmentData === 'function') loadEnlistmentData();
            if (typeof loadStudentJourney === 'function') loadStudentJourney();
        } else {
            alert("Error: " + data.error);
        }
    })
    .catch(err => alert("Server Error"));
}

// --- BULK ENROLLMENT LOGIC ---
function toggleAllCheckboxes(source) {
    // Find the closest table body and check all visible checkboxes
    const table = source.closest('table');
    const checkboxes = table.querySelectorAll('tbody .student-cb');
    checkboxes.forEach(cb => {
        // Only check rows that aren't hidden by the search filter
        if(cb.closest('tr').style.display !== 'none') {
            cb.checked = source.checked;
        }
    });
    updateBulkEnrollButton();
}

function updateBulkEnrollButton() {
    const checked = document.querySelectorAll('.student-cb:checked');
    const btn = document.getElementById('btn-bulk-enroll');
    const countSpan = document.getElementById('bulk-count');
    
    // Safety check: Make sure the button actually exists on the page
    if (!btn) return; 

    if (checked.length > 0) {
        btn.style.display = 'inline-flex';
        // Safety check: Only update innerText if the span exists
        if (countSpan) countSpan.innerText = checked.length;
    } else {
        btn.style.display = 'none';
    }
}

function confirmBulkEnrollment() {
    const checked = document.querySelectorAll('.student-cb:checked');
    if (checked.length === 0) return;

    const ids = Array.from(checked).map(cb => cb.value);
    
    if (!confirm(`Are you sure you want to enroll ${ids.length} selected student(s)?`)) return;

    const btn = document.getElementById('btn-bulk-enroll');
    const originalText = btn.innerHTML; // Save the HTML with the span inside
    
    // Change to loading state
    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processing...";
    btn.disabled = true;

    fetch('/api/enrollment/confirm_bulk', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids: ids }) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            // 1. Restore the HTML immediately so the span exists again
            btn.innerHTML = originalText;
            
            // 2. Hide the button explicitly since everyone was enrolled
            btn.style.display = 'none';
            
            alert(`Successfully enrolled ${data.count} students!`);
            
            // 3. Uncheck master checkboxes
            document.querySelectorAll('.select-all-cb').forEach(cb => cb.checked = false);
            
            // 4. Refresh tables
            loadEnrollmentData(); 
            if (typeof loadEnlistmentData === 'function') loadEnlistmentData();
            if (typeof loadStudentJourney === 'function') loadStudentJourney();
            
        } else {
            alert("Error: " + data.error);
            btn.innerHTML = originalText; // Restore on error
        }
    })
    .catch(err => {
        alert("Server Error: " + err);
        btn.innerHTML = originalText; // Restore on error
    })
    .finally(() => {
        btn.disabled = false;
    });
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
    document.getElementById('modalStudentEmail').innerText = data.email || 'N/A';
    document.getElementById('modalStudentContact').innerText = data.contact || 'N/A';

    const warningsDiv = document.getElementById('modalWarnings');
    const failedSubjectsContainer = document.getElementById('modalFailedSubjects');
    if (data.hasWarnings && data.failed_subjects && data.failed_subjects.length > 0) {
        warningsDiv.style.display = 'block';
        failedSubjectsContainer.innerHTML = ''; // Clear old tags
        
        data.failed_subjects.forEach(subject => {
            failedSubjectsContainer.innerHTML += `<span class="tag critical" style="background: white; border-color: #fecaca; color: #ef4444;"><i class='bx bx-book'></i> ${subject}</span>`;
        });
    } else {
        warningsDiv.style.display = 'none';
    }
    
    // UI Update - Student Type Badge
    const typeLabel = data.type || 'Regular';
    const typeClass = typeLabel.toLowerCase() === 'irregular' ? 'irregular' : 'regular';
    document.getElementById('modalStudentType').innerHTML = `<span class="status-pill ${typeClass}">${typeLabel}</span>`;
    
    // UI Update - Decision Badge (Promote vs Retain)
// UI Update - Decision Badge (Promote vs Retain)
    const decisionEl = document.getElementById('modalStudentDecision');
    const isRetained = data.decision === 'Retained';
    const decisionIcon = isRetained ? "bx-minus-circle" : "bx-chevrons-up";
    const decisionClass = isRetained ? "badge-retain" : "badge-promote";
    const decisionText = isRetained ? "RETAINED" : "PROMOTING TO NEXT YEAR";
    
    // Change background of the full-width modern card depending on decision
    const fullCard = document.getElementById('decision-card-container');
    const iconContainer = document.getElementById('decision-icon-container');
    
    if (isRetained) {
        fullCard.style.background = "#fff1f2";
        fullCard.style.borderColor = "#fecdd3";
        if (iconContainer) {
            iconContainer.style.background = "#ffe4e6";
            iconContainer.style.color = "#e11d48";
        }
    } else {
        fullCard.style.background = "#f0fdf4";
        fullCard.style.borderColor = "#bbf7d0";
        if (iconContainer) {
            iconContainer.style.background = "#dcfce7";
            iconContainer.style.color = "#16a34a";
        }
    }

    decisionEl.innerHTML = `
        <span class="badge-status ${decisionClass}" style="font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
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

// =======================================================
// PART 3: MANUAL ENROLLMENT
// =======================================================

function openManualEnrollmentModal() {
    // Reset the form whenever it opens
    document.getElementById('manualEnrollmentForm').reset();
    document.getElementById('manualEnrollmentModal').classList.add('active');
}

function closeManualEnrollmentModal() {
    document.getElementById('manualEnrollmentModal').classList.remove('active');
}

function submitManualEnrollment() {
    // 1. Gather data from form inputs
    const studentId = document.getElementById('manualId').value.trim();
    const first = document.getElementById('manualFirst').value.trim();
    const last = document.getElementById('manualLast').value.trim();
    const middle = document.getElementById('manualMiddle').value.trim();
    const program = document.getElementById('manualProgram').value;
    const email = document.getElementById('manualEmail').value.trim();
    const contact = document.getElementById('manualContact').value.trim();
    const gender = document.getElementById('manualGender').value;
    const address = document.getElementById('manualAddress').value.trim();

    // Basic Validation
    if (!studentId || !first || !last) {
        alert("Student ID, First Name, and Last Name are required.");
        return;
    }

    // 2. Wrap it in an array to match the Excel Upload API format
    const payload = [{
        student_id: studentId || null,
        firstname: first,
        lastname: last,
        middlename: middle,
        program: program,
        email: email,
        contact: contact,
        gender: gender,
        address: address
    }];

    // Update button UI
    const btn = document.querySelector('#manualEnrollmentModal .btn-enroll');
    const originalText = btn.innerHTML;
    btn.innerHTML = "Processing...";
    btn.disabled = true;

    // 3. Post to the exact same endpoint as the Excel Upload
    fetch('/api/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert("Student successfully enrolled!");
            closeManualEnrollmentModal();
            loadEnrollmentData(); // Refresh the list
        } else {
            alert("Failed to add student: " + (data.message || "Unknown error"));
        }
    })
    .catch(err => {
        console.error(err);
        alert("Server Error: Unable to enroll student.");
    })
    .finally(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}