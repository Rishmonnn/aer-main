document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    renderCalendar();
});

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    // FIX: Select the main wrapper class used in program-head.html
    const mainWrapper = document.querySelector('.main-wrapper');

    if (toggle && sidebar && mainWrapper) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainWrapper.classList.toggle('collapsed');
        });
    }
}

// Stats Cycling
const studentData = { "1st Year": 326, "2nd Year": 285, "3rd Year": 210, "4th Year": 145 };
const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
let yrIdx = 0;

function cycleYear() {
    yrIdx = (yrIdx + 1) % years.length;
    const label = document.getElementById('year-label');
    const count = document.getElementById('student-count');
    if (label && count) {
        label.innerText = years[yrIdx];
        count.innerText = studentData[years[yrIdx]];
    }
}

// --- TAB NAVIGATION FIX ---
function switchTab(evt, section) {
    evt.preventDefault();
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    evt.currentTarget.classList.add('active');

    const views = [
        'home-view', 'enrollment-view', 'enlistment-view', 
        'journey-view', 'retention-view', 'advising-view', 
        'classrecords-view', 'schedules-view', 'instructors-view'
    ];

    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const targetId = section === 'home' ? 'home-view' : section + '-view';
    const target = document.getElementById(targetId);
    
    if (target) {
        target.style.display = (section === 'home') ? 'grid' : 'block';
        
        // DRAW CHART ONLY WHEN TAB IS VISIBLE
        if (section === 'retention') {
            setTimeout(() => {
                if (window.initRetentionChart) window.initRetentionChart();
            }, 100); 
        }

        // --- NEW: Initialize Schedules when tab is clicked ---
        if (section === 'schedules') {
            // Wait slightly for div to be visible
            setTimeout(() => {
                if (window.Schedules && window.Schedules.init) {
                    window.Schedules.init();
                }
            }, 100);
        }
    }
}

// Calendar Logic (Home Dashboard)
let currDate = new Date();
function renderCalendar() {
    const m = currDate.getMonth(), y = currDate.getFullYear();
    const body = document.getElementById("calendar-body");
    if (!body) return;

    const firstDay = new Date(y, m, 1).getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();
    let days = "<tr>";
    for (let i = 0; i < firstDay; i++) days += "<td></td>";

    const today = new Date();
    for (let d = 1; d <= lastDate; d++) {
        if ((d + firstDay - 1) % 7 === 0 && d !== 1) days += "</tr><tr>";
        const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
        days += `<td class="${isToday ? 'today' : ''}">${d}</td>`;
    }
    days += "</tr>";
    body.innerHTML = days;
    document.getElementById('monthSelect').value = m;
    document.getElementById('yearSelect').value = y;
}

function changeMonth(step) {
    currDate.setMonth(currDate.getMonth() + step);
    renderCalendar();
}

function updateCalendarFromSelect() {
    currDate.setFullYear(parseInt(document.getElementById('yearSelect').value));
    currDate.setMonth(parseInt(document.getElementById('monthSelect').value));
    renderCalendar();
}