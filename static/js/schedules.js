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
            headerToolbar: false,
            dayHeaderFormat: { weekday: 'short' },
            hiddenDays: [0], // Hide Sunday
            slotMinTime: '07:00:00',
            slotMaxTime: '19:00:00',
            allDaySlot: false,
            height: 'auto',
            
            editable: true, 
            eventOverlap: false,
            slotEventOverlap: false,
            
            eventDrop: handleScheduleChange,
            eventResize: handleScheduleChange,
            
            expandRows: true,
            slotLabelFormat: { hour: 'numeric', meridiem: 'short' },
            eventContent: function(arg) {
                let props = arg.event.extendedProps;
                let typeIcon = props.type === 'lab' ? '🧪' : '📖';
                let footerInfo = props.room ? `${typeIcon} ${props.room}` : typeIcon;
                if (props.faculty) footerInfo += ` • ${props.faculty}`;

                return {
                    html: `<div class="fc-event-main-frame">
                             <div class="evt-code" style="font-weight:800; font-size:0.85rem;">${props.code}</div>
                             <div class="evt-title" style="font-size:0.75rem; opacity:0.9;">${arg.event.title}</div>
                             <div style="font-size:0.7rem; margin-top:2px; opacity:0.8;">${footerInfo}</div>
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

        let color = '#54a0ff'; 
        if(modalYear == 2) color = '#2ecc71';
        if(modalYear == 3) color = '#f39c12';
        if(modalYear == 4) color = '#9b59b6';

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
    const data = mockDatabase[yearKey];
    
    // Check if there are events for this year
    if (data && data.events && data.events.length > 0) {
        const coloredEvents = data.events.map(ev => ({
            ...ev,
            backgroundColor: data.color,
            borderColor: data.color
        }));
        calendarInstance.addEventSource(coloredEvents);
        updateKPIs(coloredEvents);
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

    // 1. Update UI to show File Name and Size
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // 2. Process data and get the count
        const count = processExcelData(jsonData, true); // Added 'true' to skip immediate alert

        // 3. Show Success Banner
        if (count > 0) {
            const banner = document.getElementById('importSuccessBanner');
            const msg = document.getElementById('successMessageText');
            const importBtn = document.querySelector('#importModal .btn-primary');
            
            msg.textContent = `Successfully parsed ${count} schedule entries. Ready to import.`;
            banner.style.display = 'flex';
            
            // Update the main button text like in your screenshot
            importBtn.innerHTML = `<i class='bx bx-upload'></i> Import ${count} Entries`;
        }
    };
    reader.readAsArrayBuffer(file);
}

    function processExcelData(data) {
        let importedEvents = [];
        const color = mockDatabase[currentActiveYear]?.color || '#54a0ff';

        // 🛠️ DEBUGGING: This prints the very first row to your browser console
        console.log("Extracted Data Format:", data[0]); 

        data.forEach(row => {
            let isCpeClass = false;

            // 1. Scan EVERY column in the row for 'CPE' or 'BSCPE'
            for (const key in row) {
                const cellValue = String(row[key]).toUpperCase();
                if (cellValue.includes('CPE') || cellValue.includes('BSCPE')) {
                    isCpeClass = true;
                    break; // We found it, stop searching this row
                }
            }

            // 2. If it's a CPE class, capture it
            if (isCpeClass) {
                
                // We dynamically search the keys for words like 'room', 'time', 'day' 
                // just in case your headers are named slightly differently.
                let title = 'Imported Class';
                let code = 'TBA';
                let room = 'TBA';
                let faculty = 'TBA';
                let type = 'lecture';
                let startTime = '07:30'; 
                let endTime = '09:00';
                let dayStr = 'M'; // Default to Monday if not found

                for (const key in row) {
                    const upperKey = key.toUpperCase();
                    const val = String(row[key]);

                    if (upperKey.includes('DESC') || upperKey.includes('TITLE')) title = val;
                    if (upperKey.includes('SUBJ') || upperKey.includes('CODE')) code = val;
                    if (upperKey.includes('ROOM')) room = val;
                    if (upperKey.includes('FACULTY') || upperKey.includes('INSTRUCT')) faculty = val;
                    if (upperKey.includes('TYPE')) type = val.toLowerCase().includes('lab') ? 'lab' : 'lecture';
                    if (upperKey.includes('START') || upperKey.includes('TIME IN')) startTime = formatTime(val);
                    if (upperKey.includes('END') || upperKey.includes('TIME OUT')) endTime = formatTime(val);
                    if (upperKey.includes('DAY')) dayStr = val;
                }

                const days = parseDays(dayStr); 

                days.forEach(date => {
                    importedEvents.push({
                        title: title,
                        start: `${date}T${startTime}:00`,
                        end: `${date}T${endTime}:00`,
                        backgroundColor: color,
                        borderColor: color,
                        extendedProps: {
                            code: code,
                            type: type,
                            room: room,
                            faculty: faculty
                        }
                    });
                });
            }
        });

        if (importedEvents.length > 0) {
        mockDatabase[currentActiveYear].events = mockDatabase[currentActiveYear].events.concat(importedEvents);
        loadYearData(currentActiveYear);
        if (!silent) alert(`Successfully imported ${importedEvents.length} entries.`);
        return importedEvents.length;
    }
    return 0;
}
    // --- HELPER: Converts Excel Time (e.g., "7:30 AM") to 24hr ("07:30") ---
    function formatTime(timeStr) {
        if (!timeStr) return "00:00";
        // If already in 24-hour format (HH:mm)
        if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr; 
        
        const match = timeStr.toString().trim().match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/);
        if (!match) return "00:00";
        
        let [ , hours, minutes, modifier ] = match;
        hours = parseInt(hours, 10);
        
        if (modifier && modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (modifier && modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    // --- HELPER: Maps days like "M W F" or "TTh" to dates in your calendar week ---
    function parseDays(dayString) {
        const str = dayString.toString().toUpperCase();
        let dates = [];
        
        // Base week starts Monday, Feb 9, 2026
        if (str.includes('MON') || /\bM\b/.test(str) || str.startsWith('M')) dates.push('2026-02-09');
        if (str.includes('TUE') || str.includes('TTH') || /\bT\b/.test(str) && !str.includes('TH')) dates.push('2026-02-10');
        if (str.includes('WED') || /\bW\b/.test(str)) dates.push('2026-02-11');
        if (str.includes('THU') || str.includes('TH')) dates.push('2026-02-12');
        if (str.includes('FRI') || /\bF\b/.test(str)) dates.push('2026-02-13');
        if (str.includes('SAT') || /\bS\b/.test(str)) dates.push('2026-02-14');
        
        return dates;
    }
})();