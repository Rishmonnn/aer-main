(function() {
    let calendarInstance = null;
    let currentActiveYear = "1"; 

    // 1. FACULTY LIST (Fetched via API in init)

    // 2. FULL CURRICULUM DATA
    const curriculumData = [
        // Year 1, Sem 1
        { year: "1", sem: "1", code: "GEN 002", title: "Understanding the Self", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "GEN 003", title: "Science, Technology and Society", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "MAT 152", title: "Mathematics in the Modern World", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "HIS 007", title: "Life and Works of Rizal", lec: 3, lab: 0 },
        { year: "1", sem: "1", code: "MAT 171", title: "Calculus 1 for Engineers", lec: 4, lab: 0 },
        { year: "1", sem: "1", code: "CPE 034", title: "Computer Engineering as a Discipline", lec: 1, lab: 0 },
        { year: "1", sem: "1", code: "CPE 035", title: "Programming Logic and Design", lec: 0, lab: 2 },
        { year: "1", sem: "1", code: "NST 021", title: "National Service Training Program 1", lec: 3, lab: 0 },
        // ... (Include full list as before) ...
    ];

    // 3. MOCK DATABASE
    const mockDatabase = {
        "1": { color: '#54a0ff', events: [ 
            { title: 'Understanding the Self', start: '2026-02-09T07:30:00', end: '2026-02-09T09:00:00', extendedProps: { code: 'GEN 002', type: 'lecture', room: '305', faculty: 'Mr. Andres Bonifacio' } },
            { title: 'Calculus 1', start: '2026-02-10T08:30:00', end: '2026-02-10T11:30:00', extendedProps: { code: 'MAT 171', type: 'lecture', room: '304', faculty: 'Dr. Jose Rizal' } },
        ]},
        "2": { color: '#2ecc71', events: [] },
        "3": { color: '#f39c12', events: [] },
        "4": { color: '#9b59b6', events: [] }
    };

    function init() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        // Check if FullCalendar is loaded
        if (typeof FullCalendar === 'undefined') {
            console.error("FullCalendar library is missing.");
            return;
        }

        // Re-initialize logic
        if (calendarInstance) {
            calendarInstance.destroy();
        }

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            initialDate: '2026-02-09',
            headerToolbar: false,
            dayHeaderFormat: { weekday: 'short' },
            hiddenDays: [0],
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
        if (targetYear === currentActiveYear && calendarInstance) {
            eventsToCheck = calendarInstance.getEvents().map(e => ({
                start: e.start,
                end: e.end,
                title: e.title
            }));
        } else if (mockDatabase[targetYear]) {
            eventsToCheck = mockDatabase[targetYear].events.map(e => ({
                start: new Date(e.start),
                end: new Date(e.end),
                title: e.title
            }));
        }

        for (let ev of eventsToCheck) {
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
        } else {
            alert(`Class saved to ${modalYear}${getOrdinal(modalYear)} Year schedule.`);
        }

        Schedules.closeModal();
    }

    function getNextDayOfWeek(dayIndex) {
        const baseDay = 9; 
        const offset = dayIndex - 1;
        const targetDay = baseDay + offset;
        const dayStr = targetDay < 10 ? `0${targetDay}` : targetDay;
        return `2026-02-${dayStr}`;
    }

    function loadYearData(yearKey) {
        if (!calendarInstance) return;
        currentActiveYear = yearKey;
        calendarInstance.removeAllEvents();
        const data = mockDatabase[yearKey];
        if (data) {
            const coloredEvents = data.events.map(ev => ({
                ...ev,
                backgroundColor: data.color,
                borderColor: data.color
            }));
            calendarInstance.addEventSource(coloredEvents);
            updateKPIs(coloredEvents);
        } else {
            updateKPIs([]);
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

    window.Schedules = {
        init, addEvent: openModal, closeModal, saveClass, onSubjectChange, filterSubjects
    };
})();