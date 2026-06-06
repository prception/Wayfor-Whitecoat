document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Lenis Smooth Scroll Setup
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
    });
    window.lenis = lenis;

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);

        // 2. Hero Text Reveal
        const heroTitle = document.getElementById('univ-hero-title');
        if (heroTitle) {
            gsap.fromTo(heroTitle, 
                { opacity: 0, y: 40, filter: "blur(10px)" }, 
                { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "power4.out", delay: 0.1 }
            );
        }

        const revealUps = gsap.utils.toArray(".reveal-up");
        if (revealUps.length > 0) {
            ScrollTrigger.batch(revealUps, {
                onEnter: (batch) => {
                    gsap.fromTo(batch, 
                        { opacity: 0, y: 40 },
                        {
                            opacity: 1,
                            y: 0,
                            duration: 1,
                            ease: "power3.out",
                            stagger: 0.15,
                            overwrite: true,
                            onComplete: () => {
                                batch.forEach(el => {
                                    el.classList.remove("reveal-up");
                                    gsap.set(el, { clearProps: "all" });
                                });
                            }
                        }
                    );
                },
                start: "top 88%",
                once: true
            });
        }

        // 3. Staggered Grid Reveal on Scroll
        gsap.from(".dossier-item", {
            scrollTrigger: {
                trigger: "#dossier-grid",
                start: "top 80%"
            },
            y: 50,
            opacity: 0,
            stagger: 0.1,
            duration: 0.8,
            ease: "back.out(1.2)"
        });
    }

    // 4. Dossier Filtering Logic
    const filterBtns = document.querySelectorAll('.filter-btn');
    const dossierItems = document.querySelectorAll('.dossier-item');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Manage Active Class
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            dossierItems.forEach(item => {
                const category = item.getAttribute('data-category');
                
                if (filterValue === 'all' || filterValue === category) {
                    // Show item
                    item.style.display = 'block';
                    gsap.fromTo(item, 
                        { scale: 0.9, opacity: 0 }, 
                        { scale: 1, opacity: 1, duration: 0.4, ease: "power2.out" }
                    );
                } else {
                    // Hide item
                    gsap.to(item, { 
                        scale: 0.9, opacity: 0, duration: 0.3, ease: "power2.in",
                        onComplete: () => { item.style.display = 'none'; }
                    });
                }
            });
        });
    });

    // 5. Custom Scrollbar Logic
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
        lenis.on('scroll', updateThumb);
        window.addEventListener('resize', updateThumb);
        updateThumb();
    }
});