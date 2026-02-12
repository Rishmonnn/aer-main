function showSection(sectionId) {
    // Hide all sections on the page
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    
    // Show the requested section
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
    }
}

// Login Logic (Keep this from your original)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        if (email.includes('faculty')) {
            window.location.href = 'faculty.php';
        } else if (email.includes('head')) {
            window.location.href = 'program-head.php';
        }
    });
}
