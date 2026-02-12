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
    renderCalendar();

    // --- Sidebar Toggle Logic ---
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');

    if (toggleBtn && sidebar && mainContent) {
        // Remove any existing listener to prevent duplicates (optional but safe)
        const newBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop event bubbling
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
        } else {
            // Fallback
            document.querySelectorAll('.content-section').forEach(c => c.classList.add('hidden')); 
            const target = document.getElementById(action); 
            if(target) target.classList.remove('hidden');

            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[onclick*="'${action}'"]`);
            if(activeNav) activeNav.classList.add('active');
        }

        if(action === 'grading' && window.FacultyGrading) window.FacultyGrading.loadClasses();
        if(action === 'classes' && window.FacultyClasses) window.FacultyClasses.fetchClasses();
        if(action === 'inc' && window.FacultyInc) window.FacultyInc.fetchInc();
      });
    });
  }

  // Ensure init runs whether DOM is loading or already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();