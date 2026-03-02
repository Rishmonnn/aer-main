// --- Retention JS Logic ---

document.addEventListener('DOMContentLoaded', () => {
    fetchRetentionData();
});

function fetchRetentionData() {
    fetch('/api/retention')
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                console.error("Server Error:", data.error);
                return;
            }

            // 1. Update Top Stats
            document.getElementById('ret-total-students').innerText = data.stats.total;
            document.getElementById('ret-regular').innerText = data.stats.regular;
            document.getElementById('ret-irregular').innerText = data.stats.irregular;
            // 1. Update Rates
            document.getElementById('ret-rate-val').innerText = data.stats.retention_rate + '%';
            document.getElementById('drop-rate-val').innerText = data.stats.dropout_rate + '%';

            // 2. Draw the Dynamic Doughnut Chart & Legend
            renderDoughnutChart(data.reasons);
            
            // 2. Update Risk Counts
            document.getElementById('ret-critical-count').innerText = data.risks.critical_count;
            document.getElementById('ret-high-count').innerText = data.risks.high_count;
            
            // 3. Update Population Bars (calculate percentages)
            const total = data.stats.total || 1; // Prevent division by zero
            const y1 = data.population['1st Year'] || 0;
            const y2 = data.population['2nd Year'] || 0;
            const y3 = data.population['3rd Year'] || 0;
            const y4 = data.population['4th Year'] || 0;
            
            document.getElementById('pop-count-1').innerText = y1;
            document.getElementById('pop-bar-1').style.width = `${(y1 / total) * 100}%`;
            
            document.getElementById('pop-count-2').innerText = y2;
            document.getElementById('pop-bar-2').style.width = `${(y2 / total) * 100}%`;
            
            document.getElementById('pop-count-3').innerText = y3;
            document.getElementById('pop-bar-3').style.width = `${(y3 / total) * 100}%`;
            
            document.getElementById('pop-count-4').innerText = y4;
            document.getElementById('pop-bar-4').style.width = `${(y4 / total) * 100}%`;
            
            // 4. Populate Table
            const tbody = document.getElementById('retention-table-body');
            tbody.innerHTML = ''; // Clear previous data
            
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
        })
        .catch(err => console.error("Error fetching retention data:", err));
}

// Search/filter logic
function filterRetentionTable() {
    const input = document.getElementById('retentionSearch');
    const filter = input.value.toUpperCase();
    const rows = document.querySelectorAll('.retention-table tbody tr');
    
    rows.forEach(row => {
        const text = row.innerText;
        if (text.toUpperCase().indexOf(filter) > -1) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

