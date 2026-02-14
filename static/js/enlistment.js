document.addEventListener('DOMContentLoaded', function() {
    loadEnlistmentData();
});

// --- LOAD PENDING STUDENTS ---
function loadEnlistmentData() {
    fetch('/api/enlistment/pending')
        .then(res => res.json())
        .then(data => {
            document.querySelectorAll('.enlistment-table tbody').forEach(el => el.innerHTML = '');

            data.forEach(student => {
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';

                const tbody = document.getElementById(`enlistment-tbody-${yearIndex}`);
                
                if (tbody) {
                    const tr = document.createElement('tr');
                    // We pass the whole student object to the modal opener
                    tr.onclick = () => openEnlistmentModal(student);
                    
                    tr.innerHTML = `
                        <td>${student.id}</td>
                        <td class="student-name">${student.name}</td>
                        <td>${student.program}</td>
                        <td><span class="status-pill regular">Enlisting</span></td>
                        <td><button class="btn-view-action">Select Subjects</button></td>
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
// Note: 'subjectDB' is removed. We now fetch subjects dynamically.

// --- MODAL LOGIC ---
function openEnlistmentModal(studentData) {
    currentStudent = studentData;
    selectedUnits = 0;

    // 1. Populate Header Info
    document.getElementById('modalName').innerText = studentData.name;
    document.getElementById('modalID').innerText = studentData.id;
    document.getElementById('modalStatus').innerText = "Regular"; 
    document.getElementById('modalStatus').className = `status-pill regular`;
    document.getElementById('maxUnits').innerText = studentData.maxUnits || 21;
    document.getElementById('modalStanding').innerText = studentData.year_level;

    // 2. Clear Previous Data
    document.getElementById('enlistmentAlerts').innerHTML = ''; 
    document.getElementById('subjectListBody').innerHTML = '<div style="padding:20px; text-align:center;">Loading subjects...</div>';
    
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
        
        // Dynamic Classes
        const lockedClass = sub.locked ? 'subject-locked' : '';
        row.className = `subject-row ${lockedClass}`;
        
        // Interaction Logic
        if (sub.locked) {
            row.onclick = () => alert(`Cannot take ${sub.code}: ${sub.warning}`);
            row.style.opacity = '0.6';
            row.style.cursor = 'not-allowed';
            row.style.background = '#f9f9f9';
        } else {
            row.onclick = () => toggleSubject(row, sub);
        }
        
        // Icon Logic
        let icon = "<i class='bx bx-circle' style='color:#ccc; font-size:1.4rem'></i>";
        if (sub.locked) icon = "<i class='bx bxs-lock-alt' style='color:#666; font-size:1.4rem'></i>";

        // Badge Logic
        let badgeHtml = `<span class="tag ${sub.type}">${sub.type.toUpperCase()}</span>`;
        if (sub.locked) {
            badgeHtml = `<span class="tag" style="background:#444; color:white;">LOCKED</span>`;
        } else if (sub.type === 'critical') {
            badgeHtml = `<span class="tag critical">RETAKE REQUIRED</span>`;
        }

        // Warning Text (if locked)
        let warningHtml = sub.locked 
            ? `<div style="font-size:0.75rem; color:#d32f2f; margin-top:4px;"><i class='bx bxs-error-circle'></i> ${sub.warning}</div>` 
            : '';

        row.dataset.code = sub.code;

        row.innerHTML = `
            <div class="row-top">
                <div class="subject-title">
                    <span class="selection-icon">${icon}</span>
                    <div style="display:flex; flex-direction:column;">
                        <span>${sub.code} - ${sub.name} (${sub.units} Units)</span>
                        ${warningHtml}
                    </div>
                    ${badgeHtml}
                </div>
                <div style="font-size:0.8rem; border:1px solid #ddd; padding:2px 8px; border-radius:4px;">
                    ${sub.section}
                </div>
            </div>
            <div class="row-details">
                <div class="detail-item"><i class='bx bx-calendar'></i> ${sub.sched}</div>
                <div class="detail-item"><i class='bx bx-map'></i> ${sub.room}</div>
            </div>
        `;
        
        list.appendChild(row);
    });
}

function toggleSubject(rowElement, subject) {
    const isSelected = rowElement.dataset.selected === 'true';
    const iconSpan = rowElement.querySelector('.selection-icon');
    
    if (isSelected) {
        // Deselect
        rowElement.dataset.selected = 'false';
        rowElement.classList.remove('selected');
        iconSpan.innerHTML = "<i class='bx bx-circle' style='color:#ccc; font-size:1.4rem'></i>";
        selectedUnits -= subject.units;
    } else {
        // Select
        rowElement.dataset.selected = 'true';
        rowElement.classList.add('selected');
        iconSpan.innerHTML = "<i class='bx bxs-check-circle' style='color:#90242d; font-size:1.4rem'></i>";
        selectedUnits += subject.units;
    }
    updateSummary();
}

function updateSummary() {
    document.getElementById('unitCounter').innerText = selectedUnits;
    document.getElementById('summaryCount').innerText = document.querySelectorAll('.subject-row[data-selected="true"]').length;
    document.getElementById('summaryUnitsText').innerText = `Total Units: ${selectedUnits}`;
}

function submitEnlistment() {
    const btn = document.getElementById('btnEnlist');
    
    // ... (Keep your existing validation logic here for selectedUnits > 0) ...
    if (selectedUnits === 0) {
        alert("Please select at least one subject.");
        return;
    }

    // ... (Keep your existing data gathering logic for subjectCodes) ...
    const selectedRows = document.querySelectorAll('.subject-row[data-selected="true"]');
    const subjectCodes = [];
    selectedRows.forEach(row => {
        if (row.dataset.code) subjectCodes.push(row.dataset.code);
    });

    // Send to Server
    btn.innerText = "Processing...";
    btn.disabled = true;

    fetch('/api/enlistment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            student_id: currentStudent.id,
            subjects: subjectCodes
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("Student Successfully Enlisted! They have been moved to the Enrolled list.");
            closeEnlistmentModal();
            
            // 1. Refresh THIS module (Enlistment) - Removes student from list
            loadEnlistmentData(); 

            // 2. DIRECT UPDATE: Refresh Student Journey
            // This ensures the student's new subjects appear when you view their journey
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
        btn.innerText = "Enlist Student";
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