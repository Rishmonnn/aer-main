// Accordion Logic
function toggleJourneyAccordion(element) {
    const parent = element.parentElement;
    parent.classList.toggle('collapsed');
}

// Search Filter Logic
function filterJourney() {
    const input = document.getElementById('journeySearch');
    const filter = input.value.toUpperCase();
    const rows = document.querySelectorAll('.journey-table tbody tr');
    
    rows.forEach(row => {
        const textValue = row.innerText;
        if (textValue.toUpperCase().indexOf(filter) > -1) {
            row.style.display = "";
            row.closest('.year-accordion').classList.remove('collapsed');
        } else {
            row.style.display = "none";
        }
    });
}

// --- VIEW JOURNEY NAVIGATION ---
function viewStudentJourney(id, name) {
    document.getElementById('journey-list-section').style.display = 'none';
    const detailSection = document.getElementById('journey-detail-section');
    detailSection.style.display = 'block';
    
    document.getElementById('detail-id').innerText = id || '2224-00001';
    document.getElementById('detail-name').innerText = (name || 'JUAN DELA CRUZ').toUpperCase();
    detailSection.scrollIntoView({ behavior: 'smooth' });
}

function closeJourneyDetail() {
    document.getElementById('journey-detail-section').style.display = 'none';
    document.getElementById('journey-list-section').style.display = 'block';
    
    // Reset grades view
    document.getElementById('semester-grades-section').style.display = 'none';
    document.querySelectorAll('.sem-row').forEach(row => row.classList.remove('active'));
}

// ==========================================
// --- SEMESTER GRADES LOGIC (UPDATED) ---
// ==========================================

// Data mapped by Semester Name
const semesterData = {
    'SY 24-25 SEM I': [
        { code: 'BES 024', desc: 'COMPUTER AIDED DRAFTING', type: 'Laboratory', units: 1.00, grade: 1.50, remarks: 'PASSED' },
        { code: 'CPE 038', desc: 'SOFTWARE DESIGN', type: 'Lec/Lab', units: 4.00, grade: 3.25, remarks: 'FAILED' },
        { code: 'MAT 042', desc: 'DISCRETE MATH', type: 'Lecture', units: 3.00, grade: 1.50, remarks: 'PASSED' }
    ],
    'SY 24-25 SEM II': [
        { code: 'CPE 039', desc: 'FUNDAMENTALS OF ELECTRONIC CIRCUITS', type: 'Lec/Lab', units: 4.00, grade: 1.25, remarks: 'PASSED' },
        { code: 'ECO 017', desc: 'ENGINEERING ECONOMICS', type: 'Lecture', units: 3.00, grade: 2.50, remarks: 'PASSED' },
        { code: 'MAT 120', desc: 'NUMERICAL METHODS', type: 'Lecture', units: 3.00, grade: 2.00, remarks: 'PASSED' }
    ],
    'SY 25-26 SEM I': [
        { code: 'CPE 040', desc: 'LOGIC CIRCUITS AND DESIGN', type: 'Lec/Lab', units: 4.00, grade: 1.75, remarks: 'PASSED' },
        { code: 'TECH 101', desc: 'TECHNOPRENEURSHIP', type: 'Lecture', units: 3.00, grade: 1.25, remarks: 'PASSED' }
    ]
};

function viewSemesterGrades(rowElement, semName) {
    // 1. Toggle Active State
    document.querySelectorAll('.sem-row').forEach(row => row.classList.remove('active'));
    rowElement.classList.add('active');

    // 2. Show Grades Container
    const gradesSection = document.getElementById('semester-grades-section');
    gradesSection.style.display = 'block';

    // 3. Populate Table based on selected Semester
    const tbody = document.getElementById('grades-table-body');
    tbody.innerHTML = '';

    // Get specific data for this semester, or empty array if not found
    const subjects = semesterData[semName] || [];

    if (subjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">No grades available for this semester.</td></tr>';
    } else {
        subjects.forEach(sub => {
            const isFailed = sub.remarks === 'FAILED';
            const tr = document.createElement('tr');
            tr.className = `grade-row ${isFailed ? 'failed' : ''}`;
            
            tr.innerHTML = `
                <td>${sub.code}</td>
                <td>${sub.desc}</td>
                <td>${sub.type}</td>
                <td>${sub.units.toFixed(2)}</td>
                <td>${sub.grade.toFixed(2)}</td>
                <td>${sub.remarks}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 4. Scroll to grades for better UX
    gradesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}