(function(){
  function init(){ document.addEventListener('click', function(e){ if(e.target.matches('.btn-advise')) handleAdvise(e); }); }
  function fetchAdvising(){ return fetch('/api/advising').then(r=>r.json()).then(renderAdvising).catch(e=>console.error(e)); }
  function renderAdvising(list){ const tbody = document.querySelector('.advising-table tbody'); if(!tbody) return; tbody.innerHTML = ''; list.forEach(a=>{ const tr = document.createElement('tr'); tr.dataset.adviseId = a.id; tr.innerHTML = `<td>${a.name}</td><td>${a.program}</td><td>${a.status}</td><td><button class="btn-advise btn">Advise</button></td>`; tbody.appendChild(tr); }); }
  function handleAdvise(e){ const tr = e.target.closest('tr'); const id = tr ? tr.dataset.adviseId : null; if(!id) return alert('Advise ID missing'); fetch(`/api/advising/${id}/advise`, { method:'POST' }).then(r=>r.json()).then(d=>{ alert(d.message||'Advising recorded (stub)'); fetchAdvising(); }).catch(e=>{ console.error(e); alert('Failed'); }); }
  window.Advising = { init, fetchAdvising };
  document.addEventListener('DOMContentLoaded', init);
})();
