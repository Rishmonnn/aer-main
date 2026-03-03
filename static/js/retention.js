// ==========================================
// 1. MAIN RETENTION DASHBOARD LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    fetchRetentionData();
    fetchDropHistory(); // Loads the history table on startup
});

function fetchRetentionData() {
    fetch('/api/retention')
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                console.error("Server Error:", data.error);
                return;
            }

            // Update Top Stats
            document.getElementById('ret-total-students').innerText = data.stats.total;
            document.getElementById('ret-regular').innerText = data.stats.regular;
            document.getElementById('ret-irregular').innerText = data.stats.irregular;
            
            // Update Rates
            document.getElementById('ret-rate-val').innerText = data.stats.retention_rate + '%';
            document.getElementById('drop-rate-val').innerText = data.stats.dropout_rate + '%';

            // Update Trends
            updateTrendUI('ret-trend-container', 'ret-trend-icon', 'ret-trend-val', data.stats.retention_trend, true);
            updateTrendUI('drop-trend-container', 'drop-trend-icon', 'drop-trend-val', data.stats.dropout_trend, false);

            // Draw the Dynamic Doughnut Chart
            renderDoughnutChart(data.reasons);
            
            // Update Risk Counts
            document.getElementById('ret-critical-count').innerText = data.risks.critical_count;
            document.getElementById('ret-high-count').innerText = data.risks.high_count;
            
            // Update Population Bars
            const y1 = data.population['1st Year'] || 0;
            const y2 = data.population['2nd Year'] || 0;
            const y3 = data.population['3rd Year'] || 0;
            const y4 = data.population['4th Year'] || 0;
            
            const activeTotal = (y1 + y2 + y3 + y4) || 1; 
            
            document.getElementById('pop-count-1').innerText = y1;
            if(document.getElementById('pop-bar-1')) document.getElementById('pop-bar-1').style.width = `${(y1 / activeTotal) * 100}%`;
            
            document.getElementById('pop-count-2').innerText = y2;
            if(document.getElementById('pop-bar-2')) document.getElementById('pop-bar-2').style.width = `${(y2 / activeTotal) * 100}%`;
            
            document.getElementById('pop-count-3').innerText = y3;
            if(document.getElementById('pop-bar-3')) document.getElementById('pop-bar-3').style.width = `${(y3 / activeTotal) * 100}%`;
            
            document.getElementById('pop-count-4').innerText = y4;
            if(document.getElementById('pop-bar-4')) document.getElementById('pop-bar-4').style.width = `${(y4 / activeTotal) * 100}%`;
            
            // Populate At-Risk Table
            const tbody = document.getElementById('retention-table-body');
            if(tbody) {
                tbody.innerHTML = ''; 
                if (data.at_risk_students.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b;">No students are currently at risk.</td></tr>`;
                } else {
                    data.at_risk_students.forEach(student => {
                        tbody.innerHTML += `
                            <tr>
                                <td>${student.id}</td>
                                <td class="std-name">${student.name}</td>
                                <td>${student.program}</td>
                                <td>${student.year_level}</td>
                                <td><span class="risk-pill ${student.risk_class}">${student.risk_level}</span></td>
                                <td><button class="btn-advise" onclick="openAdvisingModal('${student.id}', \`${student.name}\`)">ADVISE</button></td>
                            </tr>
                        `;
                    });
                }
            }
        })
        .catch(err => console.error("Error fetching retention data:", err));
}

// Search/filter logic for Main Table
function filterRetentionTable() {
    const input = document.getElementById('retentionSearch');
    if(!input) return;
    const filter = input.value.toUpperCase();
    const rows = document.querySelectorAll('.retention-table tbody tr');
    
    rows.forEach(row => {
        const text = row.innerText;
        row.style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    });
}

function updateTrendUI(containerId, iconId, textId, trendValue, isGoodWhenPositive) {
    const container = document.getElementById(containerId);
    const icon = document.getElementById(iconId);
    const text = document.getElementById(textId);

    if (!container || !icon || !text) return; 

    const formattedValue = trendValue > 0 ? `+${trendValue}%` : `${trendValue}%`;
    text.innerText = formattedValue;

    let isPositiveTrend = trendValue > 0;
    let isGood = isGoodWhenPositive ? isPositiveTrend : !isPositiveTrend;

    container.classList.remove('positive', 'negative');
    icon.classList.remove('bx-trending-up', 'bx-trending-down', 'bx-minus');

    if (trendValue === 0) {
        icon.classList.add('bx-minus');
        container.style.color = "#94a3b8";
    } else {
        container.classList.add(isGood ? 'positive' : 'negative');
        icon.classList.add(isPositiveTrend ? 'bx-trending-up' : 'bx-trending-down');
    }
}

// --- DOUGHNUT CHART GENERATOR ---
function renderDoughnutChart(reasons) {
    const legendBox = document.querySelector('.legend-box');
    const doughnut = document.querySelector('.css-doughnut');

    if (!legendBox || !doughnut) return;

    // 1. Define all standard categories and lock their colors so they never change
    const categories = [
        { name: "Financial Issues", color: "#ef5350" },
        { name: "Academic Struggles", color: "#263238" },
        { name: "Personal/Family", color: "#78909c" },
        { name: "Wrong Program Fit", color: "#d81b60" },
        { name: "Mental Health", color: "#ab47bc" },
        { name: "Transferred School", color: "#26a69a" },
        { name: "Other", color: "#f59e0b" }
    ];

    legendBox.innerHTML = ''; // Clear old legend
    
    let gradientStops = [];
    let currentPercentage = 0;
    let totalActiveDrops = 0;

    // 2. Loop through our fixed categories so they ALWAYS show up in the legend
    categories.forEach(category => {
        // Look in the database data to see if this reason has any drops
        const foundReason = reasons ? reasons.find(r => r.reason === category.name) : null;
        const pct = foundReason ? foundReason.percentage : 0;
        
        totalActiveDrops += pct;

        // Visual trick: Dim the text slightly if it's 0% so the active ones pop out!
        const dimStyle = pct === 0 ? "opacity: 0.5;" : "opacity: 1; font-weight: 600;";

        // Always draw the legend item
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-label" style="${dimStyle}">
                <span class="dot" style="background:${category.color}"></span>${category.name}
            </div>
            <span class="legend-val" style="${dimStyle}">${pct}%</span>
        `;
        legendBox.appendChild(legendItem);

        // Only add to the Doughnut colored ring if the percentage is greater than 0
        if (pct > 0) {
            const start = currentPercentage;
            const end = currentPercentage + pct;
            gradientStops.push(`${category.color} ${start}% ${end}%`);
            currentPercentage = end;
        }
    });

    // 3. Paint the doughnut ring (Gray if 0 drops, colored if there are drops)
    if (totalActiveDrops === 0 || gradientStops.length === 0) {
        doughnut.style.background = '#f1f5f9'; // Empty gray ring
    } else {
        doughnut.style.background = `conic-gradient(${gradientStops.join(', ')})`;
    }
}


// ==========================================
// 2. DROP & TRANSFER HISTORY LOGIC
// ==========================================

function fetchDropHistory() {
    fetch('/api/retention/history')
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('history-table-body');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #94a3b8; font-style: italic;">No drop or transfer records found.</td></tr>`;
                return;
            }
            
            data.forEach(student => {
                const pillClass = student.status === 'Dropped' ? 'status-dropped' : 'status-transferred';
                
                tbody.innerHTML += `
                    <tr>
                        <td style="color: #475569; font-weight: 500;">${student.id}</td>
                        <td style="font-weight: 700; color: #1e293b;">${student.name}</td>
                        <td><span class="status-pill ${pillClass}">${student.status}</span></td>
                        <td style="color: #334155; font-weight: 600;">${student.reason}</td>
                        <td style="color: #64748b; font-size: 0.9em; white-space: nowrap;">${student.date || 'N/A'}</td>
                    </tr>
                `;
            });
        })
        .catch(err => console.error("Error fetching history:", err));
}

// Search filter for the History Table
function filterHistoryTable() {
    let input = document.getElementById("historySearch");
    if(!input) return;
    let filter = input.value.toLowerCase();
    let table = document.getElementById("dropHistoryTable");
    let tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) {
        let text = tr[i].innerText.toLowerCase();
        tr[i].style.display = text.includes(filter) ? "" : "none";
    }
}


// ==========================================
// 3. DROP / TRANSFER STUDENT MODAL LOGIC
// ==========================================

let allStudentsCache = [];
let selectedStudentIdForDrop = null;

const dropModal = document.getElementById('dropStudentModal');
const openDropBtn = document.getElementById('btn-open-drop-modal');
const cancelDropBtn = document.getElementById('btn-cancel-drop');
const searchInput = document.getElementById('drop-student-search');
const suggestionsBox = document.getElementById('drop-student-suggestions');
const submitDropBtn = document.getElementById('btn-submit-drop');

// close button for advising modal (added to HTML)
const closeAdvBtn = document.getElementById('close-adv-modal');


function closeDropModal() {
    if(dropModal) dropModal.style.display = "none";
    document.body.style.overflow = ""; 
}

if (openDropBtn) {
    openDropBtn.onclick = () => {
        dropModal.style.display = "flex"; 
        document.body.style.overflow = "hidden"; 
        
        searchInput.value = '';
        selectedStudentIdForDrop = null;
        suggestionsBox.style.display = 'none';

        fetch('/api/students')
            .then(res => res.json())
            .then(data => {
                allStudentsCache = data.filter(s => s.status !== 'Dropped' && s.status !== 'Transferred');
            });
    }
}

// attach cancel buttons
if (cancelDropBtn) cancelDropBtn.onclick = closeDropModal;
if (closeAdvBtn) closeAdvBtn.onclick = closeAdvisingModal;

window.addEventListener('click', (e) => { 
    if(e.target == dropModal) closeDropModal();
    if(e.target == advisingModal) closeAdvisingModal();
});

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        suggestionsBox.innerHTML = '';
        selectedStudentIdForDrop = null; 
        
        if (!val) {
            suggestionsBox.style.display = 'none';
            return;
        }
        
        const matches = allStudentsCache.filter(s => 
            s.name.toLowerCase().includes(val) || s.id.toLowerCase().includes(val)
        ).slice(0, 5); 
        
        if (matches.length > 0) {
            suggestionsBox.style.display = 'block';
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<strong>${m.name}</strong> <span>(${m.id})</span>`;
                div.onclick = () => {
                    searchInput.value = `${m.name} (${m.id})`;
                    selectedStudentIdForDrop = m.id;
                    suggestionsBox.style.display = 'none';
                };
                suggestionsBox.appendChild(div);
            });
        } else {
            suggestionsBox.style.display = 'none';
        }
    });
}

if (submitDropBtn) {
    submitDropBtn.onclick = () => {
        if (!selectedStudentIdForDrop) {
            alert("Please select a valid student from the dropdown suggestions.");
            return;
        }
        
        const actionType = document.getElementById('drop-action-type').value;
        const reason = document.getElementById('drop-reason').value;
        
        if(!confirm(`WARNING: Are you sure you want to mark this student as ${actionType}?`)) return;
        
        submitDropBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processing...";
        submitDropBtn.disabled = true;

        fetch(`/api/students/drop/${selectedStudentIdForDrop}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason, status: actionType })
        })
        .then(res => res.json())
        .then(data => {
            submitDropBtn.innerHTML = "<i class='bx bx-check'></i> Confirm Action";
            submitDropBtn.disabled = false;

            if (data.success) {
                closeDropModal(); 
                
                // --- THESE TWO LINES CREATE THE INSTANT UPDATE MAGIC ---
                fetchRetentionData(); // Refreshes the Charts and Risk Counts
                fetchDropHistory();   // Refreshes the History Table instantly!
                
            } else {
                alert("Error: " + data.message);
            }
        })
        .catch(err => console.error(err));
    }
}

// ==========================================
// 4. ADVISING MODAL LOGIC
// ==========================================

const advisingModal = document.getElementById('advisingModal');
let currentAdviseStudentId = null;
let editingRecordId = null;      // NEW: Tracks if we are editing an old record
let currentAdvisingHistory = []; // NEW: Stores the records locally

function closeAdvisingModal() {
    if (advisingModal) advisingModal.style.display = "none";
    document.body.style.overflow = "";
    currentAdviseStudentId = null;
    editingRecordId = null;
}

function openAdvisingModal(studentId, studentName) {
    currentAdviseStudentId = studentId;
    
    document.getElementById('adv-student-id').innerText = studentId;
    document.getElementById('adv-student-name').innerText = studentName;
    
    resetAdvisingForm(); // Ensure the form starts blank
    
    if (advisingModal) advisingModal.style.display = "flex";
    document.body.style.overflow = "hidden";
    
    fetchAdvisingHistory(studentId);
}

function resetAdvisingForm() {
    editingRecordId = null;
    document.getElementById('adv-notes').value = '';
    document.getElementById('adv-action-plan').value = '';
    document.getElementById('adv-category').selectedIndex = 0;
    document.getElementById('adv-status').value = 'Open';
    document.getElementById('adv-followup').value = '';
    
    // Reset button appearance
    const btn = document.getElementById('btn-submit-adv');
    btn.innerHTML = "<i class='bx bx-save'></i> Save New Record";
    btn.style.background = "var(--primary-red, #8B0000)"; 
}

function fetchAdvisingHistory(studentId) {
    const historyList = document.getElementById('adv-history-list');
    historyList.innerHTML = "<div style='text-align:center; padding: 20px;'><i class='bx bx-loader-alt bx-spin' style='font-size: 24px; color: #3b82f6;'></i></div>";
    
    fetch(`/api/advising/${studentId}`)
        .then(res => res.json())
        .then(data => {
            currentAdvisingHistory = data; 
            
            if (data.length === 0) {
                historyList.innerHTML = "<div style='text-align:center; color:#94a3b8; padding: 30px 0;'><i class='bx bx-folder-open' style='font-size: 32px; display: block; margin-bottom: 10px;'></i><em>No previous advising records found.</em></div>";
            } else {
                historyList.innerHTML = data.map(r => {
                    // Dynamic Colors
                    let statusColor = r.status === 'Resolved' ? '#10b981' : (r.status === 'Monitoring' ? '#f59e0b' : '#ef4444');
                    let statusBg = r.status === 'Resolved' ? '#d1fae5' : (r.status === 'Monitoring' ? '#fef3c7' : '#fee2e2');
                    
                    let followUpText = r.follow_up_date && r.follow_up_date !== 'None' ? 
                        `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 6px;">
                            <i class='bx bx-calendar-event' style="color: #3b82f6; font-size: 16px;"></i> 
                            <strong>Scheduled Follow-up:</strong> ${r.follow_up_date}
                        </div>` : '';

                    // Sleek Card UI Output
                    return `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid ${statusColor}; position: relative;">
                        
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span style="font-weight: 700; color: #0f172a; font-size: 14px;">${r.date}</span>
                                <span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">${r.status}</span>
                                <span style="background: #f1f5f9; color: #475569; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">${r.category}</span>
                            </div>
                            <button onclick="editPastRecord(${r.id})" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; padding: 5px 12px; transition: 0.2s; display: flex; align-items: center; gap: 4px;">
                                <i class='bx bx-edit-alt'></i> Edit
                            </button>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px;">
                            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <strong style="color: #64748b; display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Discussion Notes</strong>
                                <span style="color: #334155; line-height: 1.5;">${r.notes}</span>
                            </div>
                            <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; border: 1px solid #dcfce3;">
                                <strong style="color: #166534; display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Agreed Action Plan</strong>
                                <span style="color: #15803d; line-height: 1.5;">${r.action_plan}</span>
                            </div>
                        </div>
                        
                        ${followUpText}
                    </div>`;
                }).join('');
            }
        })
        .catch(err => {
            historyList.innerHTML = "<div style='color: #ef4444; text-align: center; padding: 20px;'><i class='bx bx-error-circle' style='font-size: 24px; display: block; margin-bottom: 5px;'></i>Failed to load records.</div>";
        });
}

function editPastRecord(recordId) {
    // Find the record the user clicked on
    const record = currentAdvisingHistory.find(r => r.id === recordId);
    if (!record) return;
    
    editingRecordId = recordId; // Set the flag so the system knows we are updating
    
    // Auto-fill the inputs with the old data
    document.getElementById('adv-category').value = record.category || 'Other';
    document.getElementById('adv-status').value = record.status || 'Open';
    document.getElementById('adv-followup').value = (record.follow_up_date && record.follow_up_date !== 'None') ? record.follow_up_date : '';
    document.getElementById('adv-notes').value = record.notes || '';
    document.getElementById('adv-action-plan').value = record.action_plan || '';
    
    // Change the main button to look like an "Update" button
    const btn = document.getElementById('btn-submit-adv');
    btn.innerHTML = "<i class='bx bx-refresh'></i> Update Record";
    btn.style.background = "#f59e0b"; // Turns yellow to clearly indicate Edit Mode
}

function submitAdvising() {
    if (!currentAdviseStudentId) return;
    
    const notes = document.getElementById('adv-notes').value.trim();
    const category = document.getElementById('adv-category').value;
    const actionPlan = document.getElementById('adv-action-plan').value.trim();
    const status = document.getElementById('adv-status').value;
    const followUp = document.getElementById('adv-followup').value;
    
    if (!notes) {
        alert("Please enter discussion notes.");
        return;
    }
    
    const btn = document.getElementById('btn-submit-adv');
    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processing...";
    btn.disabled = true;
    
    // Smart Routing: Sends PUT if editing, POST if new
    const url = editingRecordId ? `/api/advising/record/${editingRecordId}` : `/api/advising/${currentAdviseStudentId}`;
    const method = editingRecordId ? 'PUT' : 'POST';
    
    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            notes: notes,
            category: category,
            action_plan: actionPlan,
            status: status,
            follow_up_date: followUp
        })
    })
    .then(res => res.json())
    .then(data => {
        btn.disabled = false;
        
        if (data.success) {
            // Instantly refresh the list and clear the form so you can see your update!
            resetAdvisingForm();
            fetchAdvisingHistory(currentAdviseStudentId);
        } else {
            alert("Error: " + data.message);
        }
    })
    .catch(err => {
        console.error(err);
        btn.innerHTML = editingRecordId ? "<i class='bx bx-refresh'></i> Update Record" : "<i class='bx bx-save'></i> Save New Record";
        btn.disabled = false;
        alert("An error occurred while saving.");
    });
}


// ==========================================
// 5. AI ADVISOR GENERATOR LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const aiBtn = document.getElementById('btn-generate-ai');
    
    if(aiBtn) {
        aiBtn.addEventListener('click', async () => {
            // 1. Ensure a student is selected via the Advising Modal
            if (!currentAdviseStudentId) {
                alert("Please select a student to advise first.");
                return;
            }
            
            // 2. Grab current context
            const category = document.getElementById('adv-category').value;
            const notes = document.getElementById('adv-notes').value;
            const actionPlanInput = document.getElementById('adv-action-plan');

            // 3. Set UI to Loading State
            const originalText = aiBtn.innerHTML;
            aiBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Generating...";
            aiBtn.disabled = true;
            actionPlanInput.value = "Consulting AI Advisor... Please wait.";

            try {
                // 4. Call the Flask backend AI API endpoint
                const response = await fetch(`/api/advising/generate-plan/${currentAdviseStudentId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ category: category, notes: notes })
                });

                const data = await response.json();

                // 5. Populate the text area
                if(data.success) {
                    actionPlanInput.value = data.action_plan;
                } else {
                    actionPlanInput.value = "";
                    alert(data.message || "Could not generate plan.");
                }
            } catch (error) {
                console.error("AI Error:", error);
                actionPlanInput.value = "";
                alert("An error occurred while connecting to the AI.");
            } finally {
                // 6. Restore the Magic Button state
                aiBtn.innerHTML = originalText;
                aiBtn.disabled = false;
            }
        });
    }
});