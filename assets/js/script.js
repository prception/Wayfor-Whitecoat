// new.js

// ScrollTrigger silently sets history.scrollRestoration = "manual" the first
// time it writes the viewport scroll (every refresh() does), so the browser
// never restores the position on reload. Persist the position ourselves and
// re-apply it on reload / back-forward; afterLoad() then locks the pinned hero
// animation into the correct phase for wherever the page lands.
const SCROLL_RESTORE_KEY = 'wfwc-scroll:' + location.pathname;
window.addEventListener('pagehide', () => {
    try {
        // Save the position as a FRACTION of the total scrollable height, not an
        // absolute pixel Y. The page has several pinned sections whose spacer
        // heights change with viewport width (hero pin, reality word-reveal,
        // editorial panel all use width-dependent pin durations), so an absolute
        // Y saved on one screen size points to a different section on another.
        // A ratio re-maps correctly onto whatever the current layout's height is.
        const scrollTop = window.scrollY || window.pageYOffset || 0;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0;
        sessionStorage.setItem(SCROLL_RESTORE_KEY, String(ratio));
    } catch (e) { /* storage unavailable */ }
});
// Returns the saved fraction (0–1) of scroll progress, or -1 if there is none
// / restoration shouldn't happen. Callers convert this to pixels against the
// CURRENT layout height so it lands on the right section at any screen size.
function getSavedScrollRatio() {
    try {
        const nav = performance.getEntriesByType('navigation')[0];
        // Only restore on reload / back-forward — a fresh link navigation
        // should start at the top like the browser's native behaviour.
        if (!nav || (nav.type !== 'reload' && nav.type !== 'back_forward')) return -1;
        const r = parseFloat(sessionStorage.getItem(SCROLL_RESTORE_KEY));
        return isNaN(r) ? -1 : Math.min(1, Math.max(0, r));
    } catch (e) {
        return -1;
    }
}
// Convert the saved ratio to a pixel offset against the current document height.
function getSavedScrollY() {
    const ratio = getSavedScrollRatio();
    if (ratio < 0) return 0;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return ratio * maxScroll;
}

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

// In-page anchor links (e.g. hero "Book a Consultation" → #contact): Lenis
// re-applies its own animated scroll position every frame, which swallows the
// browser's native hash jump — route the scroll through Lenis instead.
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (hash.length < 2) return; // bare "#"
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();

    const jumpTo = () => {
        const y = target.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop);
        // Lenis caches its own max-scroll limit and clamps scrollTo() to it.
        // That limit was measured BEFORE ScrollTrigger's pin spacers grew the
        // page, so for a late target like #contact Lenis clamps far short — and
        // because its RAF loop keeps writing that clamped value back every frame,
        // it drags a native window.scrollTo() back up into the reality-section.
        // Force Lenis to re-measure the (now taller) page first, THEN scroll.
        if (lenis) {
            if (typeof lenis.resize === 'function') lenis.resize();
            lenis.scrollTo(y, { immediate: true, force: true });
        }
        window.scrollTo(0, y);
    };

    if (window.matchMedia('(max-width: 1024px)').matches) {
        // Mobile/tablet: the URL bar collapses during a long animated scroll,
        // resizing every 100vh section mid-flight — the pre-computed destination
        // lands off-target and then visibly snaps. Jump instantly instead, and
        // re-align once the browser chrome / layout has settled.
        //
        // The bigger problem for late targets like #contact: several
        // ScrollTrigger `pin: true` sections sit between the hero and #contact,
        // and their pin spacers inflate the page height. If we jump before that
        // layout is measured, we land *inside* the reality-section (the first
        // pinned block). So: refresh ScrollTrigger to lay out the pin spacers,
        // let Lenis re-measure the taller page (inside jumpTo), then jump — and
        // keep re-aligning until the target actually sits at the top, because
        // the URL-bar/pin layout keeps settling for several frames.
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();

        // Two things try to yank scroll away from #contact after we arrive:
        //   1. Lenis re-applies its own (stale, clamped) scroll every RAF frame.
        //   2. When the mobile URL bar collapses it fires a resize, and
        //      ScrollTrigger.refresh() then RESTORES scroll to preserve a pinned
        //      section's progress — pulling us back up to the section above.
        // The old loop ran on a fixed timer and released too early, so a late
        // refresh (2) snapped the page back after the loop had finished.
        //
        // Fix: stop Lenis, and keep re-jumping on EVERY ScrollTrigger refresh
        // for a short window so any late URL-bar refresh is immediately undone.
        // Then resync Lenis and resume.
        if (lenis && typeof lenis.stop === 'function') lenis.stop();
        jumpTo();

        const onRefresh = () => jumpTo();
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.addEventListener('refresh', onRefresh);
        }

        let tries = 0;
        const hold = () => {
            jumpTo();
            if (++tries < 18) {           // ~1.8s of holding through settle
                setTimeout(hold, 100);
                return;
            }
            // Release: stop undoing refreshes and hand control back to Lenis at
            // the final resting position.
            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.removeEventListener('refresh', onRefresh);
            }
            if (lenis) {
                const finalY = window.scrollY || document.documentElement.scrollTop;
                if (typeof lenis.resize === 'function') lenis.resize();
                if (typeof lenis.scrollTo === 'function') lenis.scrollTo(finalY, { immediate: true, force: true });
                if (typeof lenis.start === 'function') lenis.start();
            }
        };
        setTimeout(hold, 100);
    } else if (lenis) {
        lenis.scrollTo(target, { duration: 1.4 });
    } else {
        target.scrollIntoView({ behavior: 'smooth' });
    }
});

const canvas = document.getElementById('webgl-canvas');
const sizes = { width: window.innerWidth, height: window.innerHeight };
const hasWebGL = typeof THREE !== 'undefined' && canvas;

// Setup Pins (Lat, Lng)
const locations = [
    { id: 'pin-russia', lat: 58.7558, lng: 37.6173, name: 'Russia', page: 'countries/MBBS-in-Russia.html', desc: 'Experience world-class medical education with advanced facilities and highly affordable tuition fees.' },
    { id: 'pin-kazakhstan', lat: 54.0000, lng: 70.0000, name: 'Kazakhstan', page: 'countries/MBBS-In-Kazakhstan.html', desc: 'A modern hub for international medical students offering WHO-approved programs in English.' },
    { id: 'pin-uzbekistan', lat: 41.4000, lng: 64.6000, name: 'Uzbekistan', page: 'countries/MBBS-in-Uzbekistan.html', desc: 'Rich in history and culture, offering top-tier medical universities with a secure environment.' },
    { id: 'pin-kyrgyzstan', lat: 41.2000, lng: 74.8000, name: 'Kyrgyzstan', page: 'countries/MBBS-in-Kyrgyzstan.html', desc: 'Affordable medical study options with English medium instruction and great clinical exposure.' },
    { id: 'pin-georgia', lat: 42.3154, lng: 43.3569, name: 'Georgia', page: 'countries/MBBS-in-Georgio.html', desc: 'A rising star in European medical education with high USMLE pass rates and excellent infrastructure.' },
    { id: 'pin-egypt', lat: 26.8206, lng: 30.8025, name: 'Egypt', page: 'countries/MBBS-in-Egypt.html', desc: 'Study medicine with a rich heritage and world-recognized universities in a global crossroads.' },
    { id: 'pin-tajikistan', lat: 38.9000, lng: 71.3000, name: 'Tajikistan', page: 'countries/MBBS-in-Tajikistan.html', desc: 'Emerging destination for affordable and high-quality medical education with hands-on practice.' },
    { id: 'pin-bangladesh', lat: 23.7000, lng: 90.4000, name: 'Bangladesh', page: 'countries/MBBS-in-Bangladesh.html', desc: 'FMGE-friendly curriculum with a similar clinical and disease pattern to India for best practice.' },
    { id: 'pin-nepal', lat: 28.2000, lng: 84.0000, name: 'Nepal', page: 'countries/MBBS-In-Nepal.html', desc: 'Study close to home with top-ranking medical institutions recognized globally.' }
];

let latLongToVector3 = () => { return { x: 0, y: 0, z: 0 }; };
let updateHTMLPins = () => {};

let scene, camera, renderer, globeGroup, standGroup, globeMesh, standMaterial, material, cornerLight;
let colorWhiteState, colorDimState;
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
    // Realistic Earth color texture — blue-marble for its rich green land,
    // with the dark oceans recolored below via the water mask.
    // NOTE: built manually (not via textureLoader.load) so nothing else ever
    // writes earthTexture.image — a TextureLoader callback racing the canvas
    // composite used to overwrite the navy oceans on warm-cache reloads.
    const earthTexture = new THREE.Texture();

    // Composite a navy tint over water areas only (mask: white = ocean),
    // so the land keeps its original colors while oceans get recolored
    const marbleImg = new Image();
    const waterImg = new Image();
    marbleImg.crossOrigin = waterImg.crossOrigin = 'anonymous';
    let earthLayersLoaded = 0;
    const lightenOceans = () => {
        if (++earthLayersLoaded < 2) return;
        const compCanvas = document.createElement('canvas');
        compCanvas.width = marbleImg.naturalWidth;
        compCanvas.height = marbleImg.naturalHeight;
        const ctx = compCanvas.getContext('2d');
        ctx.drawImage(marbleImg, 0, 0);

        const tintCanvas = document.createElement('canvas');
        tintCanvas.width = compCanvas.width;
        tintCanvas.height = compCanvas.height;
        const tctx = tintCanvas.getContext('2d');
        tctx.drawImage(waterImg, 0, 0, tintCanvas.width, tintCanvas.height);
        tctx.globalCompositeOperation = 'multiply';
        tctx.fillStyle = '#1e3a8a'; // deep navy ocean
        tctx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);

        // 'lighten' raises the near-black oceans up to the navy tint; land areas
        // (black in the tint layer) pass through unchanged
        ctx.globalCompositeOperation = 'lighten';
        ctx.drawImage(tintCanvas, 0, 0);

        earthTexture.image = compCanvas;
        earthTexture.needsUpdate = true;
    };
    marbleImg.onload = () => {
        // Show the base map as soon as it arrives so the globe isn't blank,
        // then the composite below replaces it once the mask is also ready
        earthTexture.image = marbleImg;
        earthTexture.needsUpdate = true;
        lightenOceans();
    };
    waterImg.onload = lightenOceans;
    marbleImg.src = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
    waterImg.src = 'https://unpkg.com/three-globe/example/img/earth-water.png';

    // Initial state shows the Earth texture slightly dimmed so the small desk globe isn't too bright
    colorWhiteState = new THREE.Color(0xc8c8c8);
    colorDimState = new THREE.Color(0x5a5a5a); // strong dim for the enlarged globe

    material = new THREE.MeshStandardMaterial({
        color: colorWhiteState,
        map: earthTexture,
        roughness: 0.55,   // Matte enough for the texture to read naturally
        metalness: 0.1,
        // Soft self-illumination lifts the texture's dark oceans without washing out the scene
        emissive: new THREE.Color(0xffffff),
        emissiveMap: earthTexture,
        emissiveIntensity: 0.26,
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
    const initialX = isMobileGlobe ? 0.85 : isTabletGlobe ? 0.15 : -1.8;
    // The hero image uses `background-size: cover`, so on screens wider than a
    // standard laptop the books rise in the frame while the 3D globe stays at a
    // fixed world Y — leaving the globe floating below them. Laptops (<= 1440px,
    // incl. MacBook Air) keep their tuned -1.6 baseline; only larger monitors lift
    // the globe continuously with viewport width so it keeps resting on the books.
    let desktopY = -1.6;
    if (!isMobileGlobe && !isTabletGlobe && sizes.width > 1440) {
        // Lift ~1.8 units per 1000px of extra width, capped so it never overshoots.
        const lift = Math.min((sizes.width - 1440) * 0.0018, 2.0);
        desktopY = -1.6 + lift;
    }
    const initialY = (isMobileGlobe || isTabletGlobe) ? -1.85 : desktopY;
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

    // Extra highlight on the globe coming down from the upper-right at a steep
    // ~80° angle (almost overhead, nudged slightly to the right). The light
    // follows the globe in the animation loop so the angle stays constant
    // while the globe moves and enlarges on scroll.
    cornerLight = new THREE.DirectionalLight(0xffffff, 0.7);
    const cornerLightOffset = new THREE.Vector3(11, 19, 2.5);
    cornerLight.position.copy(globeGroup.position).add(cornerLightOffset);
    cornerLight.target = globeGroup;
    scene.add(cornerLight);

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
        // Keep the corner light at the same upper-right angle relative to the
        // globe, even while the globe moves and scales during the scroll.
        cornerLight.position.copy(globeGroup.position).add(cornerLightOffset);

        // Keep the small desk globe gently rotating at all scroll positions.
        // (Previously it snapped to a fixed angle once the enlarge transition
        // began; the globe no longer expands, so it just keeps spinning.)
        globeMesh.rotation.y += 0.015;

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
        // On phones/tablets the address bar collapsing while scrolling fires a
        // height-only resize; re-projecting the camera then makes the globe
        // visibly jump. Ignore height-only resizes on touch devices — only a
        // real width change (rotation, split-screen) re-projects.
        const isTouch = window.matchMedia('(pointer: coarse)').matches;
        if (isTouch && window.innerWidth === sizes.width) return;
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
            anticipatePin: 1, // pre-pin on touch scroll so the hero (globe) doesn't slide before the pin catches
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
                // Stand stays visible in phase 2 now (globe no longer expands),
                // so no stand-state reset is needed here.
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

    // Fade out Vignette.
    tl.to(".img-vignette", { opacity: 0, duration: 0.8, ease: "power2.inOut" }, step2Start);

    // Fade the globe out entirely — it should ONLY be visible in the hero (phase 1).
    // Fades the whole WebGL layer (globe + stand) so nothing lingers into phase 2.
    tl.to(".webgl-container", {
        opacity: 0,
        duration: 0.6,
        ease: "power2.inOut",
        onReverseComplete: () => {
            gsap.set(".webgl-container", { opacity: 1 });
        }
    }, step2Start);

    // Fly Initial Text up and fade out.
    // fromTo with explicit start values: a plain .to() lazily captures whatever
    // opacity the elements happen to have on its first render — if that happens
    // while the load intro still has them hidden, the tween locks in 0→0 and the
    // hero content can never reappear when scrolling back.
    tl.fromTo(".initial-text", { opacity: 1, y: 0 }, {
        opacity: 0,
        y: -50,
        duration: 0.6,
        immediateRender: false,
        onReverseComplete: () => {
            gsap.set(".initial-text", { opacity: 1, y: 0 });
        }
    }, step2Start);

    // Fade out floating hero cards
    tl.fromTo(".initial-text-cards", { opacity: 1, y: 0 }, {
        opacity: 0,
        y: 30,
        duration: 0.5,
        immediateRender: false,
        onReverseComplete: () => {
            gsap.set(".initial-text-cards", { opacity: 1, y: 0 });
        }
    }, step2Start);

    // NOTE: The globe expansion (camera pull-back, move-to-center, massive
    // scale-up, reorientation, and dimming) was intentionally removed. The globe
    // now stays small in its desk position and keeps only its idle rotation
    // (handled in the animation loop). The destination panel replaces the old
    // enlarged-Earth backdrop, so no expand/zoom transition is needed.

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

    // Globe pins are no longer revealed — the destination panel replaces the
    // old globe-pin picker, and the small globe stays behind the opaque panel.
    // Keep the container hidden and pin projection off.
    if (typeof pinsVisible !== 'undefined') pinsVisible = false;
    (function hideGlobePins() {
        const pinsContainer = document.getElementById('html-pins-container');
        if (pinsContainer) pinsContainer.style.opacity = '0';
    })();

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
        carouselAutoScrollTimer = setInterval(moveToNextCountry, 2000);
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
    }, 2000);
}

function stopMobilePinRotation() {
    clearInterval(mobilePinTimer);
    mobilePinTimer = null;
}

// ==============================================
// 6b. Destination — Split list + live preview
// ==============================================
// Extra display data keyed by country name. Cost bands are indicative —
// replace with official figures. Images reuse the university photos.
const DEST_DISPLAY = {
    'Russia':      { cost: '₹20–30L', univ: '12', img: 'assets/images/universities/kazan-federal.jpg' },
    'Kazakhstan':  { cost: '₹18–25L', univ: '8',  img: 'assets/images/universities/al-farabi.jpg' },
    'Uzbekistan':  { cost: '₹18–26L', univ: '5',  img: 'assets/images/universities/tashkent-medical.jpg' },
    'Kyrgyzstan':  { cost: '₹15–22L', univ: '6',  img: 'assets/images/universities/bishkek-kyrgyz.jpg' },
    'Georgia':     { cost: '₹25–35L', univ: '9',  img: 'assets/images/universities/tbilisi-state.jpg' },
    'Egypt':       { cost: '₹22–30L', univ: '7',  img: 'assets/images/universities/cairo-kasr-alainy.jpg' },
    'Tajikistan':  { cost: '₹14–20L', univ: '4',  img: 'assets/images/universities/avicenna-tajik.jpg' },
    'Bangladesh':  { cost: '₹25–40L', univ: '10', img: 'assets/images/universities/dhaka-national.jpg' },
    'Nepal':       { cost: '₹40–60L', univ: '6',  img: 'assets/images/universities/kathmandu-dhulikhel.jpg' },
};
const FLAG_CODE = {
    'Russia': 'ru', 'Kazakhstan': 'kz', 'Uzbekistan': 'uz', 'Kyrgyzstan': 'kg',
    'Georgia': 'ge', 'Egypt': 'eg', 'Tajikistan': 'tj', 'Bangladesh': 'bd', 'Nepal': 'np',
};

(function initDestSplit() {
    const dsList = document.getElementById('dsList');
    const dsPreview = document.getElementById('dsPreview');
    if (!dsList || !dsPreview) return;

    const items = locations.map((loc) => {
        const extra = DEST_DISPLAY[loc.name] || {};
        return { ...loc, flag: FLAG_CODE[loc.name] || '', cost: extra.cost || '', univ: extra.univ || '', img: extra.img || '' };
    });

    let currentDest = 0;

    // Build list + preloaded preview images
    items.forEach((d, i) => {
        const item = document.createElement('div');
        item.className = 'ds-item' + (i === 0 ? ' active' : '');
        item.innerHTML =
            '<span class="ds-left"><img class="ds-flag" src="https://flagcdn.com/' + d.flag + '.svg" alt="">' + d.name + '</span>' +
            '<span class="ds-arrow">&#8594;</span>' +
            '<span class="ds-progress"></span>';
        // Manual hover/click selects and pauses the auto-cycle. Listen for
        // mousemove (not mouseenter) so an item that merely scrolls under a
        // stationary pointer doesn't hijack the selection.
        item.addEventListener('mousemove', () => { if (currentDest !== i) setDest(i); });
        item.addEventListener('click', () => setDest(i));
        dsList.appendChild(item);

        const img = document.createElement('div');
        img.className = 'ds-img' + (i === 0 ? ' show' : '');
        img.style.backgroundImage = "url('" + d.img + "')";
        img.dataset.index = i;
        dsPreview.appendChild(img);
    });

    const body = document.createElement('div');
    body.className = 'ds-pbody';
    dsPreview.appendChild(body);

    // Counter chip (01 / 09) and big outlined country name over the photo
    const counter = document.createElement('div');
    counter.className = 'ds-counter';
    dsPreview.appendChild(counter);

    const ghost = document.createElement('div');
    ghost.className = 'ds-ghost';
    dsPreview.appendChild(ghost);

    function setDest(i) {
        currentDest = i;
        const d = items[i];
        Array.from(dsList.children).forEach((c, ci) => c.classList.toggle('active', ci === i));
        dsPreview.querySelectorAll('.ds-img').forEach((img) => img.classList.toggle('show', +img.dataset.index === i));
        body.innerHTML =
            '<div class="ds-flagname"><img src="https://flagcdn.com/' + d.flag + '.svg" alt=""><span class="ds-name">' + d.name + '</span></div>' +
            '<div class="ds-stats">' +
                '<div class="ds-stat"><b>' + d.cost + '</b><small>Total est.</small></div>' +
                '<div class="ds-stat"><b>' + d.univ + '</b><small>Universities</small></div>' +
                '<div class="ds-stat"><b>6 Yrs</b><small>Duration</small></div>' +
            '</div>' +
            '<a class="ds-cta" href="' + d.page + '">View Details &#8594;</a>';
        // Update counter and ghost name, restarting their entrance animations.
        counter.innerHTML = '<b>' + String(i + 1).padStart(2, '0') + '</b> / ' + String(items.length).padStart(2, '0');
        ghost.textContent = d.name;
        // Restart the staggered caption + ghost entrance animations on every change.
        body.classList.remove('ds-animate');
        ghost.classList.remove('ds-animate');
        void body.offsetWidth; // force reflow so the animations replay
        body.classList.add('ds-animate');
        ghost.classList.add('ds-animate');
    }
    setDest(0);

    // Auto-cycle: advance to the next country every 2s. Pauses while the user
    // hovers the list or preview, and resumes on leave.
    let autoTimer = null;
    function startAuto() {
        if (autoTimer) return;
        dsList.classList.remove('ds-paused');
        // Restart the countdown bar from zero so it matches the fresh 2s window.
        const bar = dsList.children[currentDest] && dsList.children[currentDest].querySelector('.ds-progress');
        if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
        autoTimer = setInterval(() => {
            setDest((currentDest + 1) % items.length);
        }, 2000);
    }
    function stopAuto() {
        if (!autoTimer) return; // already paused (stopAuto fires on every mousemove)
        clearInterval(autoTimer);
        autoTimer = null;
        dsList.classList.add('ds-paused'); // freezes the countdown bar
    }
    [dsList, dsPreview].forEach((el) => {
        // Pause on mousemove rather than mouseenter: when the section scrolls
        // under a stationary pointer the browser fires mouseenter, which would
        // freeze the auto-cycle; a real hover always produces mousemove.
        el.addEventListener('mousemove', stopAuto);
        el.addEventListener('mouseleave', startAuto);
    });
    startAuto();
})();

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
console.log('[hero] script.js running. gsap loaded?', typeof gsap !== 'undefined');
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

    // --- Early hero intro (top of page only) -------------------------------
    // The hero text / cards / nav don't depend on any image, so animate them in
    // as soon as the DOM + GSAP are ready instead of waiting for window 'load'
    // (which blocks on the ~2MB hero image). Removes the visible hero lag.
    let introStarted = false;
    const buildHeroIntro = () => {
        if (introStarted) { console.log('[hero] skip: already started'); return; }
        if (getSavedScrollY() > 0 || window.scrollY > 0) { console.log('[hero] skip: not at top', window.scrollY, getSavedScrollY()); return; }
        if (!document.getElementById('pinned-container')) { console.log('[hero] skip: no pinned-container'); return; }
        if (!document.querySelector('.image-hero-title')) { console.log('[hero] skip: no title'); return; }
        if (!document.querySelector('.nav-brand-corner')) { console.log('[hero] skip: no nav'); return; }
        introStarted = true;
        console.log('[hero] BUILDING intro animation');

        // Split hero title into words for the cinematic reveal animation
        const heroTitleEl = document.querySelector('.image-hero-title');
        if (heroTitleEl) {
            const text = heroTitleEl.innerHTML;
            const words = text.split(/(<br.*?>)/);
            heroTitleEl.innerHTML = words.map(w => {
                if (w.includes('<br')) return w;
                return ` <span class="hero-word" style="display:inline-block; opacity:0; transform:translateY(20px)">${w}</span>`;
            }).join('');
        }

        // Set explicit hidden states via GSAP inline styles, THEN drop the CSS
        // pre-paint hide so its `opacity:0 !important` can't fight the tween. Order
        // matters: set-hidden before class-removal means no flash of visible content.
        gsap.set(["#nav-wrapper", ".nav-brand-corner", ".nav-cta-corner",
                  ".hero-word", ".image-hero-subtitle", ".hero-cta-btn",
                  ".hero-card-bl", ".hero-card-br"], { opacity: 0 });
        gsap.set(".image-hero-title", { opacity: 1 }); // container shown; words carry the reveal
        document.documentElement.classList.remove('hero-prep');

        // One coordinated reveal — fromTo with explicit start values so it animates
        // regardless of whatever opacity the elements happen to have right now.
        introTl.fromTo("#nav-wrapper",
            { y: -20, opacity: 0, visibility: 'visible' },
            { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0)
            .fromTo([".nav-brand-corner", ".nav-cta-corner"],
                { y: -10, opacity: 0, visibility: 'visible' },
                { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0)
            .fromTo(".hero-word",
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, ease: "power3.out" }, 0.05)
            .fromTo(".image-hero-subtitle",
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.05)
            .fromTo(".hero-cta-btn",
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.05)
            .fromTo(".hero-card-bl",
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.1)
            .fromTo(".hero-card-br",
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.1);
        console.log('[hero] PLAY — timeline duration:', introTl.duration(), 'words:', document.querySelectorAll('.hero-word').length);
        introTl.play(0);
    };

    // The hero background image paints on its own (CSS, preloaded high-priority) as
    // the first thing on screen. The content (nav, text, button, cards) lifts in over
    // it as soon as GSAP + DOM are ready — no need to gate on the image, so there's
    // no blank/coloured frame before the picture shows.
    const startHeroIntro = () => { buildHeroIntro(); };
    // Fire as soon as DOM is parsed; if header loads async, retry on its event.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startHeroIntro);
    } else {
        startHeroIntro();
    }
    document.addEventListener('headerLoaded', startHeroIntro);

    window.addEventListener('load', () => {
        const preloader = document.getElementById('preloader');

        // Re-apply the saved position before anything below reads window.scrollY.
        // We hold onto the saved RATIO (0–1) and convert it to pixels against the
        // live document height each time we seek — the height is still growing as
        // pin spacers settle, so a ratio stays correct where an absolute Y wouldn't.
        const restoreRatio = getSavedScrollRatio();
        const restoreYNow = () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            return restoreRatio * maxScroll;
        };
        if (restoreRatio > 0) {
            const y = restoreYNow();
            if (typeof lenis !== 'undefined' && lenis) {
                lenis.scrollTo(y, { immediate: true, force: true });
            } else {
                window.scrollTo(0, y);
            }
        }

        const afterLoad = () => {
            if (window.scrollY <= 0) {
                // The hero intro already started early (gated on the decoded hero
                // image). By 'load' the image is certainly ready, so force the build
                // directly as a fallback, then add the WebGL globe scale-in.
                buildHeroIntro();

                // Loading at the top — animate the globe scale-in. Run it as its own
                // tween (not appended to introTl, which may already have finished by
                // the time WebGL is ready) so it always plays.
                if (hasWebGL) {
                    globeGroup.scale.set(0.001, 0.001, 0.001);
                    standGroup.scale.set(0.001, 0.001, 0.001);
                    gsap.fromTo(
                        [globeGroup.scale, standGroup.scale],
                        { x: 0.001, y: 0.001, z: 0.001 },
                        { x: 0.18, y: 0.18, z: 0.18, duration: 1.4, ease: "power4.out", delay: 0.1 }
                    );
                }
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
                const pinnedEl = document.getElementById('pinned-container');
                const pinTop = pinnedEl ? pinnedEl.offsetTop : 0;
                const pinScrollLength = 600;
                const pinBottom = pinTop + pinScrollLength;

                if (window.scrollY >= pinBottom) {
                    // Fully past the hero pin — lock into phase-2 end state.
                    // Globe no longer expands: keep it small on the desk with the
                    // stand visible, pins off, normal (undimmed) colour.
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
                        material.roughness = 0.55;
                        material.metalness = 0.1;
                        material.emissiveIntensity = 0.26;
                        pinsVisible = false;
                        const pinsContainer = document.getElementById('html-pins-container');
                        if (pinsContainer) pinsContainer.style.opacity = '0';
                    }
                    // Globe is hidden in phase 2 — it only shows in the hero.
                    gsap.set(".webgl-container", { opacity: 0 });
                    // Also set final-text visible and initial-text hidden for this state
                    gsap.set(".final-text", { opacity: 1, y: 0 });
                    gsap.set([".initial-text", ".initial-text-cards"], { opacity: 0 });
                } else {
                    // Mid-scrub inside the pin — reset to phase-1 baseline so
                    // ScrollTrigger.refresh() can scrub to the correct progress.
                    // Hero text/cards must start VISIBLE here: the scrubbed timeline
                    // hides them itself if the restored progress is past the fade-out.
                    gsap.set([".initial-text", ".initial-text-cards"], { opacity: 1, y: 0 });
                    // Globe visible in the hero (phase 1).
                    gsap.set(".webgl-container", { opacity: 1 });
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
                        material.roughness = 0.55;
                        material.metalness = 0.1;
                        material.emissiveIntensity = 0.26;
                    }
                }
            }

            // Refresh ScrollTrigger after state is fully set
            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.refresh();
                requestAnimationFrame(() => ScrollTrigger.update());

                // ScrollTrigger.refresh() re-measures every pin spacer, and those
                // spacer heights differ per breakpoint (hero pin, reality, editorial
                // all use width-dependent pin durations). The early restore at the top
                // of 'load' ran against pre-refresh offsets, so on larger/smaller
                // screens the saved position could land in the wrong section. Re-assert
                // it now that the final layout is settled — recomputing pixels from the
                // saved ratio against the freshly-measured document height.
                if (restoreRatio > 0) {
                    const reapply = () => {
                        const y = restoreYNow();
                        if (typeof lenis !== 'undefined' && lenis) {
                            lenis.scrollTo(y, { immediate: true, force: true });
                        } else {
                            window.scrollTo(0, y);
                        }
                        ScrollTrigger.update();
                    };
                    // Two rafs: let refresh's layout writes flush before we re-seek.
                    requestAnimationFrame(() => requestAnimationFrame(reapply));
                }
            }
        };

        if (preloader) {
            // Wait for 3D textures and buffering to completely clear
            setTimeout(() => {
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
            // No preloader — just remove the body lock; scroll stays where the
            // browser restored it and afterLoad() handles that position
            document.body.classList.remove('preloader-active');
            afterLoad();
        }
    });
} else {
    // Fallback if GSAP is not loaded
    window.addEventListener('load', () => {
        const restoreY = getSavedScrollY();
        if (restoreY > 0) window.scrollTo(0, restoreY);
        const preloader = document.getElementById('preloader');
        if (preloader) {
            setTimeout(() => {
                document.body.classList.remove('preloader-active');
                preloader.style.opacity = '0';
                setTimeout(() => {
                    preloader.style.display = 'none';
                }, 2500);
            }, 1500);
        } else {
            document.body.classList.remove('preloader-active');
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

    // Coalesce to one check per frame — bound to both window + Lenis scroll,
    // which on mobile fire for the same native scroll.
    let navTicking = false;
    function requestNavCheck() {
        if (navTicking) return;
        navTicking = true;
        requestAnimationFrame(() => {
            navTicking = false;
            checkNavVisibility();
        });
    }

    window.addEventListener('scroll', requestNavCheck, { passive: true });
    if (typeof lenis !== 'undefined') {
        lenis.on('scroll', requestNavCheck);
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

    // On mobile (smoothTouch:false) Lenis still emits a scroll event for every
    // native scroll, so binding the same handler to both window and Lenis runs
    // it twice per frame — and each run forces a reflow (reads scrollHeight).
    // Coalesce to at most one update per animation frame.
    let thumbTicking = false;
    function requestThumbUpdate() {
        if (thumbTicking) return;
        thumbTicking = true;
        requestAnimationFrame(() => {
            thumbTicking = false;
            updateThumb();
        });
    }

    // Update on native scroll (fallback) and on Lenis scroll events
    window.addEventListener('scroll', requestThumbUpdate, { passive: true });
    if (typeof lenis !== 'undefined') {
        lenis.on('scroll', requestThumbUpdate);
    }
    window.addEventListener('resize', requestThumbUpdate);

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
        if (scrollTop > 50) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    }

    // Coalesce to one update per frame (bound to both window + Lenis scroll).
    let btnTicking = false;
    function requestBtnUpdate() {
        if (btnTicking) return;
        btnTicking = true;
        requestAnimationFrame(() => {
            btnTicking = false;
            updateBtnVisibility();
        });
    }

    // Update on native scroll and Lenis scroll
    window.addEventListener('scroll', requestBtnUpdate, { passive: true });
    if (typeof lenis !== 'undefined') {
        lenis.on('scroll', requestBtnUpdate);
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
