/**
 * WayFor Whitecoat - Navbar & Interactive Elements
 * Handles scroll-based UI adaptation and mobile interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Toggle Logic
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            // Animate toggle icon if needed
        });
    }

    // 2. Scroll Adaptive Navbar
    // We use GSAP ScrollTrigger to detect when we've scrolled into the dark section
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        const nav = document.querySelector('.liquid-navbar');
        
        if (nav) {
            // Navbar/Scrollbar now synced via new.js timeline for perfect timing
        }
    }

    // 3. Smart Adaptive Theme Detection
    // Automatically detects if background is light or dark and swaps navbar/scrollbar colors
    function updateAdaptiveTheme() {
        // Sample element slightly below the navbar to ensure we see the background
        const sampleX = window.innerWidth / 2;
        const sampleY = 120; 
        
        let targetEl = document.elementFromPoint(sampleX, sampleY);
        if (!targetEl) return;

        // Find nearest element with a real background color
        let bgColor = "rgba(0, 0, 0, 0)";
        while (targetEl && (bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent")) {
            bgColor = window.getComputedStyle(targetEl).backgroundColor;
            targetEl = targetEl.parentElement;
        }

        // Convert RGB to Luminance
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const r = parseInt(rgb[0]) / 255;
            const g = parseInt(rgb[1]) / 255;
            const b = parseInt(rgb[2]) / 255;
            
            // Standard Luminance Formula
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            
            const nav = document.querySelector('.liquid-navbar');
            const isDark = luminance < 0.5;

            if (isDark) {
                if(nav) nav.classList.add('nav-dark-mode');
            } else {
                if(nav) nav.classList.remove('nav-dark-mode');
            }
        }
    }

    // Run on scroll and resize
    window.addEventListener('scroll', updateAdaptiveTheme);
    window.addEventListener('resize', updateAdaptiveTheme);
    // Initial check
    updateAdaptiveTheme();

    if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
        window.addEventListener('load', () => ScrollTrigger.refresh());
    }
});
