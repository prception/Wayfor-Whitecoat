document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("globe-container");
    if (!container) return;

    // SCENE, CAMERA, RENDERER
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background allowing HTML white bg to show through

    // Frame the camera appropriately
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 17;
    camera.position.x = 0;
    camera.position.y = 2; // Looking slightly downward

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // CONTROLS (Interactable)
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false; // Disable zoom to not trap user scrolling
    controls.enablePan = false;
    controls.autoRotate = true;  // Slow rotation
    controls.autoRotateSpeed = 1.2;

    // GLOBE OBJECT
    const globeGeometry = new THREE.SphereGeometry(5, 64, 64);
    
    // Premium White Glass Material
    const globeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xf4f6fb,      // Soft off-white to match theme
        emissive: 0x222222,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.98
    });
    
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);

    // Abstract Tech Wireframe Layer
    const wireframeGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(5.02, 32, 32));
    const wireframeMat = new THREE.LineBasicMaterial({
        color: 0x8c90c7,     // Lavender accent
        transparent: true, 
        opacity: 0.15
    });
    const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
    globe.add(wireframe);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Deep Blue Backlight for premium rim-lighting
    const blueBacklight = new THREE.DirectionalLight(0x0d1b8c, 3.0); 
    blueBacklight.position.set(-5, -5, -5);
    scene.add(blueBacklight);

    // HELPER: Convert Lat/Lon to Vector3
    function getPosFromLatLon(lat, lon, radius) {
        var phi = (90 - lat) * (Math.PI / 180);
        var theta = (lon + 180) * (Math.PI / 180);

        var x = -(radius * Math.sin(phi) * Math.cos(theta));
        var z = (radius * Math.sin(phi) * Math.sin(theta));
        var y = (radius * Math.cos(phi));

        return new THREE.Vector3(x, y, z);
    }

    // PIN DATA
    const locations = [
        { name: "Russia", lat: 61.5, lon: 105.3, color: 0x0D1B8C }, // Primary Deep
        { name: "Kazakhstan", lat: 48.0, lon: 66.9, color: 0x2E3FBF }, // Primary Mid
        { name: "Uzbekistan", lat: 41.3, lon: 64.5, color: 0x8C90C7 }, // Lavender
        { name: "Georgia", lat: 42.3, lon: 43.3, color: 0x0D1B8C }    // Primary Deep
    ];

    locations.forEach(loc => {
        // Dot Pin
        const pinGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const pinMat = new THREE.MeshBasicMaterial({ color: loc.color });
        const pin = new THREE.Mesh(pinGeo, pinMat);

        // Outer Glow Ring
        const ringGeo = new THREE.RingGeometry(0.18, 0.28, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: loc.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);

        const pos = getPosFromLatLon(loc.lat, loc.lon, 5.06); 
        pin.position.copy(pos);
        ring.position.copy(pos);
        
        // Face ring away from sphere center
        ring.lookAt(new THREE.Vector3(0,0,0));

        globe.add(pin);
        globe.add(ring);
    });

    // AMBIENT PARTICLES (Stars/Data points)
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 600;
    const posArray = new Float32Array(particleCount * 3);
    
    for(let i=0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 16; 
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x2e3fbf,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    
    const particlesMesh = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlesMesh);

    // RESIZE HANDLING
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // ANIMATION LOOP
    const clock = new THREE.Clock();
    
    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        
        controls.update(); // Enable damping & autoRotate
        
        // Slower ambient particle drift
        particlesMesh.rotation.y = elapsedTime * 0.03;
        
        renderer.render(scene, camera);
    }
    
    animate();
});
