(function(){
  function loadClasses(){
    fetch('/api/faculty/classes').then(r=>r.json()).then(classes=>{
      const sel = document.getElementById('selectClass'); sel.innerHTML = ''; classes.forEach(c=>{ const opt = document.createElement('option'); opt.value = c.id; opt.textContent = `${c.code} - ${c.name}`; sel.appendChild(opt); });
      document.getElementById('loadGrades').addEventListener('click', loadGrades);
    }).catch(e=>console.error(e));
  }
  function loadGrades(){ const classId = document.getElementById('selectClass').value; fetch(`/api/faculty/grading/${classId}`).then(r=>r.json()).then(renderGrades).catch(e=>console.error(e)); }
  function renderGrades(list){ const tbody = document.querySelector('.grading-table tbody'); if(!tbody) return; tbody.innerHTML = ''; list.forEach(s=>{ const tr = document.createElement('tr'); tr.dataset.studentId = s.id; tr.innerHTML = `<td>${s.id}</td><td>${s.name}</td><td contenteditable class="p1">${s.p1}</td><td contenteditable class="p2">${s.p2}</td><td contenteditable class="p3">${s.p3}</td><td class="final">${s.final}</td><td><button class="btn-save btn">Save</button></td>`; tbody.appendChild(tr); }); document.querySelectorAll('.grading-table .btn-save').forEach(b=>b.addEventListener('click', saveGrade)); }
  function saveGrade(e){ const tr = e.target.closest('tr'); if(!tr) return; const classId = document.getElementById('selectClass').value; const studentId = tr.dataset.studentId; const payload = { period: 'p1', grade: tr.querySelector('.p1').textContent.trim() }; fetch(`/api/faculty/grades/${classId}/${studentId}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}).then(r=>r.json()).then(d=>{ alert(d.message||'Saved'); }).catch(e=>{ console.error(e); alert('Save failed'); }); }
  window.FacultyGrading = { loadClasses };
})();
