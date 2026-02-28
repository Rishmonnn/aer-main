// --- INIT: Load Data on Page Ready ---
document.addEventListener('DOMContentLoaded', function() {
    if(document.getElementById('journey-list-section')) {
        loadStudentJourney();
    }
});

// --- LOAD STUDENTS LIST ---
function loadStudentJourney() {
    fetch('/api/students')
        .then(response => response.json())
        .then(data => {
            // 1. Clear existing tables
            ['1', '2', '3', '4'].forEach(level => {
                const tbody = document.getElementById(`journey-tbody-${level}`);
                if(tbody) tbody.innerHTML = ''; 
            });

            // 2. Populate Tables
            data.forEach(student => {
                let yearIndex = '1';
                // Simple logic to map text "2nd Year" to ID "2"
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
                                <button class="btn-view-action" onclick="viewStudentJourney('${student.id}', '${student.name}')">
                                    View Journey
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                }
            });
            
            // 3. Handle Empty States
            ['1', '2', '3', '4'].forEach(level => {
                const tbody = document.getElementById(`journey-tbody-${level}`);
                if(tbody && tbody.children.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b; font-weight:500;">No records found.</td></tr>';
                }
            });
        })
        .catch(err => console.error('Error loading journey list:', err));
}

// Global variable to store the grades fetched from server
let currentStudentGrades = {}; 

// --- VIEW JOURNEY LOGIC (CONNECTED TO DATABASE) ---
function viewStudentJourney(id, name) {
    // 1. Switch UI to Detail View
    document.getElementById('journey-list-section').style.display = 'none';
    const detailSection = document.getElementById('journey-detail-section');
    detailSection.style.display = 'block';
    
    // 2. Set Header Info
    document.getElementById('detail-id').innerText = id || '-';
    document.getElementById('detail-name').innerText = (name || '-').toUpperCase();

    // 3. FETCH REAL DATA FROM API
    fetch(`/api/student_journey/${id}`)
        .then(response => {
            if (!response.ok) throw new Error("Student data not found");
            return response.json();
        })
        .then(data => {
            // Store grades globally so we can access them when clicking a semester row
            currentStudentGrades = data.grades; 

            // A. Update Summary Cards
            document.getElementById('stat-earned').innerText = data.summary.earned;
            document.getElementById('stat-registered').innerText = data.summary.registered;
            document.getElementById('stat-remaining').innerText = data.summary.remaining;
            document.getElementById('stat-total').innerText = data.summary.total;

            // B. Render Semesters List
            const semBody = document.getElementById('semester-list-body');
            semBody.innerHTML = '';

            if (data.semesters.length === 0) {
                semBody.innerHTML = `
                    <tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b; font-weight:500;">No academic history found.</td></tr>
                `;
            } else {
                data.semesters.forEach(sem => {
                    const tr = document.createElement('tr');
                    tr.className = 'sem-row';
                    // Pass the semester name to the click handler
                    tr.onclick = function() { viewSemesterGrades(this, sem.name); };
                    tr.innerHTML = `
                        <td class="sem-name">${sem.name}</td>
                        <td>${sem.reg.toFixed(2)}</td>
                        <td>${sem.earned.toFixed(2)}</td>
                        <td><span style="font-weight:700; color:#0f172a;">${sem.gwa.toFixed(2)}</span></td>
                    `;
                    semBody.appendChild(tr);
                });
            }
        })
        .catch(err => {
            console.error(err);
            alert("Could not load student data.");
        });

    // Hide Grades section initially
    document.getElementById('semester-grades-section').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeJourneyDetail() {
    document.getElementById('journey-detail-section').style.display = 'none';
    document.getElementById('journey-list-section').style.display = 'block';
    
    document.getElementById('semester-grades-section').style.display = 'none';
    document.querySelectorAll('.sem-row').forEach(row => row.classList.remove('active'));
}

// --- VIEW GRADES (Uses data fetched in viewStudentJourney) ---
function viewSemesterGrades(rowElement, semName) {
    if(rowElement.classList.contains('disabled')) return;

    // Highlight active row
    document.querySelectorAll('.sem-row').forEach(row => row.classList.remove('active'));
    rowElement.classList.add('active');

    const gradesSection = document.getElementById('semester-grades-section');
    gradesSection.style.display = 'block';

    const tbody = document.getElementById('grades-table-body');
    tbody.innerHTML = '';

    // Retrieve subjects from the global variable
    const subjects = currentStudentGrades[semName] || [];

    if (subjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No grades available for this semester.</td></tr>';
    } else {
        subjects.forEach(sub => {
            // Check fail status for red styling
            const isFailed = sub.remarks === 'Failed' || sub.remarks === 'Dropped' || (sub.grade > 3.0 && sub.grade !== 0);
            
            const tr = document.createElement('tr');
            tr.className = `grade-row ${isFailed ? 'failed' : ''}`;
            
            // Format Grade: If 0, show empty or pending
            let gradeDisplay = sub.grade.toFixed(2);
            if (sub.grade === 0) gradeDisplay = "-";

            tr.innerHTML = `
                <td style="font-weight:600;">${sub.code}</td>
                <td>${sub.desc}</td>
                <td>${sub.type}</td>
                <td>${sub.units.toFixed(2)}</td>
                <td style="font-weight:700;">${gradeDisplay}</td>
                <td>${sub.remarks}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    gradesSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// --- ACCORDION & FILTER ---
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