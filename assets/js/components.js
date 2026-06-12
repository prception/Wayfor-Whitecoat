// document.addEventListener('contextmenu', e => e.preventDefault());
// document.onkeydown = e =>
//     e.key === 'F12' ||
//         (e.ctrlKey && ['u', 's', 'i', 'j'].includes(e.key.toLowerCase()))
//         ? false : true;


// Shared nav scroll-hide/show behaviour — called from both script.js (home) and here (other pages)
window.__initNavScrollBehaviour = (function () {
    let initialised = false;
    return function () {
        if (initialised) return;
        initialised = true;
        const THRESHOLD = 10;
        const navEls = ['#nav-wrapper', '.nav-brand-corner', '.nav-cta-corner'];
        let navVisible = true;

        function checkNav(scrollY) {
            const atTop = scrollY <= THRESHOLD;
            if (atTop && !navVisible) {
                navVisible = true;
                if (typeof gsap !== 'undefined') {
                    gsap.to(navEls, { opacity: 1, visibility: 'visible', pointerEvents: 'auto', duration: 0.5, ease: 'power2.out', overwrite: true });
                }
            } else if (!atTop && navVisible) {
                navVisible = false;
                if (typeof gsap !== 'undefined') {
                    gsap.to(navEls, {
                        opacity: 0, duration: 0.3, ease: 'power2.in', overwrite: true,
                        onComplete: () => gsap.set(navEls, { pointerEvents: 'none' })
                    });
                }
            }
        }

        window.addEventListener('scroll', () => checkNav(window.scrollY), { passive: true });
        if (window.lenis) window.lenis.on('scroll', ({ scroll }) => checkNav(scroll));
        // Run once immediately so the nav state is correct on any load position
        checkNav(window.scrollY);
    };
}());

(function () {
    'use strict';

    // Detect if we're in a subdirectory and get the base path
    function getBasePath() {
        const path = window.location.pathname;
        // Check if we're in the courses, pages, or countries folders
        if (path.includes('/courses/') || path.includes('/pages/') || path.includes('/countries/')) {
            return '../';
        }
        return '';
    }

    const basePath = getBasePath();

    // Component paths - automatically adjusted for subdirectories
    const components = {
        header: basePath + 'components/header.html',
        footer: basePath + 'components/footer.html'
    };

    function refreshScrollLayout() {
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.refresh();
        }
        if (typeof lenis !== 'undefined' && lenis && typeof lenis.resize === 'function') {
            lenis.resize();
        }
        if (window.lenis && typeof window.lenis.resize === 'function') {
            window.lenis.resize();
        }
        window.dispatchEvent(new Event('resize'));
    }

    // Only hide body at top of page — mid-scroll loads must not flash invisible
    // (pin spacings are recalculated after injection anyway)
    if (window.scrollY <= 0) {
        document.documentElement.style.visibility = 'hidden';
    }

    /**
     * Load a component into a container element
     * @param {string} componentPath - Path to the component HTML file
     * @param {string} containerId - ID of the container element
     */
    function loadComponent(componentPath, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        return fetch(componentPath, { cache: 'default' })
            .then(response => {
                if (!response.ok) throw new Error('Component not found: ' + componentPath);
                return response.text();
            })
            .then(html => {
                // Fix relative paths if we are in a subdirectory
                if (basePath && basePath !== '') {
                    html = html.replace(/(href|src)="((?!http|#|mailto|\/).*?)"/g, '$1="' + basePath + '$2"');
                }

                container.innerHTML = html;

                if (containerId === 'header-container') {
                    highlightActiveNav();
                    initMobileNavbar();
                    // On non-home pages show nav immediately then wire scroll-hide behaviour
                    if (!document.getElementById('pinned-container')) {
                        const navEls = ['#nav-wrapper', '.nav-brand-corner', '.nav-cta-corner'];
                        if (typeof gsap !== 'undefined') {
                            gsap.set(navEls, { opacity: 1, visibility: 'visible', pointerEvents: 'auto', y: 0 });
                        } else {
                            navEls.forEach(sel => {
                                const el = document.querySelector(sel);
                                if (el) { el.style.opacity = '1'; el.style.visibility = 'visible'; }
                            });
                        }
                        window.__initNavScrollBehaviour();
                    }
                    document.dispatchEvent(new CustomEvent('headerLoaded'));
                }

                if (containerId === 'footer-container') {
                    initScrollToTop();
                    document.dispatchEvent(new CustomEvent('footerLoaded'));
                }
            })
            .catch(error => {
                console.error('Error loading component:', error);
            });
    }

    /**
     * Initialize Scroll To Top Button
     */
    function initScrollToTop() {
        const scrollBtn = document.getElementById('scrollToTopBtn');
        if (!scrollBtn) return;

        // Show/Hide on scroll
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        });

        // Smooth scroll to top
        scrollBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    /**
     * Initialize mobile navbar functionality
     * - Close on outside click
     * - Toggle overlay
     * - Close on nav link click
     */
    function initMobileNavbar() {
        // Fallback for custom toggle used in header.html (.mobile-toggle and .nav-links)
        const customToggle = document.querySelector('.mobile-toggle');
        const customLinks = document.querySelector('.nav-links');

        if (customToggle && customLinks) {
            if (!customToggle.dataset.listenerAttached) {
                customToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    customLinks.classList.toggle('active');
                });
                // Close the menu after tapping a link or anywhere outside it
                customLinks.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => customLinks.classList.remove('active'));
                });
                document.addEventListener('click', (e) => {
                    if (!customLinks.contains(e.target)) {
                        customLinks.classList.remove('active');
                    }
                });
                customToggle.dataset.listenerAttached = "true";
            }
        }

        const navbarToggler = document.querySelector('.navbar-toggler');
        const navbarCollapse = document.getElementById('navbarNav');
        const overlay = document.getElementById('navbarOverlay');

        if (!navbarToggler || !navbarCollapse || !overlay) return;

        // Show/hide overlay when navbar toggles
        navbarCollapse.addEventListener('show.bs.collapse', function () {
            overlay.classList.add('show');
        });

        navbarCollapse.addEventListener('hide.bs.collapse', function () {
            overlay.classList.remove('show');
        });

        // Close navbar when clicking overlay (outside navbar)
        overlay.addEventListener('click', function () {
            const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
            if (bsCollapse) {
                bsCollapse.hide();
            }
        });

        // Close navbar when clicking a nav link
        const navLinks = document.querySelectorAll('#navbarNav .nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function () {
                if (window.innerWidth < 992) { // Only on mobile
                    const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
                    if (bsCollapse) {
                        bsCollapse.hide();
                    }
                }
            });
        });
    }

    /**
     * Highlight the active navigation link based on current page
     */
    function highlightActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('.nav-item, .nav-link');

        navLinks.forEach(link => {
            const href = link.getAttribute('href');

            // Check if this link matches current page
            if (link.classList.contains('btn-nav-cta')) return;

            if (href === currentPage ||
                (currentPage === 'index.html' && href === '#home') ||
                (currentPage === '' && href === '#home')) {
                link.classList.add('active');
            } else if (href && !href.startsWith('#')) {
                link.classList.remove('active');
            }
        });
    }

    // Load components when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        Promise.all([
            loadComponent(components.header, 'header-container'),
            loadComponent(components.footer, 'footer-container')
        ]).then(() => {
            // Both components are in the DOM — do one clean layout refresh
            // then reveal the page so ScrollTrigger pin spacings are always correct
            requestAnimationFrame(() => {
                refreshScrollLayout();
                requestAnimationFrame(() => {
                    document.documentElement.style.visibility = '';
                });
            });
        });
    });

})();
