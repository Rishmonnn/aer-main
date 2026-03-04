document.addEventListener('DOMContentLoaded', function() {
    loadEnlistmentData();
});

// --- LOAD PENDING STUDENTS ---
function loadEnlistmentData() {
    fetch('/api/enlistment/pending')
        .then(res => res.json())
        .then(data => {
            // Clear all tables first
            document.querySelectorAll('.enlistment-table tbody').forEach(el => el.innerHTML = '');

            data.forEach(student => {
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';

                const tbody = document.getElementById(`enlistment-tbody-${yearIndex}`);
                
                if (tbody) {
                    const tr = document.createElement('tr');
                    tr.onclick = () => openEnlistmentModal(student);
                    
                    tr.innerHTML = `
                        <td>${student.id}</td>
                        <td class="student-name">${student.name}</td>
                        <td>${student.program}</td>
                        <td><span class="status-pill regular">Enlisting</span></td>
                        <td><button class="btn-view-action">Enlist</button></td>
                    `;
                    tbody.appendChild(tr);
                    tbody.closest('.year-accordion').classList.remove('collapsed');
                }
            });
        });
}

// --- GLOBAL VARIABLES ---
let currentStudent = {};
let selectedUnits = 0;

// --- MODAL LOGIC ---
function openEnlistmentModal(studentData) {
    currentStudent = studentData;
    selectedUnits = 0;

    // 1. Populate New Profile Grid Info
    document.getElementById('modalName').innerText = studentData.name;
    document.getElementById('modalID').innerText = studentData.id;
    document.getElementById('maxUnits').innerText = studentData.maxUnits || 21;
    document.getElementById('modalStanding').innerText = studentData.year_level;

    // Badge styling for status
    const typeLabel = studentData.type || 'Regular';
    const typeClass = typeLabel.toLowerCase() === 'irregular' ? 'irregular' : 'regular';
    document.getElementById('modalStatus').innerHTML = `<span class="status-pill ${typeClass}">${typeLabel}</span>`;


    // 2. Clear Previous Data & Reset Select All Button
    document.getElementById('enlistmentAlerts').innerHTML = ''; 
    document.getElementById('subjectListBody').innerHTML = '<div style="padding:20px; text-align:center;">Loading subjects...</div>';
    
    // RESET BUTTON TEXT
    const btnSelect = document.getElementById('btnSelectAll');
    if(btnSelect) btnSelect.innerText = "Select All";
    
    document.getElementById('enlistmentModal').classList.add('active');

    // 3. FETCH REAL SUBJECTS FROM API
    fetch(`/api/enlistment/subjects/${studentData.id}`)
        .then(res => res.json())
        .then(subjects => {
            renderSubjects(subjects);
            updateSummary();
        })
        .catch(err => {
            console.error(err);
            document.getElementById('subjectListBody').innerHTML = '<div style="color:red; padding:20px;">Error loading subjects.</div>';
        });
}

function closeEnlistmentModal() {
    document.getElementById('enlistmentModal').classList.remove('active');
}

// --- RENDER SUBJECTS (Dynamic Data) ---
function renderSubjects(subjects) {
    const list = document.getElementById('subjectListBody');
    list.innerHTML = '';

    if (subjects.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center;">No subjects found.</div>';
        return;
    }

    subjects.forEach((sub) => {
        const row = document.createElement('div');
        
        const lockedClass = sub.locked ? 'subject-locked' : '';
        row.className = `subject-row ${lockedClass}`;
        
        row.dataset.units = sub.units; 
        row.dataset.code = sub.code;

        if (sub.locked) {
            row.onclick = () => alert(`Cannot take ${sub.code}: ${sub.warning}`);
            row.style.opacity = '0.6';
            row.style.cursor = 'not-allowed';
            row.style.background = '#f8fafc';
        } else {
            row.onclick = () => toggleSubject(row, sub);
        }
        
        let icon = "<i class='bx bx-circle' style='color:#cbd5e1; font-size:1.4rem'></i>";
        if (sub.locked) icon = "<i class='bx bxs-lock-alt' style='color:#64748b; font-size:1.4rem'></i>";

        let badgeHtml = `<span class="tag ${sub.type}">${sub.type.toUpperCase()}</span>`;
        if (sub.locked) {
            badgeHtml = `<span class="tag" style="background:#475569; color:white;">LOCKED</span>`;
        } else if (sub.type === 'critical') {
            badgeHtml = `<span class="tag critical">RETAKE REQUIRED</span>`;
        }

        let warningHtml = sub.locked 
            ? `<div style="font-size:0.75rem; color:#ef4444; margin-top:4px; font-weight:500;"><i class='bx bxs-error-circle'></i> ${sub.warning}</div>` 
            : '';

        // --- NEW: Generate Dropdown Options for Sections ---
        let optionsHtml = '';
        if (sub.sections && sub.sections.length > 0) {
            sub.sections.forEach(sec => {
                // Formatting it nicely: "Section A (Room 101 | Instructor Name)"
                optionsHtml += `<option value="${sec.id}">Section ${sec.name} (${sec.room} | ${sec.faculty})</option>`;
            });
        }
        
        // Use onclick stopPropagation so picking a dropdown item doesn't toggle the subject
        let sectionDropdownHtml = sub.locked ? '' : `
            <select class="section-select" onclick="event.stopPropagation()" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.8rem; background: white; color: #475569; outline: none; cursor: pointer;">
                ${optionsHtml}
            </select>
        `;

        row.innerHTML = `
            <div class="row-top" style="align-items: center; border-bottom: none; padding-bottom: 0;">
                <div class="subject-title">
                    <span class="selection-icon">${icon}</span>
                    <div style="display:flex; flex-direction:column;">
                        <span>${sub.code} - ${sub.name} (${sub.units} Units)</span>
                        ${warningHtml}
                    </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${badgeHtml}
                    ${sectionDropdownHtml}
                </div>
            </div>
        `;
        
        list.appendChild(row);
    });
}

// --- TOGGLE ALL FUNCTION ---
function toggleAllSubjects() {
    // 1. Get all UNLOCKED rows
    const rows = document.querySelectorAll('.subject-row:not(.subject-locked)');
    if (rows.length === 0) return;

    // 2. Check current state (If any row is unselected, we go to Select All mode)
    const allSelected = Array.from(rows).every(r => r.dataset.selected === 'true');
    const targetState = !allSelected; // True = Select All, False = Deselect All

    // 3. Iterate and Update
    selectedUnits = 0; // Reset count to calculate fresh

    rows.forEach(row => {
        const iconSpan = row.querySelector('.selection-icon');
        const units = parseInt(row.dataset.units) || 0;

        if (targetState) {
            // Select
            row.dataset.selected = 'true';
            row.classList.add('selected');
            iconSpan.innerHTML = "<i class='bx bxs-check-circle' style='color:#90242d; font-size:1.4rem'></i>";
            selectedUnits += units;
        } else {
            // Deselect
            row.dataset.selected = 'false';
            row.classList.remove('selected');
            iconSpan.innerHTML = "<i class='bx bx-circle' style='color:#cbd5e1; font-size:1.4rem'></i>";
        }
    });

    // 4. Update Button Text
    const btn = document.getElementById('btnSelectAll');
    if(btn) btn.innerText = targetState ? "Deselect All" : "Select All";

    updateSummary();
}

function toggleSubject(rowElement, subject) {
    const isSelected = rowElement.dataset.selected === 'true';
    const iconSpan = rowElement.querySelector('.selection-icon');
    
    if (isSelected) {
        // Deselect
        rowElement.dataset.selected = 'false';
        rowElement.classList.remove('selected');
        iconSpan.innerHTML = "<i class='bx bx-circle' style='color:#cbd5e1; font-size:1.4rem'></i>";
        selectedUnits -= subject.units;
    } else {
        // Select
        rowElement.dataset.selected = 'true';
        rowElement.classList.add('selected');
        iconSpan.innerHTML = "<i class='bx bxs-check-circle' style='color:#90242d; font-size:1.4rem'></i>";
        selectedUnits += subject.units;
    }
    
    // Update "Select All" button text logic
    const rows = document.querySelectorAll('.subject-row:not(.subject-locked)');
    const allSelected = Array.from(rows).every(r => r.dataset.selected === 'true');
    const btn = document.getElementById('btnSelectAll');
    if(btn) btn.innerText = allSelected ? "Deselect All" : "Select All";

    updateSummary();
}

function updateSummary() {
    document.getElementById('unitCounter').innerText = selectedUnits;
    document.getElementById('summaryCount').innerText = document.querySelectorAll('.subject-row[data-selected="true"]').length;
}

function submitEnlistment() {
    const btn = document.getElementById('btnEnlist');
    
    if (selectedUnits === 0) {
        alert("Please select at least one subject.");
        return;
    }

    const selectedRows = document.querySelectorAll('.subject-row[data-selected="true"]');
    const subjectsData = []; // Changed to an array of objects
    
    selectedRows.forEach(row => {
        const code = row.dataset.code;
        if (code) {
            // Find the select element in this specific row and get its value
            const selectEl = row.querySelector('.section-select');
            const sectionId = selectEl ? selectEl.value : null;
            
            subjectsData.push({
                code: code,
                section_id: sectionId
            });
        }
    });

    btn.innerText = "Processing...";
    btn.disabled = true;

    fetch('/api/enlistment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            student_id: currentStudent.id,
            subjects: subjectsData  // Send the object array instead of strings
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("Student Successfully Enlisted! They have been moved to the Enrolled list.");
            closeEnlistmentModal();
            loadEnlistmentData(); 
            if (typeof loadStudentJourney === 'function') {
                loadStudentJourney();
            }
        } else {
            alert("Error: " + data.message);
        }
    })
    .catch(err => {
        console.error(err);
        alert("Server Error occurred.");
    })
    .finally(() => {
        btn.innerHTML = "<i class='bx bx-check-circle'></i> Enlist Student";
        btn.disabled = false;
    });
}

function filterEnlistment() {
    const val = document.getElementById('enlistmentSearch').value.toLowerCase();
    document.querySelectorAll('.enlistment-table tbody tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
}

function toggleAccordion(element) {
    element.parentElement.classList.toggle('collapsed');
}