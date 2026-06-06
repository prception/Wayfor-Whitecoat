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

        gsap.set(".reveal-up", { y: 40, autoAlpha: 0 });

        const heroTitle = document.querySelector('.reveal-text');
        if (heroTitle) {
            gsap.fromTo(heroTitle, 
                { autoAlpha: 0, y: 40, filter: "blur(10px)" }, 
                { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.2, ease: "power4.out", delay: 0.1 }
            );
        }

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
                    });
                },
                start: "top 85%", 
                once: true
            });
        }
        
        setTimeout(() => { ScrollTrigger.refresh(); }, 100);
    }

    // 2. Interactive Country Tab Logic
    const tabBtns = document.querySelectorAll('.country-tab-btn');
    const panes = document.querySelectorAll('.country-content-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = `pane-${btn.getAttribute('data-target')}`;
            const currentActive = document.querySelector('.country-content-pane.active');
            
            if (currentActive && currentActive.id !== targetId) {
                gsap.to(currentActive, {
                    opacity: 0,
                    duration: 0.2,
                    onComplete: () => {
                        currentActive.classList.remove('active');
                        
                        const newTarget = document.getElementById(targetId);
                        if(newTarget) {
                            newTarget.classList.add('active');
                            gsap.fromTo(newTarget, 
                                { opacity: 0, y: 20 }, 
                                { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
                            );
                            if (typeof ScrollTrigger !== 'undefined') {
                                setTimeout(() => ScrollTrigger.refresh(), 100);
                            }
                        }
                    }
                });
            }
        });
    });

    // 3. Custom Accordion Logic (For FAQs)
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const box = header.parentElement;
            const content = box.querySelector('.accordion-content');
            const icon = box.querySelector('.acc-icon i');

            document.querySelectorAll('.accordion-box').forEach(otherBox => {
                if (otherBox !== box && otherBox.classList.contains('active')) {
                    otherBox.classList.remove('active');
                    const otherContent = otherBox.querySelector('.accordion-content');
                    const otherIcon = otherBox.querySelector('.acc-icon i');
                    otherContent.classList.add('d-none');
                    otherIcon.style.transform = 'rotate(0deg)';
                }
            });

            if (box.classList.contains('active')) {
                box.classList.remove('active');
                content.classList.add('d-none');
                icon.style.transform = 'rotate(0deg)';
            } else {
                box.classList.add('active');
                content.classList.remove('d-none');
                icon.style.transform = 'rotate(180deg)';
                icon.style.transition = 'transform 0.3s ease';
                
                if (typeof ScrollTrigger !== 'undefined') {
                    setTimeout(() => ScrollTrigger.refresh(), 300);
                }
            }
        });
    });

    // 4. Custom Scrollbar Logic
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
        if (lenis) lenis.on('scroll', updateThumb);
        window.addEventListener('resize', updateThumb);
        updateThumb();
    }
});

runOnReady(() => {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {

        // 1. The Cinematic Sink & Wipe (Dark to Light Transition)
        const darkSection = document.querySelector('.core-philosophy-section');
        const lightSection = document.querySelector('.expert-team-section');

        if (darkSection && lightSection) {
            gsap.to(darkSection, {
                scrollTrigger: {
                    trigger: lightSection,
                    start: 'top bottom',
                    end: 'top top',
                    scrub: true
                },
                scale: 0.9,
                opacity: 0.3,
                y: 50
            });
        }

        // 2. GLOBAL REVEAL-UP HANDLER
        // Targets elements with .reveal-up and animates them in batches for elegant staggering
        const revealUps = gsap.utils.toArray(".reveal-up").filter(el => !el.closest(".mission-vision-light"));
        
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

        // 3. Mission & Vision Section Specifics
        const missionLightSection = document.querySelector('.mission-vision-light');
        const lightAura = document.getElementById('light-aura');

        if (missionLightSection && lightAura && window.innerWidth > 991) {
            // Center the aura initially via GSAP to avoid transform conflicts
            gsap.set(lightAura, { xPercent: -50, yPercent: -50 });

            const xTo = gsap.quickTo(lightAura, "x", { duration: 0.8, ease: "power3" });
            const yTo = gsap.quickTo(lightAura, "y", { duration: 0.8, ease: "power3" });

            missionLightSection.addEventListener('mousemove', (e) => {
                const rect = missionLightSection.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const relY = e.clientY - rect.top;
                xTo(relX);
                yTo(relY);
            });

            missionLightSection.addEventListener('mouseenter', () => {
                gsap.to(lightAura, { opacity: 1, duration: 0.8 });
            });

            missionLightSection.addEventListener('mouseleave', () => {
                gsap.to(lightAura, { opacity: 0, duration: 0.8 });
            });
        }

        // Special staggered entrance for organic glass cards in mission section
        if (document.querySelector('.mission-vision-light')) {
            gsap.fromTo(".mission-vision-light .reveal-up", 
                { opacity: 0, y: 60 },
                {
                    scrollTrigger: {
                        trigger: ".mission-vision-light",
                        start: "top 75%",
                        once: true
                    },
                    opacity: 1,
                    y: 0,
                    stagger: 0.2,
                    duration: 1.2,
                    ease: "power3.out",
                    onComplete: () => {
                        document.querySelectorAll(".mission-vision-light .reveal-up").forEach(el => {
                            el.classList.remove("reveal-up");
                            gsap.set(el, { clearProps: "all" });
                        });
                    }
                }
            );
        }

        // 4. Parallax Background Text (About Hero)
        if (document.querySelector('.parallax-bg-text-wrap')) {
            gsap.to(".parallax-text-left", {
                xPercent: -15,
                ease: "none",
                scrollTrigger: {
                    trigger: ".about-hero-section",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
            gsap.to(".parallax-text-right", {
                xPercent: 15,
                ease: "none",
                scrollTrigger: {
                    trigger: ".about-hero-section",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
        }
    }

    // 4. Parallax Background Text (About Hero)
        if (document.querySelector('.parallax-bg-text-wrap')) {
            gsap.to(".parallax-text-left", {
                xPercent: -15,
                ease: "none",
                scrollTrigger: {
                    trigger: ".about-hero-section",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
            gsap.to(".parallax-text-right", {
                xPercent: 15,
                ease: "none",
                scrollTrigger: {
                    trigger: ".about-hero-section",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
        }

        // 5. Why Us Section (Light Theme Blueprint Lens)
        if (document.querySelector('.why-us-light-lens') && window.innerWidth > 991) {
            
            const lensTriggers = document.querySelectorAll('.light-lens-trigger');
            const lensImages = document.querySelectorAll('.lens-img-light');
            const lensBadge = document.querySelector('.light-lens-badge');
            
            // Text to swap in the badge based on scroll position
            const badgeTexts = [
                "01. Zero Hidden Fees",
                "02. Top 5% Institutions",
                "03. Unbiased Counseling",
                "04. Lifelong Mentorship"
            ];

            function activateLightLens(index) {
                // 1. Highlight Text Block
                lensTriggers.forEach(t => t.classList.remove('active'));
                const activeTrigger = document.querySelector(`.light-lens-trigger[data-index="${index}"]`);
                if(activeTrigger) activeTrigger.classList.add('active');

                // 2. Crossfade Internal Image
                lensImages.forEach(img => img.classList.remove('active'));
                const activeImage = document.getElementById(`ll-img-${index}`);
                if (activeImage) activeImage.classList.add('active');

                // 3. Swap the Badge text smoothly (only if it changes to prevent flashing)
                if (lensBadge && lensBadge.textContent !== badgeTexts[index]) {
                    gsap.to(lensBadge, {
                        opacity: 0, 
                        y: 10,
                        duration: 0.2, 
                        onComplete: () => {
                            lensBadge.textContent = badgeTexts[index];
                            gsap.to(lensBadge, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
                        }
                    });
                }
            }

            // Create a ScrollTrigger for each text block on the left
            lensTriggers.forEach((trigger) => {
                const index = parseInt(trigger.getAttribute('data-index'));

                ScrollTrigger.create({
                    trigger: trigger,
                    start: "top center",     // Triggers when the top of the text block hits the center of viewport
                    end: "bottom center",
                    onEnter: () => activateLightLens(index),
                    onEnterBack: () => activateLightLens(index),
                });
            });
        }

        // 6. Wall of Proof Marquee Entrance
        if (document.querySelector('.wall-of-proof-section')) {
            const proofTl = gsap.timeline({
                scrollTrigger: {
                    trigger: ".wall-of-proof-section",
                    start: "top 80%"
                }
            });

            // Animate the two tracks sliding in from opposite directions
            proofTl.from(".marquee-track-left", {
                x: 100,
                opacity: 0,
                duration: 1.2,
                ease: "power3.out"
            })
            .from(".marquee-track-right", {
                x: -100,
                opacity: 0,
                duration: 1.2,
                ease: "power3.out"
            }, "-=1"); // Start almost simultaneously
        }
});