const ClassRecords = (function() {
    
    // --- STATE ---
    let currentPeriod = 'p1';
    let configMode = 'p1';
    let currentReviewId = null;

    // --- MOCK DATA FOR MAIN VIEW ---
    let studentInfoData = [];

    let attendanceRecords = {};
    const TOTAL_SESSIONS = 14;

    let approvalQueue = [];
    let reviewData = [];

    // --- CONFIG & SCORES ---
    const defaultCategories = [
        { id: 'activities', name: 'Other Activities', weight: 10, items: [{ id: 'act1', name: 'Activity 1', max: 10 }, { id: 'act2', name: 'Activity 2', max: 10 }] },
        { id: 'seatworks', name: 'Seat Works', weight: 20, items: [{ id: 'sw1', name: 'Seatwork 1', max: 100 }] },
        { id: 'quizzes', name: 'Quizzes', weight: 30, items: [{ id: 'qz1', name: 'Quiz 1', max: 100 }, { id: 'qz2', name: 'Quiz 2', max: 100 }] },
        { id: 'exam', name: 'Periodical Exam', weight: 40, items: [{ id: 'exam1', name: 'Exam', max: 52 }] }
    ];
    const clone = (obj) => JSON.parse(JSON.stringify(obj));
    let gradeConfig = {
        passingGrade: 60,
        periodWeights: { p1: 33, p2: 33, p3: 34 },
        periods: { p1: clone(defaultCategories), p2: clone(defaultCategories), p3: clone(defaultCategories) }
    };
    let scores = {};
// --- NEW STATE VARIABLES ---
    let availableSections = [];

    function init() {
        console.log("Class Records Initialized");
        fetchSections(); // Fetch sections first instead of fetching all students
    }

    // --- NEW: Dynamic Dropdown Logic ---
    function fetchSections() {
        fetch('/api/faculty/sections')
            .then(res => res.json())
            .then(data => {
                availableSections = data;
                populateDropdowns();
            })
            .catch(err => console.error("Error loading sections:", err));
    }

    function populateDropdowns() {
        const subjectSelect = document.getElementById('cr-subject-select');
        const sectionSelect = document.getElementById('cr-section-select');
        if(!subjectSelect || !sectionSelect) return;

        subjectSelect.innerHTML = '';
        sectionSelect.innerHTML = '';

        if (availableSections.length === 0) {
            subjectSelect.innerHTML = '<option value="">No subjects assigned</option>';
            sectionSelect.innerHTML = '<option value="">No sections</option>';
            return;
        }

        // Get unique subjects handled by the user
        const uniqueSubjects = [];
        availableSections.forEach(sec => {
            if(!uniqueSubjects.some(s => s.code === sec.subject_code)) {
                uniqueSubjects.push({code: sec.subject_code, title: sec.subject_title});
            }
        });

        // Populate Subjects
        uniqueSubjects.forEach(sub => {
            subjectSelect.innerHTML += `<option value="${sub.code}">${sub.code} - ${sub.title}</option>`;
        });

        // Event Listeners
        subjectSelect.addEventListener('change', () => {
            updateSectionDropdown(subjectSelect.value);
        });
        
        sectionSelect.addEventListener('change', () => {
            const secId = sectionSelect.value;
            updateBanner(secId);
            fetchStudentsForSection(secId);
        });

        // Initialize view with first subject
        updateSectionDropdown(uniqueSubjects[0].code);
    }

    function updateSectionDropdown(subjectCode) {
        const sectionSelect = document.getElementById('cr-section-select');
        sectionSelect.innerHTML = '';
        
        const filteredSections = availableSections.filter(s => s.subject_code === subjectCode);
        filteredSections.forEach(sec => {
            sectionSelect.innerHTML += `<option value="${sec.id}">${sec.name}</option>`;
        });

        if (filteredSections.length > 0) {
            updateBanner(filteredSections[0].id);
            fetchStudentsForSection(filteredSections[0].id);
        } else {
            // Clear table if no sections
            studentInfoData = [];
            const infoBody = document.getElementById('cr-table-body');
            if (infoBody) renderInfoTable(infoBody);
        }
    }

    function updateBanner(sectionId) {
        const sec = availableSections.find(s => s.id == sectionId);
        if(!sec) return;
        
        const subElem = document.getElementById('cr-info-subject');
        const secElem = document.getElementById('cr-info-section');
        const facElem = document.getElementById('cr-info-faculty');
        const badgeElem = document.querySelector('.badge-subject');

        if(subElem) subElem.textContent = `${sec.subject_code} - ${sec.subject_title}`;
        if(secElem) secElem.textContent = sec.name;
        if(facElem) facElem.textContent = sec.faculty_name || 'TBA';
        if(badgeElem) badgeElem.textContent = sec.subject_code;
    }

    // --- UPDATED: Fetch Students Based on Section ---
    function fetchStudentsForSection(sectionId) {
        fetch(`/api/faculty/class-records/sections/${sectionId}/students`) 
            .then(response => response.json())
            .then(data => {
                studentInfoData = data.map(s => ({
                    id: s.id,
                    name: s.name,
                    course: s.program,
                    year: s.year_level,
                    gmail: s.email
                }));

                studentInfoData.forEach(student => {
                    if (!attendanceRecords[student.id]) {
                        attendanceRecords[student.id] = Array(TOTAL_SESSIONS).fill('P');
                    }
                });
                
                const infoBody = document.getElementById('cr-table-body');
                if (infoBody) renderInfoTable(infoBody);

                const attBody = document.getElementById('cr-attendance-body');
                if (attBody) renderAttendanceTable(attBody);

                switchPeriod('p1');
                renderApprovalQueue();
            })
            .catch(error => console.error('Error fetching students:', error));
    }

    // --- NAVIGATION ---
    function switchMainTab(tabName, btnElement) {
        document.querySelectorAll('.cr-nav-pill').forEach(b => { b.classList.remove('active'); b.classList.add('inactive'); });
        btnElement.classList.remove('inactive'); btnElement.classList.add('active');
        if (tabName === 'records') {
            document.getElementById('cr-main-view').style.display = 'block';
            document.getElementById('cr-approval-view').style.display = 'none';
        } else {
            document.getElementById('cr-main-view').style.display = 'none';
            document.getElementById('cr-approval-view').style.display = 'block';
        }
    }

    function switchSubTab(tabName, btnElement) {
        document.querySelectorAll('.cr-sub-tabs .tab-item').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        
        ['info', 'attendance', 'grades'].forEach(v => document.getElementById(`cr-view-${v}`).style.display = 'none');
        document.getElementById(`cr-view-${tabName}`).style.display = 'block';

        // --- NEW LOGIC: Toggle Send for Approval Button ---
        const btnSendApproval = document.getElementById('btn-send-approval');
        if (btnSendApproval) {
            if (tabName === 'grades') {
                // Show the button when on Grades (using 'flex' to keep the icon aligned properly)
                btnSendApproval.style.display = 'flex'; 
            } else {
                // Hide the button on Student Info and Attendance
                btnSendApproval.style.display = 'none'; 
            }
        }
    }

    function switchPeriod(period) {
        currentPeriod = period;
        document.querySelectorAll('.period-tabs-row .period-tab').forEach(btn => {
            btn.classList.remove('active');
            if(btn.dataset.period === period) btn.classList.add('active');
        });
        if (period === 'final') {
            const formulaBar = document.getElementById('grade-formula-bar');
            if(formulaBar) formulaBar.style.display = 'none';
            renderFinalSummary();
        } else {
            const formulaBar = document.getElementById('grade-formula-bar');
            if(formulaBar) formulaBar.style.display = 'flex';
            renderGradesTableStructure(period);
            updateFormulaBar(period);
        }
    }

    // --- RENDERING MAIN TABLES ---
    function renderInfoTable(tbody) {
        tbody.innerHTML = '';
        studentInfoData.forEach(student => {
            const tr = document.createElement('tr');
            
            // REMOVED: Logic for icons and links
            // Simple data display only
            tr.innerHTML = `
                <td style="font-weight:600">${student.id}</td>
                <td>${student.name}</td>
                <td><span class="course-badge">${student.course || 'N/A'}</span></td>
                <td>${student.year || 'N/A'}</td>
                <td>${student.gmail || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    function renderAttendanceTable(tbody) {
        tbody.innerHTML = '';
        studentInfoData.forEach(student => {
            const tr = document.createElement('tr');
            
            // Fetch this student's specific attendance record
            const days = attendanceRecords[student.id] || Array(TOTAL_SESSIONS).fill('P');
            
            // Calculate how many times 'A' (Absent) appears
            const absentCount = days.filter(status => status === 'A').length;

            let badgeClass = 'absent-badge';
            if(absentCount === 0) badgeClass += ' zero';
            else if(absentCount >= 3) badgeClass += ' high';
            
            let dateCells = '';
            days.forEach((status, index) => {
                let pillClass = 'att-pill';
                if(status === 'P') pillClass += ' present';
                else if(status === 'A') pillClass += ' absent';
                else if(status === 'L') pillClass += ' late';
                
                // NEW: Added onclick toggle and a pointer cursor
                dateCells += `<td class="text-center">
                    <span class="${pillClass}" style="cursor: pointer; user-select: none;" 
                          onclick="ClassRecords.toggleAttendance('${student.id}', ${index})">${status}</span>
                </td>`;
            });

            tr.innerHTML = `
                <td class="sticky-col first-col" style="font-weight:600">${student.id}</td>
                <td class="sticky-col second-col">${student.name}</td>
                <td><span class="course-badge">${student.course || 'N/A'}</span></td>
                <td>${student.year || 'N/A'}</td>
                <td class="text-center"><span class="${badgeClass}">${absentCount}</span></td>
                ${dateCells}
            `;
            tbody.appendChild(tr);
        });
    }
    // --- NEW: Toggle Attendance Status ---
    function toggleAttendance(studentId, dayIndex) {
        const currentStatus = attendanceRecords[studentId][dayIndex];
        let nextStatus = 'P';
        
        // Cycle the status: Present (P) -> Absent (A) -> Late (L) -> Present (P)
        if (currentStatus === 'P') nextStatus = 'A';
        else if (currentStatus === 'A') nextStatus = 'L';
        else if (currentStatus === 'L') nextStatus = 'P';

        // Update the array
        attendanceRecords[studentId][dayIndex] = nextStatus;
        
        // Instantly refresh the table to show the new color and updated absent count
        const attBody = document.getElementById('cr-attendance-body');
        if (attBody) renderAttendanceTable(attBody);
    }

    function renderGradesTableStructure(period) {
        const thead = document.getElementById('grades-table-head');
        const tbody = document.getElementById('cr-grades-body');
        document.querySelector('.grades-table').classList.remove('final-summary-table');
        const currentCategories = gradeConfig.periods[period];
        let headerHTML = `<tr><th class="sticky-col first-col">Student ID</th><th class="sticky-col second-col">Name</th><th style="width:60px;">Course</th><th style="width:50px;">Year</th>`;
        currentCategories.forEach(cat => {
            cat.items.forEach(item => { headerHTML += `<th class="text-center col-input-head">${item.name}<br><span class="sub-head">(Max: ${item.max})</span></th>`; });
            headerHTML += `<th class="text-center col-calc-head">${cat.name}<br><span class="sub-head">(${cat.weight}%)</span></th>`;
        });
        const pLabel = period === 'p1' ? 'Period 1' : (period === 'p2' ? 'Period 2' : 'Period 3');
        headerHTML += `<th class="text-center col-final-head">${pLabel}<br>Grade</th><th class="text-center col-final-head">Status</th></tr>`;
        thead.innerHTML = headerHTML;
        tbody.innerHTML = '';
        studentInfoData.forEach(student => {
            const tr = document.createElement('tr');
            let rowHTML = `<td class="sticky-col first-col" style="font-weight:600">${student.id}</td><td class="sticky-col second-col">${student.name}</td><td><span class="course-badge">${student.course || 'CPE'}</span></td><td>${student.year || '3rd'}</td>`;
            currentCategories.forEach(cat => {
                cat.items.forEach(item => {
                    const key = `${student.id}_${period}_${cat.id}_${item.id}`;
                    const val = scores[key] || '';
                    rowHTML += `<td class="text-center"><input type="text" class="grade-input ${val !== '' ? 'filled' : ''}" data-max="${item.max}" id="${key}" value="${val}" oninput="ClassRecords.handleInput(this, '${student.id}')"></td>`;
                });
                rowHTML += `<td class="text-center calc-val" id="cat_total_${student.id}_${cat.id}">0.0%</td>`;
            });
            rowHTML += `<td class="text-center final-grade" id="period_grade_${student.id}">0.00</td><td class="text-center"><span class="status-pill failed" id="period_status_${student.id}">FAILED</span></td>`;
            tr.innerHTML = rowHTML;
            tbody.appendChild(tr);
            calculateStudentPeriodGrade(student.id, period);
        });
    }

    function renderFinalSummary() {
        const thead = document.getElementById('grades-table-head');
        const tbody = document.getElementById('cr-grades-body');
        document.querySelector('.grades-table').classList.add('final-summary-table');
        thead.innerHTML = `<tr><th class="sticky-col first-col">Student ID</th><th class="sticky-col second-col">Name</th><th>Course</th><th>Year</th><th class="text-center">Period 1<br><span class="sub-head">(${gradeConfig.periodWeights.p1}%)</span></th><th class="text-center">Period 2<br><span class="sub-head">(${gradeConfig.periodWeights.p2}%)</span></th><th class="text-center">Period 3<br><span class="sub-head">(${gradeConfig.periodWeights.p3}%)</span></th><th class="text-center col-final-head">Final Grade</th><th class="text-center col-final-head">Mark</th><th class="text-center col-final-head">Status</th></tr>`;
        tbody.innerHTML = '';
        studentInfoData.forEach(student => {
            const g1 = getCalculatedGrade(student.id, 'p1');
            const g2 = getCalculatedGrade(student.id, 'p2');
            const g3 = getCalculatedGrade(student.id, 'p3');
            const w1 = gradeConfig.periodWeights.p1 / 100;
            const w2 = gradeConfig.periodWeights.p2 / 100;
            const w3 = gradeConfig.periodWeights.p3 / 100;
            const finalGrade = (g1 * w1) + (g2 * w2) + (g3 * w3);
            const { mark, status, pillClass } = getMarkAndStatus(finalGrade);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="sticky-col first-col" style="font-weight:600">${student.id}</td><td class="sticky-col second-col">${student.name}</td><td><span class="course-badge">${student.course || 'CPE'}</span></td><td>${student.year || '3rd'}</td><td class="text-center highlight-period">${g1.toFixed(2)}</td><td class="text-center highlight-period">${g2.toFixed(2)}</td><td class="text-center highlight-period">${g3.toFixed(2)}</td><td class="text-center final-grade-text">${finalGrade.toFixed(2)}</td><td class="text-center" style="font-weight:600">${mark}</td><td class="text-center"><span class="${pillClass}">${status}</span></td>`;
            tbody.appendChild(tr);
        });
    }

    // --- APPROVAL ACTIONS ---
    function renderApprovalQueue() {
        const container = document.getElementById('approval-list-container');
        if (!container) return;
        container.innerHTML = approvalQueue.map(item => {
            let actionButtons = '';
            if (item.status === 'Pending') {
                actionButtons = `<button class="btn-review" onclick="ClassRecords.reviewItem(${item.id})">Review</button><button class="btn-approve" onclick="ClassRecords.approveItem(${item.id})">Approve</button>`;
            } else {
                actionButtons = `<span class="badge-approved"><i class='bx bx-check-circle'></i> Approved</span>`;
            }
            return `<div class="approval-card"><div class="ac-details"><h4>${item.subject}</h4><div class="ac-info">${item.info}</div><div class="ac-submitted">Submitted: ${item.date}</div></div><div class="ac-actions">${actionButtons}</div></div>`;
        }).join('');
    }

    function approveItem(id) {
        const item = approvalQueue.find(q => q.id === id);
        if (item) { item.status = 'Approved'; renderApprovalQueue(); alert(`${item.subject} has been approved.`); }
    }

    // --- REVIEW MODAL LOGIC ---
    function reviewItem(id) {
        currentReviewId = id;
        const item = approvalQueue.find(q => q.id === id);
        if (!item) return;

        // Populate Header
        document.getElementById('review-subject').textContent = `Grade Review: ${item.subject}`;
        document.getElementById('review-details').textContent = item.info;

        // Populate Table with Mock Review Data
        const tbody = document.getElementById('review-table-body');
        tbody.innerHTML = reviewData.map(row => {
            const badgeClass = row.status === 'PASSED' ? 'status-pill passed' : 'status-pill failed';
            
            return `
                <tr>
                    <td style="font-weight:600">${row.id}</td>
                    <td>${row.name}</td>
                    <td><span class="course-badge">${row.course}</span></td>
                    <td>${row.year}</td>
                    <td class="text-center review-score">${row.q1}</td>
                    <td class="text-center review-score">${row.q2}</td>
                    <td class="text-center review-score">${row.q3}</td>
                    <td class="text-center review-score">${row.mid}</td>
                    <td class="text-center review-score">${row.fin}</td>
                    <td class="text-center review-score">${row.proj}</td>
                    <td class="text-center review-final">${row.final}</td>
                    <td class="text-center"><span class="${badgeClass}">${row.status}</span></td>
                </tr>
            `;
        }).join('');

        document.getElementById('reviewModal').style.display = 'flex';
    }

    function closeReviewModal() {
        document.getElementById('reviewModal').style.display = 'none';
    }

    function approveFromReview() {
        if (currentReviewId) {
            approveItem(currentReviewId);
            closeReviewModal();
        }
    }

    // --- CALCULATION HELPERS ---
    function handleInput(input, studentId) {
        const max = parseFloat(input.dataset.max);
        let val = parseFloat(input.value);
        if (val > max) { input.value = max; val = max; }
        if (isNaN(val) && input.value !== "") val = 0;
        if(input.value === "") delete scores[input.id]; else scores[input.id] = val;
        if(input.value !== "") input.classList.add('filled'); else input.classList.remove('filled');
        calculateStudentPeriodGrade(studentId, currentPeriod);
    }

    function getCalculatedGrade(studentId, period) {
        let periodGrade = 0;
        const categories = gradeConfig.periods[period];
        categories.forEach(cat => {
            let totalScore = 0; let totalMax = 0;
            cat.items.forEach(item => {
                const key = `${studentId}_${period}_${cat.id}_${item.id}`;
                totalScore += (parseFloat(scores[key]) || 0);
                totalMax += item.max;
            });
            let percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
            periodGrade += (percentage * cat.weight) / 100;
        });
        return periodGrade;
    }

    function calculateStudentPeriodGrade(studentId, period) {
        const grade = getCalculatedGrade(studentId, period);
        const categories = gradeConfig.periods[period];
        categories.forEach(cat => {
            let totalScore = 0; let totalMax = 0;
            cat.items.forEach(item => {
                const key = `${studentId}_${period}_${cat.id}_${item.id}`;
                totalScore += (parseFloat(scores[key]) || 0);
                totalMax += item.max;
            });
            let percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
            let weighted = (percentage * cat.weight) / 100;
            const cell = document.getElementById(`cat_total_${studentId}_${cat.id}`);
            if(cell) cell.innerText = weighted.toFixed(1) + '%';
        });
        const finalCell = document.getElementById(`period_grade_${studentId}`);
        const statusCell = document.getElementById(`period_status_${studentId}`);
        if(finalCell) { finalCell.innerText = grade.toFixed(2); finalCell.className = `text-center final-grade ${grade >= gradeConfig.passingGrade ? 'passed' : 'failed'}`; }
        if(statusCell) { const passed = grade >= gradeConfig.passingGrade; statusCell.innerText = passed ? "PASSED" : "FAILED"; statusCell.className = `status-pill ${passed ? 'passed' : 'failed'}`; }
    }

    function getMarkAndStatus(grade) {
        let mark = "5.00"; let status = "FAILED"; let pillClass = "status-pill failed";
        if (grade >= 98) mark = "1.00"; else if (grade >= 95) mark = "1.25"; else if (grade >= 92) mark = "1.50"; else if (grade >= 89) mark = "1.75"; else if (grade >= 86) mark = "2.00"; else if (grade >= 83) mark = "2.25"; else if (grade >= 80) mark = "2.50"; else if (grade >= 77) mark = "2.75"; else if (grade >= 75) mark = "3.00";
        if (grade >= 75) { status = "PASSED"; pillClass = "status-pill passed"; }
        return { mark, status, pillClass };
    }

    function updateFormulaBar(period) {
        const bar = document.getElementById('grade-formula-bar');
        if(!bar) return;
        const categories = gradeConfig.periods[period];
        const pLabel = period === 'p1' ? 'Period 1' : (period === 'p2' ? 'Period 2' : 'Period 3');
        let badges = categories.map(c => `<span class="w-badge">${c.name}: ${c.weight}%</span>`).join('');
        bar.innerHTML = `<div class="formula-text"><strong>${pLabel} Configuration</strong></div><div class="weight-badges">${badges}</div>`;
    }

    // --- CONFIG MODAL ---
    function openConfigModal() { document.getElementById('gradeConfigModal').style.display = 'flex'; switchConfigMode(currentPeriod === 'final' ? 'p1' : currentPeriod); document.getElementById('conf-passing').value = gradeConfig.passingGrade; document.getElementById('conf-p1').value = gradeConfig.periodWeights.p1; document.getElementById('conf-p2').value = gradeConfig.periodWeights.p2; document.getElementById('conf-p3').value = gradeConfig.periodWeights.p3; }
    function closeConfigModal() { document.getElementById('gradeConfigModal').style.display = 'none'; }
    function switchConfigMode(period) { configMode = period; document.querySelectorAll('.conf-tab').forEach(b => { b.classList.remove('active'); if(b.dataset.period === period) b.classList.add('active'); }); renderConfigCategories(); }
    function renderConfigCategories() {
        const container = document.getElementById('config-categories-container'); container.innerHTML = '';
        const currentCats = gradeConfig.periods[configMode];
        currentCats.forEach((cat, catIndex) => {
            const catDiv = document.createElement('div'); catDiv.className = 'config-section';
            let itemsHTML = '';
            cat.items.forEach((item, itemIndex) => { itemsHTML += `<div class="config-item-row"><div class="drag-handle"><i class='bx bx-grid-vertical'></i></div><input type="text" class="item-name-input" value="${item.name}" onchange="ClassRecords.updateConfigItem(${catIndex}, ${itemIndex}, 'name', this.value)"><div class="item-max-group">Max: <input type="number" class="item-max-input" value="${item.max}" onchange="ClassRecords.updateConfigItem(${catIndex}, ${itemIndex}, 'max', this.value)"></div><button class="btn-del-item" onclick="ClassRecords.removeConfigItem(${catIndex}, ${itemIndex})"><i class='bx bx-trash'></i></button></div>`; });
            catDiv.innerHTML = `<div class="cat-header"><h4>${cat.name}</h4><input type="number" class="cat-weight-input" value="${cat.weight}" onchange="ClassRecords.updateConfigCat(${catIndex}, 'weight', this.value)"> %<button class="btn-add-item" style="margin-left:auto;" onclick="ClassRecords.addConfigItem(${catIndex})"><i class='bx bx-plus'></i> Add Item</button></div><div id="cat-items-${catIndex}">${itemsHTML}</div>`;
            container.appendChild(catDiv);
        });
    }
    function updateConfigItem(c, i, f, v) { gradeConfig.periods[configMode][c].items[i][f] = f==='max'?parseInt(v):v; }
    function updateConfigCat(c, f, v) { gradeConfig.periods[configMode][c][f] = parseInt(v); }
    function addConfigItem(c) { gradeConfig.periods[configMode][c].items.push({ id:`new_${Date.now()}`, name:'New Item', max:10}); renderConfigCategories(); }
    function removeConfigItem(c, i) { gradeConfig.periods[configMode][c].items.splice(i, 1); renderConfigCategories(); }
    function saveConfiguration() {
        let total = 0; gradeConfig.periods[configMode].forEach(c => total += c.weight);
        if(total !== 100) return alert(`Total weights for ${configMode.toUpperCase()} must be 100%. Current: ${total}%`);
        gradeConfig.passingGrade = parseInt(document.getElementById('conf-passing').value);
        gradeConfig.periodWeights.p1 = parseInt(document.getElementById('conf-p1').value);
        gradeConfig.periodWeights.p2 = parseInt(document.getElementById('conf-p2').value);
        gradeConfig.periodWeights.p3 = parseInt(document.getElementById('conf-p3').value);
        closeConfigModal(); switchPeriod(currentPeriod); alert("Configuration Saved!");
    }
    function resetGrades() { if(confirm("Reset grades?")) { scores={}; switchPeriod(currentPeriod); } }

    return {
        init, switchMainTab, switchSubTab, switchPeriod, handleInput,
        openConfigModal, closeConfigModal, saveConfiguration, switchConfigMode,
        addConfigItem, removeConfigItem, updateConfigItem, updateConfigCat, resetGrades,
        reviewItem, approveItem, closeReviewModal, approveFromReview, toggleAttendance
    };
})();


document.addEventListener('DOMContentLoaded', ClassRecords.init);