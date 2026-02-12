(function(){
  function fetchClasses(){ fetch('/api/faculty/classes').then(r=>r.json()).then(render).catch(e=>console.error(e)); }
  function render(list){ const ul = document.querySelector('.my-classes-list'); if(!ul) return; ul.innerHTML = ''; list.forEach(c=>{ const li = document.createElement('li'); li.textContent = `${c.code} - ${c.name} (${c.students} students)`; ul.appendChild(li); }); }
  window.FacultyClasses = { fetchClasses };
})();
