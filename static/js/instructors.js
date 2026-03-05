document.addEventListener('DOMContentLoaded', function() {
    try {
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
        const searchInput = document.getElementById('searchInput');

        // FORCE RENDER INITIAL EMPTY STATE IMMEDIATELY (Prevents white screen)
        updateStats([]);

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

        // --- MISSING MODAL FUNCTIONS RESTORED ---
        function buildGridStructure() {
            if (!calendarGrid) return;
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
            if (modalTeacherName) modalTeacherName.textContent = teacher.name || 'Unknown';
            if (modalTeacherDept) modalTeacherDept.textContent = teacher.department || 'Computer Engineering';
            if (modalHeaderClasses) modalHeaderClasses.textContent = teacher.classes || 0;
            
            const lecHours = parseFloat(teacher.lec) || 0;
            const labHours = parseFloat(teacher.lab) || 0;
            
            if (modalHeaderHours) {
                modalHeaderHours.innerHTML = `
                    <span style="opacity:0.9;">${(lecHours + labHours).toFixed(1)}</span>
                    <span style="font-size:0.7rem; margin-left:8px; opacity:0.7;">(L: ${lecHours.toFixed(1)} | Lab: ${labHours.toFixed(1)})</span>
                `;
            }

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
                if (calendarGrid) calendarGrid.appendChild(eventDiv);
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
            if (modalClassListBody) modalClassListBody.innerHTML = listHtml;
        }
        // --- END RESTORED MODAL FUNCTIONS ---

        function processEventsIntoFaculty(events) {
            let facultyMap = {};
            if (!Array.isArray(events)) return []; 

            events.forEach(ev => {
                if (!ev || !ev.extendedProps) return;
                const props = ev.extendedProps;
                let facName = props.faculty;
                
                if (!facName || typeof facName !== 'string' || facName.trim() === '' || facName.toUpperCase() === 'TBA') return; 
                
                if (!facultyMap[facName]) {
                    facultyMap[facName] = {
                        id: facName, name: facName, department: 'Computer Engineering',
                        classes: 0, lec: 0, lab: 0, schedule: []
                    };
                }
                
                let start = new Date(ev.start);
                let end = new Date(ev.end);
                let hours = (end - start) / (1000 * 60 * 60);
                if (isNaN(hours)) hours = 0;
                
                let typeStr = props.type || ''; 
                let isLab = typeStr.toLowerCase().includes('lab');
                
                // --- NEW: 3 hours of lab = 1 unit ---
                if (isLab) {
                    facultyMap[facName].lab += (hours / 3); 
                } else {
                    facultyMap[facName].lec += hours;
                }
                
                facultyMap[facName].classes += 1;
                
                let dayIdx = start.getDay() - 1;
                if (dayIdx < 0) dayIdx = 6;
                if (isNaN(dayIdx)) dayIdx = 0; 
                
                const formatTime = (d) => {
                    if (isNaN(d.getTime())) return "TBA";
                    let h = d.getHours();
                    let m = String(d.getMinutes()).padStart(2, '0');
                    let ampm = h >= 12 ? 'PM' : 'AM';
                    h = h % 12; h = h ? h : 12;
                    return `${h}:${m} ${ampm}`;
                };
                
                const daysLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                
                facultyMap[facName].schedule.push({
                    subjectCode: props.code || 'TBA',
                    subjectDesc: ev.title || 'Unknown Subject',
                    room: props.room || 'TBA',
                    startTime: formatTime(start),
                    endTime: formatTime(end),
                    dayIndex: dayIdx,
                    dayLong: daysLong[dayIdx] || 'Unknown',
                    type: isLab ? 'Lab' : 'Lec'
                });
            });
            
            return Object.values(facultyMap).sort((a,b) => a.name.localeCompare(b.name));
        }

        function renderFaculty(data) {
            if (!gridContainer) return;
            
            if (!Array.isArray(data)) {
                data = [];
            }

            gridContainer.innerHTML = "";
            
            if (data.length === 0) {
                updateStats([]);
                gridContainer.innerHTML = `
                    <div class="empty-state-container" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; background: white; border-radius: 12px; border: 1px dashed #cbd5e1; text-align: center; margin-top: 20px;">
                        <div style="background: #f1f5f9; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                            <i class='bx bx-user-x' style="font-size: 3rem; color: #94a3b8;"></i>
                        </div>
                        <h3 style="margin: 0 0 10px 0; color: #334155; font-size: 1.5rem;">No Instructors Available</h3>
                        <p style="margin: 0 0 24px 0; color: #64748b; max-width: 400px; line-height: 1.5;">Your faculty list is currently empty. Add instructors manually or import your schedule to generate them.</p>
                        <button class="btn-primary" onclick="document.getElementById('btnAddTeacher').click()" style="padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; background: var(--maroon); color: white; display: flex; align-items: center; gap: 8px;">
                            <i class='bx bx-plus'></i> Add Instructor Manually
                        </button>
                    </div>
                `;
                return;
            }
            
            data.forEach(teacher => {
                const lecHours = parseFloat(teacher.lec) || 0;
                const labHours = parseFloat(teacher.lab) || 0;
                const totalLoad = lecHours + labHours;
                const isFullLoad = totalLoad >= FULL_LOAD_THRESHOLD;
                const statusBadge = isFullLoad ? `<div class="full-load-badge">FULL LOAD</div>` : '';
                
                const card = document.createElement('div');
                card.className = 'faculty-card';
                card.onclick = () => { renderModalContent(teacher); if(scheduleModal) scheduleModal.style.display = 'flex'; };
                
                card.innerHTML = `
                    ${statusBadge}
                    <div class="card-header">
                        <div class="avatar"><i class='bx bx-user'></i></div>
                        <div class="info"><h3>${teacher.name || 'Unknown'}</h3><div class="dept-badge"><i class='bx bx-bookmark'></i> ${teacher.department || 'Computer Engineering'}</div></div>
                    </div>
                    <div class="card-stats">
                        <div class="stat-row">
                            <span><i class='bx bx-book-open'></i> Classes:</span>
                            <span class="stat-value">${teacher.classes || 0}</span>
                        </div>
                        <div class="stat-row">
                            <span><i class='bx bx-time-five'></i> Load:</span>
                            <div class="load-breakdown">
                                <span class="lb-lec">Lec: ${lecHours.toFixed(1)}</span>
                                <span class="lb-lab">Lab: ${labHours.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                `;
                gridContainer.appendChild(card);
            });
            
            updateStats(data);
        }

        function updateStats(data) {
            if (!totalFacultyEl || !totalClassesEl || !totalHoursEl) return;
            
            if (!Array.isArray(data) || data.length === 0) {
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

            totalFacultyEl.textContent = data.length;
            totalClassesEl.textContent = data.reduce((sum, t) => sum + (parseInt(t.classes) || 0), 0);
            const totalLec = data.reduce((sum, t) => sum + (parseFloat(t.lec) || 0), 0);
            const totalLab = data.reduce((sum, t) => sum + (parseFloat(t.lab) || 0), 0);
            
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

        function fetchRegisteredFaculty() {
            if (!registeredTeachersList) return;
            registeredTeachersList.innerHTML = "<p style='text-align:center; padding:10px;'>Loading faculty...</p>";
            
            fetch('/api/users/faculty')
                .then(res => res.json())
                .then(data => {
                    if (!Array.isArray(data)) data = [];
                    const existingIds = facultyData.map(f => f.id);
                    registeredTeachers = data.filter(teacher => !existingIds.includes(teacher.id));
                    renderRegisteredTeachers(searchRegistered ? searchRegistered.value : "");
                })
                .catch(err => {
                    console.error('Fetch Error:', err);
                    registeredTeachersList.innerHTML = `<p style='color: #a00; text-align:center;'>Error loading.</p>`;
                });
        }

        function renderRegisteredTeachers(filter = "") {
            if (!registeredTeachersList) return;
            registeredTeachersList.innerHTML = "";
            const term = filter.toLowerCase();
            const filtered = registeredTeachers.filter(t => (t.name || '').toLowerCase().includes(term));
            
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
            const index = registeredTeachers.findIndex(t => String(t.id) === String(id));
            if (index > -1) {
                const teacher = registeredTeachers[index];
                registeredTeachers.splice(index, 1);
                teacher.department = "Computer Engineering"; 
                teacher.classes = 0; teacher.lec = 0.0; teacher.lab = 0.0; teacher.schedule = [];
                facultyData.push(teacher);
                renderFaculty(facultyData);
                if (searchRegistered) renderRegisteredTeachers(searchRegistered.value);
            }
        };

        if (closeModalBtn && scheduleModal) closeModalBtn.onclick = () => scheduleModal.style.display = 'none';
        if (btnAddTeacher && addTeacherModal) {
            btnAddTeacher.onclick = () => { 
                fetchRegisteredFaculty();
                addTeacherModal.style.display = 'flex';
            };
        }
        if (closeAddModalBtn && addTeacherModal) closeAddModalBtn.onclick = () => addTeacherModal.style.display = 'none';
        
        if (searchRegistered) searchRegistered.addEventListener('input', (e) => renderRegisteredTeachers(e.target.value));
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = facultyData.filter(t => (t.name || '').toLowerCase().includes(term));
                renderFaculty(filtered);
            });
        }
        window.onclick = function(event) { 
            if (scheduleModal && event.target == scheduleModal) scheduleModal.style.display = 'none';
            if (addTeacherModal && event.target == addTeacherModal) addTeacherModal.style.display = 'none';
        }

        window.updateInstructorsFromImport = function(events) {
            localStorage.setItem('aeris_imported_schedule', JSON.stringify(events));
            facultyData = processEventsIntoFaculty(events);
            renderFaculty(facultyData);
        };

        function loadInitialData() {
            const savedEvents = localStorage.getItem('aeris_imported_schedule');
            if (savedEvents && savedEvents.length > 5) {
                try {
                    const parsedEvents = JSON.parse(savedEvents);
                    facultyData = processEventsIntoFaculty(parsedEvents);
                    renderFaculty(facultyData);
                } catch (e) {
                    console.error("Parse error:", e);
                    fetchFromAPI();
                }
            } else {
                fetchFromAPI();
            }
        }

        function fetchFromAPI() {
            fetch('/api/instructors')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data) && data.length > 0) {
                        facultyData = data.map(t => ({
                            id: t.id || t.name, name: t.name || 'Unknown', department: t.department || 'CPE',
                            classes: t.classes || 0, lec: parseFloat(t.lec) || 0, lab: parseFloat(t.lab) || 0, schedule: t.schedule || []
                        }));
                        renderFaculty(facultyData);
                    } else {
                        renderFaculty([]); 
                    }
                })
                .catch(err => {
                    console.error("API Error:", err);
                    renderFaculty([]); 
                });
        }

        loadInitialData();

    } catch (criticalError) {
        console.error("CRITICAL ERROR IN INSTRUCTORS.JS:", criticalError);
    }
});