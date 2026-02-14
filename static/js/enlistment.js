document.addEventListener('DOMContentLoaded', function() {
    loadEnlistmentData();
});

// --- LOAD DATA FROM API ---
function loadEnlistmentData() {
    fetch('/api/enlistment/pending')
        .then(res => res.json())
        .then(data => {
            // 1. Clear existing tables
            document.querySelectorAll('.enlistment-table tbody').forEach(el => el.innerHTML = '');

            // 2. Populate Tables
            data.forEach(student => {
                // Determine target table based on student's NEW year level
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';

                const tbody = document.getElementById(`enlistment-tbody-${yearIndex}`);
                
                if (tbody) {
                    // Create row
                    const tr = document.createElement('tr');
                    // Attach click event for modal
                    tr.onclick = () => openEnlistmentModal(student);
                    
                    tr.innerHTML = `
                        <td>${student.id}</td>
                        <td class="student-name">${student.name}</td>
                        <td>${student.program}</td>
                        <td><span class="status-pill regular">Enlisting</span></td>
                        <td><button class="btn-view-action">Select Subjects</button></td>
                    `;
                    tbody.appendChild(tr);
                    
                    // Auto-open accordion
                    tbody.closest('.year-accordion').classList.remove('collapsed');
                }
            });
        })
        .catch(err => console.error("Error loading enlistment:", err));
}

// --- KEEP EXISTING MODAL LOGIC BELOW ---
// (Paste the rest of your existing logic below: subjectDB, filtering, modal functions)
// Ensure 'subjectDB' and 'openEnlistmentModal' are still there.

const subjectDB = [
    { code: 'CPE 038', name: 'Software Design', units: 3, type: 'critical', sched: '07:30 AM-01:30 PM Thursday', room: 'CL3', section: 'COC-FA-CPE2-02' },
    { code: 'CPE 040', name: 'Logic Circuits And Design', units: 3, type: 'major', sched: '12:00 NN - 3:00 PM Wednesday', room: 'PH-315A', section: 'COC-FA-CPE2-02' },
    { code: 'PE 3', name: 'Physical Education 3', units: 1, type: 'minor', sched: '12:00 NN - 3:00 PM Wednesday', room: 'PH-315A', section: 'COC-FA-CPE2-02' },
    { code: 'MATH 02', name: 'Calculus 2', units: 3, type: 'major', sched: '09:00 AM - 12:00 NN Monday', room: 'RM-204', section: 'COC-FA-CPE2-02' }
];

let currentStudent = {};
let selectedUnits = 0;

function filterEnlistment() {
    const val = document.getElementById('enlistmentSearch').value.toLowerCase();
    document.querySelectorAll('.enlistment-table tbody tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
}

function openEnlistmentModal(studentData) {
    currentStudent = studentData;
    selectedUnits = 0;

    document.getElementById('modalName').innerText = studentData.name;
    document.getElementById('modalID').innerText = studentData.id;
    document.getElementById('modalStatus').innerText = "Regular"; // Default for now
    document.getElementById('modalStatus').className = `status-pill regular`;
    document.getElementById('maxUnits').innerText = studentData.maxUnits || 21;
    document.getElementById('modalStanding').innerText = studentData.year_level;

    document.getElementById('enlistmentAlerts').innerHTML = ''; 
    renderSubjects();
    updateSummary();

    document.getElementById('enlistmentModal').classList.add('active');
}

function closeEnlistmentModal() {
    document.getElementById('enlistmentModal').classList.remove('active');
}

function renderSubjects() {
    const list = document.getElementById('subjectListBody');
    list.innerHTML = '';
    
    // In a real app, you would filter subjectDB based on the student's year level
    subjectDB.forEach((sub) => {
        const row = document.createElement('div');
        row.className = `subject-row`;
        row.onclick = () => toggleSubject(row, sub);
        row.innerHTML = `
            <div class="row-top">
                <div class="subject-title">
                    <span class="selection-icon"><i class='bx bx-circle' style='color:#ccc; font-size:1.4rem'></i></span>
                    <span>${sub.code} - ${sub.name} (${sub.units} Units)</span>
                    <span class="tag ${sub.type}">${sub.type.toUpperCase()}</span>
                </div>
                <div style="font-size:0.8rem; border:1px solid #ddd; padding:2px 8px; border-radius:4px;">Section: ${sub.section}</div>
            </div>
            <div class="row-details">
                <div class="detail-item"><i class='bx bx-calendar'></i> ${sub.sched}</div>
                <div class="detail-item"><i class='bx bx-map'></i> ${sub.room}</div>
            </div>
        `;
        row.dataset.selected = 'false';
        list.appendChild(row);
    });
}

function toggleSubject(rowElement, subject) {
    const isSelected = rowElement.dataset.selected === 'true';
    const iconSpan = rowElement.querySelector('.selection-icon');
    
    if (isSelected) {
        rowElement.dataset.selected = 'false';
        rowElement.classList.remove('selected');
        iconSpan.innerHTML = "<i class='bx bx-circle' style='color:#ccc; font-size:1.4rem'></i>";
        selectedUnits -= subject.units;
    } else {
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
    alert("Student Successfully Enlisted!");
    closeEnlistmentModal();
    // Here you would add an API call to save the enlisted subjects
}

function toggleAccordion(element) {
    element.parentElement.classList.toggle('collapsed');
}