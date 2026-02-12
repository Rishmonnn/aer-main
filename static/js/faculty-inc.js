(function(){
  function fetchInc(){ fetch('/api/faculty/inc').then(r=>r.json()).then(render).catch(e=>console.error(e)); }
  function render(list){ const tbody = document.querySelector('.inc-table tbody'); if(!tbody) return; tbody.innerHTML = ''; list.forEach(i=>{ const tr = document.createElement('tr'); tr.dataset.reqId = i.id; tr.innerHTML = `<td>${i.student_name}</td><td>${i.subject}</td><td>${i.status}</td><td><button class="btn-approve btn">Approve</button></td>`; tbody.appendChild(tr); }); document.querySelectorAll('.inc-table .btn-approve').forEach(b=>b.addEventListener('click', approve)); }
  function approve(e){ const tr = e.target.closest('tr'); const id = tr ? tr.dataset.reqId : null; if(!id) return; fetch(`/api/faculty/inc/${id}/approve`, { method:'POST' }).then(r=>r.json()).then(d=>{ alert(d.message||'Approved'); fetchInc(); }).catch(e=>{ console.error(e); alert('Failed'); }); }
  window.FacultyInc = { fetchInc };
})();
