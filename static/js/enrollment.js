// --- INIT: Load Data ---
document.addEventListener('DOMContentLoaded', function() {
    loadEnrollmentData();
});

// --- LOAD DATA FROM API ---
function loadEnrollmentData() {
    fetch('/api/enrollment/pending')
        .then(res => res.json())
        .then(data => {
            // 1. Clear existing tables
            document.querySelectorAll('.year-table tbody').forEach(el => el.innerHTML = '');

            // 2. Populate Tables
            if (data.length === 0) {
                // Optional: Show empty state
                return;
            }

            data.forEach(student => {
                // Determine target table based on CURRENT year level
                let yearIndex = '1'; 
                if (student.year_level.includes('2')) yearIndex = '2';
                else if (student.year_level.includes('3')) yearIndex = '3';
                else if (student.year_level.includes('4')) yearIndex = '4';

                // Find the specific tbody in your HTML (You need to add IDs to your HTML tbodys)
                // Fallback: We search by accordion order if IDs aren't set
                // Better approach: Add IDs to the HTML (Part 4)
                const tbody = document.getElementById(`enrollment-tbody-${yearIndex}`);
                
                if (tbody) {
                    const row = document.createElement('tr');
                    row.className = 'student-row';
                    // Store data for the modal
                    row.onclick = (e) => openEnrollmentModal(e, {
                        id: student.id,
                        name: student.name,
                        program: student.program,
                        type: 'Regular',
                        year: student.year_level,
                        standing: student.year_level, // Current standing
                        decision: 'Promoted', // Default
                        hasWarnings: false
                    });

                    row.innerHTML = `
                        <td>${student.id}</td>
                        <td class="student-name">${student.name}</td>
                        <td>${student.program}</td>
                        <td><span class="status-pill pending">Pending</span></td>
                        <td class="promote-text" style="color:#2e7d32">PROMOTING TO NEXT YEAR</td>
                    `;
                    tbody.appendChild(row);
                    
                    // Open the accordion
                    tbody.closest('.year-accordion').classList.remove('collapsed');
                }
            });
        })
        .catch(err => console.error(err));
}

// --- CONFIRMATION MODAL & API CALL ---
function openEnrollmentModal(event, data) {
    if (event) event.stopPropagation();
    
    // UI Updates
    document.getElementById('modalStudentId').innerText = data.id || '-';
    document.getElementById('modalStudentName').innerText = data.name || '-';
    document.getElementById('modalStudentProgram').innerText = data.program || '-';
    document.getElementById('modalStudentYear').innerText = data.year || '-';
    document.getElementById('modalStudentStanding').innerText = data.standing || '-';
    
    document.getElementById('enrollmentModal').classList.add('active');

    // Attach ID to Confirm Button
    const btn = document.getElementById('btn-confirm-enroll');
    btn.setAttribute('data-id', data.id);
}

function closeEnrollmentModal() { 
    document.getElementById('enrollmentModal').classList.remove('active'); 
}

function confirmSingleEnrollment() {
    const btn = document.getElementById('btn-confirm-enroll');
    const studentId = btn.getAttribute('data-id');
    
    if (!studentId) return;

    btn.innerText = "Processing...";
    btn.disabled = true;

    // CALL API
    fetch('/api/enrollment/confirm', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: studentId}) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert(`Student successfully enrolled and promoted to ${data.new_year}! They are now in the Enlistment module.`);
            closeEnrollmentModal();
            loadEnrollmentData(); // Refresh list
        } else {
            alert("Error: " + data.error);
        }
    })
    .catch(err => alert("Server Error"))
    .finally(() => {
        btn.innerText = "Enroll Student";
        btn.disabled = false;
    });
}

// --- ACCORDION & FILTER (Keep existing) ---
function toggleAccordion(element) {
    element.parentElement.classList.toggle('collapsed');
}

function filterEnrollment() {
    const input = document.getElementById('enrollmentSearch');
    const filter = input.value.toUpperCase();
    const rows = document.querySelectorAll('.year-table tbody tr');
    rows.forEach(row => {
        if(row.innerText.toUpperCase().indexOf(filter) > -1) {
            row.style.display = "";
            row.closest('.year-accordion').classList.remove('collapsed');
        } else {
            row.style.display = "none";
        }
    });
}

// (Keep the Upload Logic as is, or remove if not needed)