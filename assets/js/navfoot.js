// Fetch and insert the liquid glass navbar into the placeholder
fetch('navbar.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('navbar-placeholder').innerHTML = data;
        
        // Add scroll listener to adapt glass UI on transitioning over dark backgrounds
        window.addEventListener('scroll', () => {
            const nav = document.querySelector('.liquid-navbar');
            if (nav) {
                // If scrolled past the offwhite hero top (approx 500px), switch to dark-mode glass
                
            }
        });
    })
    .catch(error => console.error('Error fetching navbar:', error));

// Fetch and insert the premium footer into the placeholder
fetch('footer.html')
    .then(response => response.text())
    .then(data => {
        const placeholder = document.getElementById('footer-placeholder');
        if (placeholder) {
            placeholder.innerHTML = data;
            // Initialize 3D 'Fly to Abroad' background on the newly injected container
            initFooter3D();
        }
    })
    .catch(error => console.error('Error fetching footer:', error));

// ThreeJS 'Fly to Abroad' Footer Experience
function initFooter3D() {
    const container = document.getElementById('footer-3d-container');
    if (!container || typeof THREE === 'undefined') return;

    // Create scene
    const scene = new THREE.Scene();
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / (container.clientHeight || 400), 0.1, 1000);
    // Position camera far enough to see the globe and airplane
    camera.position.z = 15;
    camera.position.y = 2;
    camera.position.x = 5;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    // Adjust size to the footer's dimensions
    renderer.setSize(window.innerWidth, container.clientHeight || 400); 
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Create Abstract Wireframe Globe
    const globeGeometry = new THREE.SphereGeometry(6, 32, 32);
    const globeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x0ea5e9, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.15 
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);

    // Glowing core inside the globe
    const coreGeometry = new THREE.SphereGeometry(5.8, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0x020617,
        transparent: true,
        opacity: 0.8
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // Create the Airplane Group
    const airplaneGroup = new THREE.Group();
    scene.add(airplaneGroup);

    // Make a simple paper airplane shape (Cone)
    const airplaneGeometry = new THREE.ConeGeometry(0.3, 1, 3);
    const airplaneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const airplane = new THREE.Mesh(airplaneGeometry, airplaneMaterial);
    
    // Rotate to point forward along the trajectory path
    airplane.rotation.x = Math.PI / 2;
    airplane.position.z = 7.5; // Orbit distance
    airplaneGroup.add(airplane);

    // Airplane trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailCount = 50;
    const trailPositions = new Float32Array(trailCount * 3);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.3 
    });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);

    // Animation variables
    let time = 0;
    const pastPositions = [];

    // Mouse Interaction
    let mouseX = 0;
    let targetX = 0;
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX - window.innerWidth / 2) * 0.001;
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = window.innerWidth / (container.clientHeight || 400);
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, container.clientHeight || 400);
    });

    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        // Rotate globe slowly
        globe.rotation.y += 0.002;
        globe.rotation.x += 0.001;

        // Orbit airplane around the globe
        airplaneGroup.rotation.y = -time * 1.5; // Fly around Y axis
        
        // Bob up and down physically
        airplane.position.y = Math.sin(time * 3) * 0.5;

        // Smooth mouse rotation interaction on camera
        targetX = mouseX * 2.0;
        camera.position.x += (targetX - camera.position.x) * 0.05;
        camera.lookAt(scene.position);

        // Update trail particles based on true world position of the airplane
        const worldPos = new THREE.Vector3();
        airplane.getWorldPosition(worldPos);
        
        pastPositions.unshift(worldPos.clone());
        if (pastPositions.length > trailCount) {
            pastPositions.pop();
        }

        const positionsAttribute = trail.geometry.attributes.position;
        for (let i = 0; i < pastPositions.length; i++) {
            positionsAttribute.setXYZ(i, pastPositions[i].x, pastPositions[i].y, pastPositions[i].z);
        }
        trail.geometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
    }
    
    animate();
}
