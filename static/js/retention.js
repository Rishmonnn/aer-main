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
                                <td><button class="btn-advise">ADVISE</button></td>
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
const closeDropBtn = document.getElementById('close-drop-modal');
const cancelDropBtn = document.getElementById('btn-cancel-drop');
const searchInput = document.getElementById('drop-student-search');
const suggestionsBox = document.getElementById('drop-student-suggestions');
const submitDropBtn = document.getElementById('btn-submit-drop');

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

if (closeDropBtn) closeDropBtn.onclick = closeDropModal;
if (cancelDropBtn) cancelDropBtn.onclick = closeDropModal;

window.addEventListener('click', (e) => { 
    if(e.target == dropModal) closeDropModal(); 
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