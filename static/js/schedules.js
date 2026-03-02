(function() {
    let calendarInstance = null;
    let currentActiveYear = "1"; 
    let importedFaculty = new Set();
    let importedSections = new Set();
    let editingEvent = null;
    
    // 1. FACULTY LIST (Fetched via API in init)
    
    // 2. FULL CURRICULUM DATA
    let curriculumData = [];

    // 3. MOCK DATABASE
    const mockDatabase = {
        "1": { color: '#ef4444', events: [] }, // Professional Red
        "2": { color: '#3b82f6', events: [] }, // Professional Blue
        "3": { color: '#10b981', events: [] }, // Professional Green
        "4": { color: '#8b5cf6', events: [] }  // Professional Purple
    };

    const COLOR_PALETTE = [
        'hsl(210, 90%, 55%)',
        'hsl(160, 60%, 45%)',
        'hsl(35, 90%, 55%)',
        'hsl(280, 60%, 55%)',
        'hsl(0, 70%, 55%)',
        'hsl(195, 80%, 45%)',
    ];

    function hashColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
        return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
    }

    function init() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        if (typeof FullCalendar === 'undefined') {
            setTimeout(init, 1000);
            return;
        }

        if (calendarInstance) calendarInstance.destroy();

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
            
            // --- NEW: SUGGESTION 5 (Click to Edit/Delete) ---
            eventClick: function(info) {
                const ev = info.event;
                editingEvent = ev; // Set global state
                const props = ev.extendedProps;
                
                // 1. Open the modal and hide errors
                const modal = document.getElementById('addClassModal');
                if (modal) modal.style.display = 'flex';
                
                const errorBanner = document.getElementById('modalError');
                if (errorBanner) errorBanner.style.display = 'none';
                
                // 2. Change Modal UI to "Edit Mode"
                document.querySelector('#addClassModal .header-text h3').textContent = 'Edit Class';
                document.querySelector('#addClassModal .header-text p').textContent = `Editing: ${ev.title}`;
                
                const btnDelete = document.getElementById('btnDeleteClass');
                if (btnDelete) btnDelete.style.display = 'inline-flex';
                
                // 3. Auto-Detect Year & Semester FIRST
                document.getElementById('modalYear').value = props.year || currentActiveYear;
                
                if (props.code && typeof curriculumData !== 'undefined' && curriculumData.length > 0) {
                    const cleanPropCode = props.code.trim().toUpperCase();
                    const subjectData = curriculumData.find(s => s.code.trim().toUpperCase() === cleanPropCode);
                    if (subjectData && subjectData.sem) {
                        const semSelect = document.getElementById('modalSem');
                        if (semSelect) semSelect.value = subjectData.sem;
                    }
                }
                
                // Reload the dropdowns based on the detected Year/Sem
                if (typeof filterSubjects === 'function') filterSubjects();
                
                // 4. Smart Dropdown Selection with Fallbacks
                setTimeout(() => {
                    // Select Subject
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
                    
                    // Select Section
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

                    // Select Faculty (Displays current instructor, or leaves blank if TBA)
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
                        facultySelect.value = ''; // Leave blank if TBA
                    }

                    // Fill remaining fields
                    document.getElementById('typeSelect').value = props.type || 'lecture';
                    document.getElementById('roomInput').value = props.room || '';
                    
                    // Format Time and Day precisely
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
            
            // Inject EXACT React HTML Structure into Events
            eventContent: function(arg) {
                let props = arg.event.extendedProps;
                let facultyShort = props.faculty ? props.faculty.split(',')[0] : 'TBA';
                let room = props.room || 'TBA';
                let timeText = arg.timeText; // <-- Get time explicitly from FullCalendar
                
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
        
        // FIX: Force update size after a short delay to handle "hidden tab" rendering issues
        setTimeout(() => {
            calendarInstance.updateSize();
        }, 200);

        fetchCurriculumData();
        loadYearData(currentActiveYear);
        populateFaculty(); 
        setupEventListeners();
    }

    fetch('/api/schedules')
    .then(res => res.json())
    .then(data => {
        // Clear old mock data
        for (let year in mockDatabase) mockDatabase[year].events = [];
        
        // Put database events into the mockDatabase structure
        data.forEach(event => {
            let year = event.extendedProps.year;
            if (!mockDatabase[year]) mockDatabase[year] = { color: event.backgroundColor, events: [] };
            mockDatabase[year].events.push(event);
        });
        
        // Render the calendar
        loadYearData(currentActiveYear);
    });

    // --- NEW: SUGGESTION 3 (Fetch Curriculum) ---
    function fetchCurriculumData() {
        fetch('/api/subjects')
            .then(res => res.json())
            .then(data => {
                if (data.length > 0) {
                    curriculumData = data;
                }
                filterSubjects(); // Refresh dropdowns
            })
            .catch(err => console.error("Failed to load curriculum", err));
    }

    // --- POPULATE FACULTY (Connected to API) ---
    function populateFaculty() {
        const facultySelect = document.getElementById('facultySelect');
        const filterSelects = document.querySelectorAll('.controls-group select');
        let filterFaculty = filterSelects.length > 2 ? filterSelects[2] : null;

        if (!facultySelect) return;
        
        fetch('/api/instructors')
            .then(response => response.json())
            .then(data => {
                // Merge Database Faculty with Imported Faculty
                let combinedFaculty = new Set(importedFaculty);
                data.forEach(fac => combinedFaculty.add(fac.name.toUpperCase()));

                // 1. Populate Modal Dropdown
                facultySelect.innerHTML = '<option value="">-- Select Instructor --</option>';
                Array.from(combinedFaculty).sort().forEach(fac => {
                    facultySelect.innerHTML += `<option value="${fac}">${fac}</option>`;
                });

                // 2. Populate Dashboard Filter Dropdown
                if (filterFaculty) {
                    filterFaculty.innerHTML = '<option value="all">All Faculty</option>';
                    Array.from(combinedFaculty).sort().forEach(fac => {
                        filterFaculty.innerHTML += `<option value="${fac}">${fac}</option>`;
                    });
                }
            })
            .catch(err => {
                console.error("Error loading API faculty, falling back to Excel data only:", err);
                
                // Fallback: Just use Excel data if API fails
                facultySelect.innerHTML = '<option value="">-- Select Instructor --</option>';
                Array.from(importedFaculty).sort().forEach(fac => {
                    facultySelect.innerHTML += `<option value="${fac}">${fac}</option>`;
                });
            });
    }

    // --- NEW: SUGGESTION 2 (Smart Conflicts) ---
    function isOverlapping(newStart, newEnd, targetYear, checkRoom, checkFaculty, excludeEvent = null) {
        let eventsToCheck = [];
        
        // Always check ALL events across all years to prevent room/faculty double booking
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
            // If time overlaps...
            if (newStart < ev.end && newEnd > ev.start) {
                // 1. Room Conflict (Don't check if TBA)
                if (checkRoom && checkRoom !== 'TBA' && checkRoom.toUpperCase() === ev.room?.toUpperCase()) {
                    return `Room Conflict: ${ev.room} is already booked for ${ev.title}.`;
                }
                // 2. Instructor Conflict (Don't check if TBA)
                if (checkFaculty && checkFaculty !== 'TBA' && checkFaculty.toUpperCase() === ev.faculty?.toUpperCase()) {
                    return `Instructor Conflict: ${ev.faculty} is already teaching ${ev.title}.`;
                }
                // 3. Student Conflict (Same Year Level shouldn't overlap)
                if (targetYear === ev.year) {
                    return `Student Conflict: Time overlaps with ${ev.title} for Year ${targetYear}.`;
                }
            }
        }
        return false;
    }

    function handleScheduleChange(info) {
    const ev = info.event;
    const yearKey = ev.extendedProps.year;
    
    // Find the event in the database and update its times
    if (mockDatabase[yearKey]) {
        let dbEvent = mockDatabase[yearKey].events.find(e => 
            e.title === ev.title && e.extendedProps.code === ev.extendedProps.code
        );
        if (dbEvent) {
            // Convert FullCalendar dates back to standard local strings
            dbEvent.start = ev.start.toISOString().substring(0,19); 
            dbEvent.end = ev.end.toISOString().substring(0,19);
        }
    }
    
    alert(`✅ Schedule Updated!\n\nSubject: ${ev.title}`);
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

        // Convert day index to date
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

        const color = hashColor(subData.code + type);
        const newEvent = {
    // If we are editing, keep the database ID
            id: editingEvent ? editingEvent.id : null, 
            title: subData.title,
            start: `${date}T${start}:00`,
            end: `${date}T${end}:00`,
            backgroundColor: color,
            borderColor: color,
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
                        // FIXED: Use oldYear
                        if (mockDatabase[oldYear]) { 
                            mockDatabase[oldYear].events = mockDatabase[oldYear].events.filter(e => 
                                !(e.title === editingEvent.title && e.extendedProps.code === editingEvent.extendedProps.code)
                            );
                        }
                        editingEvent.remove(); // Remove from UI
                    }
                    if (!mockDatabase[modalYear]) mockDatabase[modalYear] = { color: color, events: [] };
                    mockDatabase[modalYear].events.push(newEvent);

                    if (modalYear === currentActiveYear) {
                calendarInstance.addEvent(newEvent);
                updateKPIs(calendarInstance.getEvents());
                toggleEmptyState(true); // Ensure calendar is visible after adding
            } else {
                alert(`Class saved to ${modalYear}${getOrdinal(modalYear)} Year schedule.`);
            }

        Schedules.closeModal();
    }

    // --- UPDATED: EXPORT TO EXCEL (WITH CALCULATED HOURS & COLORS) ---
    function exportToExcel() {
        let groupedData = {};

        // 1. Group events and mathematically calculate the duration (hours)
        for (let year in mockDatabase) {
            if (mockDatabase[year] && mockDatabase[year].events) {
                mockDatabase[year].events.forEach(ev => {
                    let props = ev.extendedProps;
                    let key = `${props.year}_${props.code}_${props.sectionCode}_${props.faculty}`;

                    if (!groupedData[key]) {
                        groupedData[key] = {
                            campus: "CARMEN",
                            code: props.code || "",
                            title: ev.title || "",
                            course: `BSCPE-${props.year}`, 
                            section: props.sectionCode || "",
                            faculty: props.faculty || "",
                            lecTimes: new Set(), lecDays: new Set(), lecRooms: new Set(), lecHrs: 0,
                            labTimes: new Set(), labDays: new Set(), labRooms: new Set(), labHrs: 0
                        };
                    }

                    let timeStr = "";
                    let dayStr = "";
                    let durationHrs = 0; // Will hold the calculated hours

                    if (ev.start && ev.end) {
                        const startDt = new Date(ev.start);
                        const endDt = new Date(ev.end);
                        
                        // Calculate difference in exact hours (e.g., 1.5 for 1 hr 30 mins)
                        durationHrs = (endDt - startDt) / (1000 * 60 * 60);
                        
                        // Strict format to "09:00AM"
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

                    // Distribute data and append hours
                    if (props.type === 'lecture' || props.type === 'Lec') {
                        if (timeStr) groupedData[key].lecTimes.add(timeStr);
                        if (dayStr) groupedData[key].lecDays.add(dayStr);
                        if (props.room) groupedData[key].lecRooms.add(props.room);
                        groupedData[key].lecHrs += durationHrs; // Add calculated time
                    } else {
                        if (timeStr) groupedData[key].labTimes.add(timeStr);
                        if (dayStr) groupedData[key].labDays.add(dayStr);
                        if (props.room) groupedData[key].labRooms.add(props.room);
                        groupedData[key].labHrs += durationHrs; // Add calculated time
                    }
                });
            }
        }

        // 2. Build the EXACT layout matching the CSV Template
        let aoa = [
            ["", "", "", "", "", "", "", "", "", "", "", "", "Time", "", "Days", "", "Room", "", "Faculty"],
            ["", "CAMPUS", "Code", "Descriptive Title", "Course", "Units", "", "", "Teaching Hours", "", "", "Section", "FACE TO FACE", "", "FACE TO FACE", "", "", "", ""],
            ["", "", "", "", "", "Lec", "Lab", "Total", "Lec", "Lab", "Total", "", "Lec", "LAB", "Lec", "LAB", "Lec", "Lab", ""],
            [] // Empty row 4 just like the template
        ];

        // 3. Process grouped data into rows
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

            // Calculate Units & Totals (Will default to 0 if none)
            let lecU = row.lecHrs || 0;
            let labU = row.labHrs || 0;
            let totalU = lecU + labU;

            aoa.push([
                "", // Col 0 (Empty)
                row.campus, 
                row.code, 
                row.title, 
                row.course, 
                lecU, labU, totalU,   // Calculated Units
                lecU, labU, totalU,   // Calculated Teaching Hours
                row.section, 
                lecTimeFormat, 
                labTimeFormat, 
                lecDayFormat, 
                labDayFormat, 
                lecRoomFormat, 
                labRoomFormat, 
                row.faculty 
            ]);
        });

        // Abort if calendar is empty
        if (aoa.length <= 4) {
            if (typeof showToast === 'function') showToast("No classes found to export.");
            else alert("No classes found to export.");
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Apply column merges
        ws['!merges'] = [
            { s: {r:0, c:12}, e: {r:0, c:13} }, // Time
            { s: {r:0, c:14}, e: {r:0, c:15} }, // Days
            { s: {r:0, c:16}, e: {r:0, c:17} }, // Room
            { s: {r:1, c:12}, e: {r:1, c:13} }, // FACE TO FACE (Time)
            { s: {r:1, c:14}, e: {r:1, c:15} }, // FACE TO FACE (Days)
            { s: {r:1, c:5}, e: {r:1, c:7} },   // Units
            { s: {r:1, c:8}, e: {r:1, c:10} }   // Teaching Hours
        ];

        // Ensure columns are perfectly spaced out
        ws['!cols'] = [
            { wch: 3 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 10 }, 
            { wch: 5 }, { wch: 5 }, { wch: 6 }, { wch: 5 }, { wch: 5 }, { wch: 6 }, 
            { wch: 18 }, { wch: 35 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, 
            { wch: 15 }, { wch: 15 }, { wch: 30 }
        ];

        // --- NEW: ADVANCED EXCEL CELL STYLING (COLORS & BORDERS) ---
        const headerStyle = {
            fill: { fgColor: { rgb: "#550000" } }, // Light professional blue background
            font: { bold: true, color: { rgb: "000000" }, name: "Arial", sz: 10 },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const dataStyle = {
            alignment: { horizontal: "center", vertical: "center" },
            font: { name: "Arial", sz: 10 }
        };

        // Loop through the entire sheet to apply colors and alignment
        let range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                let cellAddress = XLSX.utils.encode_cell({r: R, c: C});
                if (!ws[cellAddress]) continue;

                // First 3 rows get Header colors, everything else gets normal alignment
                if (R <= 2) {
                    ws[cellAddress].s = headerStyle;
                } else {
                    ws[cellAddress].s = dataStyle;
                }
            }
        }

        // Generate and download
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Class Schedules");
        XLSX.writeFile(wb, "AERIS_Class_Schedules.xlsx");
        
        if (typeof showToast === 'function') showToast("Schedule exported successfully with hours calculated!");
    }

    function getNextDayOfWeek(dayIndex) {
        // Base date: Feb 9 2026 is a Monday
        const baseDay = 9; 
        const offset = dayIndex - 1; // Mon=1 -> offset=0
        const targetDay = baseDay + offset;
        const dayStr = targetDay < 10 ? `0${targetDay}` : targetDay;
        return `2026-02-${dayStr}`;
    }

    function loadYearData(yearKey) {
        if (!calendarInstance) return;
        currentActiveYear = yearKey;
        calendarInstance.removeAllEvents();
        
        let allEventsToDisplay = [];

        // 1. Get all events for the selected year (or all years)
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

        // --- NEW: APPLY DASHBOARD FILTERS ---
        // Find the top filter dropdowns (Assuming Section is index 1, Faculty is index 2)
        const filterSelects = document.querySelectorAll('.controls-group select');
        const sectionFilter = filterSelects.length > 1 ? filterSelects[1].value : 'all';
        const facultyFilter = filterSelects.length > 2 ? filterSelects[2].value : 'all';

        // Filter the events if a specific section or faculty is selected
        if (sectionFilter !== 'all' || facultyFilter !== 'all') {
            allEventsToDisplay = allEventsToDisplay.filter(ev => {
                let matchSection = true;
                let matchFaculty = true;

                if (sectionFilter !== 'all') {
                    // Make sure to handle potential undefined values gracefully
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
        // --- END OF FILTERING ---

        // 3. Display the events
        if (allEventsToDisplay.length > 0) {
            calendarInstance.addEventSource(allEventsToDisplay);
            updateKPIs(allEventsToDisplay); // KPIs will now reflect the filtered count!
            toggleEmptyState(true); 
        } else {
            updateKPIs([]);
            toggleEmptyState(false); 
        }
        updateUnassignedAlert();
    }

    function jumpToUnassigned(year, code, section) {
        // 1. Ensure the calendar is showing the correct year
        if (currentActiveYear !== year && currentActiveYear !== 'all') {
            // Update the toggle UI visually
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.year === String(year)) btn.classList.add('active');
            });
            
            // Reset Dashboard dropdown filters so the class doesn't stay hidden
            const filterSelects = document.querySelectorAll('.controls-group select');
            if (filterSelects.length > 1) filterSelects[1].value = 'all'; // Reset Section
            if (filterSelects.length > 2) filterSelects[2].value = 'all'; // Reset Faculty
            
            loadYearData(year); // Reload calendar with correct year
        }

        // 2. Find the exact event object in the calendar
        const events = calendarInstance.getEvents();
        const targetEvent = events.find(ev => 
            ev.extendedProps.code === code && 
            ev.extendedProps.sectionCode === section &&
            (!ev.extendedProps.faculty || ev.extendedProps.faculty.toUpperCase() === 'TBA')
        );

        if (!targetEvent) return;

        // 3. Jump the calendar UI to the exact date of the class
        if (targetEvent.start) {
            calendarInstance.gotoDate(targetEvent.start);
        }

        // 4. Collapse the alert panel so it gets out of the way
        const container = document.getElementById('unassigned-faculty-alert');
        if (container) container.classList.remove('expanded');

        // 5. Open the Edit Modal automatically
        editingEvent = targetEvent; 
        const props = targetEvent.extendedProps;
        
        const modal = document.getElementById('addClassModal');
        if (modal) modal.style.display = 'flex';
        
        const errorBanner = document.getElementById('modalError');
        if (errorBanner) errorBanner.style.display = 'none';
        
        // Update Modal Headers
        document.querySelector('#addClassModal .header-text h3').textContent = 'Assign Instructor';
        document.querySelector('#addClassModal .header-text p').textContent = `Resolving unassigned faculty for: ${targetEvent.title}`;
        
        const btnDelete = document.getElementById('btnDeleteClass');
        if (btnDelete) btnDelete.style.display = 'inline-flex';
        
        // --- THE FIX: Auto-Detect Year & Semester FIRST ---
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
        
        // --- THE FIX: Smart Dropdown Selection with Fallbacks ---
        setTimeout(() => {
            // Select Subject
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
            
            // Select Section
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

            // Select Faculty (Even though it's unassigned, this ensures any existing TBA text is handled)
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
                facultySelect.value = ''; // Leave blank if TBA so they can immediately select one
            }

            // Fill remaining fields
            document.getElementById('typeSelect').value = props.type || 'lecture';
            document.getElementById('roomInput').value = props.room || '';
            
            // Format Time and Day
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
        emptyState.style.display = 'none';
        calendarWrapper.style.display = 'block';
        
        // Force FullCalendar to recalculate its size when it becomes visible again
        if (calendarInstance) {
            setTimeout(() => calendarInstance.updateSize(), 50);
        }
    } else {
        emptyState.style.display = 'flex';
        calendarWrapper.style.display = 'none';
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
        editingEvent = null; // <-- Reset editing state
        
        const modal = document.getElementById('addClassModal');
        modal.style.display = 'flex';
        
        // Reset UI to "Add Mode"
        document.querySelector('#addClassModal .header-text h3').textContent = 'Add New Class';
        document.querySelector('#addClassModal .header-text p').textContent = 'Enter class details based on Curriculum';
        const btnDelete = document.getElementById('btnDeleteClass');
        if(btnDelete) btnDelete.style.display = 'none'; // Hide delete button
        
        // Clear all fields
        document.getElementById('modalYear').value = currentActiveYear;
        document.getElementById('sectionCode').value = '';
        document.getElementById('roomInput').value = '';
        document.getElementById('startTime').value = '07:30';
        document.getElementById('endTime').value = '09:00';
        document.getElementById('courseCode').value = '';
        
        filterSubjects();
        populateFaculty(); 
    }
    
    function closeModal() { document.getElementById('addClassModal').style.display = 'none'; }

    function setupEventListeners() {
        const dropZone = document.getElementById('dragDropZone');
        const fileInput = document.getElementById('modalFileInput');

        // --- NEW: Listen for Dropdown Changes ---
        const filterSelects = document.querySelectorAll('.controls-group select');
        
        // Section Dropdown Listener
        if (filterSelects.length > 1) {
            filterSelects[1].addEventListener('change', function() {
                loadYearData(currentActiveYear);
            });
        }
        
        // Faculty Dropdown Listener
        if (filterSelects.length > 2) {
            filterSelects[2].addEventListener('change', function() {
                loadYearData(currentActiveYear);
            });
        }

        if (dropZone) {
    // Prevent default browser behavior (which is to open the file in a new tab)
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
            });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
            }

    // Add highlight effect when dragging over
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });

    // Handle dropped files
        dropZone.addEventListener('drop', function(e) {
            let dt = e.dataTransfer;
            let files = dt.files;

        if (files.length) {
            // Assign the dropped file to the hidden input
            fileInput.files = files;
            // Manually trigger your existing handleImport event
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
                    const semText = document.querySelector('.sched-select').value === "1st Semester" ? "1st Sem" : "2nd Sem";
                    document.getElementById('sched-subtitle').textContent = `${year}${getOrdinal(year)} Year • Section 1 • ${semText}`;
                }
            });
        }
        
    }

    // --- NEW: Dynamic Alert Card Logic ---
    function toggleUnassignedAlert() {
        const container = document.getElementById('unassigned-faculty-alert');
        if (container) container.classList.toggle('expanded');
    }

    function updateUnassignedAlert() {
        let pendingSubjects = {};

        // 1. Scan the database to group unassigned classes
        for (let year in mockDatabase) {
            if (mockDatabase[year] && mockDatabase[year].events) {
                mockDatabase[year].events.forEach(ev => {
                    let props = ev.extendedProps;
                    
                    // Filter: Class has no assigned faculty
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

                        // Format Time logic exactly to HH:MM AM/PM
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

        // 2. Hide component if no pending assignments exist
        if (count === 0) {
            container.classList.add('hidden');
            return;
        }

        // 3. Render Component Data
        container.classList.remove('hidden');
        titleEl.textContent = `${count} Subject${count > 1 ? 's' : ''} Without Instructor`;
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

    // Expose public methods
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
    
    // Auto-init if the calendar div exists immediately (for safety)
    if(document.getElementById('calendar')) {
        init();
    }
    let pendingFile = null;

    function triggerImport() {
        const modal = document.getElementById('importModal');
        if (modal) {
            resetImportModal(); // Ensure it's clean when opened
            modal.style.display = 'flex';
        }
    }

    function closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) modal.style.display = 'none';
        resetImportModal(); // Clean up state when closing
    }

    function resetImportModal() {
        pendingFile = null;
        
        // Reset UI Elements
        const dropZone = document.getElementById('dropZoneDefault');
        if (dropZone) dropZone.style.display = ''; 
        
        const fileInfo = document.getElementById('fileInfoDisplay');
        if (fileInfo) fileInfo.style.display = 'none';
        
        const banner = document.getElementById('importSuccessBanner');
        if (banner) banner.style.display = 'none';
        
        const fileInput = document.getElementById('modalFileInput');
        if (fileInput) fileInput.value = ''; 

        // --- THE FIX: Unified function to safely trigger the file picker ---
        function triggerFileSelect(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation(); // Stops the "double click" bug
            }
            if (fileInput) {
                fileInput.value = null; // Wipe memory right before opening
                fileInput.onchange = handleImport; // Force the event listener to attach
                fileInput.click();
            }
        }

        // Attach to the primary Import Button
        const importBtn = document.querySelector('#importModal .btn-primary');
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = `<i class='bx bx-upload'></i> Import`;
            importBtn.onclick = triggerFileSelect;
        }

        // Attach to the Drag & Drop Zone Area
        if (dropZone) {
            dropZone.onclick = function(e) {
                // Ensure clicking the button inside the zone doesn't trigger this twice
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

        // 1. Update UI to show the selected file
        document.getElementById('dropZoneDefault').style.display = 'none';
        document.getElementById('fileInfoDisplay').style.display = 'block';
        document.getElementById('fileNameText').textContent = file.name;
        document.getElementById('fileSizeText').textContent = (file.size / 1024).toFixed(1) + " KB";
        document.getElementById('importSuccessBanner').style.display = 'none';

        // 2. Change the primary button to process the import on click
        const importBtn = document.querySelector('#importModal .btn-primary');
        if (importBtn) {
            importBtn.disabled = false; // <-- NEW: Ensure it's clickable
            importBtn.innerHTML = `<i class='bx bx-check-circle'></i> Finish Import`;
            importBtn.onclick = function(e) {
                if (e) e.preventDefault(); // <-- NEW: Prevent form submission/page reload
                executeImport();
            };
        }
    }

    function executeImport() {
        if (!pendingFile) return;

        // --- NEW: Block double-clicks and show loading state ---
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
            
            // Process data quietly (silent = true)
            const count = processExcelData(jsonData, true);
            
            if (count > 0) {
                // Instantly close the modal upon success
                closeImportModal();
                
                // --- THE FIX: Use the new professional popup ---
                showToast(`Successfully imported ${count} CPE schedule entries.`);
            } else {
                // Show Error Banner if formatting is wrong
                const banner = document.getElementById('importSuccessBanner');
                const msg = document.getElementById('successMessageText');

                msg.textContent = `Failed to process. Make sure the file matches the expected format.`;
                banner.style.display = 'flex';
                banner.style.backgroundColor = '#fde8e8';
                banner.style.borderColor = '#f8b4b4';
                banner.style.color = '#c53030';
                
                // --- NEW: Re-enable the button if it failed so they can try again ---
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

    // --- NEW: SUGGESTION 4 (Resilient Excel parsing) ---
    function processExcelData(data, silent = false) {
        let count = 0;
        // 1. Dynamically find column indexes by scanning headers (Rows 0-2)
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

        // Loop starting from index 3
        for (let i = 3; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 10) continue;

            let code = String(row[colMap.code] || '').trim();
            let title = String(row[colMap.title] || '').trim();
            let course = String(row[colMap.course] || '').trim();
            let section = String(row[colMap.section] || '').trim();
            let faculty = String(row[colMap.faculty] || '').trim();

            if (!code || !title) continue;

            // 1. Check if it's a CPE course FIRST
            const courseLower = course.toLowerCase();
            const isCPE = courseLower.includes('cpe') || courseLower.includes('bscpe') || courseLower.includes('computer engineering');
            if (!isCPE) continue; 

            // 2. ONLY THEN capture the faculty and section for the dropdowns
            if (faculty && faculty !== 'undefined') importedFaculty.add(faculty);
            if (section && section !== 'undefined') importedSections.add(section);

            let targetYear = currentActiveYear; 
            const yearMatch = course.match(/-(\d)/); 
            if (yearMatch) targetYear = yearMatch[1];
            
            let yearColor = '#ef4444'; // Default Red for 1st Year
            if (targetYear == "2") yearColor = '#3b82f6'; // Blue
            if (targetYear == "3") yearColor = '#10b981'; // Green
            if (targetYear == "4") yearColor = '#8b5cf6'; // Purple

            if (!mockDatabase[targetYear]) mockDatabase[targetYear] = { color: yearColor, events: [] };

            let rowEvents = [];

            // We fall back to standard indices for complex split headers (Time/Room) if strict mapping fails
            extractAndAddEvent('lecture', row[colMap.timeLec], row[colMap.dayLec], row[colMap.roomLec], code, title, section, faculty, rowEvents, yearColor);
            extractAndAddEvent('lab', row[colMap.timeLab], row[colMap.dayLab], row[colMap.roomLab], code, title, section, faculty, rowEvents, yearColor);

            if (rowEvents.length > 0) {
                rowEvents.forEach(ev => ev.extendedProps.year = targetYear);
                mockDatabase[targetYear].events = mockDatabase[targetYear].events.concat(rowEvents);
                count += rowEvents.length;
            }
        }

        if (count > 0) {
            updateSelectDropdowns(); 
            loadYearData(currentActiveYear);
            
            // --- THE FIX: Use the new professional popup ---
            if (!silent) showToast(`Successfully imported ${count} CPE entries and sorted them by Year Level.`);
            
            return count;
        }
        return 0;
    }

    // --- NEW HELPER FUNCTION ---
    function updateSelectDropdowns() {
        const sectionSelect = document.getElementById('modalSection');
        
        // Find the top filter dropdowns (Assuming Section is the 2nd one, Faculty is 3rd)
        const filterSelects = document.querySelectorAll('.controls-group select');
        let filterSection = filterSelects.length > 1 ? filterSelects[1] : null;

        // Populate Modal Sections
        if (sectionSelect && importedSections.size > 0) {
            sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
            Array.from(importedSections).sort().forEach(sec => {
                sectionSelect.innerHTML += `<option value="${sec}">${sec}</option>`;
            });
        }

        // Populate Dashboard Filter Sections
        if (filterSection && importedSections.size > 0) {
            filterSection.innerHTML = '<option value="all">All Sections</option>';
            Array.from(importedSections).sort().forEach(sec => {
                filterSection.innerHTML += `<option value="${sec}">${sec}</option>`;
            });
        }

        // Trigger populateFaculty to merge and update the faculty dropdowns
        populateFaculty();
    }

    function extractAndAddEvent(type, timeStr, dayStr, roomStr, code, title, section, faculty, importedEvents) {
        if (!timeStr || !dayStr || String(timeStr).trim() === '' || String(dayStr).trim() === '') return;
        const times = parseAdvancedTime(String(timeStr));
        if (!times) return; 
        const days = parseAdvancedDays(String(dayStr));
        
        // Hash the color exactly like the React App
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
    // --- ADVANCED HELPERS FROM TYPESCRIPT LOGIC ---

    function parseAdvancedTime(timeStr) {
        if (!timeStr) return null;
        
        // Grab just the first part if it's duplicated (e.g. "09:00AM-10:30AM/09:00AM-10:30AM")
        const part = String(timeStr).split('/')[0].trim();
        
        // Advanced Regex to catch standard time formats
        const match = part.match(/(\d{1,2})[:]+(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2})[:]+(\d{2})\s*(AM|PM)/i);
        if (!match) return null;

        let startH = parseInt(match[1]);
        const startM = match[2]; // Keep as string for formatting
        const startMeridiem = match[3].toUpperCase();
        
        let endH = parseInt(match[4]);
        const endM = match[5]; // Keep as string for formatting
        const endMeridiem = match[6].toUpperCase();

        // Convert to 24-hour format
        if (startMeridiem === 'PM' && startH !== 12) startH += 12;
        if (startMeridiem === 'AM' && startH === 12) startH = 0;
        if (endMeridiem === 'PM' && endH !== 12) endH += 12;
        if (endMeridiem === 'AM' && endH === 12) endH = 0;

        // Format as HH:mm for FullCalendar
        const formatHHMM = (h, m) => `${h.toString().padStart(2, '0')}:${m}`;

        return {
            start: formatHHMM(startH, startM),
            end: formatHHMM(endH, endM)
        };
    }

    function parseAdvancedDays(daysStr) {
        if (!daysStr) return [];
        
        // Split by slashes or commas ("MON/WED", "TUE, THU")
        const splitDays = String(daysStr).split(/[/,]/).map(d => d.trim().toUpperCase()).filter(Boolean);
        
        let dates = [];
        
        // Map the extracted days to FullCalendar dates (Base week starting Feb 9, 2026)
        splitDays.forEach(day => {
            if (day === 'MON' || day === 'MONDAY' || day === 'M') dates.push('2026-02-09');
            if (day === 'TUE' || day === 'TUESDAY' || day === 'T') dates.push('2026-02-10');
            if (day === 'WED' || day === 'WEDNESDAY' || day === 'W') dates.push('2026-02-11');
            if (day === 'THU' || day === 'THURSDAY' || day === 'TH') dates.push('2026-02-12');
            if (day === 'FRI' || day === 'FRIDAY' || day === 'F') dates.push('2026-02-13');
            if (day === 'SAT' || day === 'SATURDAY' || day === 'S') dates.push('2026-02-14');
        });

        // Return unique dates only
        return [...new Set(dates)];
    }

    function showToast(message) {
        // Remove existing toast if user imports multiple times quickly
        const existingToast = document.getElementById('custom-toast');
        if (existingToast) existingToast.remove();

        // Create the notification element
        const toast = document.createElement('div');
        toast.id = 'custom-toast';
        toast.innerHTML = `<i class='bx bx-check-circle' style='font-size: 1.2rem; margin-right: 8px;'></i> ${message}`;
        
        // Professional Styling (Modern, clean, floating)
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            backgroundColor: '#10B981', // Emerald green success color
            color: 'white',
            padding: '14px 24px',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '9999',
            display: 'flex',
            alignItems: 'center',
            opacity: '0',
            transform: 'translateY(20px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease'
        });

        document.body.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Auto-remove after 3.5 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300); // wait for fade out to finish before deleting
        }, 3500);
    }

    function deleteClass() {
    if (!editingEvent) return;
    
    const confirmDelete = confirm(`Are you sure you want to permanently delete ${editingEvent.title}?`);
    if (confirmDelete) {
        const yearKey = editingEvent.extendedProps.year;
        if (mockDatabase[yearKey]) {
            // FIXED: Filter by Title and Subject Code instead of start time
            mockDatabase[yearKey].events = mockDatabase[yearKey].events.filter(e => 
                !(e.title === editingEvent.title && e.extendedProps.code === editingEvent.extendedProps.code)
            );
        }
        editingEvent.remove();
        updateKPIs(calendarInstance.getEvents());
        
        if (typeof showToast === 'function') showToast("Class deleted successfully.");
        closeModal();
    }
}
})();