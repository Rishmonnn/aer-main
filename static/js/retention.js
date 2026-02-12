// --- Retention JS Logic ---

// Only keeping the search/filter logic since the chart is now pure CSS.
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