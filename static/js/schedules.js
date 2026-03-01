(function() {
    let calendarInstance = null;
    let currentActiveYear = "1"; 

    // 1. FACULTY LIST (Fetched via API in init)

    // 2. FULL CURRICULUM DATA
    const curriculumData = [
        { year: "1", sem: "1", code: "GEN 002", title: "Understanding the Self", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "GEN 003", title: "Science, Technology and Society", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "MAT 152", title: "Mathematics in the Modern World", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "HIS 007", title: "Life and Works of Rizal", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "MAT 171", title: "Calculus 1 for Engineers", lec: 4, lab: 0 },
        { year: "1", sem: "1", code: "CPE 034", title: "Computer Engineering as a Discipline", lec: 1, lab: 0 },
        { year: "1", sem: "1", code: "CPE 035", title: "Programming Logic and Design", lec: 0, lab: 2 },
        { year: "1", sem: "1", code: "NST 021", title: "National Service Training Program 1", lec: 3, lab: 0 },
    ];

    // 3. MOCK DATABASE
    const mockDatabase = {
        "1": { color: '#54a0ff', events: [] },
        "2": { color: '#2ecc71', events: [] },
        "3": { color: '#f39c12', events: [] },
        "4": { color: '#9b59b6', events: [] }
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
        if (!calendarEl) {
            console.warn("Calendar element not found. Skipping init.");
            return;
        }

        // Check if FullCalendar is loaded
        if (typeof FullCalendar === 'undefined') {
            console.error("FullCalendar library is missing. Please check base.html includes.");
            // Try again in 1 second in case of slow CDN
            setTimeout(init, 1000);
            return;
        }

        // Destroy existing instance if it exists to prevent duplication
        if (calendarInstance) {
            calendarInstance.destroy();
        }

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            initialDate: '2026-02-09',
            headerToolbar: false, // Hides default toolbar
            dayHeaderFormat: { weekday: 'short' }, // "Mon" -> CSS makes it "MON"
            hiddenDays: [0], // Hide Sunday
            
            // Match React Time Range (7am to 9pm)
            slotMinTime: '07:00:00',
            slotMaxTime: '21:00:00',
            allDaySlot: false,
            
            // Match React Labels
            slotLabelInterval: '01:00', // Only show labels every hour
            slotLabelFormat: { hour: 'numeric', meridiem: 'lowercase' }, // e.g., "7am"
            
            height: 'auto',
            editable: true, 
            eventOverlap: false,
            slotEventOverlap: false,
            expandRows: true,
            
            eventDrop: handleScheduleChange,
            eventResize: handleScheduleChange,
            
            // Inject EXACT React HTML Structure into Events
            eventContent: function(arg) {
                let props = arg.event.extendedProps;
                let facultyShort = props.faculty ? props.faculty.split(',')[0] : 'TBA';
                let room = props.room || 'TBA';
                
                // Using the exact typography styles from course-data-magic
                return {
                    html: `
                    <div style="padding: 4px 8px; color: white; height: 100%; overflow: hidden; display: flex; flex-direction: column;">
                        <p style="font-size: 0.75rem; font-weight: 700; line-height: 1.25; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${props.code}
                        </p>
                        <p style="font-size: 0.75rem; line-height: 1.25; margin: 0; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${arg.event.title}
                        </p>
                        <p style="font-size: 0.75rem; line-height: 1.25; margin: 2px 0 0 0; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: auto;">
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

        loadYearData(currentActiveYear);
        filterSubjects();
        populateFaculty(); 
        setupEventListeners();
    }

    // --- POPULATE FACULTY (Connected to API) ---
    function populateFaculty() {
        const facultySelect = document.getElementById('facultySelect');
        if (!facultySelect) return;
        
        fetch('/api/instructors')
            .then(response => response.json())
            .then(data => {
                facultySelect.innerHTML = '<option value="">-- Select Instructor --</option>';
                data.forEach(fac => {
                    const option = document.createElement('option');
                    option.value = fac.name;
                    option.text = fac.name;
                    facultySelect.appendChild(option);
                });
            })
            .catch(err => console.error("Error loading faculty for schedules:", err));
    }

    function isOverlapping(newStart, newEnd, targetYear) {
        let eventsToCheck = [];
        // If checking current active year, check the live calendar
        if (targetYear === currentActiveYear && calendarInstance) {
            eventsToCheck = calendarInstance.getEvents().map(e => ({
                start: e.start,
                end: e.end,
                title: e.title
            }));
        } 
        // If checking a background year, check the mockDatabase
        else if (mockDatabase[targetYear]) {
            eventsToCheck = mockDatabase[targetYear].events.map(e => ({
                start: new Date(e.start),
                end: new Date(e.end),
                title: e.title
            }));
        }

        for (let ev of eventsToCheck) {
            // Overlap logic: (StartA < EndB) and (EndA > StartB)
            if (newStart < ev.end && newEnd > ev.start) {
                return ev.title;
            }
        }
        return false;
    }

    function handleScheduleChange(info) {
        const ev = info.event;
        const options = { hour: 'numeric', minute: '2-digit', hour12: true };
        const startStr = ev.start.toLocaleTimeString('en-US', options);
        const endStr = ev.end.toLocaleTimeString('en-US', options);
        const dayStr = ev.start.toLocaleDateString('en-US', { weekday: 'long' });

        alert(`✅ Schedule Updated!\n\nSubject: ${ev.title}\nNew Time: ${dayStr}, ${startStr} - ${endStr}`);
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

        const conflict = isOverlapping(startDt, endDt, modalYear);
        if (conflict) {
            showError(`CONFLICT: Time overlaps with "${conflict}".`);
            return; 
        }

        const color = hashColor(subData.code + type);
        const newEvent = {
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

        if (yearKey === 'all') {
            // Loop through all years in the database and combine them
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
            // Load just the specific year
            const data = mockDatabase[yearKey];
            if (data && data.events && data.events.length > 0) {
                allEventsToDisplay = data.events.map(ev => ({
                    ...ev,
                    backgroundColor: data.color,
                    borderColor: data.color
                }));
            }
        }

        // Display the events
        if (allEventsToDisplay.length > 0) {
            calendarInstance.addEventSource(allEventsToDisplay);
            updateKPIs(allEventsToDisplay);
            toggleEmptyState(true); // Show calendar
        } else {
            updateKPIs([]);
            toggleEmptyState(false); // Show empty state
        }
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
        const modal = document.getElementById('addClassModal');
        modal.style.display = 'flex';
        document.getElementById('modalYear').value = currentActiveYear;
        filterSubjects();
        populateFaculty(); 
    }
    
    function closeModal() { document.getElementById('addClassModal').style.display = 'none'; }

    function setupEventListeners() {
        const dropZone = document.getElementById('dragDropZone');
const fileInput = document.getElementById('modalFileInput');

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

    // Expose public methods
    window.Schedules = {
        
        init, 
        addEvent: openModal, 
        closeModal, 
        saveClass, 
        onSubjectChange, 
        filterSubjects,
        triggerImport, 
        handleImport,
        closeImportModal
    };
    
    // Auto-init if the calendar div exists immediately (for safety)
    if(document.getElementById('calendar')) {
        init();
    }
    function triggerImport() {
        const modal = document.getElementById('importModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) modal.style.display = 'none';
    }

    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 1. Update UI
        document.getElementById('dropZoneDefault').style.display = 'none';
        document.getElementById('fileInfoDisplay').style.display = 'block';
        document.getElementById('fileNameText').textContent = file.name;
        document.getElementById('fileSizeText').textContent = (file.size / 1024).toFixed(1) + " KB";

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // MAGIC FIX: Read as a raw 2D array, ensuring empty cells aren't skipped
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            
            // 2. Process data
            const count = processExcelData(jsonData, true);
            
            // 3. Show Success/Error Banner
            const banner = document.getElementById('importSuccessBanner');
            const msg = document.getElementById('successMessageText');
            const importBtn = document.querySelector('#importModal .btn-primary');

            if (count > 0) {
                msg.textContent = `Successfully parsed ${count} schedule entries.`;
                banner.style.display = 'flex';
                banner.style.backgroundColor = '#ecfdf5';
                banner.style.borderColor = '#10b981';
                banner.style.color = '#065f46';
                
                importBtn.innerHTML = `<i class='bx bx-check'></i> Finish Import`;
                importBtn.onclick = function() {
                    Schedules.closeImportModal();
                };
            } else {
                msg.textContent = `Failed to process. Make sure the file matches the expected format.`;
                banner.style.display = 'flex';
                banner.style.backgroundColor = '#fde8e8';
                banner.style.borderColor = '#f8b4b4';
                banner.style.color = '#c53030';
            }

            // 4. Reset input
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    }

    function processExcelData(data, silent = false) {
        let count = 0;

        // Loop starting from index 3 to skip headers
        for (let i = 3; i < data.length; i++) {
            const row = data[i];
            
            // Skip empty or incomplete rows
            if (!row || row.length < 10) continue;

            let campus = String(row[1] || '').trim();
            let code = String(row[2] || '').trim();
            let title = String(row[3] || '').trim();
            let course = String(row[4] || '').trim();
            let section = String(row[11] || '').trim();
            let faculty = String(row[18] || '').trim();

            if (!campus || !code || !title) continue;

            // 1. Filter for CPE / BSCPE
            const courseLower = course.toLowerCase();
            const isCPE = courseLower.includes('cpe') || courseLower.includes('bscpe') || courseLower.includes('computer engineering');
            if (!isCPE) continue; 

            // 2. Extract Year Level from Course (e.g., "CPE-1" -> "1")
            let targetYear = currentActiveYear; // Default fallback
            const yearMatch = course.match(/-(\d)/); // Looks for the number after a hyphen
            if (yearMatch) {
                targetYear = yearMatch[1];
            }

            // 3. Get the correct color for this specific year
            let yearColor = '#54a0ff'; // 1st year default
            if (targetYear == "2") yearColor = '#2ecc71';
            if (targetYear == "3") yearColor = '#f39c12';
            if (targetYear == "4") yearColor = '#9b59b6';

            // Ensure the mockDatabase exists for this year
            if (!mockDatabase[targetYear]) {
                mockDatabase[targetYear] = { color: yearColor, events: [] };
            }

            // Create a temporary array just for this specific row's events
            let rowEvents = [];

            // Extract LECTURE: Time (12), Days (14), Room (16)
            extractAndAddEvent('lecture', row[12], row[14], row[16], code, title, section, faculty, rowEvents, yearColor);

            // Extract LAB: Time (13), Days (15), Room (17)
            extractAndAddEvent('lab', row[13], row[15], row[17], code, title, section, faculty, rowEvents, yearColor);

            // Add the generated events directly to the specific year's database
            if (rowEvents.length > 0) {
                rowEvents.forEach(ev => {
                    ev.extendedProps.year = targetYear; // Tag it with the year level
                });
                mockDatabase[targetYear].events = mockDatabase[targetYear].events.concat(rowEvents);
                count += rowEvents.length;
            }
        }

        if (count > 0) {
            // Reload the currently active year's calendar view so you see updates immediately
            loadYearData(currentActiveYear);
            
            if (!silent) alert(`Successfully imported ${count} CPE entries and sorted them by Year Level.`);
            return count;
        }
        return 0;
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
        const match = part.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
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
})();