(function() {
    let calendarInstance = null;
    let currentActiveYear = "all"; // THE FIX: Default to showing all classes instantly on reload!
    let importedFaculty = new Set();
    let importedSections = new Set();
    let editingEvent = null;
    
    let curriculumData = [];

    const mockDatabase = {
        "1": { color: '#ef4444', events: [] }, 
        "2": { color: '#3b82f6', events: [] }, 
        "3": { color: '#10b981', events: [] }, 
        "4": { color: '#8b5cf6', events: [] }  
    };

    const COLOR_PALETTE = [
        'hsl(210, 90%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(35, 90%, 55%)',
        'hsl(280, 60%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(195, 80%, 45%)',
    ];

    function hashColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
        return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
    }

    function syncMemoryToStorage() {
        let allEvents = [];
        for (let year in mockDatabase) {
            if (mockDatabase[year] && mockDatabase[year].events) {
                allEvents = allEvents.concat(mockDatabase[year].events);
            }
        }
        
        localStorage.setItem('aeris_imported_schedule', JSON.stringify(allEvents));
        
        const activeTerm = document.getElementById('academicTermSelect').value;

        // Send BOTH the term AND the events to Python
        fetch('/api/schedules/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                term: activeTerm,
                events: allEvents
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error("Database save failed:", data.message);
            }
        })
        .catch(error => console.error("Error syncing to database:", error));
        
        if (typeof window.updateInstructorsFromImport === 'function') {
            window.updateInstructorsFromImport(allEvents);
        }
    }

    function loadInitialSchedules() {
    // Force the app to ALWAYS fetch from the MySQL database first
    // instead of relying on the local browser storage.
    fetchFromAPI(); 
}

    function fetchFromAPI() {
        // Grab the selected term from the dropdown
        const activeTerm = document.getElementById('academicTermSelect').value;
        
        // Append the term to the URL so Python knows which one to fetch
        fetch(`/api/schedules?term=${activeTerm}`)
        .then(res => res.json())
        .then(data => {
            // Clear old data
            for (let year in mockDatabase) mockDatabase[year].events = [];
            importedFaculty.clear();
            importedSections.clear();
            
            data.forEach(event => {
                let year = event.extendedProps.year;
                if (!mockDatabase[year]) mockDatabase[year] = { color: event.backgroundColor || '#3b82f6', events: [] };
                mockDatabase[year].events.push(event);

                if (event.extendedProps.faculty && event.extendedProps.faculty.toUpperCase() !== 'TBA') {
                    importedFaculty.add(event.extendedProps.faculty);
                }
                if (event.extendedProps.sectionCode) {
                    importedSections.add(event.extendedProps.sectionCode);
                }
            });
            
            updateSelectDropdowns(); 
            if (calendarInstance) loadYearData(currentActiveYear);
        })
        .catch(err => console.error("Error loading from database:", err));
    }

    function init() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        if (typeof FullCalendar === 'undefined') {
            setTimeout(init, 1000);
            return;
        }

        // THE FIX: Do not destroy calendar when switching tabs. Just resize it!
        if (calendarInstance) {
            setTimeout(() => calendarInstance.updateSize(), 50);
            return;
        }

        // Auto-detect which UI button is active
        const activeBtn = document.querySelector('.toggle-btn.active');
        if (activeBtn) {
            currentActiveYear = activeBtn.getAttribute('data-year') || 'all';
        } else {
            currentActiveYear = 'all';
        }

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            initialDate: '2026-02-09',
            headerToolbar: false, 
            dayHeaderFormat: { weekday: 'short' }, 
            hiddenDays: [0], 
            slotMinTime: '07:00:00',
            slotMaxTime: '21:00:00',
            allDaySlot: false,
            slotLabelInterval: '01:00', 
            slotLabelFormat: { hour: 'numeric', meridiem: 'lowercase' }, 
            height: 'auto',
            editable: true, 
            eventOverlap: false,
            slotEventOverlap: false,
            expandRows: true,
            
            eventDrop: handleScheduleChange,
            eventResize: handleScheduleChange,
            
            eventClick: function(info) {
                const ev = info.event;
                editingEvent = ev; 
                const props = ev.extendedProps;
                
                const modal = document.getElementById('addClassModal');
                if (modal) modal.style.display = 'flex';
                
                const errorBanner = document.getElementById('modalError');
                if (errorBanner) errorBanner.style.display = 'none';
                
                document.querySelector('#addClassModal .header-text h3').textContent = 'Edit Class';
                document.querySelector('#addClassModal .header-text p').textContent = `Editing: ${ev.title}`;
                
                const btnDelete = document.getElementById('btnDeleteClass');
                if (btnDelete) btnDelete.style.display = 'inline-flex';
                
                document.getElementById('modalYear').value = props.year || currentActiveYear;
                
                if (props.code && typeof curriculumData !== 'undefined' && curriculumData.length > 0) {
                    const cleanPropCode = props.code.trim().toUpperCase();
                    const subjectData = curriculumData.find(s => s.code.trim().toUpperCase() === cleanPropCode);
                    if (subjectData && subjectData.sem) {
                        const semSelect = document.getElementById('modalSem');
                        if (semSelect) semSelect.value = subjectData.sem;
                    }
                }
                
                if (typeof filterSubjects === 'function') filterSubjects();
                
                setTimeout(() => {
                    const subjectSelect = document.getElementById('subjectSelect');
                    if(subjectSelect && props.code) {
                        const cleanCode = props.code.trim().toUpperCase();
                        let found = Array.from(subjectSelect.options).find(opt => opt.value.trim().toUpperCase() === cleanCode);
                        if (found) {
                            subjectSelect.value = found.value;
                        } else {
                            subjectSelect.innerHTML += `<option value="${props.code}">${props.code}</option>`;
                            subjectSelect.value = props.code;
                        }
                        if (typeof onSubjectChange === 'function') onSubjectChange(); 
                    }
                    
                    const savedSection = (props.sectionCode || '').trim();
                    const modalSection = document.getElementById('modalSection');
                    if (modalSection && savedSection) {
                        let secFound = Array.from(modalSection.options).find(opt => opt.value.trim().toUpperCase() === savedSection.toUpperCase());
                        if (secFound) {
                            modalSection.value = secFound.value;
                        } else {
                            modalSection.innerHTML += `<option value="${savedSection}">${savedSection}</option>`;
                            modalSection.value = savedSection;
                        }
                    }
                    document.getElementById('sectionCode').value = savedSection;

                    const facultySelect = document.getElementById('facultySelect');
                    if (facultySelect && props.faculty && props.faculty.toUpperCase() !== 'TBA') {
                        let facFound = Array.from(facultySelect.options).find(opt => opt.value.trim().toUpperCase() === props.faculty.trim().toUpperCase());
                        if (facFound) {
                            facultySelect.value = facFound.value;
                        } else {
                             facultySelect.innerHTML += `<option value="${props.faculty}">${props.faculty}</option>`;
                             facultySelect.value = props.faculty;
                        }
                    } else if (facultySelect) {
                        facultySelect.value = ''; 
                    }

                    document.getElementById('typeSelect').value = props.type || 'lecture';
                    document.getElementById('roomInput').value = props.room || '';
                    
                    if (ev.start) {
                        let dayIndex = ev.start.getDay();
                        document.getElementById('daySelect').value = dayIndex === 0 ? 7 : dayIndex;
                        const startH = String(ev.start.getHours()).padStart(2, '0');
                        const startM = String(ev.start.getMinutes()).padStart(2, '0');
                        document.getElementById('startTime').value = `${startH}:${startM}`;
                    }
                    if (ev.end) {
                        const endH = String(ev.end.getHours()).padStart(2, '0');
                        const endM = String(ev.end.getMinutes()).padStart(2, '0');
                        document.getElementById('endTime').value = `${endH}:${endM}`;
                    }
                }, 50);
            },
            
            eventContent: function(arg) {
                let props = arg.event.extendedProps;
                let facultyShort = props.faculty ? props.faculty.split(',')[0] : 'TBA';
                let room = props.room || 'TBA';
                let timeText = arg.timeText; 
                
                return {
                    html: `
                    <div style="padding: 4px 8px; color: white; height: 100%; overflow: hidden; display: flex; flex-direction: column;">
                        <p style="font-size: 0.75rem; font-weight: 700; line-height: 1.2; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${props.code}
                        </p>
                        <p style="font-size: 0.70rem; font-weight: 600; line-height: 1.2; margin: 0; opacity: 0.95;">
                            ⏱ ${timeText}
                        </p>
                        <p style="font-size: 0.75rem; line-height: 1.2; margin: 2px 0 0 0; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${arg.event.title}
                        </p>
                        <p style="font-size: 0.70rem; line-height: 1.2; margin: 2px 0 0 0; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: auto;">
                            ${room} • ${facultyShort}
                        </p>
                    </div>`
                };
            }
        });

        calendarInstance.render();
        
        setTimeout(() => {
            calendarInstance.updateSize();
        }, 200);

        fetchCurriculumData();
        populateFaculty(); 
        setupEventListeners();
        
        loadInitialSchedules();
    }

    function fetchCurriculumData() {
        fetch('/api/subjects')
            .then(res => res.json())
            .then(data => {
                if (data.length > 0) {
                    curriculumData = data;
                }
                filterSubjects(); 
            })
            .catch(err => console.error("Failed to load curriculum", err));
    }

    function populateFaculty() {
        const facultySelect = document.getElementById('facultySelect');
        const filterSelects = document.querySelectorAll('.controls-group select');
        let filterFaculty = filterSelects.length > 2 ? filterSelects[2] : null;

        const modalYearSelect = document.getElementById('modalYear');
        const modalYear = modalYearSelect ? modalYearSelect.value : currentActiveYear;

        const getActiveFacultyForYear = (targetYear) => {
            let active = new Set();
            if (targetYear === 'all') {
                for (let y in mockDatabase) {
                    if (mockDatabase[y] && mockDatabase[y].events) {
                        mockDatabase[y].events.forEach(e => {
                            if (e.extendedProps.faculty && e.extendedProps.faculty.toUpperCase() !== 'TBA') {
                                active.add(e.extendedProps.faculty.toUpperCase());
                            }
                        });
                    }
                }
            } else if (mockDatabase[targetYear] && mockDatabase[targetYear].events) {
                mockDatabase[targetYear].events.forEach(e => {
                    if (e.extendedProps.faculty && e.extendedProps.faculty.toUpperCase() !== 'TBA') {
                        active.add(e.extendedProps.faculty.toUpperCase());
                    }
                });
            }
            return active;
        };

        const renderDropdowns = (allFacultySet) => {
            const dashboardActiveFaculty = getActiveFacultyForYear(currentActiveYear);
            const modalActiveFaculty = getActiveFacultyForYear(modalYear);

            if (facultySelect) {
                facultySelect.innerHTML = '<option value="">-- Select Instructor --</option>';
                
                let activeOptions = '';
                let otherOptions = '';

                Array.from(allFacultySet).sort().forEach(fac => {
                    if (modalActiveFaculty.has(fac)) { 
                        activeOptions += `<option value="${fac}">${fac}</option>`;
                    } else {
                        otherOptions += `<option value="${fac}">${fac}</option>`;
                    }
                });

                if (activeOptions) {
                    facultySelect.innerHTML += `<optgroup label="Active in Year ${modalYear}">${activeOptions}</optgroup>`;
                }
                if (otherOptions) {
                    facultySelect.innerHTML += `<optgroup label="Other Instructors">${otherOptions}</optgroup>`;
                }
            }

            if (filterFaculty) {
                filterFaculty.innerHTML = '<option value="all">All Faculty</option>';
                Array.from(allFacultySet).sort().forEach(fac => {
                    if (currentActiveYear === 'all' || dashboardActiveFaculty.has(fac)) {
                        filterFaculty.innerHTML += `<option value="${fac}">${fac}</option>`;
                    }
                });
            }
        };

        if (!facultySelect && !filterFaculty) return;

        fetch('/api/instructors')
            .then(response => response.json())
            .then(data => {
                let combinedFaculty = new Set(importedFaculty);
                data.forEach(fac => combinedFaculty.add(fac.name.toUpperCase()));
                renderDropdowns(combinedFaculty);
            })
            .catch(err => {
                renderDropdowns(importedFaculty);
            });
    }

    function isOverlapping(newStart, newEnd, targetYear, checkRoom, checkFaculty, excludeEvent = null) {
        let eventsToCheck = [];
        
        for (let year in mockDatabase) {
            eventsToCheck = eventsToCheck.concat(mockDatabase[year].events.map(e => ({
                start: new Date(e.start),
                end: new Date(e.end),
                title: e.title,
                room: e.extendedProps.room,
                faculty: e.extendedProps.faculty,
                year: e.extendedProps.year
            })));
        }

        for (let ev of eventsToCheck) {
            if (excludeEvent && ev.title === excludeEvent.title && ev.start.getTime() === new Date(excludeEvent.startStr).getTime()) {
                continue;
            }
            if (newStart < ev.end && newEnd > ev.start) {
                if (checkRoom && checkRoom !== 'TBA' && checkRoom.toUpperCase() === ev.room?.toUpperCase()) {
                    return `Room Conflict: ${ev.room} is already booked for ${ev.title}.`;
                }
                if (checkFaculty && checkFaculty !== 'TBA' && checkFaculty.toUpperCase() === ev.faculty?.toUpperCase()) {
                    return `Instructor Conflict: ${ev.faculty} is already teaching ${ev.title}.`;
                }
                if (targetYear === ev.year) {
                    return `Student Conflict: Time overlaps with ${ev.title} for Year ${targetYear}.`;
                }
            }
        }
        return false;
    }

    function handleScheduleChange(info) {
        const ev = info.event;
        
        showCustomConfirm(
            "Save Schedule Changes",
            `Do you want to save the new schedule for ${ev.title}?`,
            "Save Changes",
            "Discard",
            () => { 
                const yearKey = ev.extendedProps.year;
                
                if (mockDatabase[yearKey]) {
                    let dbEvent = mockDatabase[yearKey].events.find(e => 
                        e.title === ev.title && 
                        e.extendedProps.code === ev.extendedProps.code &&
                        e.extendedProps.type === ev.extendedProps.type
                    );
                    
                    if (dbEvent) {
                        const formatLocal = (d) => {
                            const pad = (n) => String(n).padStart(2, '0');
                            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
                        };
                        
                        dbEvent.start = formatLocal(ev.start);
                        if (ev.end) dbEvent.end = formatLocal(ev.end);
                        
                        syncMemoryToStorage();
                    }
                }
                
                if (typeof showToast === 'function') showToast(`Schedule updated for ${ev.title}`);
            },
            () => { 
                info.revert();
            }
        );
    }

    function showError(message) {
        const errorEl = document.getElementById('modalError');
        errorEl.textContent = message;
        errorEl.style.display = 'flex';
    }

    function hideError() {
        const errorEl = document.getElementById('modalError');
        errorEl.style.display = 'none';
    }

    function filterSubjects() {
        const yearSelect = document.getElementById('modalYear');
        const semSelect = document.getElementById('modalSem');
        const subjectSelect = document.getElementById('subjectSelect');
        if (!yearSelect || !semSelect || !subjectSelect) return;

        const year = yearSelect.value;
        const sem = semSelect.value;
        subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        
        const filtered = curriculumData.filter(sub => sub.year == year && sub.sem == sem);
        if (filtered.length === 0) {
            subjectSelect.innerHTML += '<option>No subjects found for this Term</option>';
        } else {
            filtered.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.code;
                option.text = `${sub.code} - ${sub.title}`;
                option.dataset.json = JSON.stringify(sub);
                subjectSelect.appendChild(option);
            });
        }
    }

    function onSubjectChange() {
        const select = document.getElementById('subjectSelect');
        const courseInput = document.getElementById('courseCode');
        const typeSelect = document.getElementById('typeSelect');
        
        if (select.value) {
            const sub = JSON.parse(select.options[select.selectedIndex].dataset.json);
            courseInput.value = sub.code;
            if (sub.lec == 0 && sub.lab > 0) typeSelect.value = 'lab';
            else typeSelect.value = 'lecture';
        } else {
            courseInput.value = "";
        }
    }

    function saveClass() {
        hideError(); 

        const subjectSelect = document.getElementById('subjectSelect');
        if (!subjectSelect.value) { 
            showError("Please select a subject.");
            return; 
        }

        const subData = JSON.parse(subjectSelect.options[subjectSelect.selectedIndex].dataset.json);
        const modalYear = document.getElementById('modalYear').value;
        const day = parseInt(document.getElementById('daySelect').value);
        const start = document.getElementById('startTime').value;
        const end = document.getElementById('endTime').value;
        const room = document.getElementById('roomInput').value;
        const faculty = document.getElementById('facultySelect').value;
        const type = document.getElementById('typeSelect').value;
        const sectionCode = document.getElementById('sectionCode').value;

        const date = getNextDayOfWeek(day);
        const startDt = new Date(`${date}T${start}:00`);
        const endDt = new Date(`${date}T${end}:00`);

        if (startDt >= endDt) {
            showError("End time must be after Start time.");
            return;
        }

        const conflict = isOverlapping(startDt, endDt, modalYear, room, faculty, editingEvent);
        if (conflict) {
            showError(conflict);
            return;
        }
        const yearColor = mockDatabase[modalYear] ? mockDatabase[modalYear].color : '#3b82f6'; 

        const newEvent = {
            id: editingEvent ? editingEvent.id : null, 
            title: subData.title,
            start: `${date}T${start}:00`,
            end: `${date}T${end}:00`,
            backgroundColor: yearColor, 
            borderColor: yearColor,     
            extendedProps: {
                code: subData.code,
                sectionCode: sectionCode,
                faculty: faculty,
                room: room,
                type: type,
                year: modalYear
            }
        };

        if (editingEvent) {
            const oldYear = editingEvent.extendedProps.year;
            if (mockDatabase[oldYear]) { 
                mockDatabase[oldYear].events = mockDatabase[oldYear].events.filter(e => 
                    !(e.title === editingEvent.title && 
                      e.extendedProps.code === editingEvent.extendedProps.code &&
                      e.extendedProps.type === editingEvent.extendedProps.type)
                );
            }
            editingEvent.remove();
        }
        
        if (!mockDatabase[modalYear]) mockDatabase[modalYear] = { color: yearColor, events: [] };
        mockDatabase[modalYear].events.push(newEvent);

        syncMemoryToStorage();

        if (modalYear === currentActiveYear) {
            loadYearData(currentActiveYear);
        } else {
            if (typeof showToast === 'function') {
                showToast(`Class saved to ${modalYear}${getOrdinal(modalYear)} Year schedule.`);
            } else {
                alert(`Class saved to ${modalYear}${getOrdinal(modalYear)} Year schedule.`);
            }
        }

        Schedules.closeModal();
    }

    function exportToExcel() {
        let groupedData = {};

        for (let year in mockDatabase) {
            if (mockDatabase[year] && mockDatabase[year].events) {
                mockDatabase[year].events.forEach(ev => {
                    let props = ev.extendedProps;
                    let key = `${props.year}_${props.code}_${props.sectionCode}_${props.faculty}`;

                    if (!groupedData[key]) {
                        groupedData[key] = {
                            campus: "CARMEN", code: props.code || "", title: ev.title || "",
                            course: `BSCPE-${props.year}`, section: props.sectionCode || "", faculty: props.faculty || "",
                            lecTimes: new Set(), lecDays: new Set(), lecRooms: new Set(), lecHrs: 0,
                            labTimes: new Set(), labDays: new Set(), labRooms: new Set(), labHrs: 0
                        };
                    }

                    let timeStr = "";
                    let dayStr = "";
                    let durationHrs = 0; 

                    if (ev.start && ev.end) {
                        const startDt = new Date(ev.start);
                        const endDt = new Date(ev.end);
                        
                        durationHrs = (endDt - startDt) / (1000 * 60 * 60);
                        
                        const formatTime = (dt) => {
                            let hours = dt.getHours();
                            let minutes = dt.getMinutes();
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12;
                            hours = hours ? hours : 12;
                            minutes = minutes < 10 ? '0' + minutes : minutes;
                            return `${hours < 10 ? '0' + hours : hours}:${minutes}${ampm}`;
                        };
                        
                        timeStr = `${formatTime(startDt)}-${formatTime(endDt)}`;
                        const daysShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                        dayStr = daysShort[startDt.getDay()];
                    }

                    if (props.type === 'lecture' || props.type === 'Lec') {
                        if (timeStr) groupedData[key].lecTimes.add(timeStr);
                        if (dayStr) groupedData[key].lecDays.add(dayStr);
                        if (props.room) groupedData[key].lecRooms.add(props.room);
                        groupedData[key].lecHrs += durationHrs; 
                    } else {
                        if (timeStr) groupedData[key].labTimes.add(timeStr);
                        if (dayStr) groupedData[key].labDays.add(dayStr);
                        if (props.room) groupedData[key].labRooms.add(props.room);
                        groupedData[key].labHrs += durationHrs; 
                    }
                });
            }
        }

        let aoa = [
            ["", "", "", "", "", "", "", "", "", "", "", "", "Time", "", "Days", "", "Room", "", "Faculty"],
            ["", "CAMPUS", "Code", "Descriptive Title", "Course", "Units", "", "", "Teaching Hours", "", "", "Section", "FACE TO FACE", "", "FACE TO FACE", "", "", "", ""],
            ["", "", "", "", "", "Lec", "Lab", "Total", "Lec", "Lab", "Total", "", "Lec", "LAB", "Lec", "LAB", "Lec", "Lab", ""],
            [] 
        ];

        Object.values(groupedData).forEach(row => {
            let lecDayFormat = Array.from(row.lecDays).join('/');
            let labDayFormat = Array.from(row.labDays).join('/');
            
            let lecTimeFormat = Array.from(row.lecTimes).join('/');
            if (row.lecDays.size > 1 && row.lecTimes.size === 1) {
               lecTimeFormat = Array.from(row.lecDays).map(() => Array.from(row.lecTimes)[0]).join('/');
            }
            
            let labTimeFormat = Array.from(row.labTimes).join('/');
            if (row.labDays.size > 1 && row.labTimes.size === 1) {
               labTimeFormat = Array.from(row.labDays).map(() => Array.from(row.labTimes)[0]).join('/');
            }

            let lecRoomFormat = Array.from(row.lecRooms).join('/');
            let labRoomFormat = Array.from(row.labRooms).join('/');

            let lecU = row.lecHrs || 0;
            let labU = row.labHrs || 0;
            let totalU = lecU + labU;

            aoa.push([
                "", 
                row.campus, row.code, row.title, row.course, 
                lecU, labU, totalU,   
                lecU, labU, totalU,   
                row.section, lecTimeFormat, labTimeFormat, lecDayFormat, labDayFormat, 
                lecRoomFormat, labRoomFormat, row.faculty 
            ]);
        });

        if (aoa.length <= 4) {
            if (typeof showToast === 'function') showToast("No classes found to export.");
            else alert("No classes found to export.");
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        ws['!merges'] = [
            { s: {r:0, c:12}, e: {r:0, c:13} }, { s: {r:0, c:14}, e: {r:0, c:15} },
            { s: {r:0, c:16}, e: {r:0, c:17} }, { s: {r:1, c:12}, e: {r:1, c:13} },
            { s: {r:1, c:14}, e: {r:1, c:15} }, { s: {r:1, c:5}, e: {r:1, c:7} },   
            { s: {r:1, c:8}, e: {r:1, c:10} }   
        ];

        ws['!cols'] = [
            { wch: 3 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 10 }, 
            { wch: 5 }, { wch: 5 }, { wch: 6 }, { wch: 5 }, { wch: 5 }, { wch: 6 }, 
            { wch: 18 }, { wch: 35 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, 
            { wch: 15 }, { wch: 15 }, { wch: 30 }
        ];

        const headerStyle = {
            fill: { fgColor: { rgb: "D9E1F2" } }, 
            font: { bold: true, color: { rgb: "000000" }, name: "Arial", sz: 10 },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "000000" } }, bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } }, right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const dataStyle = {
            alignment: { horizontal: "center", vertical: "center" }, font: { name: "Arial", sz: 10 }
        };

        let range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                let cellAddress = XLSX.utils.encode_cell({r: R, c: C});
                if (!ws[cellAddress]) continue;

                if (R <= 2) ws[cellAddress].s = headerStyle;
                else ws[cellAddress].s = dataStyle;
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Class Schedules");
        XLSX.writeFile(wb, "AERIS_Class_Schedules.xlsx");
        
        if (typeof showToast === 'function') showToast("Schedule exported successfully with hours calculated!");
    }

    function getNextDayOfWeek(dayIndex) {
        const baseDay = 9; 
        const offset = dayIndex - 1; 
        const targetDay = baseDay + offset;
        const dayStr = targetDay < 10 ? `0${targetDay}` : targetDay;
        return `2026-02-${dayStr}`;
    }

    // --- THE ANTI-FLASH FIX: ADD EVENTS ONE-BY-ONE INSTEAD OF DESTROYING GRID ---
    function loadYearData(yearKey) {
        if (!calendarInstance) return;
        currentActiveYear = yearKey;
        
        // Sync the HTML toggle buttons so they match the loaded data
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.year === String(yearKey)) btn.classList.add('active');
        });
        
        // Instantly clears the calendar classes without destroying the entire layout grid
        calendarInstance.removeAllEvents();
        
        let allEventsToDisplay = [];

        if (yearKey === 'all') {
            for (let year in mockDatabase) {
                const data = mockDatabase[year];
                if (data && data.events && data.events.length > 0) {
                    const coloredEvents = data.events.map(ev => ({
                        ...ev,
                        backgroundColor: data.color,
                        borderColor: data.color
                    }));
                    allEventsToDisplay = allEventsToDisplay.concat(coloredEvents);
                }
            }
        } else {
            const data = mockDatabase[yearKey];
            if (data && data.events && data.events.length > 0) {
                allEventsToDisplay = data.events.map(ev => ({
                    ...ev,
                    backgroundColor: data.color,
                    borderColor: data.color
                }));
            }
        }

        const filterSelects = document.querySelectorAll('.controls-group select');
        const sectionFilterSelect = document.getElementById('sectionFilterSelect');
        const facultyFilterSelect = document.getElementById('facultyFilterSelect');
        const sectionFilter = sectionFilterSelect ? sectionFilterSelect.value : 'all';
        const facultyFilter = facultyFilterSelect ? facultyFilterSelect.value : 'all';
        if (sectionFilter !== 'all' || facultyFilter !== 'all') {
            allEventsToDisplay = allEventsToDisplay.filter(ev => {
                let matchSection = true;
                let matchFaculty = true;

                if (sectionFilter !== 'all') {
                    const evSection = ev.extendedProps.sectionCode || "";
                    matchSection = evSection.toUpperCase() === sectionFilter.toUpperCase();
                }
                if (facultyFilter !== 'all') {
                    const evFaculty = ev.extendedProps.faculty || "";
                    matchFaculty = evFaculty.toUpperCase() === facultyFilter.toUpperCase();
                }

                return matchSection && matchFaculty;
            });
        }

        if (allEventsToDisplay.length > 0) {
            // THE FIX: Batch add all events at once to eliminate rendering lag
            calendarInstance.addEventSource(allEventsToDisplay);
            updateKPIs(allEventsToDisplay); 
            toggleEmptyState(true); 
        } else {
            updateKPIs([]);
            toggleEmptyState(false); 
        }
        updateUnassignedAlert();
    }

    function jumpToUnassigned(year, code, section) {
        if (currentActiveYear !== year && currentActiveYear !== 'all') {
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.year === String(year)) btn.classList.add('active');
            });
            
            const filterSelects = document.querySelectorAll('.controls-group select');
            if (filterSelects.length > 1) filterSelects[1].value = 'all'; 
            if (filterSelects.length > 2) filterSelects[2].value = 'all'; 
            
            loadYearData(year); 
        }

        const events = calendarInstance.getEvents();
        const targetEvent = events.find(ev => 
            ev.extendedProps.code === code && 
            ev.extendedProps.sectionCode === section &&
            (!ev.extendedProps.faculty || ev.extendedProps.faculty.toUpperCase() === 'TBA')
        );

        if (!targetEvent) return;

        if (targetEvent.start) {
            calendarInstance.gotoDate(targetEvent.start);
        }

        const container = document.getElementById('unassigned-faculty-alert');
        if (container) container.classList.remove('expanded');

        editingEvent = targetEvent; 
        const props = targetEvent.extendedProps;
        
        const modal = document.getElementById('addClassModal');
        if (modal) modal.style.display = 'flex';
        
        const errorBanner = document.getElementById('modalError');
        if (errorBanner) errorBanner.style.display = 'none';
        
        document.querySelector('#addClassModal .header-text h3').textContent = 'Assign Instructor';
        document.querySelector('#addClassModal .header-text p').textContent = `Resolving unassigned faculty for: ${targetEvent.title}`;
        
        const btnDelete = document.getElementById('btnDeleteClass');
        if (btnDelete) btnDelete.style.display = 'inline-flex';
        
        document.getElementById('modalYear').value = props.year || currentActiveYear;
        
        if (props.code && typeof curriculumData !== 'undefined' && curriculumData.length > 0) {
            const cleanPropCode = props.code.trim().toUpperCase();
            const subjectData = curriculumData.find(s => s.code.trim().toUpperCase() === cleanPropCode);
            if (subjectData && subjectData.sem) {
                const semSelect = document.getElementById('modalSem');
                if (semSelect) semSelect.value = subjectData.sem;
            }
        }
        
        if (typeof filterSubjects === 'function') filterSubjects();
        
        setTimeout(() => {
            const subjectSelect = document.getElementById('subjectSelect');
            if(subjectSelect && props.code) {
                const cleanCode = props.code.trim().toUpperCase();
                let found = Array.from(subjectSelect.options).find(opt => opt.value.trim().toUpperCase() === cleanCode);
                if (found) {
                    subjectSelect.value = found.value;
                } else {
                    subjectSelect.innerHTML += `<option value="${props.code}">${props.code}</option>`;
                    subjectSelect.value = props.code;
                }
                if (typeof onSubjectChange === 'function') onSubjectChange(); 
            }
            
            const savedSection = (props.sectionCode || '').trim();
            const modalSection = document.getElementById('modalSection');
            if (modalSection && savedSection) {
                let secFound = Array.from(modalSection.options).find(opt => opt.value.trim().toUpperCase() === savedSection.toUpperCase());
                if (secFound) {
                    modalSection.value = secFound.value;
                } else {
                    modalSection.innerHTML += `<option value="${savedSection}">${savedSection}</option>`;
                    modalSection.value = savedSection;
                }
            }
            document.getElementById('sectionCode').value = savedSection;

            const facultySelect = document.getElementById('facultySelect');
            if (facultySelect && props.faculty && props.faculty.toUpperCase() !== 'TBA') {
                let facFound = Array.from(facultySelect.options).find(opt => opt.value.trim().toUpperCase() === props.faculty.trim().toUpperCase());
                if (facFound) {
                    facultySelect.value = facFound.value;
                } else {
                     facultySelect.innerHTML += `<option value="${props.faculty}">${props.faculty}</option>`;
                     facultySelect.value = props.faculty;
                }
            } else if (facultySelect) {
                facultySelect.value = ''; 
            }

            document.getElementById('typeSelect').value = props.type || 'lecture';
            document.getElementById('roomInput').value = props.room || '';
            
            if (targetEvent.start) {
                let dayIndex = targetEvent.start.getDay();
                document.getElementById('daySelect').value = dayIndex === 0 ? 7 : dayIndex;
                const startH = String(targetEvent.start.getHours()).padStart(2, '0');
                const startM = String(targetEvent.start.getMinutes()).padStart(2, '0');
                document.getElementById('startTime').value = `${startH}:${startM}`;
            }
            if (targetEvent.end) {
                const endH = String(targetEvent.end.getHours()).padStart(2, '0');
                const endM = String(targetEvent.end.getMinutes()).padStart(2, '0');
                document.getElementById('endTime').value = `${endH}:${endM}`;
            }
        }, 50);
    }

    function toggleEmptyState(hasEvents) {
        const emptyState = document.getElementById('empty-state');
        const calendarWrapper = document.getElementById('calendar-wrapper');

        if (hasEvents) {
            if (emptyState) emptyState.style.display = 'none';
            if (calendarWrapper) calendarWrapper.style.display = 'block';
            
            if (calendarInstance) {
                setTimeout(() => calendarInstance.updateSize(), 50);
            }
        } else {
            if (emptyState) emptyState.style.display = 'flex';
            if (calendarWrapper) calendarWrapper.style.display = 'none';
        }
    }

    function updateKPIs(events) {
        const totalEl = document.getElementById('kpi-total');
        if (totalEl) {
            totalEl.textContent = events.length;
            document.getElementById('kpi-lecture').textContent = events.filter(e => e.extendedProps.type === 'lecture').length;
            document.getElementById('kpi-lab').textContent = events.filter(e => e.extendedProps.type === 'lab').length;
        }
    }

    function getOrdinal(n) {
        let s = ["th", "st", "nd", "rd"], v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    function openModal() { 
        hideError();
        editingEvent = null; 
        
        const modal = document.getElementById('addClassModal');
        modal.style.display = 'flex';
        
        document.querySelector('#addClassModal .header-text h3').textContent = 'Add New Class';
        document.querySelector('#addClassModal .header-text p').textContent = 'Enter class details based on Curriculum';
        const btnDelete = document.getElementById('btnDeleteClass');
        if(btnDelete) btnDelete.style.display = 'none'; 
        
        document.getElementById('modalYear').value = currentActiveYear === 'all' ? '1' : currentActiveYear;
        document.getElementById('sectionCode').value = '';
        document.getElementById('roomInput').value = '';
        document.getElementById('startTime').value = '07:30';
        document.getElementById('endTime').value = '09:00';
        document.getElementById('courseCode').value = '';
        
        filterSubjects();
        updateSelectDropdowns(); 
    }
    
    function closeModal() { document.getElementById('addClassModal').style.display = 'none'; }

    function setupEventListeners() {
        const dropZone = document.getElementById('dragDropZone');
        const fileInput = document.getElementById('modalFileInput');

        const filterSection = document.getElementById('sectionFilterSelect');
        if (filterSection) {
            filterSection.addEventListener('change', function() {
                loadYearData(currentActiveYear);
            });
        }
        
        const filterFaculty = document.getElementById('facultyFilterSelect');
        if (filterFaculty) {
            filterFaculty.addEventListener('change', function() {
                loadYearData(currentActiveYear);
            });
        }

        const modalYearSelect = document.getElementById('modalYear');
        if (modalYearSelect) {
            modalYearSelect.addEventListener('change', function() {
                if (typeof filterSubjects === 'function') filterSubjects();
                if (typeof updateSelectDropdowns === 'function') updateSelectDropdowns(); 
            });
        }

        if (dropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
                });

            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }

            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
            });

            dropZone.addEventListener('drop', function(e) {
                let dt = e.dataTransfer;
                let files = dt.files;

                if (files.length) {
                    fileInput.files = files;
                    const event = new Event('change');
                    fileInput.dispatchEvent(event);
                }
            });
        }
        
        const container = document.getElementById('schedules');
        if (container) {
            container.addEventListener('click', function(e) {
                const btn = e.target.closest('.toggle-btn');
                if (btn) {
                    container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const year = btn.getAttribute('data-year');
                    loadYearData(year);
                    updateSelectDropdowns();

                    const semDropdown = document.querySelector('.sched-select');
                    const semText = semDropdown && semDropdown.value === "1st Semester" ? "1st Sem" : "2nd Sem";

                    if (year === 'all') {
                        document.getElementById('sched-subtitle').textContent = `All Years • All Sections • ${semText}`;
                    } else {
                        document.getElementById('sched-subtitle').textContent = `${year}${getOrdinal(year)} Year • All Sections • ${semText}`;
                    }
                }
            });
        }
        const termSelect = document.getElementById('academicTermSelect');
        if (termSelect) {
            termSelect.addEventListener('change', function() {
                fetchFromAPI(); // Fetch the schedule for the newly selected term
            });
        }
    }

    function toggleUnassignedAlert() {
        const container = document.getElementById('unassigned-faculty-alert');
        if (container) container.classList.toggle('expanded');
    }

    function updateUnassignedAlert() {
        let pendingSubjects = {};

        for (let year in mockDatabase) {
            if (mockDatabase[year] && mockDatabase[year].events) {
                mockDatabase[year].events.forEach(ev => {
                    let props = ev.extendedProps;
                    
                    if (!props.faculty || props.faculty.toUpperCase() === 'TBA') {
                        let key = `${props.year}_${props.code}_${props.sectionCode}`;
                        
                        if (!pendingSubjects[key]) {
                            pendingSubjects[key] = {
                                year: props.year || currentActiveYear,
                                code: props.code || "Unknown",
                                title: ev.title || "Unknown Subject",
                                section: props.sectionCode || "TBA",
                                lecture: null,
                                lab: null
                            };
                        }

                        let timeStr = "";
                        if (ev.start && ev.end) {
                            const startDt = new Date(ev.start);
                            const endDt = new Date(ev.end);
                            const formatTime = (dt) => {
                                let hours = dt.getHours();
                                let minutes = dt.getMinutes();
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12;
                                hours = hours ? hours : 12;
                                minutes = minutes < 10 ? '0' + minutes : minutes;
                                return `${hours < 10 ? '0' + hours : hours}:${minutes}${ampm}`;
                            };
                            timeStr = `${formatTime(startDt)}–${formatTime(endDt)}`;
                        }

                        if (props.type === 'lecture' || props.type === 'Lec') {
                            pendingSubjects[key].lecture = timeStr;
                        } else {
                            pendingSubjects[key].lab = timeStr;
                        }
                    }
                });
            }
        }

        const subjectsWithoutInstructor = Object.values(pendingSubjects);
        const container = document.getElementById('unassigned-faculty-alert');
        const listContainer = document.getElementById('unassigned-list-container');
        const titleEl = document.getElementById('unassigned-title');
        const badgeEl = document.getElementById('unassigned-badge');

        if (!container || !listContainer || !titleEl || !badgeEl) return;

        const count = subjectsWithoutInstructor.length;

        container.classList.remove('hidden');
        container.classList.remove('expanded');

        if (count === 0) {
            // NEW: Add a success class for CSS styling
            container.classList.add('success-mode');
            
            titleEl.textContent = "All Classes Have Instructors";
            document.querySelector('#unassigned-faculty-alert p').textContent = "No pending assignments for this year level.";
            badgeEl.textContent = "All Clear";
            listContainer.innerHTML = '';
            
            const icon = container.querySelector('.alert-icon-box i');
            if (icon) icon.className = 'bx bx-check-shield';
            return;
        }

        // NEW: Remove the success class if there are warnings
        container.classList.remove('success-mode');
        
        titleEl.textContent = `${count} Subject${count > 1 ? 's' : ''} Without Instructor`;
        document.querySelector('#unassigned-faculty-alert p').textContent = "These classes need a faculty assignment before the schedule is finalized.";
        badgeEl.textContent = `${count} Pending`;
        
        listContainer.innerHTML = '';
        subjectsWithoutInstructor.forEach(sub => {
            let detailsText = `Section: ${sub.section}`;
            if (sub.lecture) detailsText += ` • Lec: ${sub.lecture}`;
            if (sub.lab) detailsText += ` • Lab: ${sub.lab}`;

            const itemHtml = `
                <div class="unassigned-item" onclick="Schedules.jumpToUnassigned('${sub.year}', '${sub.code}', '${sub.section}')">
                    <div class="unassigned-item-left">
                        <div class="unassigned-item-icon">
                            <i class='bx bx-user-x'></i>
                        </div>
                        <div class="unassigned-item-details">
                            <h4>${sub.code} — ${sub.title}</h4>
                            <p>${detailsText}</p>
                        </div>
                    </div>
                    <div class="unassigned-status-badge">No Instructor</div>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
    }

    function deleteClass() {
        if (!editingEvent) return;
        
        showCustomConfirm(
            "Delete Class",
            `Are you sure you want to permanently delete ${editingEvent.title}?`,
            "Delete",
            "Cancel",
            () => { 
                const yearKey = editingEvent.extendedProps.year;
                
                if (mockDatabase[yearKey]) {
                    mockDatabase[yearKey].events = mockDatabase[yearKey].events.filter(e => 
                        !(e.title === editingEvent.title && 
                          e.extendedProps.code === editingEvent.extendedProps.code &&
                          e.extendedProps.type === editingEvent.extendedProps.type)
                    );
                }
                
                syncMemoryToStorage();

                editingEvent.remove();
                updateKPIs(calendarInstance.getEvents());
                
                if (typeof showToast === 'function') showToast("Class deleted successfully.");
                closeModal();
            },
            null 
        );
    }

    window.Schedules = {
        init, 
        addEvent: openModal, 
        closeModal, 
        saveClass,
        deleteClass,
        exportToExcel,
        onSubjectChange, 
        filterSubjects,
        triggerImport, 
        handleImport,
        closeImportModal,
        toggleUnassignedAlert,
        jumpToUnassigned
    };
    
    if(document.getElementById('calendar')) {
        init();
    }
    
    let pendingFile = null;

    function triggerImport() {
        const modal = document.getElementById('importModal');
        if (modal) {
            resetImportModal(); 
            modal.style.display = 'flex';
        }
    }

    function closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) modal.style.display = 'none';
        resetImportModal(); 
    }

    function resetImportModal() {
        pendingFile = null;
        
        const dropZone = document.getElementById('dropZoneDefault');
        if (dropZone) dropZone.style.display = ''; 
        
        const fileInfo = document.getElementById('fileInfoDisplay');
        if (fileInfo) fileInfo.style.display = 'none';
        
        const banner = document.getElementById('importSuccessBanner');
        if (banner) banner.style.display = 'none';
        
        const fileInput = document.getElementById('modalFileInput');
        if (fileInput) fileInput.value = ''; 

        function triggerFileSelect(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation(); 
            }
            if (fileInput) {
                fileInput.value = null; 
                fileInput.onchange = handleImport; 
                fileInput.click();
            }
        }

        const importBtn = document.querySelector('#importModal .btn-primary');
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = `<i class='bx bx-upload'></i> Import`;
            importBtn.onclick = triggerFileSelect;
        }

        if (dropZone) {
            dropZone.onclick = function(e) {
                if (e.target !== importBtn && !importBtn.contains(e.target)) {
                    triggerFileSelect(e);
                }
            };
        }
    }

    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        pendingFile = file;

        document.getElementById('dropZoneDefault').style.display = 'none';
        document.getElementById('fileInfoDisplay').style.display = 'block';
        document.getElementById('fileNameText').textContent = file.name;
        document.getElementById('fileSizeText').textContent = (file.size / 1024).toFixed(1) + " KB";
        document.getElementById('importSuccessBanner').style.display = 'none';

        const importBtn = document.querySelector('#importModal .btn-primary');
        if (importBtn) {
            importBtn.disabled = false; 
            importBtn.innerHTML = `<i class='bx bx-check-circle'></i> Finish Import`;
            importBtn.onclick = function(e) {
                if (e) e.preventDefault(); 
                executeImport();
            };
        }
    }

    function executeImport() {
        if (!pendingFile) return;

        const importBtn = document.querySelector('#importModal .btn-primary');
        if (importBtn) {
            importBtn.innerHTML = `<i class='bx bx-loader bx-spin'></i> Processing...`;
            importBtn.disabled = true; 
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            
            const count = processExcelData(jsonData, true);
            
            if (count > 0) {
                closeImportModal();
                showToast(`Successfully imported ${count} CPE schedule entries.`);
            } else {
                const banner = document.getElementById('importSuccessBanner');
                const msg = document.getElementById('successMessageText');

                msg.textContent = `Failed to process. Make sure the file matches the expected format.`;
                banner.style.display = 'flex';
                banner.style.backgroundColor = '#fde8e8';
                banner.style.borderColor = '#f8b4b4';
                banner.style.color = '#c53030';
                
                if (importBtn) {
                    importBtn.disabled = false;
                    importBtn.innerHTML = `<i class='bx bx-upload'></i> Try Again`;
                    importBtn.onclick = function(e) {
                        if (e) e.preventDefault();
                        document.getElementById('modalFileInput').click();
                    };
                }
            }
        };
        reader.readAsArrayBuffer(pendingFile);
    }

    function processExcelData(data, silent = false) {
        let count = 0;
        let colMap = { code: 2, title: 3, course: 4, section: 11, timeLec: 12, timeLab: 13, dayLec: 14, dayLab: 15, roomLec: 16, roomLab: 17, faculty: 18 };
        
        const headerRows = data.slice(0, 3);
        headerRows.forEach(row => {
            row.forEach((cell, index) => {
                if (!cell) return;
                let text = String(cell).toUpperCase();
                if (text.includes("CODE")) colMap.code = index;
                if (text === "COURSE") colMap.course = index;
                if (text.includes("SECTION")) colMap.section = index;
                if (text === "FACULTY") colMap.faculty = index;
                if (text.includes("DESCRIPTIVE TITLE")) colMap.title = index;
            });
        });

        for (let i = 3; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 10) continue;

            let code = String(row[colMap.code] || '').trim();
            let title = String(row[colMap.title] || '').trim();
            let course = String(row[colMap.course] || '').trim();
            let section = String(row[colMap.section] || '').trim();
            let faculty = String(row[colMap.faculty] || '').trim();

            if (!code || !title) continue;

            const courseLower = course.toLowerCase();
            const isCPE = courseLower.includes('cpe') || courseLower.includes('bscpe') || courseLower.includes('computer engineering');
            if (!isCPE) continue; 

            if (faculty && faculty !== 'undefined') importedFaculty.add(faculty);
            if (section && section !== 'undefined') importedSections.add(section);

            let targetYear = currentActiveYear === 'all' ? '1' : currentActiveYear; 
            const yearMatch = course.match(/-(\d)/); 
            if (yearMatch) targetYear = yearMatch[1];
            
            let yearColor = '#ef4444'; 
            if (targetYear == "2") yearColor = '#3b82f6'; 
            if (targetYear == "3") yearColor = '#10b981'; 
            if (targetYear == "4") yearColor = '#8b5cf6'; 

            if (!mockDatabase[targetYear]) mockDatabase[targetYear] = { color: yearColor, events: [] };

            let rowEvents = [];

            extractAndAddEvent('lecture', row[colMap.timeLec], row[colMap.dayLec], row[colMap.roomLec], code, title, section, faculty, rowEvents, yearColor);
            extractAndAddEvent('lab', row[colMap.timeLab], row[colMap.dayLab], row[colMap.roomLab], code, title, section, faculty, rowEvents, yearColor);

            if (rowEvents.length > 0) {
                rowEvents.forEach(ev => {
                    ev.extendedProps.year = targetYear;
                    
                    let isDuplicate = mockDatabase[targetYear].events.some(e => 
                        e.start === ev.start && 
                        e.extendedProps.code === ev.extendedProps.code && 
                        e.extendedProps.sectionCode === ev.extendedProps.sectionCode &&
                        e.extendedProps.type === ev.extendedProps.type
                    );

                    if (!isDuplicate) {
                        mockDatabase[targetYear].events.push(ev);
                        count++;
                    }
                });
            }
        }

        if (count > 0) {
            updateSelectDropdowns();
            syncMemoryToStorage();
            loadYearData(currentActiveYear);
            
            if (!silent) showToast(`Successfully imported ${count} new CPE entries.`);
            return count;
        } else if (!silent) {
            showToast(`All imported classes already exist. No duplicates added.`);
            return 0;
        }
        return 0;
    }

    function updateSelectDropdowns() {
        const sectionSelect = document.getElementById('modalSection');
        const filterFaculty = document.getElementById('facultyFilterSelect');
        let filterSection = filterSelects.length > 1 ? filterSelects[1] : null;

        const modalYearSelect = document.getElementById('modalYear');
        const modalYear = modalYearSelect ? modalYearSelect.value : currentActiveYear;

        if (sectionSelect && importedSections.size > 0) {
            sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
            Array.from(importedSections).sort().forEach(sec => {
                const secYear = getYearFromSection(sec);
                if (secYear === String(modalYear) || !secYear || modalYear === 'all') {
                    sectionSelect.innerHTML += `<option value="${sec}">${sec}</option>`;
                }
            });
        }

        if (filterSection && importedSections.size > 0) {
            filterSection.innerHTML = '<option value="all">All Sections</option>';
            Array.from(importedSections).sort().forEach(sec => {
                const secYear = getYearFromSection(sec);
                if (currentActiveYear === 'all' || secYear === String(currentActiveYear) || !secYear) {
                    filterSection.innerHTML += `<option value="${sec}">${sec}</option>`;
                }
            });
        }

        populateFaculty();
    }

    function extractAndAddEvent(type, timeStr, dayStr, roomStr, code, title, section, faculty, importedEvents, colorHash) {
        if (!timeStr || !dayStr || String(timeStr).trim() === '' || String(dayStr).trim() === '') return;
        const times = parseAdvancedTime(String(timeStr));
        if (!times) return; 
        const days = parseAdvancedDays(String(dayStr));
        
        const color = hashColor(code + type);

        days.forEach(date => {
            importedEvents.push({
                title: title,
                start: `${date}T${times.start}:00`,
                end: `${date}T${times.end}:00`,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    code: code,
                    sectionCode: section,
                    type: type,
                    room: roomStr ? String(roomStr).trim() : 'TBA',
                    faculty: faculty
                }
            });
        });
    }

    function getYearFromSection(sectionCode) {
        if (!sectionCode) return null;
        
        const parts = String(sectionCode).trim().split('-');
        
        if (parts.length >= 3) {
            const programYear = parts[2]; 
            const match = programYear.match(/\d/); 
            if (match) return match[0];
        }
        return null; 
    }

    function parseAdvancedTime(timeStr) {
        if (!timeStr) return null;
        
        const part = String(timeStr).split('/')[0].trim();
        
        const match = part.match(/(\d{1,2})[:]+(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2})[:]+(\d{2})\s*(AM|PM)/i);
        if (!match) return null;

        let startH = parseInt(match[1]);
        const startM = match[2]; 
        const startMeridiem = match[3].toUpperCase();
        
        let endH = parseInt(match[4]);
        const endM = match[5]; 
        const endMeridiem = match[6].toUpperCase();

        if (startMeridiem === 'PM' && startH !== 12) startH += 12;
        if (startMeridiem === 'AM' && startH === 12) startH = 0;
        if (endMeridiem === 'PM' && endH !== 12) endH += 12;
        if (endMeridiem === 'AM' && endH === 12) endH = 0;

        const formatHHMM = (h, m) => `${h.toString().padStart(2, '0')}:${m}`;

        return {
            start: formatHHMM(startH, startM),
            end: formatHHMM(endH, endM)
        };
    }

    function parseAdvancedDays(daysStr) {
        if (!daysStr) return [];
        
        const splitDays = String(daysStr).split(/[/,]/).map(d => d.trim().toUpperCase()).filter(Boolean);
        
        let dates = [];
        
        splitDays.forEach(day => {
            if (day === 'MON' || day === 'MONDAY' || day === 'M') dates.push('2026-02-09');
            if (day === 'TUE' || day === 'TUESDAY' || day === 'T') dates.push('2026-02-10');
            if (day === 'WED' || day === 'WEDNESDAY' || day === 'W') dates.push('2026-02-11');
            if (day === 'THU' || day === 'THURSDAY' || day === 'TH') dates.push('2026-02-12');
            if (day === 'FRI' || day === 'FRIDAY' || day === 'F') dates.push('2026-02-13');
            if (day === 'SAT' || day === 'SATURDAY' || day === 'S') dates.push('2026-02-14');
        });

        return [...new Set(dates)];
    }

    function showCustomConfirm(title, message, confirmText, cancelText, onConfirm, onCancel) {
        let modal = document.getElementById('aerisConfirmModal');
        
        if (!modal) {
            const html = `
            <div id="aerisConfirmModal" class="aeris-confirm-overlay">
                <div class="aeris-confirm-card">
                    <div class="aeris-confirm-header">
                        <div class="aeris-confirm-icon">
                            <i class='bx bx-question-mark'></i>
                        </div>
                        <h3 id="aerisConfirmTitle">Confirm Action</h3>
                    </div>
                    <div class="aeris-confirm-body">
                        <p id="aerisConfirmMessage">Are you sure?</p>
                    </div>
                    <div class="aeris-confirm-actions">
                        <button id="aerisConfirmCancel" class="btn-secondary">Cancel</button>
                        <button id="aerisConfirmOk" class="btn-primary">Confirm</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            modal = document.getElementById('aerisConfirmModal');
        }

        document.getElementById('aerisConfirmTitle').textContent = title;
        document.getElementById('aerisConfirmMessage').textContent = message;
        document.getElementById('aerisConfirmOk').textContent = confirmText || 'Confirm';
        document.getElementById('aerisConfirmCancel').textContent = cancelText || 'Cancel';

        modal.style.display = 'flex';

        const btnOk = document.getElementById('aerisConfirmOk');
        const btnCancel = document.getElementById('aerisConfirmCancel');

        const newBtnOk = btnOk.cloneNode(true);
        const newBtnCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnOk.addEventListener('click', () => {
            modal.style.display = 'none';
            if (onConfirm) onConfirm();
        });

        newBtnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
            if (onCancel) onCancel();
        });
    }

    function showToast(message) {
        const existingToast = document.getElementById('custom-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'custom-toast';
        toast.innerHTML = `<i class='bx bx-check-circle' style='font-size: 1.2rem; margin-right: 8px;'></i> ${message}`;
        
        Object.assign(toast.style, {
            position: 'fixed', bottom: '30px', right: '30px', backgroundColor: '#10B981',
            color: 'white', padding: '14px 24px', borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px',
            fontWeight: '500', zIndex: '9999', display: 'flex', alignItems: 'center',
            opacity: '0', transform: 'translateY(20px)', transition: 'opacity 0.3s ease, transform 0.3s ease'
        });

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300); 
        }, 3500);
    }
})();