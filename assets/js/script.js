// new.js

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
}

const canvas = document.getElementById('webgl-canvas');
const sizes = { width: window.innerWidth, height: window.innerHeight };
const hasWebGL = typeof THREE !== 'undefined' && canvas;

// Setup Pins (Lat, Lng)
const locations = [
    { id: 'pin-russia', lat: 58.7558, lng: 37.6173, name: 'Russia', desc: 'Experience world-class medical education with advanced facilities and highly affordable tuition fees.' },
    { id: 'pin-kazakhstan', lat: 54.0000, lng: 70.0000, name: 'Kazakhstan', desc: 'A modern hub for international medical students offering WHO-approved programs in English.' },
    { id: 'pin-uzbekistan', lat: 41.0000, lng: 56.0000, name: 'Uzbekistan', desc: 'Rich in history and culture, offering top-tier medical universities with a secure environment.' },
    { id: 'pin-kyrgyzstan', lat: 43.0000, lng: 82.0000, name: 'Kyrgyzstan', desc: 'Affordable medical study options with English medium instruction and great clinical exposure.' },
    { id: 'pin-georgia', lat: 42.3154, lng: 43.3569, name: 'Georgia', desc: 'A rising star in European medical education with high USMLE pass rates and excellent infrastructure.' },
    { id: 'pin-egypt', lat: 26.8206, lng: 30.8025, name: 'Egypt', desc: 'Study medicine with a rich heritage and world-recognized universities in a global crossroads.' },
    { id: 'pin-tajikistan', lat: 35.0000, lng: 68.0000, name: 'Tajikistan', desc: 'Emerging destination for affordable and high-quality medical education with hands-on practice.' },
    { id: 'pin-bangladesh', lat: 20.0000, lng: 92.0000, name: 'Bangladesh', desc: 'FMGE-friendly curriculum with a similar clinical and disease pattern to India for best practice.' },
    { id: 'pin-nepal', lat: 30.0000, lng: 82.0000, name: 'Nepal', desc: 'Study close to home with top-ranking medical institutions recognized globally.' }
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
    const initialX = sizes.width > 768 ? -1.8 : -0.2;
    const initialY = -1.6;
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
        renderer.render(scene, camera);

        // Smoothly rotate the earth texture (globeMesh)
        if (scrollProgress < 0.01) {
            // Spin freely on the desk
            globeMesh.rotation.y += 0.015;
        } else {
            // Smoothly snap to the nearest multiple of 2PI so the map and pins align correctly
            const target = Math.round(globeMesh.rotation.y / (Math.PI * 2)) * Math.PI * 2;
            globeMesh.rotation.y += (target - globeMesh.rotation.y) * 0.05; // ease towards target
        }

        // Tiny idle animation once pins are visible
        if (pinsVisible) {
            globeGroup.rotation.y += 0.00025;
            updateHTMLPins();
        }

        // Keep pins aligned with the earth texture rotation if they are visible
        if (pinsVisible && Math.abs(globeMesh.rotation.y % (Math.PI * 2)) > 0.01) {
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
            end: "+=1600",
            pin: true,
            pinSpacing: true,
            scrub: 1.2,
            onUpdate: (self) => {
                scrollProgress = self.progress;
            }
        }
    });

    // ==========================================
    // STEP 1: The Image Crossfade
    // Occurs during the first chunk of the scroll. Hero text & Globe stay untouched.
    // ==========================================
    tl.to(".hero-bg-img-2", {
        opacity: 1,
        duration: 1.5,
        ease: "power1.inOut"
    }, 0); // Starts immediately upon scroll

    // Small pause variable so the user can appreciate the second image before zooming
    const step2Start = 2.0;

    // ==========================================
    // STEP 2: Cinematic Zoom & Dark Transition
    // ==========================================

    // Hide navbar and corner elements as dark phase begins
    tl.to(["#nav-wrapper", ".nav-brand-corner", ".nav-cta-corner"], {
        opacity: 0,
        pointerEvents: "none",
        duration: 0.4,
        ease: "power2.inOut",
        onReverseComplete: () => {
            gsap.set(["#nav-wrapper", ".nav-brand-corner", ".nav-cta-corner"], { opacity: 1, pointerEvents: "auto" });
        }
    }, step2Start);

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
        tl.to(standMaterial, { opacity: 0, duration: 0.8, ease: "power2.inOut" }, step2Start);
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

        tl.fromTo(globeGroup.scale,
            { x: 0.18, y: 0.18, z: 0.18 },
            { x: 0.68, y: 0.68, z: 0.68, duration: 1.2, ease: "power2.inOut" },
        step2Start);

        // Rotate the globe so Central Asia/Eurasia faces the camera perfectly
        tl.to(globeGroup.rotation, {
            y: Math.PI * 1.02,
            x: Math.PI * 0.15,
            duration: 1.2,
            ease: "power2.inOut",
            onUpdate: () => {
                if (pinsVisible) updateHTMLPins();
            },
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

// ==============================================
// 7. Preloader Logic & GSAP Entrance Animations
// ==============================================
if (typeof gsap !== 'undefined') {
    // Hide hero elements immediately to prevent flash before animation
    gsap.set("#nav-wrapper", { y: -30, opacity: 0 });
    gsap.set(".image-hero-subtitle", { y: 30, opacity: 0 });
    gsap.set(".hero-cta-btn", { y: 20, opacity: 0 });
    gsap.set(".hero-card-bl", { y: 30, opacity: 0 });
    gsap.set(".hero-card-br", { y: 30, opacity: 0 });

    // Set up the entrance timeline
    const introTl = gsap.timeline({ paused: true });

    // Check if we need to split title for cinematic effect
    const heroTitleEl = document.querySelector('.image-hero-title');
    if (heroTitleEl) {
        const text = heroTitleEl.innerHTML;
        const words = text.split(/(<br.*?>)/);
        heroTitleEl.innerHTML = words.map(w => {
            if (w.includes('<br')) return w;
            return ` <span class="hero-word" style="display:inline-block; opacity:0; transform:translateY(30px)">${w}</span>`;
        }).join('');
    }

    if (hasWebGL) {
        introTl.fromTo([globeGroup.scale, standGroup.scale], { x: 0.001, y: 0.001, z: 0.001 }, { x: 0.18, y: 0.18, z: 0.18, duration: 2.5, ease: "power4.out" }, 0.2);
    }
    introTl.to("#nav-wrapper", { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" }, 0.5)
        .to(".hero-word", { y: 0, opacity: 1, duration: 1.2, stagger: 0.1, ease: "power4.out" }, 0.7)
        .to(".image-hero-subtitle", { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" }, 1.1)
        .to(".hero-cta-btn", { y: 0, opacity: 1, duration: 1, ease: "power2.out" }, 1.3)
        .to(".hero-card-bl", { y: 0, opacity: 1, duration: 0.9, ease: "power2.out" }, 1.5)
        .to(".hero-card-br", { y: 0, opacity: 1, duration: 0.9, ease: "power2.out" }, 1.65);

    window.addEventListener('load', () => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            // Wait for 3D textures and buffering to completely clear
            setTimeout(() => {
                // Fade out preloader
                gsap.to(preloader, {
                    opacity: 0,
                    duration: 2.5,
                    ease: "power2.inOut",
                    onComplete: () => {
                        preloader.style.display = 'none';
                    }
                });

                // Simultaneously play entrance animations so elements rise beautifully
                introTl.play();

            }, 1500);
        } else {
            introTl.play();
        }
        // Final refresh to lock in page dimensions
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.refresh();
        }
    });
} else {
    // Fallback if GSAP is not loaded
    window.addEventListener('load', () => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            setTimeout(() => {
                preloader.style.opacity = '0';
                setTimeout(() => {
                    preloader.style.display = 'none';
                }, 2500);
            }, 1500);
        }
    });
}

// Reality Check — Liquid Glass Redesign Animations
if (document.querySelector('.reality-section') && typeof gsap !== 'undefined') {

    // Soft blob drift
    gsap.to(".rc-blob-1", { x: 30, y: 20, duration: 8, yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.to(".rc-blob-2", { x: -20, y: -30, duration: 10, yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.to(".rc-blob-3", { x: 15, y: 15, duration: 7, yoyo: true, repeat: -1, ease: "sine.inOut" });

    if (typeof ScrollTrigger !== 'undefined') {
        const rcTl = gsap.timeline({
            scrollTrigger: {
                trigger: ".reality-pipeline",
                start: "top 78%",
            }
        });

        rcTl
            .from(".rc-title", { y: 28, opacity: 0, duration: 0.75, ease: "power3.out" })
            .from(".rc-subtitle", { y: 16, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.5")
            .from(".rc-card-1", { y: 60, opacity: 0, duration: 0.9, ease: "power3.out" }, "-=0.3")
            .from(".rc-card-2", { y: 60, opacity: 0, duration: 0.9, ease: "power3.out" }, "-=0.7")
            .from(".rc-card-3", { y: 60, scale: 0.96, opacity: 0, duration: 1.1, ease: "power3.out" }, "-=0.7")
            .from(".lq-perk", { y: 12, opacity: 0, duration: 0.5, stagger: 0.1, ease: "back.out(2)" }, "-=0.5");

        // Animate progress bars after cards enter
        ScrollTrigger.create({
            trigger: ".reality-pipeline",
            start: "top 70%",
            onEnter: () => {
                document.querySelectorAll('.lq-bar').forEach(bar => {
                    const targetWidth = bar.dataset.width + '%';
                    bar.style.width = targetWidth;
                });
            }
        });
    }

    // 3D tilt on hover
    document.querySelectorAll('.lq-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rx = ((e.clientY - rect.top - cy) / cy) * -6;
            const ry = ((e.clientX - rect.left - cx) / cx) * 6;
            card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px) scale(1.015)`;
            card.style.transition = 'transform 0.12s ease-out';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });
    });
}

// Anatomy Stack Section - Scroll Card Stack
(function () {
    const pinWrap = document.getElementById('anatomy-pin-wrap');
    const cards = gsap.utils.toArray('.anatomy-card');
    if (!pinWrap || !cards.length) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    // Mobile: skip pinning, show cards in normal flow
    if (window.innerWidth <= 991) return;

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
    // Each card transition gets equal scroll distance (600px per card)
    const scrollPerCard = 700;
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

// Hide logo + CTA once user scrolls past the hero section
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const heroCornerEls = ['.nav-brand-corner', '.nav-cta-corner'];

    // The first section after the hero is #reality-check.
    // When it enters the top of the viewport, hide the fixed logo/CTA.
    // When the user scrolls back up into the hero, restore them.
    const postHeroSection = document.querySelector('#reality-check') || document.querySelector('.reality-section');
    if (postHeroSection) {
        ScrollTrigger.create({
            trigger: postHeroSection,
            start: 'top bottom',   // fires as soon as post-hero section enters viewport bottom
            onEnter: () => {
                gsap.to(heroCornerEls, { opacity: 0, pointerEvents: 'none', duration: 0.2, overwrite: true });
            },
            onLeaveBack: () => {
                // user scrolled back up — hero is visible again
                gsap.to(heroCornerEls, { opacity: 1, pointerEvents: 'auto', duration: 0.3, overwrite: true });
            }
        });
    }
}

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

    // Only apply GSAP horizontal scroll on Desktop. Mobile uses native CSS swipe deck.
    if (journeySection && journeyTrack && window.innerWidth > 991) {

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

        // Manual hover override
        item.addEventListener('mouseenter', () => {
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
                gsap.fromTo(targetImg,
                    { scale: 1.05 },
                    { scale: 1, duration: 6, ease: "power1.out" }
                );
            }
        }

        // Premium text entrance animation
        const activeText = item.querySelector('.dossier-body p');
        if (activeText && typeof gsap !== 'undefined') {
            gsap.fromTo(activeText,
                { y: 15, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.2 }
            );
        }

        // Animate SVG drawing (Acts as Timer)
        const activePaths = item.querySelectorAll('svg:nth-child(2) path, svg:nth-child(2) line, svg:nth-child(2) circle');

        if (typeof gsap !== 'undefined') {
            dossierTimer = gsap.to(activePaths, {
                strokeDashoffset: 0,
                duration: 6, // 6 seconds per card
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
            }, 6000);
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
            stagger: 0.1,
            duration: 0.5,
            ease: "power3.out"
        })

            // 2. Reveal the "Trap" (Left Card)
            .from(".comp-col-trap", {
                x: -50,
                opacity: 0,
                duration: 0.5,
                ease: "power3.out"
            }, "<0.1") // Starts 0.1s after header begins

            // 3. SLAM down the "Solution" (Right Card) with a dramatic elastic effect
            .from(".comp-col-solution", {
                scale: 0.8,
                x: 50,
                opacity: 0,
                duration: 0.8,
                ease: "elastic.out(1, 0.6)"
            }, "<0.1") // Starts 0.1s after Trap begins

            // 3.5 POP the VS badge
            .from(".vs-badge", {
                scale: 0,
                rotation: -180,
                opacity: 0,
                duration: 0.4,
                ease: "back.out(1.5)"
            }, "<0.1")

            // 4. Stagger the winning checkmarks for emphasis
            .from(".comp-win-row", {
                x: -20,
                opacity: 0,
                stagger: 0.1,
                duration: 0.4,
                ease: "power2.out"
            }, "-=0.4");
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
