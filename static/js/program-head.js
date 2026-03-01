document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    renderCalendar();
    loadDashboardData(); // Fetch dynamic dashboard data
});

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    renderCalendar();
    loadDashboardData(); // Fetch dynamic dashboard data
    loadStudentCounts(); // NEW: Fetch actual student counts from DB
});

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const mainWrapper = document.querySelector('.main-wrapper');

    if (toggle && sidebar && mainWrapper) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainWrapper.classList.toggle('collapsed');
        });
    }
}

// --- Dynamic Dashboard Data (Activities & Actions) ---
function loadDashboardData() {
    fetch('/api/dashboard/activities')
        .then(res => res.json())
        .then(data => {
            // 1. Render Recent Activities
            const activityContainer = document.getElementById('dashboard-activities');
            if (activityContainer) {
                activityContainer.innerHTML = '';
                if (!data.activities || data.activities.length === 0) {
                     activityContainer.innerHTML = '<div style="padding: 30px; text-align: center; color: #64748b; font-weight: 500;">No recent activities.</div>';
                } else {
                    data.activities.forEach(act => {
                        let icon = 'bx-user-check';
                        let iconClass = 'info';
                        
                        if (act.type.includes('Approved')) {
                            icon = 'bx-check-double';
                            iconClass = 'success';
                        } else if (act.type.includes('Enlisted')) {
                            icon = 'bx-list-plus';
                            iconClass = 'warning';
                        }

                        activityContainer.innerHTML += `
                            <div class="feed-item">
                                <div class="feed-icon ${iconClass}"><i class='bx ${icon}'></i></div>
                                <div class="feed-content">
                                    <h4 class="feed-title">${act.type}</h4>
                                    <p class="feed-meta">${act.message}</p>
                                    <div class="feed-time">${act.time}</div>
                                </div>
                            </div>
                        `;
                    });
                }
            }

            // 2. Render Suggested Actions
            const actionContainer = document.getElementById('dashboard-actions');
            if (actionContainer) {
                actionContainer.innerHTML = '';
                if (!data.actions || data.actions.length === 0) {
                    actionContainer.innerHTML = '<div style="padding: 30px; text-align: center; color: #64748b; font-weight: 500;">All clear. No pending tasks.</div>';
                } else {
                    data.actions.forEach(action => {
                        let icon = 'bx-check-circle';
                        let iconClass = 'success';
                        let btnOnClick = '';

                        if (action.type === 'enrollment') {
                             icon = 'bx-user-plus'; iconClass = 'info';
                             btnOnClick = "document.querySelector('.nav-item:nth-child(2)').click()";
                        } else if (action.type === 'enlistment') {
                             icon = 'bx-file-blank'; iconClass = 'warning';
                             btnOnClick = "document.querySelector('.nav-item:nth-child(3)').click()";
                        } else if (action.type === 'retention') {
                             icon = 'bx-error-circle'; iconClass = 'danger';
                             btnOnClick = "document.querySelector('.nav-item:nth-child(5)').click()";
                        } else {
                             btnOnClick = "loadDashboardData()";
                        }

                        actionContainer.innerHTML += `
                            <div class="feed-item" style="align-items: center;">
                                <div class="feed-icon ${iconClass}"><i class='bx ${icon}'></i></div>
                                <div class="feed-content">
                                    <h4 class="feed-title">${action.title}</h4>
                                    <p class="feed-meta">${action.description}</p>
                                </div>
                                <button class="btn-action" onclick="${btnOnClick}">${action.btn_text}</button>
                            </div>
                        `;
                    });
                }
            }
        })
        .catch(err => console.error("Error loading dashboard data:", err));
}

// --- Stats Cycling ---
// --- Dynamic Stats Cycling ---
let studentData = { "Total": 0, "1st Year": 0, "2nd Year": 0, "3rd Year": 0, "4th Year": 0 };
const years = ["Total", "1st Year", "2nd Year", "3rd Year", "4th Year"];
let yrIdx = 0;

function loadStudentCounts() {
    fetch('/api/students')
        .then(res => res.json())
        .then(data => {
            // Set the total count
            studentData["Total Students"] = data.length;
            
            // Tally up students by their exact year level
            data.forEach(student => {
                if (studentData[student.year_level] !== undefined) {
                    studentData[student.year_level]++;
                }
            });
        })
        .catch(err => console.error("Error loading student counts:", err));
}

function cycleYear() {
    yrIdx = (yrIdx + 1) % years.length;
    const label = document.getElementById('year-label');
    const count = document.getElementById('student-count');
    
    if (label && count) {
        label.innerText = years[yrIdx];
        count.innerText = studentData[years[yrIdx]];
    }
}

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
    if (evt) evt.preventDefault(); 
    
    if (evt && evt.currentTarget) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        evt.currentTarget.classList.add('active');
    }

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
        
        // Refresh dashboard data when returning to home
        if (section === 'home') loadDashboardData();

        // DRAW CHART ONLY WHEN TAB IS VISIBLE
        if (section === 'retention') {
            setTimeout(() => {
                if (window.initRetentionChart) window.initRetentionChart();
            }, 100); 
        }

        // Initialize Schedules when tab is clicked
        if (section === 'schedules') {
            setTimeout(() => {
                if (window.Schedules && window.Schedules.init) {
                    window.Schedules.init();
                }
            }, 100);
        }
    }
}

// --- Modern Calendar Logic ---
let currDate = new Date();
function renderCalendar() {
    const m = currDate.getMonth(), y = currDate.getFullYear();
    const body = document.getElementById("calendar-body");
    if (!body) return;

    const firstDay = new Date(y, m, 1).getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();
    let days = "<tr>";
    
    // Empty cells
    for (let i = 0; i < firstDay; i++) days += "<td></td>";

    const today = new Date();
    for (let d = 1; d <= lastDate; d++) {
        if ((d + firstDay - 1) % 7 === 0 && d !== 1) days += "</tr><tr>";
        const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
        days += `<td><span class="${isToday ? 'today' : ''}">${d}</span></td>`;
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