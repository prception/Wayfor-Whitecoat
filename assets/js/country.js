let lenis;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Lenis Smooth Scroll Setup
    if (typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smooth: true,
        });

        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => { lenis.raf(time * 1000); });
            gsap.ticker.lagSmoothing(0);
        } else {
            function raf(time) {
                lenis.raf(time);
                requestAnimationFrame(raf);
            }
            requestAnimationFrame(raf);
        }
    }

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // ==========================================
        // CRITICAL FIX: Set initial states immediately 
        // to prevent "Flashing" on page load.
        // ==========================================
        gsap.set(".reveal-up", { y: 40, autoAlpha: 0 });
        gsap.set(".pathway-item", { y: 80, rotationX: 10, transformPerspective: 1000, autoAlpha: 0 });

        // 2. Hero Text Reveal
        const heroTitle = document.getElementById('atlas-hero-title');
        if (heroTitle) {
            // Hero doesn't use batch, so fromTo is fine, but we add autoAlpha
            gsap.fromTo(heroTitle, 
                { autoAlpha: 0, y: 40, filter: "blur(10px)" }, 
                { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "power4.out", delay: 0.1 }
            );
        }

        // 3. Global Reveal Up Batching (Optimized)
        const revealUps = gsap.utils.toArray(".reveal-up");
        if (revealUps.length > 0) {
            ScrollTrigger.batch(revealUps, {
                onEnter: (elements) => {
                    gsap.to(elements, {
                        autoAlpha: 1,
                        y: 0,
                        duration: 1,
                        ease: "power3.out",
                        stagger: 0.15,
                        overwrite: true
                        // Removed clearProps: "all" to prevent layout jumping at the end
                    });
                },
                start: "top 85%", // Slightly lower trigger point for a better feel
                once: true
            });
        }

        // 4. Cinematic 3D Grid Reveal (Optimized)
        const pathwayItems = gsap.utils.toArray(".pathway-item");
        if (pathwayItems.length > 0) {
            ScrollTrigger.batch(pathwayItems, {
                onEnter: (elements) => {
                    gsap.to(elements, {
                        autoAlpha: 1,
                        y: 0,
                        rotationX: 0,
                        duration: 1.2,
                        ease: "power4.out",
                        stagger: 0.15,
                        overwrite: true
                    });
                },
                start: "top 85%",
                once: true
            });
        }
        
        // 5. Enhanced Image Parallax (Moves image up/down inside its container as you scroll)
        const cardImages = document.querySelectorAll('.pathway-img');
        cardImages.forEach(img => {
            gsap.set(img, { yPercent: -10 }); // Start slightly higher
            
            gsap.to(img, {
                yPercent: 10, // Move it down as we scroll
                ease: "none",
                scrollTrigger: {
                    trigger: img.closest('.pathway-item'),
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true
                }
            });
        });

        // Force ScrollTrigger to recalculate after initial load/setup
        setTimeout(() => {
            ScrollTrigger.refresh();
        }, 100);
    }

    // 6. Custom Scrollbar Logic
    const track = document.getElementById('custom-scrollbar-track');
    const thumb = document.getElementById('custom-scrollbar-thumb');
    if (track && thumb) {
        function updateThumb() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight;
            const viewHeight = window.innerHeight;
            const trackHeight = viewHeight;
            const thumbHeight = Math.max(30, (viewHeight / docHeight) * trackHeight);
            const maxScroll = docHeight - viewHeight;
            const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;
            const thumbTop = scrollRatio * (trackHeight - thumbHeight);
            thumb.style.height = thumbHeight + 'px';
            thumb.style.transform = 'translateY(' + thumbTop + 'px)';
        }
        window.addEventListener('scroll', updateThumb, { passive: true });
        if (lenis) {
            lenis.on('scroll', updateThumb);
        }
        window.addEventListener('resize', updateThumb);
        updateThumb();
    }

    // 7. Scroll to Top Button Logic
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        function updateBtnVisibility() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            if (scrollTop > 500) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        }

        window.addEventListener('scroll', updateBtnVisibility, { passive: true });
        if (lenis) {
            lenis.on('scroll', updateBtnVisibility);
        }

        scrollToTopBtn.addEventListener('click', () => {
            if (lenis) {
                lenis.scrollTo(0, { duration: 1.5, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        updateBtnVisibility();
    }
});