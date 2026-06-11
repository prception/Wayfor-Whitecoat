// new.js

// Prevent browser from restoring mid-page scroll position on refresh.
// The hero section has a pinned GSAP animation that must always start from top.
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

let lenis;
if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Default easing
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        smoothTouch: false,
        touchMultiplier: 2,
    });
    window.lenis = lenis;

    // Sync Lenis with GSAP ScrollTrigger
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        lenis.on('scroll', ScrollTrigger.update);

        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        gsap.ticker.lagSmoothing(0);
    } else {
        // Basic RAF loop if GSAP isn't loaded
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }
}

if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    // Don't re-measure pins on mobile URL-bar show/hide (height-only resizes):
    // mid-scroll refreshes desync pinned sections and cause overlap glitches.
    ScrollTrigger.config({ ignoreMobileResize: true });
}

const canvas = document.getElementById('webgl-canvas');
const sizes = { width: window.innerWidth, height: window.innerHeight };
const hasWebGL = typeof THREE !== 'undefined' && canvas;

// Setup Pins (Lat, Lng)
const locations = [
    { id: 'pin-russia', lat: 58.7558, lng: 37.6173, name: 'Russia', page: 'countries/MBBS-in-Russia.html', desc: 'Experience world-class medical education with advanced facilities and highly affordable tuition fees.' },
    { id: 'pin-kazakhstan', lat: 54.0000, lng: 70.0000, name: 'Kazakhstan', page: 'countries/MBBS-In-Kazakhstan.html', desc: 'A modern hub for international medical students offering WHO-approved programs in English.' },
    { id: 'pin-uzbekistan', lat: 41.0000, lng: 56.0000, name: 'Uzbekistan', page: 'countries/MBBS-in-Uzbekistan.html', desc: 'Rich in history and culture, offering top-tier medical universities with a secure environment.' },
    { id: 'pin-kyrgyzstan', lat: 43.0000, lng: 82.0000, name: 'Kyrgyzstan', page: 'countries/MBBS-in-Kyrgyzstan.html', desc: 'Affordable medical study options with English medium instruction and great clinical exposure.' },
    { id: 'pin-georgia', lat: 42.3154, lng: 43.3569, name: 'Georgia', page: 'countries/MBBS-in-Georgio.html', desc: 'A rising star in European medical education with high USMLE pass rates and excellent infrastructure.' },
    { id: 'pin-egypt', lat: 26.8206, lng: 30.8025, name: 'Egypt', page: 'countries/MBBS-in-Egypt.html', desc: 'Study medicine with a rich heritage and world-recognized universities in a global crossroads.' },
    { id: 'pin-tajikistan', lat: 35.0000, lng: 68.0000, name: 'Tajikistan', page: 'countries/MBBS-in-Tajikistan.html', desc: 'Emerging destination for affordable and high-quality medical education with hands-on practice.' },
    { id: 'pin-bangladesh', lat: 20.0000, lng: 92.0000, name: 'Bangladesh', page: 'countries/MBBS-in-Bangladesh.html', desc: 'FMGE-friendly curriculum with a similar clinical and disease pattern to India for best practice.' },
    { id: 'pin-nepal', lat: 30.0000, lng: 82.0000, name: 'Nepal', page: 'countries/MBBS-In-Nepal.html', desc: 'Study close to home with top-ranking medical institutions recognized globally.' }
];

let latLongToVector3 = () => { return { x: 0, y: 0, z: 0 }; };
let updateHTMLPins = () => {};

let scene, camera, renderer, globeGroup, standGroup, globeMesh, standMaterial, material;
let colorWhiteState, colorBlueState;
let pinsVisible = false;
let scrollProgress = 0;

if (hasWebGL) {
    // 1. Three.js Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 1000);
    camera.position.z = 8;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Create Globe & Consultation Scene
    const consultationGroup = new THREE.Group();
    globeGroup = new THREE.Group();

    const textureLoader = new THREE.TextureLoader();

    // --- GLOBE ---
    const geometry = new THREE.SphereGeometry(1.8, 64, 64);
    // High quality bump map for the surface
    const bumpTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');

    // Initial state is white geometric look
    colorWhiteState = new THREE.Color(0xffffff);
    colorBlueState = new THREE.Color(0x0A192F);

    material = new THREE.MeshStandardMaterial({
        color: colorWhiteState,
        roughness: 0.1,    // Glossy finish for premium look
        metalness: 0.7,    // High metalness makes it look like polished silver when white
        bumpMap: bumpTexture,
        bumpScale: 0.08
    });
    globeMesh = new THREE.Mesh(geometry, material);
    globeGroup.add(globeMesh);

    scene.add(globeGroup);

    // Place globe ON the desk initially
    globeGroup.scale.set(0.18, 0.18, 0.18); // Small globe
    // Place over the glowing spot in the image (right-side of center, on the table)
    // Three tiers: phones sit lower-left, tablets lower and toward center, desktop unchanged
    const isMobileGlobe = sizes.width <= 768;
    const isTabletGlobe = sizes.width > 768 && sizes.width <= 1024;
    const initialX = isMobileGlobe ? -0.6 : isTabletGlobe ? -1.35 : -1.8;
    const initialY = (isMobileGlobe || isTabletGlobe) ? -1.85 : -1.6;
    globeGroup.position.set(initialX, initialY, -3.5);
    globeGroup.rotation.y = -Math.PI / 2;
    globeGroup.rotation.x = 0.2;

    // --- GLOBE STAND ---
    standGroup = new THREE.Group();
    standMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xb0b5bc), // Premium silver/platinum 
        roughness: 0.2,
        metalness: 0.9,
        transparent: true,
        opacity: 1
    });

    // Base plate
    const baseGeom = new THREE.CylinderGeometry(1.6, 1.8, 0.2, 32);
    const baseMesh = new THREE.Mesh(baseGeom, standMaterial);
    baseMesh.position.y = -2.4;
    standGroup.add(baseMesh);

    // Center arm
    const armGeom = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 16);
    const armMesh = new THREE.Mesh(armGeom, standMaterial);
    armMesh.position.y = -2.0;
    standGroup.add(armMesh);

    // Semicircle arc holding the globe
    const ringGeom = new THREE.TorusGeometry(2.05, 0.08, 16, 50, Math.PI);
    const ringMesh = new THREE.Mesh(ringGeom, standMaterial);
    ringMesh.rotation.z = -Math.PI / 2;
    ringMesh.rotation.y = Math.PI / 2;
    standGroup.add(ringMesh);

    // Place stand at same height as globe
    standGroup.scale.set(0.18, 0.18, 0.18);
    standGroup.position.set(initialX, initialY, -3.5);
    // Angle slightly for 3D perspective
    standGroup.rotation.y = -Math.PI / 6;
    scene.add(standGroup);

    // Lighting for premium shading
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    latLongToVector3 = function(lat, lng, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);
        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const z = (radius * Math.sin(phi) * Math.sin(theta));
        const y = (radius * Math.cos(phi));
        return new THREE.Vector3(x, y, z);
    };

    updateHTMLPins = function() {
        const container = document.getElementById('html-pins-container');
        if (!pinsVisible) {
            if (container) container.style.opacity = '0';
            return;
        }

        if (container) container.style.opacity = '1';
        const radius = 1.8; // Matches new bigger sphere geometry

        locations.forEach(loc => {
            const el = document.getElementById(loc.id);
            if (!el) return;

            const vec3 = latLongToVector3(loc.lat, loc.lng, radius);
            // Apply globe group transformation matrix
            vec3.applyMatrix4(globeGroup.matrixWorld);

            // Calculate dot product to check if facing camera
            const camToCenter = globeGroup.position.clone().sub(camera.position).normalize();
            const centerToPin = vec3.clone().sub(globeGroup.position).normalize();
            const dot = camToCenter.dot(centerToPin);

            // If > 0 it's on the front side of the sphere relative to camera
            if (dot < 0) {
                // Point is in front
                vec3.project(camera);
                const x = (vec3.x * 0.5 + 0.5) * sizes.width;
                const y = -(vec3.y * 0.5 - 0.5) * sizes.height;

                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
            } else {
                // Point is currently on the back of the globe
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
            }
        });
    };

    // 4. Animation loop
    const clock = new THREE.Clock();
    function tick() {
        // Smoothly rotate the earth texture (globeMesh)
        if (scrollProgress < 0.01) {
            globeMesh.rotation.y += 0.015;
        } else {
            const target = Math.round(globeMesh.rotation.y / (Math.PI * 2)) * Math.PI * 2;
            globeMesh.rotation.y += (target - globeMesh.rotation.y) * 0.05;
        }

        // Render first so matrixWorld is fully up to date, then project pins once per frame
        renderer.render(scene, camera);
        if (pinsVisible) {
            globeGroup.updateMatrixWorld(true);
            updateHTMLPins();
        }

        window.requestAnimationFrame(tick);
    }
    tick();

    // Resize Handle
    window.addEventListener('resize', () => {
        sizes.width = window.innerWidth;
        sizes.height = window.innerHeight;
        camera.aspect = sizes.width / sizes.height;
        camera.updateProjectionMatrix();
        renderer.setSize(sizes.width, sizes.height);
    });
}

// 5. GSAP Scroll Sequence
// We increased the pin scroll distance to 3500px to allow a smooth, unhurried 3-step sequence
const pinnedContainer = document.getElementById('pinned-container');
if (pinnedContainer && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: "#pinned-container",
            start: "top top",
            end: "+=600",
            pin: true,
            pinSpacing: true,
            scrub: 0.5,
            onUpdate: (self) => {
                scrollProgress = self.progress;
            },
            onStart: () => {
                // If the page-load intro animation is still running (user fast-scrolled),
                // kill it and snap the globe to its correct phase-1 baseline size so the
                // scrub timeline starts from the right scale instead of near-zero.
                if (introTl && introTl.isActive()) {
                    introTl.kill();
                    if (hasWebGL) {
                        globeGroup.scale.set(0.18, 0.18, 0.18);
                        standGroup.scale.set(0.18, 0.18, 0.18);
                    }
                }
            },
            onLeave: () => {
                // Hide initial hero content and cards that would bleed through
                gsap.set(".initial-text", { opacity: 0 });
                gsap.set(".initial-text-cards", { opacity: 0 });
            },
            onEnterBack: () => {
                // Scrub timeline re-runs in reverse from progress=1 (phase-2 state).
                // Ensure final-text is visible as phase-2 starting point.
                gsap.set(".final-text", { opacity: 1, y: 0 });
                // Force stand back to its correct phase-2 state (large globe, stand hidden)
                // so the scrub reverse can animate it correctly back to phase-1.
                if (hasWebGL && standMaterial) {
                    standMaterial.transparent = true;
                    standMaterial.opacity = 0;
                }
            }
        }
    });

    // ==========================================
    // STEP 1: The Image Crossfade
    // Occurs during the first chunk of the scroll. Hero text & Globe stay untouched.
    // ==========================================
    tl.to(".hero-bg-img-2", {
        opacity: 1,
        duration: 0.3,
        ease: "power1.inOut"
    }, 0); // Starts immediately upon scroll

    // Small pause variable so the user can appreciate the second image before zooming
    const step2Start = 0;

    // ==========================================
    // STEP 2: Cinematic Zoom & Dark Transition
    // ==========================================

    // Nav is managed by a separate ScrollTrigger below — not part of the scrub timeline.

    // Remove white mat around the frame as the dark phase begins
    tl.to("#pinned-container", {
        backgroundColor: "#020617",
        padding: 0,
        duration: 0.8,
        ease: "power2.inOut",
        onReverseComplete: () => {
            gsap.set("#pinned-container", { backgroundColor: "#FFFFFF", padding: "0 10px 10px 10px" });
        }
    }, step2Start);
    tl.to(".hero-image-frame", {
        borderRadius: 0,
        duration: 0.8,
        ease: "power2.inOut",
        onReverseComplete: () => {
            gsap.set(".hero-image-frame", { borderRadius: 20 });
        }
    }, step2Start);

    // Fade in the dark blue deep space overlay
    tl.to(".hero-dark-overlay", {
        opacity: 1,
        duration: 1,
        ease: "power2.inOut"
    }, step2Start);

    // Fade out Vignette & Globe Stand
    tl.to(".img-vignette", { opacity: 0, duration: 0.8, ease: "power2.inOut" }, step2Start);
    if (hasWebGL) {
        // Fade the stand out quickly, before the camera zoom becomes visible —
        // otherwise the zoom makes the (stationary) stand appear to slide and grow.
        tl.to(standMaterial, {
            opacity: 0, duration: 0.15, ease: "power1.out",
            onReverseComplete: () => { standMaterial.opacity = 1; }
        }, step2Start);
    }

    // Fly Initial Text up and fade out
    tl.to(".initial-text", {
        opacity: 0,
        y: -50,
        duration: 0.6,
        onReverseComplete: () => {
            gsap.set(".initial-text", { opacity: 1, y: 0 });
        }
    }, step2Start);

    // Fade out floating hero cards
    tl.to(".initial-text-cards", {
        opacity: 0,
        y: 30,
        duration: 0.5,
        onReverseComplete: () => {
            gsap.set(".initial-text-cards", { opacity: 1, y: 0 });
        }
    }, step2Start);

    if (hasWebGL) {
        // Move camera back to fit scaled globe
        tl.to(camera.position, {
            z: 6,
            duration: 1.2,
            ease: "power2.inOut",
            onReverseComplete: () => {
                // Reset camera when scrolling back
                camera.position.z = 8;
            }
        }, step2Start);

        // Move globe to center and scale up massively
        tl.to(globeGroup.position, {
            x: 0, y: -0.2, z: 0,
            duration: 1.2,
            ease: "power2.inOut",
            onReverseComplete: () => {
                pinsVisible = false;
                const pinsContainer = document.getElementById('html-pins-container');
                if (pinsContainer) pinsContainer.style.opacity = '0';
                globeGroup.position.set(initialX, initialY, -3.5);
            }
        }, step2Start);

        tl.to(globeGroup.scale,
            { x: 0.68, y: 0.68, z: 0.68, duration: 1.2, ease: "power2.inOut",
              onReverseComplete: () => {
                  globeGroup.scale.set(0.18, 0.18, 0.18);
              }
            },
        step2Start);

        // Rotate the globe so Central Asia/Eurasia faces the camera perfectly
        tl.to(globeGroup.rotation, {
            y: Math.PI * 1.02,
            x: Math.PI * 0.15,
            duration: 1.2,
            ease: "power2.inOut",
            onReverseComplete: () => {
                // Reset rotation when scrolling back
                globeGroup.rotation.y = -Math.PI / 2;
                globeGroup.rotation.x = 0.2;
            }
        }, step2Start);

        // Transition Globe Material Color to Dark Blue
        tl.to(material.color, {
            r: colorBlueState.r,
            g: colorBlueState.g,
            b: colorBlueState.b,
            duration: 0.8,
            ease: "none",
            onReverseComplete: () => {
                // Ensure color resets to white when scrolling back
                material.color.copy(colorWhiteState);
            }
        }, step2Start + 0.2);
    }

    // ==========================================
    // STEP 3: Phase 2 Content Reveal (Dashboard)
    // ==========================================
    const step3Start = step2Start + 1.0;

    // Fade in the Destination UI
    tl.to(".final-text", {
        opacity: 1,
        y: 0,
        duration: 0.6
    }, step3Start);

    // Reveal Pins on the globe
    tl.to("#html-pins-container", {
        opacity: 1,
        duration: 0.4,
        onStart: () => {
            pinsVisible = true;
            startCarousel();
        },
        onReverseComplete: () => {
            pinsVisible = false;
            stopCarousel();
            const pinsContainer = document.getElementById('html-pins-container');
            if (pinsContainer) pinsContainer.style.opacity = '0';
            const medicalElements = document.getElementById('medical-bg-elements');
            if (medicalElements) medicalElements.style.opacity = '0';
        }
    }, step3Start + 0.2);

    // Reveal Medical Background Elements gracefully
    tl.to("#medical-bg-elements", {
        opacity: 0.4,
        duration: 0.8,
        ease: "power2.inOut"
    }, step3Start);

    tl.fromTo(".med-el",
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.06, duration: 0.7, ease: "back.out(1.4)" },
        step3Start + 0.1
    );
    tl.fromTo(".med-dot",
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.04, duration: 0.5, ease: "power2.out" },
        step3Start + 0.3
    );
}

// Nav visibility: hide on scroll, restore at top — home page only.
// All other pages use the same logic wired in components.js after header loads.
(function () {
    if (!document.getElementById('pinned-container')) return;
    window.__initNavScrollBehaviour();
}());

// G. About Section High-End Reveals
if (typeof gsap !== 'undefined') {
    if (document.querySelector('.about-manifesto')) {
        gsap.from(".about-manifesto", {
            scrollTrigger: {
                trigger: ".about-dark-area",
                start: "top 80%",
            },
            y: 50,
            opacity: 0,
            duration: 1.5,
            ease: "power4.out"
        });
    }

    if (document.querySelector('.feature-card')) {
        gsap.from(".feature-card", {
            scrollTrigger: {
                trigger: ".about-features-area",
                start: "top 80%",
            },
            y: 60,
            opacity: 0,
            stagger: 0.2,
            duration: 1.2,
            ease: "power3.out"
        });
    }

    if (document.querySelector('.stat-item')) {
        gsap.from(".stat-item", {
            scrollTrigger: {
                trigger: ".stat-banner",
                start: "top 90%",
            },
            scale: 0.8,
            opacity: 0,
            stagger: 0.2,
            duration: 1,
            ease: "back.out(1.7)"
        });
    }
}

// ==============================================
// 6. Vertical Carousel Integration
// ==============================================
const countryListEl = document.getElementById('country-list');
const scrollContainer = document.getElementById('country-scroll-container');
const titleEl = document.getElementById('country-title');
const descEl = document.getElementById('country-desc');

let activeIndex = -1;
// Exposed so the timeline can start/stop the carousel at the exact right moment
let carouselAutoScrollTimer = null;
let carouselIsPaused = false;
let carouselIsScrolling;

function startCarousel() {
    if (!countryListEl || !scrollContainer) return;
    detectCenterItem();
    updateActiveCountry(0, true);
    resetCarouselAutoScroll();
}

function stopCarousel() {
    clearInterval(carouselAutoScrollTimer);
    carouselAutoScrollTimer = null;
    activeIndex = -1;
    if (countryListEl) {
        Array.from(countryListEl.children).forEach(child => child.classList.remove('active'));
    }
    document.querySelectorAll('.country-pin').forEach(pin => {
        pin.classList.remove('active-pin', 'active-layer');
    });
}

if (countryListEl && scrollContainer) {
    // Render List Items
    locations.forEach((loc, index) => {
        const li = document.createElement('li');
        li.textContent = loc.name;
        li.dataset.index = index;
        // Click to scroll to this item easily
        li.addEventListener('click', () => {
            const topOfItem = li.offsetTop - scrollContainer.offsetTop;
            const middlePos = topOfItem - (scrollContainer.clientHeight / 2) + (li.clientHeight / 2);

            if (typeof gsap !== 'undefined') {
                gsap.to(scrollContainer, {
                    scrollTo: { y: middlePos },
                    duration: 0.8,
                    ease: "power2.inOut"
                });
            } else {
                scrollContainer.scrollTop = middlePos;
            }
            updateActiveCountry(index);
        });

        // Pause auto-scroll on hover
        li.addEventListener('mouseenter', () => { carouselIsPaused = true; });
        li.addEventListener('mouseleave', () => { carouselIsPaused = false; resetCarouselAutoScroll(); });

        countryListEl.appendChild(li);

        // Add hover listener to the corresponding pin on the globe
        const pinEl = document.getElementById(loc.id);
        if (pinEl) {
            pinEl.addEventListener('mouseenter', () => {
                const topOfItem = li.offsetTop - scrollContainer.offsetTop;
                const middlePos = topOfItem - (scrollContainer.clientHeight / 2) + (li.clientHeight / 2);

                if (typeof gsap !== 'undefined') {
                    gsap.to(scrollContainer, {
                        scrollTo: { y: middlePos },
                        duration: 0.8,
                        ease: "power2.inOut"
                    });
                } else {
                    scrollContainer.scrollTop = middlePos;
                }
                updateActiveCountry(index);
            });

            pinEl.addEventListener('mouseenter', () => { carouselIsPaused = true; });
            pinEl.addEventListener('mouseleave', () => { carouselIsPaused = false; resetCarouselAutoScroll(); });
        }
    });

    // Update UI Function
    function updateActiveCountry(index, force = false) {
        if (!force && index === activeIndex || index < 0 || index >= locations.length) return;
        activeIndex = index;
        const loc = locations[index];

        if (titleEl) titleEl.textContent = loc.name;
        if (descEl) descEl.textContent = loc.desc;
        const viewDetailsBtn = document.getElementById('country-view-details');
        if (viewDetailsBtn) viewDetailsBtn.href = loc.page;

        Array.from(countryListEl.children).forEach(child => child.classList.remove('active'));
        if (countryListEl.children[index]) {
            countryListEl.children[index].classList.add('active');
        }

        document.querySelectorAll('.country-pin').forEach(pin => {
            pin.classList.remove('active-pin', 'active-layer');
        });

        setTimeout(() => {
            const activePin = document.getElementById(loc.id);
            if (activePin) {
                activePin.classList.add('active-layer');
                activePin.classList.add('active-pin');
            }
        }, 50);
    }

    function detectCenterItem() {
        const containerCenterY = scrollContainer.scrollTop + scrollContainer.clientHeight / 2;
        let closestIndex = 0;
        let minDistance = Infinity;

        Array.from(countryListEl.children).forEach((li, index) => {
            const liTop = li.offsetTop - scrollContainer.offsetTop;
            const liCenter = liTop + li.clientHeight / 2;
            const dist = Math.abs(containerCenterY - liCenter);
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = index;
            }
        });

        updateActiveCountry(closestIndex);
    }

    function moveToNextCountry() {
        if (!pinsVisible || carouselIsPaused) return;
        let nextIndex = activeIndex + 1;
        if (nextIndex >= locations.length) nextIndex = 0;
        const li = countryListEl.children[nextIndex];
        if (li) {
            const topOfItem = li.offsetTop - scrollContainer.offsetTop;
            const middlePos = topOfItem - (scrollContainer.clientHeight / 2) + (li.clientHeight / 2);

            if (typeof gsap !== 'undefined') {
                gsap.to(scrollContainer, {
                    scrollTo: { y: middlePos },
                    duration: 1.2,
                    ease: "power2.inOut"
                });
            } else {
                scrollContainer.scrollTop = middlePos;
            }
        }
    }

    function resetCarouselAutoScroll() {
        clearInterval(carouselAutoScrollTimer);
        carouselAutoScrollTimer = setInterval(moveToNextCountry, 5000);
    }

    scrollContainer.addEventListener('scroll', () => {
        window.clearTimeout(carouselIsScrolling);
        resetCarouselAutoScroll();
        carouselIsScrolling = setTimeout(() => {
            detectCenterItem();
        }, 50);
    });
    // Carousel is started/stopped exclusively by the timeline tween callbacks below
}

// Mobile pin + description auto-rotate (fires only on touch/small screens)
let mobilePinTimer = null;
let mobilePinIndex = 0;

function startMobilePinRotation() {
    if (mobilePinTimer) return;
    mobilePinTimer = setInterval(() => {
        mobilePinIndex = (mobilePinIndex + 1) % locations.length;
        const loc = locations[mobilePinIndex];

        if (titleEl) titleEl.textContent = loc.name;
        if (descEl) descEl.textContent = loc.desc;
        const viewDetailsBtn = document.getElementById('country-view-details');
        if (viewDetailsBtn) viewDetailsBtn.href = loc.page;

        document.querySelectorAll('.country-pin').forEach(pin => {
            pin.classList.remove('active-pin', 'active-layer');
        });
        const activePin = document.getElementById(loc.id);
        if (activePin) {
            activePin.classList.add('active-pin', 'active-layer');
        }
    }, 3000);
}

function stopMobilePinRotation() {
    clearInterval(mobilePinTimer);
    mobilePinTimer = null;
}

// Start on mobile when phase 2 becomes visible; stop when it leaves
if (window.matchMedia('(max-width: 768px)').matches && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
        trigger: '#pinned-container',
        start: 'top top',
        end: 'bottom bottom',
        onEnter: startMobilePinRotation,
        onLeave: stopMobilePinRotation,
        onEnterBack: startMobilePinRotation,
        onLeaveBack: stopMobilePinRotation,
    });
}

// ==============================================
// 7. Preloader Logic & GSAP Entrance Animations
// ==============================================
let introTl;
if (typeof gsap !== 'undefined') {

    // Set up the entrance timeline
    introTl = gsap.timeline({ paused: true });

    // Word-split and intro timeline are set up inside afterLoad()
    // once we know the scroll position, so mid-scroll loads never get hidden states.

    // On non-home pages (no #pinned-container), show nav immediately after header loads
    if (!document.getElementById('pinned-container')) {
        const showNavNow = () => {
            gsap.set(["#nav-wrapper", ".nav-brand-corner", ".nav-cta-corner"], {
                opacity: 1, visibility: 'visible', pointerEvents: 'auto', y: 0
            });
        };
        document.addEventListener('headerLoaded', showNavNow);
        // Fallback in case headerLoaded already fired
        window.addEventListener('load', () => {
            if (document.querySelector('.nav-brand-corner')) showNavNow();
        });
    }

    window.addEventListener('load', () => {
        const preloader = document.getElementById('preloader');

        const afterLoad = () => {
            if (window.scrollY <= 0) {
                // Split hero title into words for the cinematic reveal animation
                const heroTitleEl = document.querySelector('.image-hero-title');
                if (heroTitleEl) {
                    const text = heroTitleEl.innerHTML;
                    const words = text.split(/(<br.*?>)/);
                    heroTitleEl.innerHTML = words.map(w => {
                        if (w.includes('<br')) return w;
                        return ` <span class="hero-word" style="display:inline-block; opacity:0; transform:translateY(30px)">${w}</span>`;
                    }).join('');
                }

                // Set initial hidden states for hero elements before intro animates them in
                gsap.set("#nav-wrapper", { y: -30, opacity: 0, visibility: 'visible' });
                gsap.set([".nav-brand-corner", ".nav-cta-corner"], { visibility: 'visible', opacity: 0, y: -10 });
                gsap.set(".image-hero-subtitle", { y: 30, opacity: 0 });
                gsap.set(".hero-cta-btn", { y: 20, opacity: 0 });
                gsap.set(".hero-card-bl", { y: 30, opacity: 0 });
                gsap.set(".hero-card-br", { y: 30, opacity: 0 });

                // Build the intro timeline tweens — tightened timing so content appears fast
                introTl.to("#nav-wrapper", { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, 0.1)
                    .to([".nav-brand-corner", ".nav-cta-corner"], { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.1)
                    .to(".hero-word", { y: 0, opacity: 1, duration: 0.8, stagger: 0.07, ease: "power4.out" }, 0.2)
                    .to(".image-hero-subtitle", { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, 0.5)
                    .to(".hero-cta-btn", { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.65)
                    .to(".hero-card-bl", { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.8)
                    .to(".hero-card-br", { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.9);

                // Loading at the top — play the globe scale-in as part of the intro animation
                if (hasWebGL) {
                    globeGroup.scale.set(0.001, 0.001, 0.001);
                    standGroup.scale.set(0.001, 0.001, 0.001);
                    introTl.fromTo(
                        [globeGroup.scale, standGroup.scale],
                        { x: 0.001, y: 0.001, z: 0.001 },
                        { x: 0.18, y: 0.18, z: 0.18, duration: 1.4, ease: "power4.out" },
                        0.1
                    );
                }
                introTl.play();
            } else {
                // Mid-scroll load — hide nav, hide hero-only UI elements immediately.
                // Apply once now (in case header is already in DOM) and again on headerLoaded
                // (in case the async fetch hasn't completed yet).
                const hideMidScrollNav = () => {
                    gsap.set(["#nav-wrapper", ".nav-brand-corner", ".nav-cta-corner"], {
                        opacity: 0, visibility: 'visible', pointerEvents: 'none'
                    });
                    // Wire scroll-hide/show so nav reappears when user scrolls back to top.
                    window.__initNavScrollBehaviour();
                };
                hideMidScrollNav();
                document.addEventListener('headerLoaded', hideMidScrollNav, { once: true });
                // Hero cards and initial text must be hidden when loaded mid/past pin
                gsap.set([".initial-text", ".initial-text-cards"], { opacity: 0 });

                const pinnedEl = document.getElementById('pinned-container');
                const pinTop = pinnedEl ? pinnedEl.offsetTop : 0;
                const pinScrollLength = 600;
                const pinBottom = pinTop + pinScrollLength;

                if (window.scrollY >= pinBottom) {
                    // Fully past the hero pin — lock everything into phase-2 end state
                    if (hasWebGL) {
                        globeGroup.scale.set(0.68, 0.68, 0.68);
                        globeGroup.position.set(0, -0.2, 0);
                        globeGroup.rotation.y = Math.PI * 1.02;
                        globeGroup.rotation.x = Math.PI * 0.15;
                        standGroup.scale.set(0.18, 0.18, 0.18);
                        standGroup.position.set(initialX, initialY, -3.5);
                        standMaterial.opacity = 0;
                        standMaterial.transparent = true;
                        camera.position.z = 6;
                        material.color.copy(colorBlueState);
                        pinsVisible = true;
                        startCarousel();
                        const pinsContainer = document.getElementById('html-pins-container');
                        if (pinsContainer) pinsContainer.style.opacity = '1';
                    }
                    // Also set final-text visible and initial-text hidden for this state
                    gsap.set(".final-text", { opacity: 1, y: 0 });
                } else {
                    // Mid-scrub inside the pin — reset to phase-1 baseline so
                    // ScrollTrigger.refresh() can scrub to the correct progress.
                    if (hasWebGL) {
                        globeGroup.scale.set(0.18, 0.18, 0.18);
                        globeGroup.position.set(initialX, initialY, -3.5);
                        globeGroup.rotation.y = -Math.PI / 2;
                        globeGroup.rotation.x = 0.2;
                        standGroup.scale.set(0.18, 0.18, 0.18);
                        standGroup.position.set(initialX, initialY, -3.5);
                        standMaterial.opacity = 1;
                        standMaterial.transparent = true;
                        camera.position.z = 8;
                        material.color.copy(colorWhiteState);
                    }
                }
            }

            // Refresh ScrollTrigger after state is fully set
            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.refresh();
                requestAnimationFrame(() => ScrollTrigger.update());
            }
        };

        if (preloader) {
            // Wait for 3D textures and buffering to completely clear
            setTimeout(() => {
                // Force scroll to top now — body is still locked, so this is safe.
                // Then unlock body so GSAP/Lenis can take over from position 0.
                window.scrollTo(0, 0);
                document.body.classList.remove('preloader-active');

                // Fade out preloader
                gsap.to(preloader, {
                    opacity: 0,
                    duration: 2.5,
                    ease: "power2.inOut",
                    onComplete: () => {
                        preloader.style.display = 'none';
                    }
                });

                afterLoad();
            }, 1500);
        } else {
            // No preloader — still remove lock and reset scroll
            document.body.classList.remove('preloader-active');
            window.scrollTo(0, 0);
            afterLoad();
        }
    });
} else {
    // Fallback if GSAP is not loaded
    window.addEventListener('load', () => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            setTimeout(() => {
                window.scrollTo(0, 0);
                document.body.classList.remove('preloader-active');
                preloader.style.opacity = '0';
                setTimeout(() => {
                    preloader.style.display = 'none';
                }, 2500);
            }, 1500);
        } else {
            document.body.classList.remove('preloader-active');
            window.scrollTo(0, 0);
        }
    });
}

// Reality Check — Pinned word-reveal animation
if (document.querySelector('.reality-section') && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {

    const pinWrap = document.getElementById('rc-pin-wrap');
    const words   = document.querySelectorAll('.rc-word');
    const sub     = document.getElementById('rc-reveal-sub');

    if (pinWrap && words.length) {
        // Pin the panel for scrolling space proportional to word count
        // Shorter on mobile/tablet = faster scrub through the word reveal
        const isMobileOrTablet = window.innerWidth <= 1024;
        const pinDuration = isMobileOrTablet ? '160%' : '250%';

        ScrollTrigger.create({
            trigger: pinWrap,
            start: 'top top',
            end: '+=' + pinDuration,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            onUpdate(self) {
                const p = self.progress; // 0 → 1
                const wordCount = words.length;

                // Each word gets revealed across its slice of scroll progress
                // Words 0–(n-1) light up across 0→0.85, sub fades in 0.85→1
                words.forEach((word, i) => {
                    const start  = (i / wordCount) * 0.85;
                    const end    = ((i + 1) / wordCount) * 0.85;
                    const t      = Math.min(1, Math.max(0, (p - start) / (end - start)));
                    // interpolate from rgba(255,255,255,0.02) → rgba(255,255,255,1)
                    const alpha  = 0.02 + (1 - 0.02) * t;
                    word.style.color = `rgba(255,255,255,${alpha.toFixed(3)})`;
                });

                // Sub-line fades in during last 15% of scroll
                const subT = Math.min(1, Math.max(0, (p - 0.82) / 0.18));
                if (sub) sub.style.color = `rgba(255,255,255,${(subT * 0.55).toFixed(3)})`;
            }
        });
    }

    // Editorial pinned panel — line scrub + staggered row reveal
    const rcEditWrap  = document.getElementById('rc-editorial-wrap');
    const rcEditorial = document.getElementById('rc-editorial');
    const rcDivLine   = document.getElementById('rc-divider-line');
    const rcHRule     = document.getElementById('rc-h-rule');
    const rcColLeft   = document.getElementById('rc-col-left');
    const rcColRight  = document.getElementById('rc-col-right');
    const rcRightTop  = document.getElementById('rc-right-top');
    const rcRightBot  = document.getElementById('rc-right-bot');

    if (rcEditWrap && rcDivLine && typeof ScrollTrigger !== 'undefined') {

        const leftRows     = Array.from(rcColLeft  ? rcColLeft.querySelectorAll('.rc-row')  : []);
        // Separate the right rows by block so we can order them correctly
        const rightTopRows = Array.from(rcRightTop ? rcRightTop.querySelectorAll('.rc-row') : []);
        const rightBotRows = Array.from(rcRightBot ? rcRightBot.querySelectorAll('.rc-row') : []);

        const leftTitle     = rcColLeft  ? rcColLeft.querySelector('.rc-col-title')   : null;
        const rightTopTitle = rcRightTop ? rcRightTop.querySelector('.rc-col-title')  : null;
        const rightBotLabel = rcRightBot ? rcRightBot.querySelector('.rc-col-label')  : null;
        const rightBotTitle = rcRightBot ? rcRightBot.querySelector('.rc-col-title')  : null;

        // Fade-in window — wider = slower, scrub-reversible
        const FADE = 0.18;
        const scrubFade = (p, start) => Math.min(1, Math.max(0, (p - start) / FADE));

        // Remove CSS transitions so scrub drives opacity/transform directly (reversible)
        [leftTitle, rightTopTitle, rightBotLabel, rightBotTitle, ...leftRows, ...rightTopRows, ...rightBotRows]
            .forEach(el => { if (el) el.style.transition = 'none'; });
        if (rcHRule) rcHRule.style.transition = 'none';

        // Build a unified top-to-bottom sequence of "slots".
        // Each slot = { leftEl, rightEl } — they reveal together at the same scroll position.
        // Left col:  title  + 5 rows
        // Right col: topTitle + 3 topRows + hRule + botLabel + botTitle + 3 botRows
        // We zip them so each vertical position fires simultaneously on both sides.
        // rcHRule is driven separately below — not in the slot array.
        const leftSlots  = [leftTitle,     ...leftRows];
        const rightSlots = [rightTopTitle, ...rightTopRows, rightBotLabel, rightBotTitle, ...rightBotRows];
        const totalSlots = Math.max(leftSlots.length, rightSlots.length);

        const ROWS_START = 0.06;
        const ROWS_END   = 0.90;
        const ROWS_SPAN  = ROWS_END - ROWS_START;

        const isMobileTablet = window.innerWidth <= 1024;
        ScrollTrigger.create({
            trigger: rcEditWrap,
            start: 'top top',
            end: isMobileTablet ? '+=180%' : '+=300%',
            pin: true,
            pinSpacing: true,
            scrub: isMobileTablet ? 1.5 : 3,
            onUpdate(self) {
                const p = self.progress;

                // Divider line grows top-to-bottom with scroll
                rcDivLine.style.setProperty('--line-progress', (p * 100).toFixed(1) + '%');

                if (rcColLeft)  rcColLeft.classList.toggle('rc-visible',  p >= 0.02);
                if (rcColRight) rcColRight.classList.toggle('rc-visible', p >= 0.02);

                // Each slot index i maps to a scroll start position.
                // Both the left and right element at row i reveal at the exact same time.
                for (let i = 0; i < totalSlots; i++) {
                    const slotStart = ROWS_START + (i / totalSlots) * ROWS_SPAN;
                    const a = scrubFade(p, slotStart);

                    const lEl = leftSlots[i]  || null;
                    const rEl = rightSlots[i] || null;

                    if (lEl) {
                        lEl.style.opacity   = a;
                        lEl.style.transform = `translateY(${(1 - a) * 20}px)`;
                        if (lEl.classList && lEl.classList.contains('rc-row')) {
                            lEl.style.borderBottomColor = `rgba(100,255,218,${(a * 0.08).toFixed(3)})`;
                        }
                    }
                    if (rEl) {
                        rEl.style.opacity   = a;
                        rEl.style.transform = `translateY(${(1 - a) * 20}px)`;
                        if (rEl.classList && rEl.classList.contains('rc-row')) {
                            rEl.style.borderBottomColor = `rgba(255,255,255,${(a * 0.05).toFixed(3)})`;
                        }
                    }
                }

                // rc-right-top rows border-top: scrub-driven, tied to rightTopTitle slot
                if (rcRightTop) {
                    const topRowsStart = ROWS_START + (0 / totalSlots) * ROWS_SPAN;
                    const tA = Math.min(1, Math.max(0, (p - topRowsStart) / FADE));
                    const topRows = rcRightTop.querySelector('.rc-col-rows');
                    if (topRows) topRows.style.borderTopColor = `rgba(255,255,255,${(tA * 0.07).toFixed(3)})`;
                }

                // h-rule: appears only after the last rightTopRow is fully revealed.
                // Start = last rightTopRow slot index + FADE (fully done).
                if (rcHRule) {
                    const lastTopRowIdx   = rightTopRows.length;
                    const lastTopRowStart = ROWS_START + (lastTopRowIdx / totalSlots) * ROWS_SPAN;
                    const hRuleStart      = lastTopRowStart + FADE;
                    const hA = Math.min(1, Math.max(0, (p - hRuleStart) / FADE));
                    // Interpolate height/margin with hA — a binary toggle here causes a
                    // sudden layout jump that shoves the bottom block down in one frame.
                    rcHRule.style.height  = hA > 0 ? '1px' : '0';
                    rcHRule.style.margin  = `calc(clamp(0.8rem, 2vh, 1.5rem) * ${hA.toFixed(3)}) 0`;
                    rcHRule.style.width   = (hA * 100).toFixed(1) + '%';
                    rcHRule.style.opacity = hA.toFixed(3);
                }

                // rc-right-bot rows border-top: appears when rightBotTitle (slot index 5) is fully in
                if (rcRightBot) {
                    const botTitleIdx   = 1 + rightTopRows.length + 1; // botLabel + botTitle
                    const botTitleStart = ROWS_START + (botTitleIdx / totalSlots) * ROWS_SPAN;
                    const bRuleStart    = botTitleStart + FADE;
                    const bA = Math.min(1, Math.max(0, (p - bRuleStart) / FADE));
                    const botRows = rcRightBot.querySelector('.rc-col-rows');
                    if (botRows) botRows.style.borderTopColor = `rgba(255,255,255,${(bA * 0.07).toFixed(3)})`;
                }
            }
        });
    }
}

// Anatomy Stack Section - Scroll Card Stack
(function () {
    const pinWrap = document.getElementById('anatomy-pin-wrap');
    const cards = gsap.utils.toArray('.anatomy-card');
    if (!pinWrap || !cards.length) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    const cardCount = cards.length;

    // Card 1 is always visible (translateY 0). Cards 2-4 start below (translateY 100%)
    cards.forEach((card, i) => {
        if (i === 0) {
            gsap.set(card, { yPercent: 0 });
        } else {
            gsap.set(card, { yPercent: 100 });
        }
    });

    // Animate stat bar for the card that just became active
    const animateStatBar = (card) => {
        const fill = card.querySelector('.anatomy-stat-fill');
        if (!fill) return;
        const target = fill.style.getPropertyValue('--fill') || '100%';
        gsap.fromTo(fill, { width: '0%' }, { width: target, duration: 1.1, ease: 'power2.out' });
    };

    // Pin the wrap and scrub each card sliding up
    // Reduce scroll distance on small screens so snapping feels natural
    const scrollPerCard = window.innerWidth <= 576 ? 500 : window.innerWidth <= 991 ? 600 : 700;
    const totalScroll = scrollPerCard * (cardCount - 1);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: pinWrap,
            start: 'top top',
            end: '+=' + totalScroll,
            pin: true,
            pinSpacing: true,
            scrub: 0.8,
            snap: {
                snapTo: 1 / (cardCount - 1),
                duration: { min: 0.3, max: 0.6 },
                ease: 'power2.inOut'
            },
            onUpdate: (self) => {
                // Determine which card is active and fire stat bar once
                const activeIndex = Math.round(self.progress * (cardCount - 1));
                if (activeIndex !== tl._lastActive) {
                    tl._lastActive = activeIndex;
                    animateStatBar(cards[activeIndex]);
                }
            }
        }
    });

    tl._lastActive = 0;
    animateStatBar(cards[0]);

    // For each subsequent card, slide it up from 100% to 0%
    cards.forEach((card, i) => {
        if (i === 0) return;
        tl.to(card, {
            yPercent: 0,
            ease: 'none',
            duration: 1
        }, (i - 1));
    });
})();

// Hide/show navbar based on scroll position relative to the hero pin.
// We do this with a plain scroll listener instead of a second ScrollTrigger
// because pinned elements have unreliable bounding boxes during the pin phase.
(function () {
    const heroPinnedEl = document.getElementById('pinned-container');
    if (!heroPinnedEl) return;

    const navEls = ['#nav-wrapper', '.nav-brand-corner', '.nav-cta-corner'];
    let navHidden = false;

    function setNavHidden(hide) {
        if (hide === navHidden) return;
        navHidden = hide;
        if (hide) {
            gsap.set(navEls, { opacity: 0, visibility: 'hidden', pointerEvents: 'none' });
        } else {
            gsap.set(navEls, { opacity: 1, visibility: 'visible', pointerEvents: 'auto', y: 0 });
        }
    }

    function checkNavVisibility() {
        // pinTop = where the hero section sits in the document before pinning begins
        const pinTop = heroPinnedEl.offsetTop;
        // The scrub timeline runs for 600px of scroll
        const pinEnd = pinTop + 600;

        if (window.scrollY <= pinTop) {
            // At or above the hero — nav visible (intro anim owns opacity on fresh load)
            setNavHidden(false);
        } else if (window.scrollY >= pinEnd) {
            // Past the entire hero scrub — hide nav
            setNavHidden(true);
        } else {
            // Inside the scrub range — nav is hidden by the scrub tween itself,
            // but keep visibility:visible so the scrub opacity can show through
            if (navHidden) {
                gsap.set(navEls, { visibility: 'visible' });
                navHidden = false;
            }
        }
    }

    window.addEventListener('scroll', checkNavVisibility, { passive: true });
    if (typeof lenis !== 'undefined') {
        lenis.on('scroll', checkNavVisibility);
    }
})();

    // 2. The Sticky Card Stack Depth Effect
    // On desktop, as cards stack over each other, the ones underneath scale down slightly
    if (window.innerWidth > 991 && document.querySelector('.stack-card')) {
        const cards = gsap.utils.toArray('.stack-card');

        cards.forEach((card, index) => {
            // We don't scale down the last card
            if (index === cards.length - 1) return;

            // As the NEXT card scrolls up to cover THIS card, scale THIS card down
            gsap.to(card, {
                scrollTrigger: {
                    trigger: cards[index + 1],
                    start: "top " + (120 + ((index + 1) * 20)),
                    end: "top " + (50 + ((index + 1) * 20)),
                    scrub: true,
                },
                scale: 0.92,
                opacity: 0.6,
                filter: "blur(4px)"
            });
        });

        // Interactive 3D Tilt + Spotlight on Card Hover
        cards.forEach(card => {
            const dossier = card.querySelector('.glass-dossier');
            const spotlight = card.querySelector('.card-spotlight-usp');

            if (!dossier) return;

            card.addEventListener('mousemove', (e) => {
                const rect = dossier.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -4;
                const rotateY = ((x - centerX) / centerX) * 4;

                gsap.to(dossier, {
                    rotationX: rotateX,
                    rotationY: rotateY,
                    transformPerspective: 1200,
                    duration: 0.4,
                    ease: "power2.out",
                    overwrite: "auto"
                });

                if (spotlight) {
                    spotlight.style.background = `radial-gradient(circle 300px at ${x}px ${y}px, rgba(99, 102, 241, 0.06), transparent)`;
                }
            });

            card.addEventListener('mouseleave', () => {
                gsap.to(dossier, {
                    rotationX: 0,
                    rotationY: 0,
                    duration: 0.6,
                    ease: "power3.out",
                    overwrite: "auto"
                });

                if (spotlight) {
                    spotlight.style.background = 'transparent';
                }
            });
        });
    }

    // 3. Entrance animations for the left side text (choreographed)
    if (document.querySelector('.usp-premium-stack')) {
        const uspTl = gsap.timeline({
            scrollTrigger: {
                trigger: ".usp-premium-stack",
                start: "top 70%"
            }
        });

        uspTl.from(".sticky-content-wrapper .urgency-badge", {
            y: 20, opacity: 0, duration: 0.6, ease: "power3.out"
        })
            .from(".sticky-content-wrapper h2", {
                y: 30, opacity: 0, duration: 0.8, ease: "power3.out"
            }, "-=0.3")
            .from(".sticky-content-wrapper > p", {
                y: 25, opacity: 0, duration: 0.7, ease: "power3.out"
            }, "-=0.4")
            .from(".trust-stat-item", {
                y: 20, opacity: 0, scale: 0.9, stagger: 0.1, duration: 0.6, ease: "back.out(1.4)"
            }, "-=0.3")
            .from(".trust-stat-divider", {
                scaleY: 0, opacity: 0, stagger: 0.1, duration: 0.4, ease: "power2.out"
            }, "-=0.5")
            .from(".zero-donation-badge-wrap", {
                y: 30, opacity: 0, scale: 0.95, duration: 0.8, ease: "power3.out"
            }, "-=0.3");
    }

    // 4. Staggered card entrance
    if (document.querySelector('.cards-stack-wrapper')) {
        gsap.from(".stack-card", {
            scrollTrigger: {
                trigger: ".cards-stack-wrapper",
                start: "top 80%"
            },
            y: 60,
            opacity: 0,
            stagger: 0.15,
            duration: 0.9,
            ease: "power3.out"
        });
    }

    // 5. Animated Trust Stat Counters
    const statNumbers = document.querySelectorAll('.trust-stat-number[data-target]');
    if (statNumbers.length > 0 && document.querySelector('.usp-trust-stats')) {
        ScrollTrigger.create({
            trigger: ".usp-trust-stats",
            start: "top 80%",
            once: true,
            onEnter: () => {
                statNumbers.forEach(el => {
                    const target = parseInt(el.dataset.target);
                    gsap.to(el, {
                        innerText: target,
                        duration: 2,
                        ease: "power2.out",
                        snap: { innerText: 1 },
                        onUpdate: function () {
                            el.textContent = Math.round(parseFloat(el.textContent)).toLocaleString();
                        }
                    });
                });
            }
        });
    }

    // 6. Parallax on background shapes
    if (document.querySelector('.usp-premium-stack')) {
        gsap.to(".shape-mint", {
            scrollTrigger: {
                trigger: ".usp-premium-stack",
                start: "top bottom",
                end: "bottom top",
                scrub: 1
            },
            y: -80,
            x: 30,
            ease: "none"
        });

        gsap.to(".shape-blue", {
            scrollTrigger: {
                trigger: ".usp-premium-stack",
                start: "top bottom",
                end: "bottom top",
                scrub: 1
            },
            y: -60,
            x: -30,
            ease: "none"
        });
    }

// Global Light Background Injection for Light Sections
const injectGlobalLightBg = () => {
    const bgHTML = `
        <div class="position-absolute top-0 start-0 w-100 h-100 overflow-hidden z-0 pointer-events-none" style="border-radius: inherit;">
            <div class="bg-shape shape-mint"></div>
            <div class="bg-shape shape-blue"></div>
            <svg class="usp-dot-grid" width="100%" height="100%">
                <defs>
                    <pattern id="dot-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill="rgba(13,27,140,0.07)"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dot-pattern)"/>
            </svg>
        </div>
    `;
    document.querySelectorAll('.with-global-light-bg').forEach(el => {
        el.insertAdjacentHTML('afterbegin', bgHTML);
    });
};
injectGlobalLightBg();

// Cinematic Accordion & Modal Logic
const slices = document.querySelectorAll('.accordion-slice');
const portalOverlay = document.getElementById('univ-portal');

if (slices.length > 0) {

    // Accordion Entrance Animation
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && document.querySelector('.universities-accordion-section')) {
        const slicesArray = gsap.utils.toArray(".accordion-slice");

        slicesArray.forEach((slice, i) => {
            // Alternating animation: odds from top (-80), evens from bottom (80)
            const startY = (i % 2 === 0) ? -80 : 80;

            gsap.from(slice, {
                scrollTrigger: {
                    trigger: ".universities-accordion-section",
                    start: "top 80%"
                },
                y: startY,
                opacity: 0,
                duration: 1.2,
                delay: i * 0.1, // Stagger effect
                ease: "power3.out"
            });
        });
    }

    slices.forEach(slice => {

        // 1. Accordion Expansion Logic (Desktop Only)
        slice.addEventListener('mouseenter', (e) => {
            // If already active, do nothing
            if (slice.classList.contains('active')) return;

            // Remove active from all
            slices.forEach(s => s.classList.remove('active'));
            // Add to hovered
            slice.classList.add('active');
        });

        // 2. Modal Trigger Logic (Triggered by the button)
        const btn = slice.querySelector('.btn-view-univ');
        if (btn && portalOverlay) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Stop the slice from expanding again

                // Extract Data from the parent slice
                const name = slice.getAttribute('data-name');
                const country = slice.getAttribute('data-country');
                const fees = slice.getAttribute('data-fees');
                const imgUrl = slice.getAttribute('data-img');
                const desc = slice.getAttribute('data-desc');

                // Populate Portal
                const portalTitle = document.getElementById('portal-title');
                const portalCountry = document.getElementById('portal-country');
                const portalFees = document.getElementById('portal-fees');
                const portalImg = document.getElementById('portal-img');
                const portalDesc = document.getElementById('portal-desc');

                if (portalTitle) portalTitle.textContent = name;
                if (portalCountry) portalCountry.textContent = country;
                if (portalFees) portalFees.textContent = fees;
                if (portalImg) portalImg.src = imgUrl;
                if (portalDesc) portalDesc.textContent = desc;

                // Open Portal
                portalOverlay.classList.add('portal-active');
                document.body.style.overflow = 'hidden';

                // Modal Entrance Animation
                if (typeof gsap !== 'undefined') {
                    gsap.timeline()
                        .fromTo(".portal-content-wrapper",
                            { scale: 0.9, y: 30, opacity: 0 },
                            { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.2)" }
                        )
                        .fromTo(".portal-header h2, .portal-header .badge",
                            { y: 20, opacity: 0 },
                            { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 }, "-=0.2"
                        )
                        .fromTo(".portal-body > *",
                            { y: 20, opacity: 0 },
                            { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 }, "-=0.2"
                        );
                }
            });
        }
    });

    // Modal Close Logic
    const closePortalBtn = document.getElementById('close-portal');
    if (closePortalBtn && portalOverlay) {
        const closePortal = () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(".portal-content-wrapper", {
                    scale: 0.95, y: 20, opacity: 0, duration: 0.3, ease: "power2.in",
                    onComplete: () => {
                        portalOverlay.classList.remove('portal-active');
                        document.body.style.overflow = '';
                    }
                });
            } else {
                portalOverlay.classList.remove('portal-active');
                document.body.style.overflow = '';
            }
        };

        closePortalBtn.addEventListener('click', closePortal);
        portalOverlay.addEventListener('click', (e) => {
            if (e.target === portalOverlay) closePortal();
        });
    }
}

// Cinematic Horizontal Journey Logic (Process Section)
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {

    const journeySection = document.querySelector('.journey-section');
    const journeyTrack = document.querySelector('.journey-track');

    // Pinned horizontal scroll on all breakpoints (desktop, tablet, mobile)
    if (journeySection && journeyTrack) {

        // Calculate how far to move horizontally
        const getScrollAmount = () => -(journeyTrack.scrollWidth - window.innerWidth);

        // 1. Pin and Slide Horizontal Animation
        const tween = gsap.to(journeyTrack, {
            x: getScrollAmount,
            ease: "none"
        });

        ScrollTrigger.create({
            trigger: ".journey-pin-wrapper",
            start: "top top",
            end: () => `+=${getScrollAmount() * -1}`, // Scroll distance equals track length
            pin: true,
            anticipatePin: 1, // Pre-pin on fast touch scroll so the section doesn't lag in
            animation: tween,
            scrub: 1, // Smooth scrubbing
            invalidateOnRefresh: true // Recalculates on window resize
        });

        // 2. The Glowing Progress Line
        const cards = gsap.utils.toArray('.journey-card:not(.buffer-card)');

        const glowLineTl = gsap.timeline({
            scrollTrigger: {
                trigger: ".journey-pin-wrapper",
                start: "top top",
                end: () => `+=${getScrollAmount() * -1}`,
                scrub: 1,
                onUpdate: (self) => {
                    const trackScrollWidth = journeyTrack.scrollWidth;
                    // The physical position of the glowing tip along the track
                    const tipX = self.progress * trackScrollWidth;

                    cards.forEach(card => {
                        const cardLeft = card.offsetLeft;
                        const cardRight = cardLeft + card.offsetWidth;

                        // Activate card when the glowing tip is within its horizontal bounds
                        if (tipX >= cardLeft - 100 && tipX <= cardRight + 100) {
                            card.classList.add("is-active");
                        } else {
                            card.classList.remove("is-active");
                        }
                    });
                }
            }
        });

        const pathFill = document.querySelector('.journey-path-fill');
        if (pathFill) {
            glowLineTl.to(pathFill, {
                width: "100%",
                ease: "none"
            }, 0);
        }

        // Show the glow tip as soon as we start scrolling
        const pathGlow = document.querySelector('.journey-path-glow');
        if (pathGlow) {
            glowLineTl.to(pathGlow, {
                opacity: 1,
                duration: 0.1,
                ease: "power2.out"
            }, 0);
        }
    }
}

// Parents Trust Dossier Logic
const dossierItems = document.querySelectorAll('.dossier-item');
const dossierImages = document.querySelectorAll('.dossier-img');

if (dossierItems.length > 0 && dossierImages.length > 0) {
    let currentDossierIndex = 0;
    let dossierTimer;

    // 1. Setup SVG cloning for the drawing effect
    dossierItems.forEach((item, index) => {
        const iconContainer = item.querySelector('.dossier-icon');
        const svg = iconContainer ? iconContainer.querySelector('svg') : null;

        if (svg && iconContainer) {
            // Clone SVG to create a faint background track
            const bgSvg = svg.cloneNode(true);
            bgSvg.style.opacity = '0.15';
            bgSvg.style.position = 'absolute';
            bgSvg.style.top = '50%';
            bgSvg.style.left = '50%';
            bgSvg.style.transform = 'translate(-50%, -50%)';
            iconContainer.style.position = 'relative';

            // Ensure original svg is on top and absolute
            svg.style.position = 'relative';
            svg.style.zIndex = '2';

            iconContainer.insertBefore(bgSvg, svg);

            // Calculate lengths for the foreground SVG
            const paths = svg.querySelectorAll('path, line, circle');
            paths.forEach(path => {
                let length = 150; // safe fallback
                if (typeof path.getTotalLength === 'function') {
                    length = path.getTotalLength();
                }
                // Set up stroke-dash array and offset
                path.style.strokeDasharray = length;
                path.style.strokeDashoffset = length;
                // Store length as data attribute
                path.dataset.length = length;
            });
        }

        // Manual hover override (ignore the already-active item so its
        // image/text animations don't restart and cause a visible jump)
        item.addEventListener('mouseenter', () => {
            if (item.classList.contains('active')) return;
            activateDossierItem(index, true);
        });
    });

    function activateDossierItem(index, isManual = false) {
        if (dossierItems[index].classList.contains('active') && !isManual && dossierTimer) return;

        // Stop previous animation
        if (dossierTimer) {
            if (typeof dossierTimer.kill === 'function') {
                dossierTimer.kill();
            } else {
                clearTimeout(dossierTimer);
            }
        }

        // Remove active class from all
        dossierItems.forEach(d => {
            d.classList.remove('active');
            // Hide foreground SVGs instantly
            const paths = d.querySelectorAll('svg:nth-child(2) path, svg:nth-child(2) line, svg:nth-child(2) circle');
            paths.forEach(p => {
                if (typeof gsap !== 'undefined') {
                    gsap.set(p, { strokeDashoffset: p.dataset.length });
                } else {
                    p.style.strokeDashoffset = p.dataset.length;
                }
            });
        });
        dossierImages.forEach(img => img.classList.remove('active'));

        // Set new active
        const item = dossierItems[index];
        if (!item) return;
        item.classList.add('active');

        const targetImgId = item.getAttribute('data-img');
        const targetImg = document.getElementById(targetImgId);
        if (targetImg) {
            targetImg.classList.add('active');
            // Premium Image Animation (Subtle Zoom)
            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf(dossierImages);
                gsap.fromTo(targetImg,
                    { scale: 1.06 },
                    { scale: 1, duration: 7, ease: "none", overwrite: true }
                );
            }
        }

        // Premium text entrance animation
        const activeText = item.querySelector('.dossier-body p');
        if (activeText && typeof gsap !== 'undefined') {
            gsap.fromTo(activeText,
                { y: 10, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.15, overwrite: true }
            );
        }

        // Animate SVG drawing (Acts as Timer)
        const activePaths = item.querySelectorAll('svg:nth-child(2) path, svg:nth-child(2) line, svg:nth-child(2) circle');

        if (typeof gsap !== 'undefined') {
            dossierTimer = gsap.to(activePaths, {
                strokeDashoffset: 0,
                duration: 2, // 2 seconds per card
                ease: "linear",
                onComplete: () => {
                    // Auto-advance to next
                    currentDossierIndex = (currentDossierIndex + 1) % dossierItems.length;
                    activateDossierItem(currentDossierIndex);
                }
            });
        } else {
            dossierTimer = setTimeout(() => {
                currentDossierIndex = (currentDossierIndex + 1) % dossierItems.length;
                activateDossierItem(currentDossierIndex);
            }, 2000);
            activePaths.forEach(p => { p.style.strokeDashoffset = '0'; });
        }

        currentDossierIndex = index;
    }

    // GSAP Entrance & Auto-Start trigger
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && document.querySelector('.trust-dossier-section')) {
        let hasStarted = false;

        const trustTl = gsap.timeline({
            scrollTrigger: {
                trigger: ".trust-dossier-section",
                start: "top 75%",
                onEnter: () => {
                    // Start auto-cycle exactly when the entry animation begins
                    if (!hasStarted) {
                        hasStarted = true;
                        activateDossierItem(0);
                    }
                }
            }
        });

        trustTl.from(".trust-dossier-container", {
            y: 50,
            opacity: 0,
            duration: 1,
            ease: "power3.out"
        })
            .from(".promise-plaque", {
                x: -40,
                opacity: 0,
                duration: 0.8,
                ease: "back.out(1.2)"
            }, "-=0.4");

        // Visibility Tracker: Pause animation when section is out of viewport
        ScrollTrigger.create({
            trigger: ".trust-dossier-section",
            start: "top 100%", // When top of section hits bottom of viewport
            end: "bottom 0%",  // When bottom of section hits top of viewport
            onEnter: () => { if (hasStarted && dossierTimer && typeof dossierTimer.play === 'function') dossierTimer.play(); },
            onLeave: () => { if (dossierTimer && typeof dossierTimer.pause === 'function') dossierTimer.pause(); },
            onEnterBack: () => { if (hasStarted && dossierTimer && typeof dossierTimer.play === 'function') dossierTimer.play(); },
            onLeaveBack: () => { if (dossierTimer && typeof dossierTimer.pause === 'function') dossierTimer.pause(); }
        });

    } else {
        // Fallback if GSAP fails
        activateDossierItem(0);
    }
}

// Contact form — click anywhere in a field row to focus its input
document.querySelectorAll('.cfc-field').forEach(field => {
    field.addEventListener('click', () => {
        const input = field.querySelector('input, select');
        if (input) input.focus();
    });
});

// Comparison Matrix Entrance Animations
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    if (document.querySelector('.comparison-section')) {

        const compTl = gsap.timeline({
            scrollTrigger: {
                trigger: ".comparison-section",
                start: "top 85%", // Trigger earlier in the scroll
            }
        });

        // 1. Reveal Header
        compTl.from(".comparison-section h2, .comparison-section p", {
            y: 30,
            opacity: 0,
            stagger: 0.06,
            duration: 0.3,
            ease: "power3.out"
        })

            // 2. Reveal the "Trap" (Left Card)
            .from(".comp-col-trap", {
                x: -50,
                opacity: 0,
                duration: 0.3,
                ease: "power3.out"
            }, "<0.05") // Starts 0.05s after header begins

            // 3. SLAM down the "Solution" (Right Card) with a dramatic elastic effect
            .from(".comp-col-solution", {
                scale: 0.8,
                x: 50,
                opacity: 0,
                duration: 0.6,
                ease: "elastic.out(1, 0.6)"
            }, "<0.05") // Starts 0.05s after Trap begins

            // 3.5 POP the VS badge
            .from(".vs-badge", {
                scale: 0,
                rotation: -180,
                opacity: 0,
                duration: 0.3,
                ease: "back.out(1.5)"
            }, "<0.05")

            // 4. Stagger the winning checkmarks for emphasis
            .from(".comp-win-row", {
                x: -20,
                opacity: 0,
                stagger: 0.07,
                duration: 0.3,
                ease: "power2.out"
            }, "-=0.3");
    }
}

// ================================================
// CUSTOM OVERLAY SCROLLBAR (driven by Lenis)
// ================================================
(function () {
    const track = document.getElementById('custom-scrollbar-track');
    const thumb = document.getElementById('custom-scrollbar-thumb');
    if (!track || !thumb) return;

    function updateThumb() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const trackHeight = viewHeight;

        // Thumb height = proportion of visible viewport to total document
        const thumbHeight = Math.max(30, (viewHeight / docHeight) * trackHeight);
        // Thumb position = scroll ratio * remaining track space
        const maxScroll = docHeight - viewHeight;
        const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;
        const thumbTop = scrollRatio * (trackHeight - thumbHeight);

        thumb.style.height = thumbHeight + 'px';
        thumb.style.transform = 'translateY(' + thumbTop + 'px)';
    }

    // Update on native scroll (fallback) and on Lenis scroll events
    window.addEventListener('scroll', updateThumb, { passive: true });
    if (typeof lenis !== 'undefined') {
        lenis.on('scroll', updateThumb);
    }
    window.addEventListener('resize', updateThumb);

    // Drag support — dragging the thumb scrolls the page
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollY = 0;

    thumb.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartY = e.clientY;
        dragStartScrollY = window.scrollY;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const trackHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const thumbHeight = Math.max(30, (viewHeight / docHeight) * trackHeight);
        const maxThumbTop = trackHeight - thumbHeight;
        const maxScroll = docHeight - viewHeight;
        const delta = e.clientY - dragStartY;
        const scrollDelta = (delta / maxThumbTop) * maxScroll;
        const newScroll = Math.min(maxScroll, Math.max(0, dragStartScrollY + scrollDelta));
        if (typeof lenis !== 'undefined') {
            lenis.scrollTo(newScroll, { immediate: true });
        } else {
            window.scrollTo({ top: newScroll });
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
        }
    });

    // Click on track (outside thumb) — jump to that position
    track.addEventListener('click', (e) => {
        if (e.target === thumb) return;
        const trackRect = track.getBoundingClientRect();
        const clickRatio = (e.clientY - trackRect.top) / trackRect.height;
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const maxScroll = docHeight - viewHeight;
        const newScroll = Math.min(maxScroll, Math.max(0, clickRatio * maxScroll));
        if (typeof lenis !== 'undefined') {
            lenis.scrollTo(newScroll, { duration: 0.6 });
        } else {
            window.scrollTo({ top: newScroll, behavior: 'smooth' });
        }
    });

    // Initial render
    updateThumb();
})();

// ================================================
// SCROLL TO TOP BUTTON LOGIC
// ================================================
(function () {
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (!scrollToTopBtn) return;

    function updateBtnVisibility() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop > 500) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    }

    // Update on native scroll and Lenis scroll
    window.addEventListener('scroll', updateBtnVisibility, { passive: true });
    if (typeof lenis !== 'undefined') {
        lenis.on('scroll', updateBtnVisibility);
    }

    scrollToTopBtn.addEventListener('click', () => {
        if (typeof lenis !== 'undefined') {
            lenis.scrollTo(0, { duration: 1.5, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    updateBtnVisibility();
})();

const runOnReady = (fn) => {
    if (document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
};

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
// Animate gc-bar progress bars on scroll into view
(function () {
    const bars = document.querySelectorAll('.gc-bar[data-width]');
    if (!bars.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.width = entry.target.dataset.width + '%';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    bars.forEach(bar => observer.observe(bar));
})();

// Reality Check cards — expand from center on scroll in, collapse on scroll out
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const rcCards = gsap.utils.toArray('#reality-check .gc-card');

    gsap.set(rcCards, { scale: 0, opacity: 0, transformOrigin: '50% 50%' });

    ScrollTrigger.create({
        trigger: '#reality-check',
        start: 'top 75%',
        end: 'bottom 25%',
        scrub: 1,
        onUpdate(self) {
            const p = self.progress;
            // First 40% of scroll range: grow in. Last 60%: stay full.
            // On leave (progress back to 0): shrink back.
            const inScale  = Math.min(p / 0.4, 1);
            rcCards.forEach((card, i) => {
                // Stagger: each card starts slightly later
                const staggerOffset = i * 0.06;
                const cardP = Math.max(0, Math.min((p - staggerOffset) / 0.4, 1));
                gsap.set(card, {
                    scale:   cardP,
                    opacity: cardP,
                });
            });
        }
    });
}

// Reality Check — left text column scroll-in animation
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const rcTextEls = gsap.utils.toArray(
        '#reality-check .rc-text-col .rc-badge, ' +
        '#reality-check .rc-text-col .rc-title, ' +
        '#reality-check .rc-text-col .rc-subtitle, ' +
        '#reality-check .rc-text-col .rc-body-text, ' +
        '#reality-check .rc-text-col .lq-cta'
    );

    gsap.set(rcTextEls, { y: 40, opacity: 0 });

    ScrollTrigger.create({
        trigger: '#reality-check .rc-text-col',
        start: 'top 80%',
        once: true,
        onEnter() {
            gsap.to(rcTextEls, {
                y: 0,
                opacity: 1,
                duration: 0.7,
                ease: 'power3.out',
                stagger: 0.12
            });
        }
    });
}
