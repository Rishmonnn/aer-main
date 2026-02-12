// --- Enlistment Module Logic ---

// --- DUMMY DATA FOR SUBJECTS ---
const subjectDB = [
    { code: 'CPE 038', name: 'Software Design', units: 3, type: 'critical', sched: '07:30 AM-01:30 PM Thursday', room: 'CL3', section: 'COC-FA-CPE2-02' },
    { code: 'CPE 040', name: 'Logic Circuits And Design', units: 3, type: 'major', sched: '12:00 NN - 3:00 PM Wednesday', room: 'PH-315A', section: 'COC-FA-CPE2-02' },
    { code: 'PE 3', name: 'Physical Education 3', units: 1, type: 'minor', sched: '12:00 NN - 3:00 PM Wednesday', room: 'PH-315A', section: 'COC-FA-CPE2-02' },
    { code: 'MATH 02', name: 'Calculus 2', units: 3, type: 'major', sched: '09:00 AM - 12:00 NN Monday', room: 'RM-204', section: 'COC-FA-CPE2-02' }
];

let currentStudent = {};
let selectedUnits = 0;

// --- FILTERING ---
function filterEnlistment() {
    const val = document.getElementById('enlistmentSearch').value.toLowerCase();
    document.querySelectorAll('.enlistment-table tbody tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
}

// --- MODAL & LOGIC ---
function openEnlistmentModal(studentData) {
    currentStudent = studentData;
    selectedUnits = 0; // Reset

    // Populate Header Info
    document.getElementById('modalName').innerText = studentData.name;
    document.getElementById('modalID').innerText = studentData.id;
    document.getElementById('modalStatus').innerText = studentData.status;
    document.getElementById('modalStatus').className = `status-pill ${studentData.status.toLowerCase()}`;
    document.getElementById('maxUnits').innerText = studentData.maxUnits;
    
    // Render Alerts
    const alertContainer = document.getElementById('enlistmentAlerts');
    alertContainer.innerHTML = ''; // Clear previous

    if (studentData.retained) {
        alertContainer.innerHTML += `
            <div class="alert-banner alert-danger">
                <i class='bx bx-error-circle'></i>
                <div>
                    <h5>Student Retained at 2nd Year</h5>
                    <p>Failed a critical subject that has a prerequisite.</p>
                </div>
            </div>
            <div class="alert-banner alert-warning">
                <i class='bx bx-book-bookmark'></i>
                <div>
                    <h5>Subject Retake Required</h5>
                    <p>The following subject need to be retaken and are prioritized: <strong>CPE 038 - Software Design</strong></p>
                </div>
            </div>
        `;
    }

    // Render Subjects
    renderSubjects();
    updateSummary();

    // Show Modal
    document.getElementById('enlistmentModal').classList.add('active');
}

function closeEnlistmentModal() {
    document.getElementById('enlistmentModal').classList.remove('active');
}

function renderSubjects() {
    const list = document.getElementById('subjectListBody');
    list.innerHTML = '';

    subjectDB.forEach((sub, index) => {
        // If student is retained, auto-select Critical subjects
        const isPreSelected = currentStudent.retained && sub.type === 'critical';
        if(isPreSelected) selectedUnits += sub.units;

        let badgeClass = sub.type; 
        let badgeText = sub.type === 'critical' ? 'Critical Path' : (sub.type === 'major' ? 'Major - Current Year' : 'Minor Subject');
        
        // Icon logic
        let icon = isPreSelected ? "<i class='bx bxs-check-circle' style='color:#90242d; font-size:1.4rem'></i>" : "<i class='bx bx-circle' style='color:#ccc; font-size:1.4rem'></i>";

        const row = document.createElement('div');
        row.className = `subject-row ${isPreSelected ? 'selected' : ''}`;
        row.onclick = () => toggleSubject(row, sub);
        row.innerHTML = `
            <div class="row-top">
                <div class="subject-title">
                    <span class="selection-icon">${icon}</span>
                    <span>${sub.code} - ${sub.name} (${sub.units} Units)</span>
                    <span class="tag ${badgeClass}">${badgeText}</span>
                </div>
                <div style="font-size:0.8rem; border:1px solid #ddd; padding:2px 8px; border-radius:4px;">
                    Section: <strong>${sub.section}</strong>
                </div>
            </div>
            <div class="row-details">
                <div class="detail-item"><i class='bx bx-calendar'></i> ${sub.sched}</div>
                <div class="detail-item"><i class='bx bx-user'></i> Engr. Instructor</div>
                <div class="detail-item"><i class='bx bx-map'></i> ${sub.room}</div>
            </div>
        `;
        
        // Attach data for easy access
        row.dataset.units = sub.units;
        row.dataset.selected = isPreSelected ? 'true' : 'false';
        
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
    const unitCounter = document.getElementById('unitCounter');
    const summaryUnits = document.getElementById('summaryUnitsText');
    const summaryCount = document.getElementById('summaryCount');
    const alerts = document.getElementById('enlistmentAlerts');
    
    // Update Counts
    unitCounter.innerText = selectedUnits;
    summaryCount.innerText = document.querySelectorAll('.subject-row[data-selected="true"]').length;
    
    // Check Overload
    const max = currentStudent.maxUnits;
    let overloadHtml = '';
    
    if (selectedUnits > max) {
        unitCounter.style.color = 'red';
        summaryUnits.innerHTML = `Total Units: <span style="color:red; font-weight:bold">${selectedUnits}/${max}</span>`;
        
        // Add Overload Alert if not already there
        if (!document.getElementById('overloadAlert')) {
            overloadHtml = `
                <div id="overloadAlert" class="alert-banner alert-danger">
                    <i class='bx bxs-error'></i>
                    <div>
                        <h5>Unit Overload Detected</h5>
                        <p>You have selected <strong>${selectedUnits}</strong> units, which exceeds the maximum of <strong>${max}</strong> units. Please remove some subjects.</p>
                    </div>
                </div>
            `;
            // Prepend to alerts
            alerts.innerHTML = overloadHtml + alerts.innerHTML;
        }
        
        // Disable Enlist Button
        document.getElementById('btnEnlist').style.opacity = '0.5';
        document.getElementById('btnEnlist').style.pointerEvents = 'none';
        
        // Show Footer Warning
        if(!document.getElementById('footerWarn')) {
            summaryUnits.insertAdjacentHTML('afterend', '<span id="footerWarn" class="error-text"><i class="bx bxs-error"></i> Please remove 1 unit to proceed</span>');
        }
        
    } else {
        unitCounter.style.color = '#90242d';
        summaryUnits.innerHTML = `Total Units: ${selectedUnits}/${max}`;
        
        // Remove Overload Alert
        const existingAlert = document.getElementById('overloadAlert');
        if (existingAlert) existingAlert.remove();
        
        const footerWarn = document.getElementById('footerWarn');
        if (footerWarn) footerWarn.remove();

        // Enable Button
        document.getElementById('btnEnlist').style.opacity = '1';
        document.getElementById('btnEnlist').style.pointerEvents = 'auto';
    }
}

function submitEnlistment() {
    alert("Student Successfully Enlisted!");
    closeEnlistmentModal();
}