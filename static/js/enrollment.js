// =======================================================
// GLOBAL: TOAST NOTIFICATIONS
// =======================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'bx-check-circle' : 'bx-error-circle';
    toast.innerHTML = `<i class='bx ${icon}'></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// =======================================================
// GLOBAL: NUMBER ANIMATOR
// =======================================================
function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Easing function for a smooth slow-down effect at the end
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        obj.innerHTML = Math.floor(easeProgress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end; // Ensure it lands exactly on the target number
        }
    };
    window.requestAnimationFrame(step);
}

// =======================================================
// PART 1: PENDING ENROLLMENT LIST (Approval Workflow)
// =======================================================

document.addEventListener('DOMContentLoaded', function() {
    loadEnrollmentData();

    // Setup Filter Pills
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', function() {
            pills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            filterEnrollment();
        });
    });
});

function loadEnrollmentData() {
    // 1. Show Skeletons before fetching
    const skeletonHTML = `
        <tr class="skeleton-row">
            <td><div class="skeleton-box" style="width: 20px;"></div></td>
            <td><div class="skeleton-box" style="width: 100px;"></div></td>
            <td><div class="skeleton-box" style="width: 150px;"></div></td>
            <td><div class="skeleton-box" style="width: 80px;"></div></td>
            <td><div class="skeleton-box" style="width: 100px;"></div></td>
            <td><div class="skeleton-box" style="width: 60px;"></div></td>
        </tr>
    `.repeat(3);

    [1, 2, 3, 4].forEach(i => {
        const tbody = document.getElementById(`enrollment-tbody-${i}`);
        if (tbody) tbody.innerHTML = skeletonHTML;
    });

    fetch('/api/enrollment/pending')
        .then(res => res.json())
        .then(data => {
            [1, 2, 3, 4].forEach(i => {
                const tbody = document.getElementById(`enrollment-tbody-${i}`);
                if (tbody) tbody.innerHTML = '';
            });

            const summaryContainer = document.getElementById('enrollmentSummaryCards');
            if (summaryContainer) summaryContainer.style.display = 'grid';
            
            let promoteCount = 0;
            let reviewCount = 0;
            const groupedData = { '1': [], '2': [], '3': [], '4': [] };

            data.forEach(student => {
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';
                
                groupedData[yearIndex].push(student);

                // --- UPDATED COUNTER LOGIC ---
                if (student.decision.includes('Retained')) reviewCount++;
                else promoteCount++;
            });

            // Trigger Number Animations
            const countTotalEl = document.getElementById('count-total');
            const countPromoteEl = document.getElementById('count-promote');
            const countReviewEl = document.getElementById('count-review');
            
            if (countTotalEl) animateValue(countTotalEl, 0, data.length, 1000);
            if (countPromoteEl) animateValue(countPromoteEl, 0, promoteCount, 1000);
            if (countReviewEl) animateValue(countReviewEl, 0, reviewCount, 1000);

            [1, 2, 3, 4].forEach(i => {
                const tbody = document.getElementById(`enrollment-tbody-${i}`);
                const students = groupedData[i.toString()];

                if (!tbody) return;

                if (students.length === 0) {
                    const yearLabel = i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : '4th';
                    // Inject Designed Empty State
                    tbody.innerHTML = `
                        <tr class="empty-state-row">
                            <td colspan="6">
                                <div class="empty-state-container">
                                    <i class='bx bx-ghost empty-state-icon'></i>
                                    <div class="empty-state-text">All caught up!</div>
                                    <div class="empty-state-subtext">No ${yearLabel} Year students pending enrollment.</div>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    students.forEach(student => {
                        const row = document.createElement('tr');
                        row.className = 'student-row';

                        // --- UPDATED REMARKS HTML (Handles 3 Colors now) ---
                        let remarksHtml = '';
                        if (student.decision === 'Promoted') {
                            remarksHtml = '<span class="tag success"><i class="bx bx-check"></i> Cleared</span>';
                        } else if (student.decision.includes('Retake') || student.decision.includes('Conditional')) {
                            // Orange tag for Conditional Promotion
                            remarksHtml = `<span class="tag warning" style="background: #fffbeb; color: #d97706; border: 1px solid #fde68a;"><i class="bx bx-error"></i> ${student.decision}</span>`;
                        } else {
                            // Red tag for Academic Probation / Retained
                            remarksHtml = '<span class="tag critical"><i class="bx bx-error-circle"></i> Retained</span>';
                        }

                        const studentDataStr = JSON.stringify({
                            id: student.id, name: student.name, program: student.program, type: student.type, 
                            year: student.year_level, standing: student.status, decision: student.decision, hasWarnings: student.hasWarnings,
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
                    tbody.closest('.year-accordion').classList.remove('collapsed');
                }
            });
        })
        .catch(err => {
            console.error(err);
            showToast("Failed to load enrollment data", "error");
        });
}

function quickApprove(studentId) {
    if(!confirm(`Are you sure you want to enroll student ${studentId}?`)) return;

    fetch('/api/enrollment/confirm', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: studentId}) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showToast(`Student ${studentId} enrolled  successfully!`, 'success');
            loadEnrollmentData(); 
            if (typeof loadEnlistmentData === 'function') loadEnlistmentData();
            if (typeof loadStudentJourney === 'function') loadStudentJourney();
        } else {
            showToast(data.error, 'error');
        }
    })
    .catch(err => showToast("Server Error", 'error'));
}

function toggleAllCheckboxes(source) {
    const table = source.closest('table');
    const checkboxes = table.querySelectorAll('tbody .student-cb');
    checkboxes.forEach(cb => {
        if(cb.closest('tr').style.display !== 'none') {
            cb.checked = source.checked;
        }
    });
    updateBulkEnrollButton();
}

function updateBulkEnrollButton() {
    const checked = document.querySelectorAll('.student-cb:checked');
    const container = document.getElementById('bulk-action-container');
    const countSpan = document.getElementById('bulk-count');
    
    if (!container) return; 

    if (checked.length > 0) {
        container.style.display = 'block';
        if (countSpan) countSpan.innerText = checked.length;
    } else {
        container.style.display = 'none';
    }
}

function confirmBulkEnrollment() {
    const checked = document.querySelectorAll('.student-cb:checked');
    if (checked.length === 0) return;

    const ids = Array.from(checked).map(cb => cb.value);
    
    if (!confirm(`Are you sure you want to enroll ${ids.length} selected student(s)?`)) return;

    const btn = document.getElementById('btn-bulk-enroll');
    const originalText = btn.innerHTML; 
    
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
            btn.innerHTML = originalText;
            document.getElementById('bulk-action-container').style.display = 'none';
            
            showToast(`Successfully enrolled ${data.count} students!`, 'success');
            
            document.querySelectorAll('.select-all-cb').forEach(cb => cb.checked = false);
            
            loadEnrollmentData(); 
            if (typeof loadEnlistmentData === 'function') loadEnlistmentData();
            if (typeof loadStudentJourney === 'function') loadStudentJourney();
        } else {
            showToast(data.error, 'error');
            btn.innerHTML = originalText;
        }
    })
    .catch(err => {
        showToast("Server Error", 'error');
        btn.innerHTML = originalText;
    })
    .finally(() => {
        btn.disabled = false;
    });
}

function openEnrollmentModal(event, data) {
    if (event) event.stopPropagation();
    
    // 1. Populate Basic Student Information
    document.getElementById('modalStudentId').innerText = data.id || '-';
    document.getElementById('modalStudentName').innerText = data.name || '-';
    document.getElementById('modalStudentProgram').innerText = data.program || '-';
    document.getElementById('modalStudentYear').innerText = data.year || '-';
    document.getElementById('modalStudentEmail').innerText = data.email || 'N/A';
    document.getElementById('modalStudentContact').innerText = data.contact || 'N/A';

    // 2. Display Failed Subjects (if any) & Dynamic Warning Box
    const warningsDiv = document.getElementById('modalWarnings');
    const warningBox = document.getElementById('modalWarningBox');
    const warningTitle = document.getElementById('modalWarningTitle');
    const warningDesc = document.getElementById('modalWarningDesc');
    const warningIcon = document.getElementById('modalWarningIcon');
    const failedSubjectsContainer = document.getElementById('modalFailedSubjects');
    
    if (data.hasWarnings && data.failed_subjects && data.failed_subjects.length > 0) {
        warningsDiv.style.display = 'block';
        failedSubjectsContainer.innerHTML = '';
        
        // Check if actually retained, or just promoted conditionally
        const isRetained = data.decision.includes('Retained');

        if (isRetained) {
            // RED BOX for Retained
            warningBox.style.backgroundColor = "#fef2f2";
            warningBox.style.border = "1px solid #fecaca";
            warningBox.style.color = "#991b1b";
            warningIcon.className = 'bx bx-error-circle';
            warningTitle.innerText = "Student Retained: Academic Probation";
            warningDesc.innerText = "This student cannot be promoted to the next year level due to failing grades in the following subjects:";
        } else {
            // ORANGE BOX for Conditional Promotion
            warningBox.style.backgroundColor = "#fffbeb";
            warningBox.style.border = "1px solid #fde68a";
            warningBox.style.color = "#92400e";
            warningIcon.className = 'bx bx-error';
            warningTitle.innerText = "Warning: Failed Subjects Detected";
            warningDesc.innerText = "This student is promoted, but has deficiencies in the following subjects that must be retaken:";
        }
        
        // Add the subject tags
        data.failed_subjects.forEach(subject => {
            const tagColor = isRetained ? "#ef4444" : "#d97706";
            const borderColor = isRetained ? "#fecaca" : "#fde68a";
            failedSubjectsContainer.innerHTML += `<span class="tag" style="background: white; border: 1px solid ${borderColor}; color: ${tagColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;"><i class='bx bx-book'></i> ${subject}</span>`;
        });
    } else {
        warningsDiv.style.display = 'none';
    }
    
    // 3. Set Regular vs Irregular Badge
    const typeLabel = data.type || 'Regular';
    const typeClass = typeLabel.toLowerCase() === 'irregular' ? 'irregular' : 'regular';
    document.getElementById('modalStudentType').innerHTML = `<span class="status-pill ${typeClass}">${typeLabel}</span>`;
    
    // 4. Apply The 3-Color Decision Card Logic
    const decisionEl = document.getElementById('modalStudentDecision');
    const fullCard = document.getElementById('decision-card-container');
    const iconContainer = document.getElementById('decision-icon-container');

    const isRetainedCard = data.decision.includes('Retained');
    const isConditionalCard = data.decision.includes('Retake') || data.decision.includes('Conditional');

    let decisionIcon, decisionText, badgeColor;

    if (isRetainedCard) {
        // RED CARD: Academic Probation / Retained
        decisionIcon = "bx-minus-circle";
        decisionText = data.decision.toUpperCase();
        badgeColor = "#e11d48";
        fullCard.style.background = "#fff1f2";
        fullCard.style.borderColor = "#fecdd3";
        if (iconContainer) { 
            iconContainer.style.background = "#ffe4e6"; 
            iconContainer.style.color = "#e11d48"; 
        }
    } else if (isConditionalCard) {
        // YELLOW/ORANGE CARD: Promoted but with Warnings
        decisionIcon = "bx-error";
        decisionText = data.decision.toUpperCase();
        badgeColor = "#d97706";
        fullCard.style.background = "#fffbeb";
        fullCard.style.borderColor = "#fde68a";
        if (iconContainer) { 
            iconContainer.style.background = "#fef3c7"; 
            iconContainer.style.color = "#d97706"; 
        }
    } else {
        // GREEN CARD: Clean Slate Promoted
        decisionIcon = "bx-chevrons-up";
        decisionText = "PROMOTING TO NEXT YEAR";
        badgeColor = "#16a34a";
        fullCard.style.background = "#f0fdf4";
        fullCard.style.borderColor = "#bbf7d0";
        if (iconContainer) { 
            iconContainer.style.background = "#dcfce7"; 
            iconContainer.style.color = "#16a34a"; 
        }
    }

    // Output the chosen badge design
    decisionEl.innerHTML = `
        <span style="color: ${badgeColor}; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; font-size: 0.95rem;">
            <i class='bx ${decisionIcon}'></i> ${decisionText}
        </span>
    `;

    // 5. Open the Modal & Bind ID to Confirmation Button
    document.getElementById('enrollmentModal').classList.add('active');
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

    fetch('/api/enrollment/confirm', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: studentId}) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showToast('Student successfully enrolled!', 'success');
            closeEnrollmentModal();
            loadEnrollmentData(); 
            if (typeof loadEnlistmentData === 'function') loadEnlistmentData();
            if (typeof loadStudentJourney === 'function') loadStudentJourney();
        } else {
            showToast(data.error, 'error');
        }
    })
    .catch(err => showToast("Server Error", 'error'))
    .finally(() => {
       btn.innerHTML = "<i class='bx bx-check-circle'></i> Enroll Student";
       btn.disabled = false;
    });
}

function toggleAccordion(element) {
    element.parentElement.classList.toggle('collapsed');
}

function filterEnrollment() {
    const searchInput = document.getElementById('enrollmentSearch');
    const input = searchInput ? searchInput.value.toUpperCase() : '';
    
    const activePill = document.querySelector('.filter-pill.active');
    const activeFilter = activePill ? activePill.getAttribute('data-filter') : 'all';
    
    const rows = document.querySelectorAll('.year-table tbody tr.student-row');

    rows.forEach(row => {
        const text = row.innerText.toUpperCase();
        let show = text.indexOf(input) > -1;

        if (show && activeFilter !== 'all') {
            if (activeFilter === 'cleared' && !text.includes('CLEARED')) show = false;
            if (activeFilter === 'retained' && !text.includes('RETAINED')) show = false;
            if (activeFilter === 'bscpe' && !text.includes('BSCPE')) show = false;
        }

        row.style.display = show ? "" : "none";
        
        if (show) row.closest('.year-accordion').classList.remove('collapsed');
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

function dragOverHandler(e) { 
    e.preventDefault(); 
    const dt = e.dataTransfer;
    const zone = e.currentTarget;
    
    if (dt.items && dt.items.length > 0 && dt.items[0].kind === 'file') {
        const fileType = dt.items[0].type;
        if (fileType.includes('spreadsheetml') || fileType.includes('excel') || fileType.includes('csv')) {
            zone.classList.add('dragover-success');
            zone.classList.remove('dragover-error');
        } else {
            zone.classList.add('dragover-error');
            zone.classList.remove('dragover-success');
        }
    }
}

function dragLeaveHandler(e) { 
    e.preventDefault(); 
    e.currentTarget.classList.remove('dragover-success', 'dragover-error'); 
}

function dropHandler(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover-success', 'dragover-error');
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if(file.name.endsWith('.xls') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv')){
             showLoadingState();
             setTimeout(() => processExcelFile(file), 100);
        } else {
             showToast("Invalid file type. Please upload XLSX or XLS.", "error");
        }
    }
}

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
        zone.classList.remove('dragover-success', 'dragover-error');
        zone.innerHTML = `
            <input type="file" id="modalFileInput" hidden onchange="handleFileSelect(event)" accept=".xlsx, .xls, .csv">
            <i class='bx bx-upload upload-icon-large'></i>
            <h3>Drag and drop file here, or click to browse</h3>
            <p>Accepted formats: XLSX, XLS</p>
        `;
    }
}

function isValidStudentFile(headers) {
    const studentKeywords = ['name', 'first', 'last', 'id', 'program', 'email'];
    // Check if at least 2 headers match student keywords
    const matchCount = headers.filter(h => 
        studentKeywords.some(key => h.toLowerCase().includes(key))
    ).length;
    return matchCount >= 2;
}

// Update the processExcelFile function in enrollment.js:
function processExcelFile(file) {
    if (typeof XLSX === 'undefined') {
        showToast("Error: Excel library failed to load.", "error");
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
                const headers = jsonData[0];
                
                // --- NEW: Header Validation ---
                if (!isValidStudentFile(headers)) {
                    document.getElementById('invalidFileModal').classList.add('active');
                    resetDropZone();
                    return; // Stop the upload process immediately
                }

                fileHeaders = headers; 
                uploadedData = XLSX.utils.sheet_to_json(sheet);
                
                setTimeout(() => {
                    nextStep();
                    resetDropZone(); 
                }, 500);
            } else {
                document.getElementById('invalidFileModal').classList.add('active');
                resetDropZone();
            }
        } catch (error) {
            console.error("SheetJS Error:", error);
            showToast("Error reading file.", "error");
            resetDropZone();
        }
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

// Update the updatePreviewTable function in enrollment.js:
function updatePreviewTable() {
    const tbody = document.getElementById('preview-table-body');
    const countEl = document.getElementById('preview-count');
    tbody.innerHTML = '';
    
    const mappings = {};
    document.querySelectorAll('.map-select').forEach(sel => {
        mappings[sel.getAttribute('data-key')] = sel.value;
    });

    let validCount = 0;

    uploadedData.slice(0, 100).forEach((row, index) => {
        const tr = document.createElement('tr');
        
        const getVal = (key) => {
            const colName = mappings[key];
            return colName ? (row[colName] || '') : '';
        };

        const fname = getVal('firstname');
        const lname = getVal('lastname');
        
        // --- NEW: Simple Validation Logic ---
        const isValid = fname.trim() !== '' && lname.trim() !== '';
        if (isValid) validCount++;

        const statusIcon = isValid 
            ? `<i class='bx bxs-check-circle' style='color:#2e7d32; font-size:1.2rem;' title="Valid Record"></i>`
            : `<i class='bx bxs-x-circle' style='color:#c62828; font-size:1.2rem;' title="Invalid: Missing Name"></i>`;

        tr.style.opacity = isValid ? "1" : "0.6"; // Dim invalid rows
        if (!isValid) tr.style.backgroundColor = "#fff5f5";

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align:center;">${statusIcon}</td>
            <td contenteditable="true" data-index="${index}" data-key="lastname">${lname}</td>
            <td contenteditable="true" data-index="${index}" data-key="firstname">${fname}</td>
            <td contenteditable="true" data-index="${index}" data-key="middlename">${getVal('middlename')}</td>
            <td contenteditable="true" data-index="${index}" data-key="program">${getVal('program') || 'BSCpE'}</td>
            <td contenteditable="true" data-index="${index}" data-key="email">${getVal('email')}</td>
            <td contenteditable="true" data-index="${index}" data-key="contact">${getVal('contact')}</td>
            <td contenteditable="true" data-index="${index}" data-key="address">${getVal('address')}</td>
            <td>${getVal('birthdate') || '-'}</td>
            <td>${getVal('gender') || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    countEl.innerText = `${validCount} Valid / ${uploadedData.length} Total Records`;
}


function nextStep() {
    if (currentStep === 3) {
        submitEnrollment();
    } else if (currentStep === 2) {
        // 1. Run the validation check
        const warnings = validateMappings();
        
        // 2. If errors are found, trigger the Custom Modal instead of the native confirm()
        if (warnings.length > 0) {
            const warningListEl = document.getElementById('mappingWarningList');
            warningListEl.innerHTML = ''; // Clear old warnings
            
            // Inject new RICH warnings
            warnings.forEach(w => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.alignItems = 'flex-start';
                li.style.gap = '10px';
                li.style.color = '#475569';
                li.style.fontSize = '0.95rem';
                li.style.lineHeight = '1.4';
                
                li.innerHTML = `
                    <i class='bx bx-info-circle' style='color: #ef4444; font-size: 1.2rem; margin-top: 2px; flex-shrink: 0;'></i> 
                    <span>${w}</span>
                `;
                warningListEl.appendChild(li);
            });
            
            // Show the modal
            document.getElementById('mappingWarningModal').classList.add('active');
            return; // Stop here and wait for the user's choice
        }

        // 3. If no warnings, proceed to preview normally
        executeStep3Transition();

    } else if (currentStep < 4) {
        currentStep++;
        if (currentStep === 2) updateMappingUI();
        updateStepUI();
    } else {
        closeUploadModal();
    }
}

// --- NEW HELPER FUNCTIONS FOR THE CUSTOM MODAL ---

function closeMappingWarningModal() {
    // User chose to "Edit Mapping"
    document.getElementById('mappingWarningModal').classList.remove('active');
}

function closeInvalidFileModal() {
    document.getElementById('invalidFileModal').classList.remove('active');
}

function forceNextStep() {
    // User chose to "Continue Anyway"
    document.getElementById('mappingWarningModal').classList.remove('active');
    executeStep3Transition();
}

function executeStep3Transition() {
    // The actual code to move from Step 2 -> Step 3
    currentStep++;
    updatePreviewTable();
    updateStepUI();
}

function validateMappings() {
    const mappings = {};
    const reverseMappings = {}; 
    let warnings = [];

    // Gather all mappings
    document.querySelectorAll('.map-select').forEach(sel => {
        const sysKey = sel.getAttribute('data-key');
        const excelCol = sel.value;
        mappings[sysKey] = excelCol;

        if (excelCol) {
            if (!reverseMappings[excelCol]) reverseMappings[excelCol] = [];
            reverseMappings[excelCol].push(sysKey);
        }
    });

    // 1. Check for missing required fields
    if (!mappings['firstname'] || !mappings['lastname']) {
        warnings.push("Required fields (First Name, Last Name) are not mapped.");
    }

    // 2. Check for duplicate mappings
    for (const [excelCol, sysKeys] of Object.entries(reverseMappings)) {
        if (sysKeys.length > 1) {
            const readableKeys = sysKeys.map(k => k.toUpperCase()).join(' & ');
            warnings.push(`You mapped the Excel column "${excelCol}" to multiple fields (${readableKeys}).`);
        }
    }

    // 3. Heuristic Data Checks (Look at the first row of uploaded data)
    if (uploadedData.length > 0) {
        const sampleRow = uploadedData[0];
        
        // Check Email
        if (mappings['email'] && sampleRow[mappings['email']]) {
            const sampleEmail = String(sampleRow[mappings['email']]);
            if (!sampleEmail.includes('@') && sampleEmail.trim() !== '') {
                warnings.push(`The column mapped to "Email" doesn't look like an email address (e.g., "${sampleEmail}").`);
            }
        }

        // Check Contact Number
        if (mappings['contact'] && sampleRow[mappings['contact']]) {
            const sampleContact = String(sampleRow[mappings['contact']]);
            if (/[a-zA-Z]/.test(sampleContact)) {
                warnings.push(`The column mapped to "Contact Number" contains letters (e.g., "${sampleContact}").`);
            }
        }
    }

    // --- NEW: 4. Check for Swapped First/Last Names (Header Heuristic) ---
    if (mappings['firstname'] && mappings['lastname']) {
        const fnHeader = mappings['firstname'].toLowerCase();
        const lnHeader = mappings['lastname'].toLowerCase();
        
        // If they mapped the "First Name" field to an Excel column named "Last Name" or "Surname"
        if (fnHeader.includes('last') || fnHeader.includes('surname')) {
            warnings.push(`You mapped "First Name" to the Excel column "${mappings['firstname']}". Did you accidentally swap the names?`);
        }
        // If they mapped the "Last Name" field to an Excel column named "First Name" or "Given Name"
        else if (lnHeader.includes('first') || lnHeader.includes('given')) {
            warnings.push(`You mapped "Last Name" to the Excel column "${mappings['lastname']}". Did you accidentally swap the names?`);
        }
    }

    return warnings;
}

function submitEnrollment() {
    const btn = document.getElementById('btn-next');
    const originalText = btn.innerText;
    btn.innerText = "Importing...";
    btn.disabled = true;

    const mappings = {};
    document.querySelectorAll('.map-select').forEach(sel => {
        if(sel.value) mappings[sel.getAttribute('data-key')] = sel.value;
    });

    const payload = uploadedData
        .filter(row => {
            const fn = row[mappings['firstname']] || '';
            const ln = row[mappings['lastname']] || '';
            return fn.trim() !== '' && ln.trim() !== '';
        })
        .map(row => {
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

    if (payload.length === 0) {
        showToast("No valid student records found to import.", "error");
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    } // Remove the semicolon and the extra brace below

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
            
            currentStep++;
            updateStepUI();
            loadEnrollmentData(); 
        } else {
            showToast("Import Failed: " + (data.message || "Unknown error"), "error");
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Server Error: Unable to save students.", "error");
    })
    .finally(() => {
        btn.innerText = originalText;
        btn.disabled = false;
    });
} // This is where the function should actually end


function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepUI();
    }
}

function updateStepUI() {
    [1,2,3,4].forEach(n => document.getElementById(`step-${n}`).style.display = 'none');
    document.getElementById(`step-${currentStep}`).style.display = 'block';

    // Animate the connected progress bar
    const progressWidth = ((currentStep - 1) / 3) * 100;
    const progressBar = document.getElementById('stepper-progress');
    if (progressBar) progressBar.style.width = `${progressWidth}%`;

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
        nextBtn.innerText = "Done"; nextBtn.style.background = "#90242d";
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
    document.getElementById('manualEnrollmentForm').reset();
    document.getElementById('manualEnrollmentModal').classList.add('active');
}

function closeManualEnrollmentModal() {
    document.getElementById('manualEnrollmentModal').classList.remove('active');
}

function submitManualEnrollment() {
    const studentId = document.getElementById('manualId').value.trim();
    const first = document.getElementById('manualFirst').value.trim();
    const last = document.getElementById('manualLast').value.trim();
    const middle = document.getElementById('manualMiddle').value.trim();
    const program = document.getElementById('manualProgram').value;
    const email = document.getElementById('manualEmail').value.trim();
    const contact = document.getElementById('manualContact').value.trim();
    const gender = document.getElementById('manualGender').value;
    const address = document.getElementById('manualAddress').value.trim();

    if (!studentId || !first || !last) {
        showToast("Student ID, First Name, and Last Name are required.", "error");
        return;
    }

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

    const btn = document.querySelector('#manualEnrollmentModal .btn-enroll');
    const originalText = btn.innerHTML;
    btn.innerHTML = "Processing...";
    btn.disabled = true;

    fetch('/api/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast("Student successfully enrolled!", "success");
            closeManualEnrollmentModal();
            loadEnrollmentData(); 
        } else {
            showToast("Failed to add student: " + (data.message || "Unknown error"), "error");
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Server Error: Unable to enroll student.", "error");
    })
    .finally(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}