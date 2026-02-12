document.addEventListener('DOMContentLoaded', function() {
    
    const gridContainer = document.getElementById('facultyGrid');
    if (!gridContainer) return; 

    // --- Config ---
    const FULL_LOAD_THRESHOLD = 24; 
    const START_HOUR = 7; 
    const END_HOUR = 20;  
    const TIME_SLOTS_PER_HOUR = 2; 

    // --- MAIN FACULTY DATA (Fetched from API) ---
    let facultyData = [];

    let registeredTeachers = [
        { id: 101, name: "BAUTISTA, RYAN", department: "General Education" },
        { id: 102, name: "LOPEZ, JESSICA", department: "Mathematics" },
        { id: 103, name: "TAN, DAVID", department: "Engineering" },
        { id: 104, name: "GONZALES, MARK", department: "Physics" },
        { id: 105, name: "RAMOS, SARAH", department: "General Education" }
    ];

    // --- DOM Elements ---
    const searchInput = document.getElementById('searchInput');
    const totalFacultyEl = document.getElementById('total-faculty');
    const totalClassesEl = document.getElementById('total-classes');
    const totalHoursEl = document.getElementById('total-hours'); 
    
    // Modal Elements
    const scheduleModal = document.getElementById('scheduleModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTeacherName = document.getElementById('modalTeacherName');
    const modalTeacherDept = document.getElementById('modalTeacherDept');
    const modalHeaderClasses = document.getElementById('modalHeaderClasses');
    const modalHeaderHours = document.getElementById('modalHeaderHours');
    const calendarGrid = document.getElementById('calendarGrid');
    const modalClassListBody = document.getElementById('modalClassListBody');

    // Add Modal Elements
    const btnAddTeacher = document.getElementById('btnAddTeacher');
    const addTeacherModal = document.getElementById('addTeacherModal');
    const closeAddModalBtn = document.getElementById('closeAddModalBtn');
    const registeredTeachersList = document.getElementById('registeredTeachersList');
    const searchRegistered = document.getElementById('searchRegistered');

    function parseTime(timeStr) {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    }

    function getTeacherSchedule(teacherId) {
        const subjects = [
            { code: 'CPE 101', desc: 'Intro to CPE' }, 
            { code: 'CPE 102', desc: 'Programming Logic' },
            { code: 'MATH 101', desc: 'Calculus I' }, 
            { code: 'PHYS 101', desc: 'Engineering Physics' },
            { code: 'CPE 301', desc: 'Computer Networks' }, 
            { code: 'CPE 402', desc: 'Software Design' }
        ];
        const rooms = ['Room 301', 'Comp Lab 1', 'Comp Lab 2', 'AVR', 'Room 405'];
        const scheduleOptions = [
            { start: '7:30 AM', end: '1:00 PM' }, { start: '9:00 AM', end: '12:00 PM' },
            { start: '1:00 PM', end: '4:00 PM' }, { start: '7:30 AM', end: '9:00 AM' },
            { start: '4:00 PM', end: '7:00 PM' }
        ];
        const daysLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        let schedule = [];
        const numClasses = 3 + (teacherId % 3); 
        
        for(let i=0; i<numClasses; i++) {
            const timeOpt = scheduleOptions[(teacherId + i) % scheduleOptions.length];
            const dayIndex = (teacherId + i) % 6;
            const subjectObj = subjects[(teacherId + i) % subjects.length];
            const duration = parseTime(timeOpt.end) - parseTime(timeOpt.start);
            const isLab = duration > 180 || Math.random() > 0.6;
            const type = isLab ? 'Lab' : 'Lec';

            schedule.push({
                subjectCode: subjectObj.code, subjectDesc: subjectObj.desc,
                room: rooms[(teacherId + i) % rooms.length],
                startTime: timeOpt.start, endTime: timeOpt.end,
                dayIndex: dayIndex, dayLong: daysLong[dayIndex],
                type: type 
            });
        }
        return schedule;
    }

    function buildGridStructure() {
        calendarGrid.innerHTML = '';
        const days = ['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(day => {
            const div = document.createElement('div');
            div.className = 'grid-header';
            div.textContent = day;
            calendarGrid.appendChild(div);
        });
        const totalRows = (END_HOUR - START_HOUR) * TIME_SLOTS_PER_HOUR;
        for (let i = 0; i < totalRows; i++) {
            const minutesFromStart = i * 30;
            const hour = START_HOUR + Math.floor(minutesFromStart / 60);
            const mins = minutesFromStart % 60;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : hour;
            const timeLabel = `${displayHour}:${mins === 0 ? '00' : '30'} ${ampm}`;
            const timeCell = document.createElement('div');
            timeCell.className = 'time-label';
            timeCell.textContent = timeLabel;
            timeCell.style.gridColumn = '1';
            timeCell.style.gridRow = `${i + 2}`;
            calendarGrid.appendChild(timeCell);
            for (let d = 0; d < 6; d++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.style.gridColumn = `${d + 2}`;
                cell.style.gridRow = `${i + 2}`;
                calendarGrid.appendChild(cell);
            }
        }
    }

    function renderModalContent(teacher) {
        modalTeacherName.textContent = teacher.name;
        modalTeacherDept.textContent = teacher.department;
        modalHeaderClasses.textContent = teacher.classes;
        
        // Professional Header Split
        modalHeaderHours.innerHTML = `
            <span style="opacity:0.9;">${(teacher.lec + teacher.lab).toFixed(1)}</span>
            <span style="font-size:0.7rem; margin-left:8px; opacity:0.7;">(L: ${teacher.lec} | Lab: ${teacher.lab})</span>
        `;
        
        const schedule = getTeacherSchedule(teacher.id);
        buildGridStructure();
        
        schedule.forEach(cls => {
            const startMin = parseTime(cls.startTime);
            const endMin = parseTime(cls.endTime);
            const startGridMin = START_HOUR * 60;
            const startRow = Math.floor((startMin - startGridMin) / 30) + 2;
            const durationMin = endMin - startMin;
            const spanRows = Math.ceil(durationMin / 30);
            const col = cls.dayIndex + 2;
            const typeClass = cls.type === 'Lab' ? 'is-lab' : 'is-lec';

            const eventDiv = document.createElement('div');
            eventDiv.className = `class-event-block ${typeClass}`;
            eventDiv.innerHTML = `
                <div class="subj">${cls.subjectCode}</div>
                <div class="time-range">${cls.startTime} - ${cls.endTime}</div>
                <div class="room">${cls.room}</div>
            `;
            eventDiv.style.gridColumn = `${col}`;
            eventDiv.style.gridRow = `${startRow} / span ${spanRows}`;
            calendarGrid.appendChild(eventDiv);
        });

        let listHtml = '';
        if(schedule.length === 0) { listHtml = '<tr><td colspan="4">No classes scheduled.</td></tr>'; } 
        else {
            schedule.sort((a, b) => a.dayIndex - b.dayIndex);
            schedule.forEach(cls => {
                const badgeClass = cls.type === 'Lab' ? 'lb-lab' : 'lb-lec';
                listHtml += `
                    <tr>
                        <td>
                            <div style="font-weight:700; color:var(--text-main);">${cls.subjectCode}</div>
                            <span class="${badgeClass}">${cls.type}</span>
                        </td>
                        <td>${cls.subjectDesc}</td>
                        <td>${cls.dayLong} ${cls.startTime}-${cls.endTime}</td>
                        <td>${cls.room}</td>
                    </tr>`;
            });
        }
        modalClassListBody.innerHTML = listHtml;
    }

    function renderFaculty(data) {
        gridContainer.innerHTML = "";
        if (!data || data.length === 0) {
            gridContainer.innerHTML = "<p style='color: #777; grid-column: span 3;'>No faculty members found.</p>";
            return;
        }
        data.forEach(teacher => {
            const totalLoad = teacher.lec + teacher.lab;
            const isFullLoad = totalLoad >= FULL_LOAD_THRESHOLD;
            const statusBadge = isFullLoad ? `<div class="full-load-badge">FULL LOAD</div>` : '';
            
            const card = document.createElement('div');
            card.className = 'faculty-card';
            card.onclick = () => { renderModalContent(teacher); scheduleModal.style.display = 'flex'; };
            
            card.innerHTML = `
                ${statusBadge}
                <div class="card-header">
                    <div class="avatar"><i class='bx bx-user'></i></div>
                    <div class="info"><h3>${teacher.name}</h3><div class="dept-badge"><i class='bx bx-bookmark'></i> ${teacher.department}</div></div>
                </div>
                <div class="card-stats">
                    <div class="stat-row">
                        <span><i class='bx bx-book-open'></i> Classes:</span>
                        <span class="stat-value">${teacher.classes}</span>
                    </div>
                    <div class="stat-row">
                        <span><i class='bx bx-time-five'></i> Load:</span>
                        <div class="load-breakdown">
                            <span class="lb-lec">Lec: ${teacher.lec}</span>
                            <span class="lb-lab">Lab: ${teacher.lab}</span>
                        </div>
                    </div>
                </div>
            `;
            gridContainer.appendChild(card);
        });
        updateStats(data);
    }

    function renderRegisteredTeachers(filter = "") {
        registeredTeachersList.innerHTML = "";
        const term = filter.toLowerCase();
        const filtered = registeredTeachers.filter(t => t.name.toLowerCase().includes(term));
        if (filtered.length === 0) {
            registeredTeachersList.innerHTML = "<p style='text-align:center; color:#777; padding:10px;'>No matching teachers found.</p>";
            return;
        }
        filtered.forEach(teacher => {
            const div = document.createElement('div');
            div.className = 'teacher-select-item';
            div.innerHTML = `
                <div class="tsi-left">
                    <div class="tsi-avatar"><i class='bx bx-user'></i></div>
                    <div class="tsi-info"><h4>${teacher.name}</h4><p>${teacher.department}</p></div>
                </div>
                <button class="btn-add-teacher" onclick="window.addTeacherToDept(${teacher.id})"><i class='bx bx-plus'></i> Add</button>
            `;
            registeredTeachersList.appendChild(div);
        });
    }

    window.addTeacherToDept = function(id) {
        const index = registeredTeachers.findIndex(t => t.id === id);
        if (index > -1) {
            const teacher = registeredTeachers[index];
            registeredTeachers.splice(index, 1);
            teacher.department = "Computer Engineering"; 
            teacher.classes = 0; teacher.lec = 0.0; teacher.lab = 0.0;
            facultyData.push(teacher);
            renderFaculty(facultyData);
            renderRegisteredTeachers(searchRegistered.value);
        }
    };

    if (closeModalBtn) closeModalBtn.onclick = () => scheduleModal.style.display = 'none';
    if (btnAddTeacher) {
        btnAddTeacher.onclick = () => { renderRegisteredTeachers(); addTeacherModal.style.display = 'flex'; };
    }
    if (closeAddModalBtn) closeAddModalBtn.onclick = () => addTeacherModal.style.display = 'none';
    if (searchRegistered) {
        searchRegistered.addEventListener('input', (e) => renderRegisteredTeachers(e.target.value));
    }
    window.onclick = function(event) { 
        if (event.target == scheduleModal) scheduleModal.style.display = 'none'; 
        if (event.target == addTeacherModal) addTeacherModal.style.display = 'none';
    }

    function updateStats(data) {
        if (!totalFacultyEl) return;
        totalFacultyEl.textContent = data.length;
        totalClassesEl.textContent = data.reduce((sum, t) => sum + t.classes, 0);
        
        const totalLec = data.reduce((sum, t) => sum + t.lec, 0);
        const totalLab = data.reduce((sum, t) => sum + t.lab, 0);
        
        // Professional Top Stats Display
        totalHoursEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.2;">
                <span style="font-weight:800; font-size:1.3rem; color:var(--text-main);">${(totalLec + totalLab).toFixed(1)}</span>
                <div style="display:flex; gap:5px; font-size:0.75rem;">
                    <span style="color:var(--text-light);">L: <b>${totalLec}</b></span>
                    <span style="color:#cbd5e1;">|</span>
                    <span style="color:var(--text-light);">Lb: <b>${totalLab}</b></span>
                </div>
            </div>
        `;
    }

    // --- FETCH DATA FROM SERVER ---
    fetch('/api/instructors')
        .then(response => response.json())
        .then(data => {
            facultyData = data;
            renderFaculty(facultyData);
        })
        .catch(err => {
            console.error('Error fetching instructors:', err);
            gridContainer.innerHTML = "<p style='color: #a00; grid-column: span 3;'>Error loading data.</p>";
        });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = facultyData.filter(t => t.name.toLowerCase().includes(term));
            renderFaculty(filtered);
        });
    }
});