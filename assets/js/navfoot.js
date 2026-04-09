// Fetch and insert the liquid glass navbar into the placeholder
fetch('navbar.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('navbar-placeholder').innerHTML = data;
        
        // Add scroll listener to adapt glass UI on transitioning over dark backgrounds
        window.addEventListener('scroll', () => {
            const nav = document.querySelector('.liquid-navbar');
            if (nav) {
                // If scrolled past the offwhite hero top (approx 500px), switch to dark-mode glass
                
            }
        });
    })
    .catch(error => console.error('Error fetching navbar:', error));
