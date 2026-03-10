(function(){
  // --- Calendar Logic ---
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
      
      const mSelect = document.getElementById('monthSelect');
      const ySelect = document.getElementById('yearSelect');
      if(mSelect) mSelect.value = m;
      if(ySelect) ySelect.value = y;
  }

  window.changeMonth = function(step) {
      currDate.setMonth(currDate.getMonth() + step);
      renderCalendar();
  };

  window.updateCalendarFromSelect = function() {
      const yVal = document.getElementById('yearSelect').value;
      const mVal = document.getElementById('monthSelect').value;
      currDate.setFullYear(parseInt(yVal));
      currDate.setMonth(parseInt(mVal));
      renderCalendar();
  };

  // --- Main Init ---
  function init(){
    renderCalendar(); // THIS DRAWS THE CALENDAR!

    // --- Sidebar Toggle Logic ---
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');

    if (toggleBtn && sidebar && mainContent) {
        const newBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('collapsed-margin');
        });
    }

    // --- Quick Action Buttons Logic ---
    document.querySelectorAll('.action-trigger[data-action]').forEach(el=>{
      el.addEventListener('click', (e)=>{
        e.preventDefault();
        const action = el.dataset.action;
        
        if(typeof window.showSection === 'function'){
            window.showSection(action);
        } else if (typeof switchTab === 'function') {
            switchTab(action);
        }

        if(action === 'grading' && window.FacultyGrading) window.FacultyGrading.loadClasses();
        if(action === 'classes' && window.FacultyClasses) window.FacultyClasses.fetchClasses();
        if(action === 'inc' && window.FacultyInc) window.FacultyInc.fetchInc();
      });
    });
  }

  // --- UNIFIED DOM CONTENT LOADED LISTENER ---
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Actually initialize the JS (draws calendar, sets up buttons)
    init(); 
    
    // 2. Select the Home tab properly based on your HTML structure
    const homeTabBtn = document.querySelector('.nav-item'); 
    if (homeTabBtn && typeof window.showSection === 'function') {
        window.showSection('home', homeTabBtn); 
    }

    // 3. Load dynamic stats if on the dashboard
    if (document.getElementById('fac-stat-students')) {
        loadFacultyDashboardStats();
    }
  });

})();

// --- Dynamic Faculty Dashboard Stats ---
window.loadFacultyDashboardStats = function() {
    fetch('/api/faculty/dashboard_stats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('fac-stat-students').innerText = data.stats.total_students;
                document.getElementById('fac-stat-classes').innerText = data.stats.classes;
                document.getElementById('fac-stat-grading').innerText = data.stats.grading_status;

                const activityList = document.getElementById('fac-activity-list');
                if (!activityList) return;
                
                activityList.innerHTML = ''; 

                if (data.activities && data.activities.length > 0) {
                    data.activities.forEach(act => {
                        const div = document.createElement('div');
                        div.className = 'activity-item';
                        div.innerHTML = `
                            <span><span class="${act.css_class}">${act.type}:</span> ${act.message}</span>
                            <span class="timestamp">${act.time}</span>
                        `;
                        activityList.appendChild(div);
                    });
                } else {
                    activityList.innerHTML = '<div class="activity-item" style="justify-content: center; color: #64748b;">No recent activities.</div>';
                }
            }
        })
        .catch(err => {
            console.error('Failed to load faculty stats:', err);
            const activityList = document.getElementById('fac-activity-list');
            if (activityList) {
                activityList.innerHTML = '<div class="activity-item" style="justify-content: center; color: #ef4444;">Failed to load data.</div>';
            }
        });
}

// Fallback switchTab just in case
window.switchTab = function(tabId, clickedElement) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    document.querySelectorAll('.sidebar-menu li, .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const targetSection = document.getElementById(tabId);
    if (targetSection) targetSection.style.display = 'block';
    if (clickedElement) clickedElement.classList.add('active');
}