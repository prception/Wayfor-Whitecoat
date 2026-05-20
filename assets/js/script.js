// new.js

gsap.registerPlugin(ScrollTrigger);

const canvas = document.getElementById('webgl-canvas');
const sizes = { width: window.innerWidth, height: window.innerHeight };

// 1. Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 1000);
camera.position.z = 8;
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 2. Create Globe
const globeGroup = new THREE.Group();

const geometry = new THREE.SphereGeometry(1.8, 64, 64);
const textureLoader = new THREE.TextureLoader();
// High quality bump map for the surface
const bumpTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');

// Initial state is white geometric look
const colorWhiteState = new THREE.Color(0xffffff);
const colorBlueState = new THREE.Color(0x0A192F);

const material = new THREE.MeshStandardMaterial({
    color: colorWhiteState,
    roughness: 0.1,    // Glossy finish for premium look
    metalness: 0.7,    // High metalness makes it look like polished silver when white
    bumpMap: bumpTexture,
    bumpScale: 0.08
});
const globeMesh = new THREE.Mesh(geometry, material);
globeGroup.add(globeMesh);



scene.add(globeGroup);

// Initial Position — centered and hidden (scale 0)
globeGroup.position.set(0, 0, 0);
globeGroup.scale.set(0, 0, 0);
globeGroup.rotation.y = -Math.PI / 2;
globeGroup.rotation.x = 0.2;


// Lighting for premium shading
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(5, 3, 5);
scene.add(directionalLight);

// 3. Setup Pins (Lat, Lng)
const locations = [
    { id: 'pin-russia', lat: 55.7558, lng: 37.6173, name: 'Russia', desc: 'Experience world-class medical education with advanced facilities and highly affordable tuition fees.' },
    { id: 'pin-kazakhstan', lat: 48.0196, lng: 66.9237, name: 'Kazakhstan', desc: 'A modern hub for international medical students offering WHO-approved programs in English.' },
    { id: 'pin-uzbekistan', lat: 41.3775, lng: 64.5853, name: 'Uzbekistan', desc: 'Rich in history and culture, offering top-tier medical universities with a secure environment.' },
    { id: 'pin-kyrgyzstan', lat: 41.2044, lng: 74.7661, name: 'Kyrgyzstan', desc: 'Affordable medical study options with English medium instruction and great clinical exposure.' },
    { id: 'pin-georgia', lat: 42.3154, lng: 43.3569, name: 'Georgia', desc: 'A rising star in European medical education with high USMLE pass rates and excellent infrastructure.' },
    { id: 'pin-egypt', lat: 26.8206, lng: 30.8025, name: 'Egypt', desc: 'Study medicine with a rich heritage and world-recognized universities in a global crossroads.' },
    { id: 'pin-tajikistan', lat: 38.8610, lng: 71.2761, name: 'Tajikistan', desc: 'Emerging destination for affordable and high-quality medical education with hands-on practice.' },
    { id: 'pin-bangladesh', lat: 23.6850, lng: 90.3563, name: 'Bangladesh', desc: 'FMGE-friendly curriculum with a similar clinical and disease pattern to India for best practice.' },
    { id: 'pin-nepal', lat: 28.3949, lng: 84.1240, name: 'Nepal', desc: 'Study close to home with top-ranking medical institutions recognized globally.' }
];

function latLongToVector3(lat, lng, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
}

let pinsVisible = false;

// Convert 3D coordinates to CSS left/top values
function updateHTMLPins() {
    if(!pinsVisible) {
        document.getElementById('html-pins-container').style.opacity = '0';
        return;
    }
    
    document.getElementById('html-pins-container').style.opacity = '1';
    const radius = 1.8; // Matches new bigger sphere geometry
    
    locations.forEach(loc => {
        const el = document.getElementById(loc.id);
        if(!el) return;

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
}

// 4. Animation loop
const clock = new THREE.Clock();
function tick() {
    // Idle rotation Ã¢â‚¬â€ speed differs by phase; GSAP overrides during scroll
    globeGroup.rotation.y += pinsVisible ? 0.00025 : 0.002;
    
    if(pinsVisible) {
        updateHTMLPins();
    }
    
    renderer.render(scene, camera);
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


// 5. GSAP Scroll Sequence — "Transition" and "Globe Pin"
// Transition Section Text Reveals
gsap.to(".transition-title", {
    scrollTrigger: {
        trigger: "#transition-section",
        start: "top 60%",
        end: "top 30%",
        scrub: 1
    },
    opacity: 1,
    y: 0,
    duration: 1
});

gsap.to(".transition-subtitle", {
    scrollTrigger: {
        trigger: "#transition-section",
        start: "top 50%",
        end: "top 20%",
        scrub: 1
    },
    opacity: 1,
    y: 0,
    duration: 1
});

// Pin container for 2000px of scroll distance.
const tl = gsap.timeline({
    scrollTrigger: {
        trigger: "#pinned-container",
        start: "top top",
        end: "+=2000",
        pin: true,
        scrub: 1
    }
});

// ═══ Phase 1: Globe scales up from 0 to 1, darkens (0–40%) ═══
tl.to(globeGroup.scale, {
    x: 1, y: 1, z: 1,
    duration: 0.6,
    ease: "power2.inOut"
}, 0);

tl.to(globeGroup.position, {
    x: 0,
    y: -0.6,
    z: 0,
    duration: 0.6,
    ease: "power2.inOut"
}, 0);

// Rotate globe so Central Asia/Eurasia faces the camera
tl.to(globeGroup.rotation, {
    y: Math.PI * 1.02,
    x: Math.PI * 0.15,
    duration: 0.6,
    ease: "power2.inOut",
    onUpdate: () => {
        if(pinsVisible) updateHTMLPins();
    }
}, 0);

// Background transitions from light to dark
tl.to(".dynamic-bg", {
    backgroundColor: "#020617",
    duration: 0.6,
    ease: "none"
}, 0);

// Globe material: white/silver → dark blue
tl.to(material.color, {
    r: colorBlueState.r,
    g: colorBlueState.g,
    b: colorBlueState.b,
    duration: 0.5,
    ease: "none"
}, 0.1);

// ═══ Phase 2: Destination UI appears (50–100%) ═══
tl.to(".final-text", {
    opacity: 1,
    y: 0,
    duration: 0.4
}, 0.4);

tl.to("#html-pins-container", {
    opacity: 1,
    duration: 0.3,
    onStart: () => {
        pinsVisible = true;
    },
    onReverseComplete: () => {
        pinsVisible = false;
        document.getElementById('html-pins-container').style.opacity = '0';
    }
}, 0.7);

// G. About Section High-End Reveals
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

// ==============================================
// 6. Vertical Carousel Integration
// ==============================================
const countryListEl = document.getElementById('country-list');
const scrollContainer = document.getElementById('country-scroll-container');
const titleEl = document.getElementById('country-title');
const descEl = document.getElementById('country-desc');

let activeIndex = -1;

// Render List Items
locations.forEach((loc, index) => {
    const li = document.createElement('li');
    li.textContent = loc.name;
    li.dataset.index = index;
    // Click to scroll to this item easily (Reverted to click as requested)
    li.addEventListener('click', () => {
        const topOfItem = li.offsetTop - scrollContainer.offsetTop;
        const middlePos = topOfItem - (scrollContainer.clientHeight / 2) + (li.clientHeight / 2);
        
        gsap.to(scrollContainer, {
            scrollTo: { y: middlePos },
            duration: 0.8,
            ease: "power2.inOut"
        });
        updateActiveCountry(index);
    });
    
    // Pause auto-scroll on hover
    li.addEventListener('mouseenter', () => { isPaused = true; });
    li.addEventListener('mouseleave', () => { isPaused = false; resetAutoScroll(); });
    
    countryListEl.appendChild(li);

    // Add Click listener to the corresponding pin on the globe
    const pinEl = document.getElementById(loc.id);
    if(pinEl) {
        pinEl.addEventListener('mouseenter', () => {
            const topOfItem = li.offsetTop - scrollContainer.offsetTop;
            const middlePos = topOfItem - (scrollContainer.clientHeight / 2) + (li.clientHeight / 2);
            
            gsap.to(scrollContainer, {
                scrollTo: { y: middlePos },
                duration: 0.8,
                ease: "power2.inOut"
            });
            updateActiveCountry(index);
        });

        // Pause auto-scroll on hover
        pinEl.addEventListener('mouseenter', () => { isPaused = true; });
        pinEl.addEventListener('mouseleave', () => { isPaused = false; resetAutoScroll(); });
    }
});

// Update UI Function
function updateActiveCountry(index, force = false) {
    if(!force && index === activeIndex || index < 0 || index >= locations.length) return;
    activeIndex = index;
    const loc = locations[index];

    // Update Text on Left
    if(titleEl) titleEl.textContent = loc.name;
    if(descEl) descEl.textContent = loc.desc;

    // Update List UI
    Array.from(countryListEl.children).forEach(child => child.classList.remove('active'));
    if(countryListEl.children[index]) {
        countryListEl.children[index].classList.add('active');
    }

    // Update Pins on Globe
    document.querySelectorAll('.country-pin').forEach(pin => {
        pin.classList.remove('active-pin');
        pin.classList.remove('active-layer');
    });
    
    setTimeout(() => {
        const activePin = document.getElementById(loc.id);
        if(activePin) {
            activePin.classList.add('active-layer');
            activePin.classList.add('active-pin'); 
        }
    }, 50);
}

// Intersect / Scroll logic to determine active item in center
function detectCenterItem() {
    const containerCenterY = scrollContainer.scrollTop + scrollContainer.clientHeight / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    Array.from(countryListEl.children).forEach((li, index) => {
        // Find center of this li relative to the scroll container's scrollable height
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

// Throttle scroll listener slightly
let isScrolling;
let autoScrollTimer = null;
let isPaused = false; // New variable to track manual interaction status

function moveToNextCountry() {
    if (!pinsVisible || isPaused) return; // Stop auto-move if user is hovering or section hidden
    let nextIndex = activeIndex + 1;
    if (nextIndex >= locations.length) {
        nextIndex = 0; // Loop back to start
    }
    const li = countryListEl.children[nextIndex];
    if(li) {
        const topOfItem = li.offsetTop - scrollContainer.offsetTop;
        const middlePos = topOfItem - (scrollContainer.clientHeight / 2) + (li.clientHeight / 2);
        
        gsap.to(scrollContainer, {
            scrollTo: { y: middlePos },
            duration: 1.2, // Slower, more majestic auto-scroll
            ease: "power2.inOut"
        });
    }
}

function resetAutoScroll() {
    clearInterval(autoScrollTimer);
    autoScrollTimer = setInterval(moveToNextCountry, 5000); // Increased to 5s for better readability
}

scrollContainer.addEventListener('scroll', () => {
    window.clearTimeout(isScrolling);
    resetAutoScroll(); // Reset auto-scroll timer whenever user interacts manually
    isScrolling = setTimeout(() => {
        detectCenterItem();
    }, 50);
});

// Initialize first active item after a short delay and start auto play
setTimeout(() => {
    detectCenterItem();
    // Force Russia (index 0) to be technically active and showing details initially
    updateActiveCountry(0, true); 
    resetAutoScroll();
}, 1000);

// ==============================================
// 7. Preloader Logic & Entrance Animations
// ==============================================

const introTl = gsap.timeline({ paused: true });

const heroTitleEl = document.querySelector('.image-hero-title');
if (heroTitleEl) {
    const text = heroTitleEl.innerHTML;
    const words = text.split(/(<br.*?>)/);
    heroTitleEl.innerHTML = words.map(w => {
        if (w.includes('<br')) return w;
        return `<span class="hero-word" style="display:inline-block; opacity:0; transform:translateY(30px)">${w}</span>`;
    }).join('');
}

introTl.from(".consultation-img-wrap", { opacity: 0, scale: 0.95, duration: 2, ease: "power3.out" }, 0.2)
       .from("#nav-wrapper", { y: -30, opacity: 0, duration: 1.2, ease: "power3.out" }, 0.3)
       .to(".hero-word", { y: 0, opacity: 1, duration: 1.2, stagger: 0.1, ease: "power4.out" }, 0.5)
       .from(".image-hero-subtitle", { y: 30, opacity: 0, duration: 1.2, ease: "power3.out" }, 0.9)
       .from(".initial-text .liquid-glass-btn", { y: 20, opacity: 0, stagger: 0.2, duration: 1, ease: "power2.out" }, 1.1);

window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            gsap.to(preloader, {
                opacity: 0,
                duration: 1.5,
                ease: "power2.inOut",
                onComplete: () => {
                    preloader.style.display = 'none';
                    introTl.play();
                }
            });
        }, 1500);
    } else {
        introTl.play();
    }
    ScrollTrigger.refresh();
});