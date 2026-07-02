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

    // NOTE: We no longer hide the whole <html> while components load. The navbar is
    // inlined in the home page (known height at first paint, so no layout shift), and
    // the hero content is held by the CSS `.hero-prep` rule until the JS intro reveals
    // it. Hiding the document here only produced a white blank flash, so it's removed.

    /**
     * Load a component into a container element
     * @param {string} componentPath - Path to the component HTML file
     * @param {string} containerId - ID of the container element
     */
    function loadComponent(componentPath, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // If the markup is already inlined in the page (e.g. the navbar on the
        // home page), skip the network fetch entirely and just run the init so
        // it appears on first paint with no round-trip.
        if (container.dataset.inlined === 'true') {
            if (containerId === 'header-container') {
                highlightActiveNav();
                initMobileNavbar();
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
            return Promise.resolve();
        }

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
    let scrollToTopInit = false;
    function initScrollToTop() {
        const scrollBtn = document.getElementById('scrollToTopBtn');
        if (!scrollBtn || scrollToTopInit) return;
        scrollToTopInit = true;

        function updateVisibility(scrollY) {
            const y = (typeof scrollY === 'number') ? scrollY : (window.scrollY || document.documentElement.scrollTop);
            if (y > 50) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        }

        // Show/Hide on native scroll and Lenis scroll (these pages use Lenis,
        // which can suppress native window scroll events)
        window.addEventListener('scroll', () => updateVisibility(), { passive: true });

        // Lenis is initialised in the page's own DOMContentLoaded handler, which
        // may run after this one — bind as soon as window.lenis is available.
        let lenisBound = false;
        function bindLenis() {
            if (lenisBound) return true;
            if (window.lenis) {
                window.lenis.on('scroll', ({ scroll }) => updateVisibility(scroll));
                lenisBound = true;
                return true;
            }
            return false;
        }
        if (!bindLenis()) {
            let tries = 0;
            const lenisTimer = setInterval(() => {
                if (bindLenis() || ++tries > 40) clearInterval(lenisTimer);
            }, 100);
        }

        // Smooth scroll to top
        scrollBtn.addEventListener('click', () => {
            if (window.lenis) {
                window.lenis.scrollTo(0, { duration: 1.5 });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        // Set correct initial state
        updateVisibility();
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
                    customToggle.classList.toggle('active');
                });
                // Close the menu after tapping a link or anywhere outside it
                customLinks.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => {
                        customLinks.classList.remove('active');
                        customToggle.classList.remove('active');
                    });
                });
                document.addEventListener('click', (e) => {
                    if (!customLinks.contains(e.target) && !customToggle.contains(e.target)) {
                        customLinks.classList.remove('active');
                        customToggle.classList.remove('active');
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
        // Wire the scroll-to-top button for pages with an inline footer (e.g.
        // contact, gallery) — the button markup is already in the page even
        // when no footer-container component is loaded. Idempotent, so a later
        // footer-container load won't double-bind.
        initScrollToTop();

        // Header: inlined on the home page, so this resolves synchronously with no
        // fetch. Just refresh layout once it's in (page was never hidden).
        Promise.resolve(loadComponent(components.header, 'header-container')).then(() => {
            requestAnimationFrame(refreshScrollLayout);
        });

        // Footer loads independently; refresh layout once it's in.
        Promise.resolve(loadComponent(components.footer, 'footer-container')).then(() => {
            refreshScrollLayout();
        });
    });

})();
