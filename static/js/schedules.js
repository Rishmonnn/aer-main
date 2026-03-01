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
        handleImport,        // <--- This connects the HTML to the function
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
            
            // MAGIC FIX: Read as a raw 2D array of rows and columns instead of using headers
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
            
            // 2. Process data and get the count
            const count = processExcelData(jsonData, true);
            
            // 3. Show Success/Error Banner & Update Button
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
                msg.textContent = `Failed to process. Check if it's the right schedule format.`;
                banner.style.display = 'flex';
                banner.style.backgroundColor = '#fde8e8';
                banner.style.borderColor = '#f8b4b4';
                banner.style.color = '#c53030';
            }

            // 4. Reset the input so you can re-upload the same file if needed
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    }

    function processExcelData(data, silent = false) {
        let importedEvents = [];
        const color = mockDatabase[currentActiveYear]?.color || '#54a0ff';

        console.log("Raw Array Data Loaded", data);

        data.forEach((row) => {
            // Skip the header rows (rows that don't have a valid Class Code in column 2)
            // In your CSV snippet, data starts where column 1 is "CARMEN" and column 2 is the code.
            if (!row || row.length < 10 || row[1] === 'CAMPUS' || !row[2]) return;

            // Map data by its strict column index from your file format
            let code = row[2] ? row[2].toString().trim() : 'TBA';
            let title = row[3] ? row[3].toString().trim() : 'Imported Class';
            let section = row[11] ? row[11].toString().trim() : '';
            let faculty = row[18] ? row[18].toString().trim() : 'TBA';

            // Helper to process Lec or Lab
            const addEvents = (type, timeStr, dayStr, roomStr) => {
                if (!timeStr || !dayStr || timeStr.toString().trim() === '' || dayStr.toString().trim() === '') return;
                
                // Some times look like "03:00PM-04:30PM/03:00PM-04:30PM", we just need the first part
                let cleanTimeStr = timeStr.toString().split('/')[0];
                let times = cleanTimeStr.split('-');
                
                let startTime = times[0] ? formatTime(times[0].trim()) : '07:30';
                let endTime = times[1] ? formatTime(times[1].trim()) : '09:00';

                // Pass "TUE/THU" into your existing parser, which will extract both days perfectly!
                const days = parseDays(dayStr.toString().split('/')[0]); 

                days.forEach(date => {
                    importedEvents.push({
                        title: title,
                        start: `${date}T${startTime}:00`,
                        end: `${date}T${endTime}:00`,
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
            };

            // Column 12=Lec Time, 14=Lec Days, 16=Lec Room
            addEvents('lecture', row[12], row[14], row[16]);
            
            // Column 13=Lab Time, 15=Lab Days, 17=Lab Room
            addEvents('lab', row[13], row[15], row[17]);
        });

        if (importedEvents.length > 0) {
            if (!mockDatabase[currentActiveYear]) {
                mockDatabase[currentActiveYear] = { color: color, events: [] };
            }
            
            mockDatabase[currentActiveYear].events = mockDatabase[currentActiveYear].events.concat(importedEvents);
            loadYearData(currentActiveYear);
            
            if (!silent) alert(`Successfully imported ${importedEvents.length} entries.`);
            return importedEvents.length;
        }
        return 0;
    }
    // --- HELPER: Converts Excel Time (e.g., "7:30 AM") to 24hr ("07:30") ---
    function formatTime(timeStr) {
        if (!timeStr || timeStr.toString().toUpperCase().includes('TBA')) return "00:00";
        
        // Clean up the string and remove spaces
        const cleanTime = timeStr.toString().trim().toUpperCase();
        
        // Matches standard times like "7:30", "07:30", "7:30AM", "1:00 PM", "13:00"
        const match = cleanTime.match(/(\d{1,2})[:.]?(\d{2})?\s*(AM|PM)?/);
        if (!match) return "00:00";
        
        let hours = parseInt(match[1], 10);
        let minutes = match[2] || "00";
        let modifier = match[3];

        // Convert to 24-hour time
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    // --- UPGRADED HELPER: Bulletproof Day Parser ---
    function parseDays(dayString) {
        if (!dayString || dayString.toString().toUpperCase().includes('TBA')) return [];
        
        const str = dayString.toString().toUpperCase();
        let dates = [];
        
        // Base week starts Monday, Feb 9, 2026 [cite: 201]
        if (/(M|MON)/.test(str)) dates.push('2026-02-09');
        
        // Tuesday: Looks for 'T' but specifically ignores 'TH'
        if (/(T(?!H)|TUE)/.test(str)) dates.push('2026-02-10'); 
        
        if (/(W|WED)/.test(str)) dates.push('2026-02-11');
        
        // Thursday: Looks for 'TH'
        if (/(TH|THU)/.test(str)) dates.push('2026-02-12'); 
        
        if (/(F|FRI)/.test(str)) dates.push('2026-02-13');
        
        // Saturday: Looks for 'S' but ignores 'SU' for Sunday
        if (/(S(?!U)|SAT)/.test(str)) dates.push('2026-02-14'); 
        
        // Remove duplicates just in case (e.g., "TTh" parsing twice)
        return [...new Set(dates)];
    }
})();