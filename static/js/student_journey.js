// --- INIT: Load Data on Page Ready ---
document.addEventListener('DOMContentLoaded', function() {
    if(document.getElementById('journey-list-section')) {
        loadStudentJourney();
    }
});

// --- LOAD STUDENTS FROM API ---
function loadStudentJourney() {
    fetch('/api/students')
        .then(response => response.json())
        .then(data => {
            // 1. Clear existing tables
            ['1', '2', '3', '4'].forEach(level => {
                const tbody = document.getElementById(`journey-tbody-${level}`);
                if(tbody) tbody.innerHTML = ''; 
            });

            // 2. Populate Tables with Students from API
            // This loops through EVERY student returned by the database
            data.forEach(student => {
                let yearIndex = '1';
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';

                const tbody = document.getElementById(`journey-tbody-${yearIndex}`);
                if (tbody) {
                    const row = `
                        <tr>
                            <td>${student.id}</td>
                            <td class="student-name">${student.name}</td>
                            <td>${student.program}</td>
                            <td>
                                <button class="btn-view-journey" onclick="viewStudentJourney('${student.id}', '${student.name}')">
                                    View Journey
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                }
            });

            // 3. Handle Empty States for sections with no students
            ['1', '2', '3', '4'].forEach(level => {
                const tbody = document.getElementById(`journey-tbody-${level}`);
                if(tbody && tbody.children.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">No records found.</td></tr>';
                }
            });

        })
        .catch(err => console.error('Error loading journey data:', err));
}

// --- MOCK ACADEMIC DATA (Grades are only here for older students) ---
const mockAcademicData = {
    // OLD STUDENT (2nd Year) - Has Grades
    '2023-00001': {
        summary: { earned: 68, registered: 92, remaining: 104, total: 172 },
        semesters: [
            { name: 'SY 24-25 SEM I', reg: 22.00, earned: 22.00, gwa: 1.80 },
            { name: 'SY 24-25 SEM II', reg: 22.00, earned: 22.00, gwa: 1.80 },
            { name: 'SY 25-26 SEM I', reg: 22.00, earned: 22.00, gwa: 1.80 }
        ]
    }
    // FRESHMEN (Maria/Pemela/Others) are NOT here, so they will default to empty automatically
};

// --- GRADES DATA (Detailed) ---
const semesterGradesData = {
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

// --- VIEW JOURNEY LOGIC ---
function viewStudentJourney(id, name) {
    document.getElementById('journey-list-section').style.display = 'none';
    const detailSection = document.getElementById('journey-detail-section');
    detailSection.style.display = 'block';
    
    // 1. Set Header Info
    document.getElementById('detail-id').innerText = id || '-';
    document.getElementById('detail-name').innerText = (name || '-').toUpperCase();

    // 2. Fetch Data (Mock)
    const data = mockAcademicData[id] || null;

    if (data) {
        // --- EXISTING STUDENT (Has Data) ---
        document.getElementById('stat-earned').innerText = data.summary.earned;
        document.getElementById('stat-registered').innerText = data.summary.registered;
        document.getElementById('stat-remaining').innerText = data.summary.remaining;
        document.getElementById('stat-total').innerText = data.summary.total;

        // Render Semesters
        const semBody = document.getElementById('semester-list-body');
        semBody.innerHTML = '';
        data.semesters.forEach(sem => {
            const tr = document.createElement('tr');
            tr.className = 'sem-row';
            tr.onclick = function() { viewSemesterGrades(this, sem.name); };
            tr.innerHTML = `
                <td class="sem-name">${sem.name}</td>
                <td>${sem.reg.toFixed(2)}</td>
                <td>${sem.earned.toFixed(2)}</td>
                <td>${sem.gwa.toFixed(2)}</td>
            `;
            semBody.appendChild(tr);
        });

    } else {
        // --- FRESHMAN / NEW STUDENT (Empty Grades) ---
        // This runs for ANY student ID not found in mockAcademicData
        document.getElementById('stat-earned').innerText = '0';
        document.getElementById('stat-registered').innerText = '0'; 
        document.getElementById('stat-remaining').innerText = '172';
        document.getElementById('stat-total').innerText = '172';

        // Render Empty State
        const semBody = document.getElementById('semester-list-body');
        semBody.innerHTML = `
            <tr class="sem-row disabled" style="background: #f9f9f9; cursor: default;">
                <td class="sem-name" style="color: #666;">SY 25-26 SEM I (Current)</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            </tr>
            <tr>
                <td colspan="4" style="text-align:center; padding: 15px; font-style: italic; color: #888;">
                    No academic history available (Freshman).
                </td>
            </tr>
        `;
    }

    // Hide Grades section initially
    document.getElementById('semester-grades-section').style.display = 'none';
    detailSection.scrollIntoView({ behavior: 'smooth' });
}

function closeJourneyDetail() {
    document.getElementById('journey-detail-section').style.display = 'none';
    document.getElementById('journey-list-section').style.display = 'block';
    
    document.getElementById('semester-grades-section').style.display = 'none';
    document.querySelectorAll('.sem-row').forEach(row => row.classList.remove('active'));
}

// --- VIEW GRADES (Only for students with data) ---
function viewSemesterGrades(rowElement, semName) {
    if(rowElement.classList.contains('disabled')) return;

    document.querySelectorAll('.sem-row').forEach(row => row.classList.remove('active'));
    rowElement.classList.add('active');

    const gradesSection = document.getElementById('semester-grades-section');
    gradesSection.style.display = 'block';

    const tbody = document.getElementById('grades-table-body');
    tbody.innerHTML = '';

    const subjects = semesterGradesData[semName] || [];

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

    gradesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Accordion Logic
function toggleJourneyAccordion(element) {
    const parent = element.parentElement;
    parent.classList.toggle('collapsed');
}

function filterJourney() {
    const input = document.getElementById('journeySearch');
    const filter = input.value.toUpperCase();
    const rows = document.querySelectorAll('.journey-table tbody tr');
    
    rows.forEach(row => {
        if(row.children.length < 2) return;
        const textValue = row.innerText;
        if (textValue.toUpperCase().indexOf(filter) > -1) {
            row.style.display = "";
            row.closest('.year-accordion').classList.remove('collapsed');
        } else {
            row.style.display = "none";
        }
    });
}