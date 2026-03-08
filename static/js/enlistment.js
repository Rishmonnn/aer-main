// =======================================================
// GLOBAL IMPORTS: CONFETTI & TOASTS
// =======================================================

const confettiScript = document.createElement('script');
confettiScript.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
document.head.appendChild(confettiScript);

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        
        container.style.position = 'fixed'; container.style.top = '20px';
        container.style.right = '20px'; container.style.zIndex = '9999';
        container.style.display = 'flex'; container.style.flexDirection = 'column';
        container.style.gap = '10px';
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'bx-check-circle' : 'bx-error-circle';
    
    toast.innerHTML = `<i class='bx ${icon}'></i> <span>${message}</span>`;
    toast.style.background = '#fff';
    toast.style.borderLeft = `5px solid ${type === 'success' ? '#10b981' : '#ef4444'}`;
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.padding = '15px 20px'; toast.style.borderRadius = '4px';
    toast.style.display = 'flex'; toast.style.alignItems = 'center'; toast.style.gap = '10px';
    
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

// =======================================================
// INIT & LOAD DATA
// =======================================================

document.addEventListener('DOMContentLoaded', function() {
    initCalendarGrid(); 
    loadEnlistmentData();
});

function initCalendarGrid() {
    const timeHeader = document.getElementById('calTimeHeader');
    if(!timeHeader) return;
    timeHeader.innerHTML = '';
    // Draw 14 horizontal hours from 7 AM to 8 PM
    for(let hour = 7; hour < 21; hour++) {
        const displayHour = hour > 12 ? `${hour-12} PM` : (hour === 12 ? '12 PM' : `${hour} AM`);
        const label = document.createElement('div');
        label.className = 'cal-time-header';
        label.innerText = displayHour;
        timeHeader.appendChild(label);
    }
}

function loadEnlistmentData() {
    fetch('/api/enlistment/pending')
        .then(res => res.json())
        .then(data => {
            // Clear existing rows first
            document.querySelectorAll('.enlistment-table tbody').forEach(el => el.innerHTML = '');

            // Track how many students are added per year level
            const yearCounts = { '1': 0, '2': 0, '3': 0, '4': 0 };

            // Distribute students into their respective tables
            data.forEach(student => {
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';

                const tbody = document.getElementById(`enlistment-tbody-${yearIndex}`);
                if (tbody) {
                    yearCounts[yearIndex]++;
                    const tr = document.createElement('tr');
                    tr.onclick = () => openEnlistmentModal(student);
                    tr.innerHTML = `
                        <td>${student.id}</td>
                        <td class="student-name">${student.name}</td>
                        <td>${student.program}</td>
                        <td><span class="status-pill regular">Enlisting</span></td>
                        <td><button class="btn-view-action">Enlist</button></td>
                    `;
                    tbody.appendChild(tr);
                    
                    // Automatically open accordions that have pending students
                    tbody.closest('.year-accordion').classList.remove('collapsed');
                }
            });

            // Inject "Empty State" for any year level with 0 students
            const yearLabels = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th' };
            for (const [year, count] of Object.entries(yearCounts)) {
                if (count === 0) {
                    const tbody = document.getElementById(`enlistment-tbody-${year}`);
                    if (tbody) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="5" style="text-align: center; padding: 45px 20px; background: #fcfcfc; border-bottom: none; cursor: default;">
                                    <i class='bx bx-check-shield' style='font-size: 3.5rem; color: #cbd5e1; margin-bottom: 12px; display: block;'></i>
                                    <div style="font-size: 1.15rem; color: #334155; margin: 0 0 6px 0; font-weight: 700;">All caught up!</div>
                                    <div style="color: #64748b; font-size: 0.95rem; margin: 0;">No ${yearLabels[year]}-year students pending enlistment.</div>
                                </td>
                            </tr>
                        `;
                    }
                }
            }
        })
        .catch(err => {
            console.error("Error loading enlistment data:", err);
            showToast("Failed to load student data.", "error");
        });
}

function openEnlistmentModal(studentData) {
    currentStudent = studentData;
    selectedUnits = 0;

    document.getElementById('modalName').innerText = studentData.name;
    document.getElementById('modalID').innerText = studentData.id;
    
    const maxUnits = studentData.maxUnits || 23; 
    document.getElementById('maxUnits').innerText = maxUnits;
    document.getElementById('footerMaxUnits').innerText = maxUnits;
    document.getElementById('modalStanding').innerText = studentData.year_level;

    const typeLabel = studentData.type || 'Regular';
    const typeClass = typeLabel.toLowerCase() === 'irregular' ? 'irregular' : 'regular';
    document.getElementById('modalStatus').innerHTML = `<span class="status-pill ${typeClass}">${typeLabel}</span>`;
    document.getElementById('enlistmentAlerts').innerHTML = ''; 
    
    const skeletonSubjectHtml = `
        <div class="skeleton-subject">
            <div style="display: flex; gap: 15px; align-items: center;">
                <div class="skeleton-box" style="width: 24px; height: 24px; border-radius: 50%;"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div class="skeleton-box" style="width: 50%;"></div>
                    <div class="skeleton-box" style="width: 30%;"></div>
                </div>
                <div class="skeleton-box" style="width: 120px;"></div>
            </div>
        </div>
    `.repeat(4);
    document.getElementById('subjectListBody').innerHTML = skeletonSubjectHtml;
    
    const btnSelect = document.getElementById('btnSelectAll');
    if(btnSelect) btnSelect.innerText = "Select All";
    
    document.getElementById('modalSubjectSearch').value = ''; 
    document.getElementById('cartDrawer').classList.remove('active'); 
    document.getElementById('enlistmentModal').classList.add('active');

    setTimeout(() => {
        fetch(`/api/enlistment/subjects/${studentData.id}`)
            .then(res => res.json())
            .then(subjects => {
                renderSubjects(subjects);
                updateSummary();
            })
            .catch(err => {
                console.error(err);
                document.getElementById('subjectListBody').innerHTML = '<div style="color:red; padding:20px;">Error loading subjects.</div>';
            });
    }, 400); 
}

function closeEnlistmentModal() {
    document.getElementById('enlistmentModal').classList.remove('active');
    document.getElementById('cartDrawer').classList.remove('active');
}

// =======================================================
// RENDER & INTERACTIONS
// =======================================================

function renderSubjects(subjects) {
    const list = document.getElementById('subjectListBody');
    list.innerHTML = '';

    if (subjects.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center;">No subjects found.</div>';
        return;
    }

    subjects.forEach((sub) => {
        const row = document.createElement('div');
        const lockedClass = sub.locked ? 'subject-locked' : '';
        row.className = `subject-row ${lockedClass}`;
        row.dataset.units = sub.units; 
        row.dataset.code = sub.code;

        if (sub.locked) {
            row.onclick = () => showToast(`Cannot take ${sub.code}: ${sub.warning}`, 'error');
        } else {
            row.onclick = () => toggleSubject(row, sub);
        }
        
        let icon = "<i class='bx bx-circle' style='color:#cbd5e1; font-size:1.4rem'></i>";
        if (sub.locked) icon = "<i class='bx bxs-lock-alt' style='color:#64748b; font-size:1.4rem'></i>";

        let badgeHtml = `<span class="tag ${sub.type}">${sub.type.toUpperCase()}</span>`;
        if (sub.locked) badgeHtml = `<span class="tag" style="background:#475569; color:white;">LOCKED</span>`;
        else if (sub.type === 'critical') badgeHtml = `<span class="tag critical">RETAKE REQUIRED</span>`;

        let warningHtml = sub.locked ? `<div style="font-size:0.75rem; color:#ef4444; margin-top:4px; font-weight:500;"><i class='bx bxs-error-circle'></i> ${sub.warning}</div>` : '';

        let optionsHtml = '';
        if (sub.sections && sub.sections.length > 0) {
            sub.sections.forEach(sec => {
                optionsHtml += `<option value="${sec.id}" data-days="${sec.days || ''}" data-time="${sec.time || ''}" data-room="${sec.room || 'TBA'}">Section ${sec.name} (${sec.room} | ${sec.faculty})</option>`;
            });
        }
        
        let sectionDropdownHtml = sub.locked ? '' : `
            <select class="section-select" onclick="event.stopPropagation()" onchange="updateSummary()" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.8rem; background: white; color: #475569; outline: none; cursor: pointer;">
                ${optionsHtml}
            </select>
        `;

        row.innerHTML = `
            <div class="row-top" style="align-items: center; border-bottom: none; padding-bottom: 0;">
                <div class="subject-title">
                    <span class="selection-icon">${icon}</span>
                    <div style="display:flex; flex-direction:column;">
                        <span>${sub.code} - ${sub.name} (${sub.units} Units)</span>
                        ${warningHtml}
                    </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${badgeHtml}
                    ${sectionDropdownHtml}
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

function filterModalSubjects() {
    const val = document.getElementById('modalSubjectSearch').value.toLowerCase();
    document.querySelectorAll('.subject-row').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
}

function toggleCartDrawer() { document.getElementById('cartDrawer').classList.toggle('active'); }

function autoFillBlock() {
    // Because the backend sorted them, the rows are already in priority order top-to-bottom
    const rows = Array.from(document.querySelectorAll('.subject-row:not(.subject-locked)'));
    if (rows.length === 0) return;
    
    // Reset all selections first
    document.querySelectorAll('.subject-row').forEach(r => {
        r.dataset.selected = 'false'; r.classList.remove('selected');
        const iconSpan = r.querySelector('.selection-icon');
        if(iconSpan && !r.classList.contains('subject-locked')) {
            iconSpan.innerHTML = "<i class='bx bx-circle' style='color:#cbd5e1; font-size:1.4rem'></i>";
        }
    });
    
    const maxUnits = parseInt(currentStudent.maxUnits) || 23;
    selectedUnits = 0; 
    
    rows.forEach(row => {
        const units = parseInt(row.dataset.units, 10) || 0;
        
        // SMART FILL: Only add the subject if it fits within the max units allowance
        if (selectedUnits + units <= maxUnits) {
            const selectEl = row.querySelector('.section-select');
            if (selectEl && selectEl.options.length > 0) {
                let targetIndex = 0;
                for(let i=0; i<selectEl.options.length; i++) {
                    if(selectEl.options[i].text.includes('Section A')) { targetIndex = i; break; }
                }
                selectEl.selectedIndex = targetIndex;
            }
            row.dataset.selected = 'true'; 
            row.classList.add('selected');
            row.querySelector('.selection-icon').innerHTML = "<i class='bx bxs-check-circle' style='color:#90242d; font-size:1.4rem'></i>";
            
            selectedUnits += units;
        }
    });
    
    const btn = document.getElementById('btnSelectAll');
    if(btn) btn.innerText = "Deselect All";
    
    showToast(`Smart-filled ${selectedUnits} units based on priority!`, "success");
    updateSummary();
}

function toggleAllSubjects() {
    const rows = document.querySelectorAll('.subject-row:not(.subject-locked)');
    if (rows.length === 0) return;
    const allSelected = Array.from(rows).every(r => r.dataset.selected === 'true');
    const targetState = !allSelected; 
    selectedUnits = 0; 
    rows.forEach(row => {
        const iconSpan = row.querySelector('.selection-icon');
        const units = parseInt(row.dataset.units, 10) || 0; // 🚀 BUG FIX: Parse Int securely
        
        if (targetState) {
            row.dataset.selected = 'true'; row.classList.add('selected');
            iconSpan.innerHTML = "<i class='bx bxs-check-circle' style='color:#90242d; font-size:1.4rem'></i>";
            selectedUnits += units;
        } else {
            row.dataset.selected = 'false'; row.classList.remove('selected');
            iconSpan.innerHTML = "<i class='bx bx-circle' style='color:#cbd5e1; font-size:1.4rem'></i>";
        }
    });
    const btn = document.getElementById('btnSelectAll');
    if(btn) btn.innerText = targetState ? "Deselect All" : "Select All";
    updateSummary();
}

function toggleSubject(rowElement, subject) {
    const isSelected = rowElement.dataset.selected === 'true';
    const iconSpan = rowElement.querySelector('.selection-icon');
    const units = parseInt(subject.units, 10) || 0; // 🚀 BUG FIX: Math crash string-concatenation fix
    
    if (isSelected) {
        rowElement.dataset.selected = 'false'; rowElement.classList.remove('selected');
        iconSpan.innerHTML = "<i class='bx bx-circle' style='color:#cbd5e1; font-size:1.4rem'></i>";
        selectedUnits -= units;
    } else {
        rowElement.dataset.selected = 'true'; rowElement.classList.add('selected');
        iconSpan.innerHTML = "<i class='bx bxs-check-circle' style='color:#90242d; font-size:1.4rem'></i>";
        selectedUnits += units;
    }
    const rows = document.querySelectorAll('.subject-row:not(.subject-locked)');
    const allSelected = Array.from(rows).every(r => r.dataset.selected === 'true');
    const btn = document.getElementById('btnSelectAll');
    if(btn) btn.innerText = allSelected ? "Deselect All" : "Select All";
    updateSummary();
}

// =======================================================
// SUMMARY & HORIZONTAL GANTT CHART
// =======================================================

function updateSummary() {
    const maxUnits = parseInt(currentStudent.maxUnits) || 23;
    const unitCounter = document.getElementById('unitCounter');
    const progressBar = document.getElementById('unitProgressBar');
    const btnEnlist = document.getElementById('btnEnlist');
    
    unitCounter.innerText = selectedUnits;
    const boardUnitCount = document.getElementById('boardUnitCount');
    if (boardUnitCount) boardUnitCount.innerText = `${selectedUnits} Units`;

    const selectedRows = document.querySelectorAll('.subject-row[data-selected="true"]');
    document.getElementById('summaryCount').innerText = selectedRows.length;
    
    let percentage = (selectedUnits / maxUnits) * 100;
    if (percentage > 100) {
        progressBar.style.width = '100%'; progressBar.classList.add('overload');
        unitCounter.style.color = '#ef4444'; 
        btnEnlist.disabled = true;
    } else {
        progressBar.style.width = `${percentage}%`; progressBar.classList.remove('overload');
        unitCounter.style.color = '#10b981'; 
        btnEnlist.disabled = false; 
    }

    renderScheduleBoard(selectedRows);
    updateCartDrawer(selectedRows);
}

function updateCartDrawer(selectedRows) {
    const cartList = document.getElementById('cartDrawerList');
    if (!cartList) return;
    if (selectedRows.length === 0) {
        cartList.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 10px;">Cart is empty.</div>';
        return;
    }
    cartList.innerHTML = '';
    selectedRows.forEach(row => {
        cartList.innerHTML += `
            <div class="cart-item">
                <strong>${row.dataset.code}</strong>
                <span>${row.dataset.units} Units</span>
            </div>
        `;
    });
}

function parseTimeToDecimal(timeStr) {
    // 🚀 BUG FIX: \d{1,2} to allow "7:30AM" instead of strictly requiring "07:30AM"
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*([APM]{2})/i); 
    if(!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours + (minutes / 60);
}

function renderScheduleBoard(selectedRows) {
    const days = ['MON','TUE','WED','THU','FRI','SAT'];
    let hasPlottedSomething = false; // 🚀 BUG FIX: Tracks if at least ONE time was mapped
    
    // Clear Tracks First
    days.forEach(day => {
        const track = document.getElementById(`track-${day}`);
        if(track) track.innerHTML = '';
    });
    
    const tbaList = document.getElementById('tbaList');
    const tbaTray = document.getElementById('tbaTray');
    if(tbaList) tbaList.innerHTML = '';
    let hasTBA = false;

    const cardColors = ['#90242d', '#0284c7', '#059669', '#d97706', '#7c3aed', '#db2777'];

    // Map through selected rows and plot them
    selectedRows.forEach((row, index) => {
        const code = row.dataset.code;
        const selectEl = row.querySelector('.section-select');
        const color = cardColors[index % cardColors.length];

        let isPlotted = false;

        if (selectEl && selectEl.options.length > 0) {
            const option = selectEl.options[selectEl.selectedIndex];
            const rawDays = option.getAttribute('data-days'); 
            const rawTime = option.getAttribute('data-time'); 
            const room = option.getAttribute('data-room');

            if (rawDays && rawTime && rawTime.includes('-')) {
                const daysArr = rawDays.split(/[\/,]/).map(d => d.trim().substring(0,3).toUpperCase());
                const [startStr, endStr] = rawTime.split('-');
                
                const startDec = parseTimeToDecimal(startStr);
                const endDec = parseTimeToDecimal(endStr);

                if (startDec !== null && endDec !== null) {
                    hasPlottedSomething = true;
                    const leftPercent = ((startDec - 7) / 14) * 100;
                    const widthPercent = ((endDec - startDec) / 14) * 100;

                    daysArr.forEach(day => {
                        const track = document.getElementById(`track-${day}`);
                        if (track) {
                            const block = document.createElement('div');
                            block.className = 'gantt-block';
                            block.style.background = color;
                            block.style.left = `${leftPercent}%`;
                            block.style.width = `${widthPercent}%`;
                            block.innerHTML = `
                                <div class="gantt-code">${code}</div>
                                <div class="gantt-room">${room}</div>
                            `;
                            track.appendChild(block);
                            isPlotted = true;
                        }
                    });
                }
            }
        }

        // If block couldn't be mapped to the timeline, put it in TBA Tray
        if (!isPlotted) {
            hasTBA = true;
            const tbaPill = document.createElement('div');
            tbaPill.className = 'tba-pill';
            tbaPill.innerHTML = `<span style="color:${color}">●</span> ${code}`;
            if(tbaList) tbaList.appendChild(tbaPill);
        }
    });

    // 🚀 BUG FIX: Smarter day hiding logic
    days.forEach(day => {
        const row = document.getElementById(`row-${day}`);
        const track = document.getElementById(`track-${day}`);
        if (row && track) {
            if (hasPlottedSomething) {
                // If we mapped standard times, safely hide rows that ended up totally empty
                row.style.display = track.innerHTML.trim() === '' ? 'none' : 'flex';
            } else {
                // If NOTHING was plotted (eg only TBA classes), keep all blank rows visible to maintain calendar shape
                row.style.display = 'flex'; 
            }
        }
    });

    if(tbaTray) tbaTray.style.display = hasTBA ? 'block' : 'none';
}

// =======================================================
// SUBMIT WORKFLOW
// =======================================================

function submitEnlistment() {
    const btn = document.getElementById('btnEnlist');
    if (selectedUnits === 0) { showToast("Please select at least one subject.", "error"); return; }

    const selectedRows = document.querySelectorAll('.subject-row[data-selected="true"]');
    const subjectsData = []; 
    
    selectedRows.forEach(row => {
        const code = row.dataset.code;
        if (code) {
            const selectEl = row.querySelector('.section-select');
            const sectionId = selectEl ? selectEl.value : null;
            subjectsData.push({ code: code, section_id: sectionId });
        }
    });

    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processing..."; 
    btn.disabled = true;

    fetch('/api/enlistment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: currentStudent.id, subjects: subjectsData })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast("Student Successfully Enlisted!", "success");
            closeEnlistmentModal();
            loadEnlistmentData(); 
            if (typeof loadStudentJourney === 'function') loadStudentJourney();
            
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150, spread: 80, origin: { y: 0.6 },
                    colors: ['#90242d', '#10b981', '#fbbf24', '#3b82f6'], zIndex: 9999
                });
            }
        } else {
            showToast("Error: " + data.message, "error");
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Server Error occurred.", "error");
    })
    .finally(() => {
        btn.innerHTML = "<i class='bx bx-check-circle'></i> Enlist Student";
        btn.disabled = false;
    });
}

function filterEnlistment() {
    const val = document.getElementById('enlistmentSearch').value.toLowerCase();
    document.querySelectorAll('.enlistment-table tbody tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
}

function toggleAccordion(element) {
    element.parentElement.classList.toggle('collapsed');
}