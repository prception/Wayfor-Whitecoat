document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Lenis Smooth Scroll Setup
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
    });

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
        const heroTitle = document.getElementById('gallery-hero-title');
        if (heroTitle) {
            gsap.fromTo(heroTitle, 
                { opacity: 0, y: 40, filter: "blur(10px)" }, 
                { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "power4.out", delay: 0.1 }
            );
        }

        gsap.from(".reveal-up", {
            y: 30,
            opacity: 0,
            stagger: 0.15,
            duration: 1,
            ease: "power3.out",
            delay: 0.3
        });

        // 3. Staggered Bento Grid Reveal on Scroll
        const bentoItems = gsap.utils.toArray(".bento-item");
        if (bentoItems.length > 0) {
            ScrollTrigger.batch(bentoItems, {
                onEnter: (batch) => {
                    gsap.fromTo(batch, 
                        { opacity: 0, y: 60, scale: 0.95 },
                        {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            duration: 1,
                            ease: "back.out(1.2)",
                            stagger: 0.1,
                            overwrite: true
                        }
                    );
                },
                start: "top 85%",
                once: true
            });
        }
    }

    // 4. Bug-Free Gallery Filtering Logic
    const filterBtns = document.querySelectorAll('.filter-btn-light');
    const galleryItems = document.querySelectorAll('.bento-item');
    let isFiltering = false;

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isFiltering) return;
            isFiltering = true;

            // Manage Active Class
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            // Fade Out
            gsap.to(galleryItems, {
                scale: 0.9,
                opacity: 0,
                duration: 0.3,
                ease: "power2.inOut",
                onComplete: () => {
                    let itemsToShow = [];

                    // Manipulate DOM Display
                    galleryItems.forEach(item => {
                        const category = item.getAttribute('data-category');
                        if (filterValue === 'all' || filterValue === category) {
                            item.style.display = ''; // Revert to CSS Grid logic
                            itemsToShow.push(item);
                        } else {
                            item.style.display = 'none';
                        }
                    });

                    // Refresh ScrollTrigger heights
                    if (typeof ScrollTrigger !== 'undefined') {
                        ScrollTrigger.refresh();
                    }

                    // Fade In Remaining Items
                    if(itemsToShow.length > 0) {
                        gsap.to(itemsToShow, {
                            scale: 1,
                            opacity: 1,
                            duration: 0.4,
                            stagger: 0.05,
                            ease: "back.out(1.2)",
                            onComplete: () => { isFiltering = false; }
                        });
                    } else {
                        isFiltering = false;
                    }
                }
            });
        });
    });

    // 5. Custom GSAP Lightbox Engine
    const lightbox = document.getElementById('liquid-lightbox');
    const lightboxBg = document.querySelector('.lightbox-bg');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const closeBtn = document.getElementById('lightbox-close');

    if (lightbox && galleryItems.length > 0) {
        
        galleryItems.forEach(item => {
            const frame = item.querySelector('.skeuo-gallery-frame');
            const img = item.querySelector('.bento-img');
            const title = item.querySelector('.bento-caption h4, .bento-caption h5, .bento-caption h6');
            const subtitle = item.querySelector('.bento-caption span');

            frame.addEventListener('click', () => {
                // Populate Lightbox
                lightboxImg.src = img.src;
                lightboxCaption.innerHTML = `
                    <div class="fw-bold">${title.innerText}</div>
                    <div class="small text-info mt-1 font-monospace">${subtitle.innerText}</div>
                `;

                // Show Lightbox Container
                lightbox.classList.add('active');
                lenis.stop(); // Stop background scrolling

                // Entrance Animation
                gsap.to(lightboxBg, { opacity: 1, duration: 0.4 });
                gsap.fromTo(lightboxImg, 
                    { scale: 0.8, opacity: 0, y: 30 }, 
                    { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.2)", delay: 0.1 }
                );
                gsap.fromTo(lightboxCaption, 
                    { opacity: 0, y: 20 }, 
                    { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", delay: 0.3 }
                );
            });
        });

        // Close Logic
        const closeLightbox = () => {
            gsap.to([lightboxImg, lightboxCaption], { scale: 0.9, opacity: 0, y: 20, duration: 0.3, ease: "power2.in" });
            gsap.to(lightboxBg, { 
                opacity: 0, 
                duration: 0.4, 
                delay: 0.1,
                onComplete: () => {
                    lightbox.classList.remove('active');
                    lenis.start(); // Resume scrolling
                }
            });
        };

        closeBtn.addEventListener('click', closeLightbox);
        lightboxBg.addEventListener('click', closeLightbox);
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });
    }
});