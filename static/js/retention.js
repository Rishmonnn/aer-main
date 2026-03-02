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

            // Retention is good when it goes up (true)
            updateTrendUI('ret-trend-container', 'ret-trend-icon', 'ret-trend-val', data.stats.retention_trend, true);
            
            // Dropout is good when it goes DOWN (false)
            updateTrendUI('drop-trend-container', 'drop-trend-icon', 'drop-trend-val', data.stats.dropout_trend, false);

            // 2. Draw the Dynamic Doughnut Chart & Legend
            renderDoughnutChart(data.reasons);
            
            // 2. Update Risk Counts
            document.getElementById('ret-critical-count').innerText = data.risks.critical_count;
            document.getElementById('ret-high-count').innerText = data.risks.high_count;
            
            // 3. Update Population Bars (calculate percentages)
            const total = data.stats.total || 1; // Prevent division by zero
            // 3. Update Population Bars (calculate percentages)
            const y1 = data.population['1st Year'] || 0;
            const y2 = data.population['2nd Year'] || 0;
            const y3 = data.population['3rd Year'] || 0;
            const y4 = data.population['4th Year'] || 0;
            
            // Calculate Active Total (Only students currently in 1st-4th year)
            const activeTotal = (y1 + y2 + y3 + y4) || 1; // Prevent division by zero
            
            document.getElementById('pop-count-1').innerText = y1;
            document.getElementById('pop-bar-1').style.width = `${(y1 / activeTotal) * 100}%`;
            
            document.getElementById('pop-count-2').innerText = y2;
            document.getElementById('pop-bar-2').style.width = `${(y2 / activeTotal) * 100}%`;
            
            document.getElementById('pop-count-3').innerText = y3;
            document.getElementById('pop-bar-3').style.width = `${(y3 / activeTotal) * 100}%`;
            
            document.getElementById('pop-count-4').innerText = y4;
            document.getElementById('pop-bar-4').style.width = `${(y4 / activeTotal) * 100}%`;
            
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

function updateTrendUI(containerId, iconId, textId, trendValue, isGoodWhenPositive) {
    const container = document.getElementById(containerId);
    const icon = document.getElementById(iconId);
    const text = document.getElementById(textId);

    if (!container || !icon || !text) {
        console.warn(`Trend UI elements missing for ${containerId}`);
        return; 
    }
    // Format the number to always show a + or - sign
    const formattedValue = trendValue > 0 ? `+${trendValue}%` : `${trendValue}%`;
    text.innerText = formattedValue;

    // Determine if the trend is "good" or "bad"
    // For Retention: Positive is good. For Dropout: Positive is bad.
    let isPositiveTrend = trendValue > 0;
    let isGood = isGoodWhenPositive ? isPositiveTrend : !isPositiveTrend;

    // Reset classes
    container.classList.remove('positive', 'negative');
    icon.classList.remove('bx-trending-up', 'bx-trending-down', 'bx-minus');

    if (trendValue === 0) {
        icon.classList.add('bx-minus'); // Neutral dash
        container.style.color = "#94a3b8"; // Gray color for no change
    } else {
        container.classList.add(isGood ? 'positive' : 'negative');
        icon.classList.add(isPositiveTrend ? 'bx-trending-up' : 'bx-trending-down');
    }
}

// --- DOUGHNUT CHART GENERATOR ---
function renderDoughnutChart(reasons) {
    const legendBox = document.querySelector('.legend-box');
    const doughnut = document.querySelector('.css-doughnut');

    // Safety check just in case the HTML elements are missing
    if (!legendBox || !doughnut) return;

    // The colors used in your original design
    const colors = ['#ef5350', '#263238', '#78909c', '#d81b60', '#ab47bc', '#f59e0b', '#10b981'];

    // 1. Clear the old hardcoded HTML legend
    legendBox.innerHTML = ''; 

    // 2. Handle the "Empty State" (If nobody has dropped out yet!)
    if (!reasons || reasons.length === 0) {
        doughnut.style.background = '#f1f5f9'; // Flat gray circle
        legendBox.innerHTML = `
            <div class="legend-item" style="justify-content: center;">
                <span style="color:#64748b; font-style:italic; font-size: 0.9rem;">No dropouts recorded</span>
            </div>
        `;
        return;
    }

    // 3. Build the new legend and the CSS chart
    let gradientStops = [];
    let currentPercentage = 0;

    reasons.forEach((item, index) => {
        // Pick a color from the array (loop back to start if we run out of colors)
        const color = colors[index % colors.length];
        const pct = item.percentage;

        // Build the Legend Item HTML
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-label">
                <span class="dot" style="background:${color}"></span>${item.reason}
            </div>
            <span class="legend-val">${pct}%</span>
        `;
        legendBox.appendChild(legendItem);

        // Build the pie slice for the CSS Doughnut
        // Example output: "#ef5350 0% 28%"
        const start = currentPercentage;
        const end = currentPercentage + pct;
        gradientStops.push(`${color} ${start}% ${end}%`);
        
        currentPercentage = end; // Move the starting point for the next slice
    });

    // Apply the slices to the doughnut ring!
    doughnut.style.background = `conic-gradient(${gradientStops.join(', ')})`;
}