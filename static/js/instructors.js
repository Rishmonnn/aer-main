document.addEventListener('DOMContentLoaded', function() {
    const gridContainer = document.getElementById('facultyGrid');
    if (!gridContainer) return; 

    // --- Config ---
    const FULL_LOAD_THRESHOLD = 24; 
    const START_HOUR = 7; 
    const END_HOUR = 20;  
    const TIME_SLOTS_PER_HOUR = 2; 

    // --- MAIN FACULTY DATA ---
    let facultyData = [];
    let registeredTeachers = [];

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
        if (!timeStr) return 0;
        const parts = timeStr.split(' ');
        if (parts.length < 2) return 0;
        const time = parts[0];
        const modifier = parts[1];
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    }

    // --- THE FIX: DYNAMICALLY PROCESS REAL IMPORTED SCHEDULES ---
    function processEventsIntoFaculty(events) {
        let facultyMap = {};
        events.forEach(ev => {
            let facName = ev.extendedProps.faculty;
            // Skip if no faculty is assigned or if it's TBA
            if (!facName || facName.trim() === '' || facName.toUpperCase() === 'TBA') return; 
            
            if (!facultyMap[facName]) {
                facultyMap[facName] = {
                    id: facName,
                    name: facName,
                    department: 'Computer Engineering',
                    classes: 0,
                    lec: 0,
                    lab: 0,
                    schedule: []
                };
            }
            
            // Safely calculate exact hours
            let start = new Date(ev.start);
            let end = new Date(ev.end);
            let hours = (end - start) / (1000 * 60 * 60);
            if (isNaN(hours)) hours = 0;
            
            let isLab = ev.extendedProps.type.toLowerCase().includes('lab');
            if (isLab) facultyMap[facName].lab += hours;
            else facultyMap[facName].lec += hours;
            
            facultyMap[facName].classes += 1;
            
            // Calculate day index (Mon=0 ... Sun=6)
            let dayIdx = start.getDay() - 1;
            if (dayIdx < 0) dayIdx = 6;
            
            const formatTime = (d) => {
                let h = d.getHours();
                let m = String(d.getMinutes()).padStart(2, '0');
                let ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12;
                h = h ? h : 12;
                return `${h}:${m} ${ampm}`;
            };
            const daysLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            
            facultyMap[facName].schedule.push({
                subjectCode: ev.extendedProps.code,
                subjectDesc: ev.title,
                room: ev.extendedProps.room || 'TBA',
                startTime: formatTime(start),
                endTime: formatTime(end),
                dayIndex: dayIdx,
                dayLong: daysLong[dayIdx],
                type: isLab ? 'Lab' : 'Lec'
            });
        });
        
        // Return sorted alphabetically by name
        return Object.values(facultyMap).sort((a,b) => a.name.localeCompare(b.name));
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
        
        modalHeaderHours.innerHTML = `
            <span style="opacity:0.9;">${(teacher.lec + teacher.lab).toFixed(1)}</span>
            <span style="font-size:0.7rem; margin-left:8px; opacity:0.7;">(L: ${teacher.lec.toFixed(1)} | Lab: ${teacher.lab.toFixed(1)})</span>
        `;

        // Load the REAL schedule
        const schedule = teacher.schedule || [];
        
        buildGridStructure();
        
        schedule.forEach(cls => {
            const startMin = parseTime(cls.startTime);
            const endMin = parseTime(cls.endTime);
            const startGridMin = START_HOUR * 60;
            
            if (startMin === 0 || endMin === 0) return; 

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
        if(schedule.length === 0) { 
            listHtml = '<tr><td colspan="4">No classes scheduled.</td></tr>';
        } else {
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
        if (!gridContainer) return;
        gridContainer.innerHTML = "";
        
        // 1. SAFE HANDLING FOR NO DATA
        if (!data || data.length === 0) {
            // Reset the top stats to 0 safely
            updateStats([]);
            
            // Inject a beautifully styled empty state directly into the grid
            gridContainer.innerHTML = `
                <div class="empty-state-container" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; background: white; border-radius: 12px; border: 1px dashed #cbd5e1; text-align: center; margin-top: 20px;">
                    <div style="background: #f1f5f9; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                        <i class='bx bx-user-x' style="font-size: 3rem; color: #94a3b8;"></i>
                    </div>
                    <h3 style="margin: 0 0 10px 0; color: #334155; font-size: 1.5rem;">No Instructors Available</h3>
                    <p style="margin: 0 0 24px 0; color: #64748b; max-width: 400px; line-height: 1.5;">Your faculty list is currently empty. You can add instructors manually or import your schedule in the Schedules tab to generate them automatically.</p>
                    <button class="btn-primary" onclick="document.getElementById('btnAddTeacher').click()" style="padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; background: var(--maroon); color: white; display: flex; align-items: center; gap: 8px;">
                        <i class='bx bx-plus'></i> Add Instructor Manually
                    </button>
                </div>
            `;
            return;
        }
        
        // 2. RENDER ACTUAL DATA
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
                            <span class="lb-lec">Lec: ${teacher.lec.toFixed(1)}</span>
                            <span class="lb-lab">Lab: ${teacher.lab.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            `;
            gridContainer.appendChild(card);
        });
        
        // Update stats with real data
        updateStats(data);
    }

    function updateStats(data) {
        if (!totalFacultyEl || !totalClassesEl || !totalHoursEl) return;
        
        // Failsafe: If data is empty, set everything to 0
        if (!data || data.length === 0) {
            totalFacultyEl.textContent = "0";
            totalClassesEl.textContent = "0";
            totalHoursEl.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.2;">
                    <span style="font-weight:800; font-size:1.3rem; color:var(--text-main);">0.0</span>
                    <div style="display:flex; gap:5px; font-size:0.75rem;">
                        <span style="color:var(--text-light);">L: <b>0.0</b></span>
                        <span style="color:#cbd5e1;">|</span>
                        <span style="color:var(--text-light);">Lb: <b>0.0</b></span>
                    </div>
                </div>
            `;
            return;
        }

        // Calculate real stats
        totalFacultyEl.textContent = data.length;
        totalClassesEl.textContent = data.reduce((sum, t) => sum + t.classes, 0);
        const totalLec = data.reduce((sum, t) => sum + t.lec, 0);
        const totalLab = data.reduce((sum, t) => sum + t.lab, 0);
        
        totalHoursEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.2;">
                <span style="font-weight:800; font-size:1.3rem; color:var(--text-main);">${(totalLec + totalLab).toFixed(1)}</span>
                <div style="display:flex; gap:5px; font-size:0.75rem;">
                    <span style="color:var(--text-light);">L: <b>${totalLec.toFixed(1)}</b></span>
                    <span style="color:#cbd5e1;">|</span>
                    <span style="color:var(--text-light);">Lb: <b>${totalLab.toFixed(1)}</b></span>
                </div>
            </div>
        `;
    }

    // --- ALL OTHER EXISTING LISTENERS ---
    function fetchRegisteredFaculty() {
        registeredTeachersList.innerHTML = "<p style='text-align:center; padding:10px;'>Loading faculty...</p>";
        fetch('/api/users/faculty')
            .then(async response => {
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") === -1) {
                    throw new Error("Server returned HTML instead of JSON.");
                }
                return response.json();
            })
            .then(data => {
                const existingIds = facultyData.map(f => f.id);
                registeredTeachers = data.filter(teacher => !existingIds.includes(teacher.id));
                renderRegisteredTeachers(searchRegistered ? searchRegistered.value : "");
            })
            .catch(err => {
                console.error('Detailed Fetch Error:', err);
                registeredTeachersList.innerHTML = `<p style='color: #a00; text-align:center; font-size: 0.9rem; padding: 10px;'><b>Error:</b> Could not connect to database.</p>`;
            });
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
                <button class="btn-add-teacher" onclick="window.addTeacherToDept('${teacher.id}')"><i class='bx bx-plus'></i> Add</button>
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
            teacher.classes = 0; teacher.lec = 0.0; teacher.lab = 0.0; teacher.schedule = [];
            facultyData.push(teacher);
            renderFaculty(facultyData);
            renderRegisteredTeachers(searchRegistered.value);
        }
    };

    if (closeModalBtn) closeModalBtn.onclick = () => scheduleModal.style.display = 'none';
    if (btnAddTeacher) {
        btnAddTeacher.onclick = () => { 
            fetchRegisteredFaculty();
            addTeacherModal.style.display = 'flex';
        };
    }
    if (closeAddModalBtn) closeAddModalBtn.onclick = () => addTeacherModal.style.display = 'none';
    
    if (searchRegistered) {
        searchRegistered.addEventListener('input', (e) => renderRegisteredTeachers(e.target.value));
    }
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = facultyData.filter(t => t.name.toLowerCase().includes(term));
            renderFaculty(filtered);
        });
    }
    window.onclick = function(event) { 
        if (event.target == scheduleModal) scheduleModal.style.display = 'none';
        if (event.target == addTeacherModal) addTeacherModal.style.display = 'none';
    }

    // --- CROSS-TAB COMMUNICATION LOGIC ---
    window.updateInstructorsFromImport = function(events) {
        localStorage.setItem('aeris_imported_schedule', JSON.stringify(events));
        facultyData = processEventsIntoFaculty(events);
        renderFaculty(facultyData);
    };

    // Initial Page Load
    function loadInitialData() {
        const savedEvents = localStorage.getItem('aeris_imported_schedule');
        
        if (savedEvents && savedEvents.length > 5) {
            // Found real data from the Excel import memory
            try {
                const parsedEvents = JSON.parse(savedEvents);
                facultyData = processEventsIntoFaculty(parsedEvents);
                if (facultyData.length > 0) {
                    renderFaculty(facultyData);
                } else {
                    gridContainer.innerHTML = "<div style='grid-column: span 3; text-align: center; padding: 40px;'><h3>No Faculty Found in Import</h3><p>Your Excel file was processed, but no valid faculty names were found in the Faculty column.</p></div>";
                }
            } catch (e) {
                console.error("Could not parse saved schedule data:", e);
                fetchFromAPI();
            }
        } else {
            // No local storage data, fall back to API
            fetchFromAPI();
        }
    }

    function fetchFromAPI() {
        fetch('/api/instructors')
            .then(response => {
                if(!response.ok) throw new Error("API failed");
                return response.json();
            })
            .then(data => {
                if (data && data.length > 0) {
                    facultyData = data;
                    renderFaculty(facultyData);
                } else {
                    gridContainer.innerHTML = "<div style='color: #777; grid-column: span 3; text-align: center; padding: 40px; background: white; border-radius: 8px;'><h3>No Faculty Members Found</h3><p>Import your class schedule Excel file in the Schedules tab first to generate the faculty list.</p></div>";
                }
            })
            .catch(err => {
                console.error("API error:", err);
                // CRITICAL: Pass an empty array so the Empty State triggers safely!
                renderFaculty([]); 
            });
    }

    // Start up
    loadInitialData();
    window.addEventListener('storage', function(e) {
        if (e.key === 'aeris_imported_schedule' && e.newValue) {
            try {
                const parsedEvents = JSON.parse(e.newValue);
                facultyData = processEventsIntoFaculty(parsedEvents);
                renderFaculty(facultyData);
            } catch (err) {
                console.error("Error reading updated schedule from storage:", err);
            }
        }
    });
});