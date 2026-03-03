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

if (data.student_info) {
                document.getElementById('detail-email').innerText = data.student_info.email || 'N/A';
                document.getElementById('detail-contact').innerText = data.student_info.contact_number || 'N/A';
                document.getElementById('detail-year').innerText = data.student_info.year_level || '-';
                
                // NEW: Address and Birthdate
                document.getElementById('detail-address').innerText = data.student_info.address || 'N/A';
                const birthdateStr = data.student_info.birthdate || 'N/A';
                document.getElementById('detail-birthdate').innerText = birthdateStr;

                // NEW: Calculate Age Dynamically
                let ageText = 'N/A';
                if (birthdateStr !== 'N/A') {
                    const bDate = new Date(birthdateStr);
                    // Check if it's a valid date
                    if (!isNaN(bDate)) {
                        const ageDifMs = Date.now() - bDate.getTime();
                        const ageDate = new Date(ageDifMs);
                        ageText = Math.abs(ageDate.getUTCFullYear() - 1970) + " years old";
                    } else {
                        ageText = "Invalid Date";
                    }
                }
                document.getElementById('detail-age').innerText = ageText;
                
                // Add a visual badge for status
                const status = data.student_info.status || 'Regular';
                const statusClass = status.toLowerCase() === 'irregular' ? 'irregular' : 'regular';
                document.getElementById('detail-status').innerHTML = `<span class="status-pill ${statusClass}">${status}</span>`;
            }

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

            // C. Render Advising History
            const advContainer = document.getElementById('journey-advising-list');
            advContainer.innerHTML = '';
            
            if (!data.advising_records || data.advising_records.length === 0) {
                advContainer.innerHTML = '<p style="text-align:center; color:#64748b; font-style:italic; margin: 10px 0;">No prior advising records or interventions found for this student.</p>';
            } else {
                advContainer.innerHTML = data.advising_records.map(r => {
                    let statusColor = r.status === 'Resolved' ? '#10b981' : (r.status === 'Monitoring' ? '#f59e0b' : '#ef4444');
                    let followUpText = r.follow_up_date && r.follow_up_date !== 'None' ? 
                        `<div style="font-size: 12px; color: #475569; margin-top: 8px;"><i class='bx bx-calendar-event'></i> <strong>Follow-up Scheduled:</strong> ${r.follow_up_date}</div>` : '';

                    return `<div style="margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; display: flex; flex-direction: column; gap: 5px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-weight: 600; color: #0f172a; margin-right: 10px; font-size: 14px;">${r.date}</span>
                                <span style="background: ${statusColor}20; color: ${statusColor}; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${r.status}</span>
                            </div>
                            <span style="background: #e2e8f0; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #475569;">${r.category}</span>
                        </div>
                        <div style="color: #334155; font-size: 13px; margin-top: 5px;"><strong>Notes:</strong> ${r.notes}</div>
                        <div style="color: #059669; font-style: italic; font-size: 13px;"><strong>Action Plan:</strong> ${r.action_plan}</div>
                        ${followUpText}
                    </div>`;
                }).join('');
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
            const isFailed = sub.remarks === 'Failed' || sub.remarks === 'Dropped' || (sub.grade > 3.0 && sub.grade !== 0);
            
            // Format Grade
            let gradeDisplay = sub.grade === 0 ? "-" : sub.grade.toFixed(2);

            // --- 1. Create Main Subject Row ---
            const tr = document.createElement('tr');
            tr.className = `grade-row ${isFailed ? 'failed' : ''}`;
            tr.style.cursor = 'pointer'; 
            
            // Notice the new chevron icon before the subject code
            tr.innerHTML = `
                <td style="font-weight:600; display: flex; align-items: center; gap: 8px;">
                    <i class='bx bx-chevron-right toggle-icon' style="font-size: 18px; color: #64748b; transition: 0.2s;"></i> 
                    ${sub.code}
                </td>
                <td>${sub.desc}</td>
                <td>${sub.type}</td>
                <td>${sub.units.toFixed(2)}</td>
                <td style="font-weight:700;">${gradeDisplay}</td>
                <td>${sub.remarks}</td>
            `;

            // --- 2. Create the Hidden Breakdown Row ---
            const breakdownTr = document.createElement('tr');
            breakdownTr.className = 'breakdown-row';
            breakdownTr.style.display = 'none'; // Hidden by default
            
            // Format period grades safely
            const formatGrade = (val) => typeof val === 'number' ? val.toFixed(2) : (val || '-');

            breakdownTr.innerHTML = `
                <td colspan="6" style="padding: 0; border: none;">
                    <div class="breakdown-container">
                        <div class="period-box">
                            <span class="period-label">Period !</span>
                            <span class="period-grade">${formatGrade(sub.p1)}</span>
                        </div>
                        <div class="period-box">
                            <span class="period-label">Period 2</span>
                            <span class="period-grade">${formatGrade(sub.p2)}</span>
                        </div>
                        <div class="period-box">
                            <span class="period-label">Period 3</span>
                            <span class="period-grade">${formatGrade(sub.p3)}</span>
                        </div>
                        <div class="period-box highlight">
                            <span class="period-label">Final Grade</span>
                            <span class="period-grade">${gradeDisplay}</span>
                        </div>
                    </div>
                </td>
            `;

            // --- 3. Click Event to Toggle Dropdown ---
            tr.onclick = () => {
                const icon = tr.querySelector('.toggle-icon');
                if (breakdownTr.style.display === 'none') {
                    // Open it
                    breakdownTr.style.display = 'table-row';
                    icon.classList.replace('bx-chevron-right', 'bx-chevron-down');
                    tr.style.backgroundColor = '#f8fafc'; // Slight highlight when open
                } else {
                    // Close it
                    breakdownTr.style.display = 'none';
                    icon.classList.replace('bx-chevron-down', 'bx-chevron-right');
                    tr.style.backgroundColor = ''; // Remove highlight
                }
            };

            // Append both rows to the table
            tbody.appendChild(tr);
            tbody.appendChild(breakdownTr);
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

