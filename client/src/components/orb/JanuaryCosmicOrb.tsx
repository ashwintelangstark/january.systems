import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AgentState, EmotionState } from '../../types';

interface JanuaryCosmicOrbProps {
  agentState: AgentState;
  emotionState?: EmotionState;
  inputLevel?: number;
  outputLevel?: number;
  onActivate?: () => void;
  className?: string;
  isDrawerOpen?: boolean;
  isChatExpanded?: boolean;
}

export const JanuaryCosmicOrb: React.FC<JanuaryCosmicOrbProps> = ({
  agentState,
  emotionState,
  inputLevel = 0,
  outputLevel = 0,
  onActivate,
  className = '',
  isDrawerOpen = false,
  isChatExpanded = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ agentState, emotionState, inputLevel, outputLevel, isDrawerOpen, isChatExpanded });

  // Update state ref for requestAnimationFrame without re-mounting Three.js scene
  useEffect(() => {
    stateRef.current = { agentState, emotionState, inputLevel, outputLevel, isDrawerOpen, isChatExpanded };
  }, [agentState, emotionState, inputLevel, outputLevel, isDrawerOpen, isChatExpanded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Exact 2,000 Motion Particles with High-Definition Core ---
    const PARTICLE_COUNT = 2000;
    const SPHERE_RADIUS = 2.4;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // 100% transparent clear canvas
    container.appendChild(renderer.domElement);

    // Master Group for smooth dynamic offset (clearing drawer without UI overlap)
    const orbMasterGroup = new THREE.Group();
    scene.add(orbMasterGroup);

    // --- Custom GLSL Vertex Shader for Dual-Energy Swirling Core ---
    const vertexShader = `
      uniform float uTime;
      uniform vec2 uMouseWorld;
      uniform float uMouseForce;
      uniform float uAudioLevel;
      uniform float uSpeedFactor;
      uniform vec3 uColorCyan;
      uniform vec3 uColorOrange;
      uniform vec3 uColorCenter;

      attribute float aPhase;
      attribute float aScale;
      attribute vec3 aDirection;

      varying vec3 vColor;
      varying float vDist;

      void main() {
        vec3 pos = position;

        // 1. Dual-Vortex Swirling Flow (Counter-rotating polar vortices)
        float polarAngle = atan(pos.z, pos.x);
        float distFromY = length(pos.xz);
        
        // Swirl speed increases dynamically with audio, voice input, and synthesis activity
        float swirlSpeed = (1.4 + uSpeedFactor * 0.9) * (1.0 + uAudioLevel * 1.6);
        float swirlAngle = uTime * swirlSpeed * 0.5 + aPhase * 6.2831;

        // Bipolar spiral twisting
        float twist = (pos.y > 0.0 ? 1.0 : -1.0) * (2.2 / (distFromY + 0.7));
        float totalAngle = polarAngle + swirlAngle * 0.45 + twist * sin(uTime * 0.9 + aPhase * 3.14);

        pos.x = cos(totalAngle) * distFromY;
        pos.z = sin(totalAngle) * distFromY;

        // 2. Harmonic Audio Wave Breathing & Shockwaves during inputs/responses
        float breath = sin(uTime * 2.4 + aPhase * 6.28) * 0.18;
        if (uAudioLevel > 0.01) {
          float audioPulse = sin(length(pos) * 3.5 - uTime * 9.0) * (uAudioLevel * 1.1);
          pos += normalize(pos) * (breath + audioPulse);
        } else {
          pos += normalize(pos) * breath;
        }

        // 3. Fluid Mouse Interactive Deflection (Accurately projected to 3D cursor position)
        vec2 mouseDelta = pos.xy - uMouseWorld;
        float mouseDist = length(mouseDelta);
        if (mouseDist < 4.2) {
          vec2 repelDir = normalize(mouseDelta);
          float force = (4.2 - mouseDist) / 4.2;
          pos.xy += repelDir * (force * uMouseForce * 2.2);
          pos.z += sin(force * 3.1415) * 1.4;
        }

        // 4. Color Calculation (Electric Cyan/Blue vs Solar Orange/Magenta)
        float hemisphereFactor = smoothstep(-1.2, 1.2, pos.y);
        vec3 streamColor = mix(uColorOrange, uColorCyan, hemisphereFactor);

        // Core starburst brightness
        float centerDist = length(pos);
        float centerGlow = 1.0 - smoothstep(0.0, 2.5, centerDist);
        vColor = mix(streamColor, uColorCenter, centerGlow * (0.7 + uAudioLevel * 0.3));

        vDist = centerDist;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        // Bold, punchy point size that scales with perspective and audio
        float pointSize = (aScale * 44.0 + uAudioLevel * 30.0) * (20.0 / -mvPosition.z);
        gl_PointSize = clamp(pointSize, 3.0, 65.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    // --- Custom GLSL Fragment Shader for Crisp, Bright & Bold Particles ---
    const fragmentShader = `
      varying vec3 vColor;
      varying float vDist;

      void main() {
        float r = length(gl_PointCoord - vec2(0.5));
        if (r > 0.5) discard;

        // Solid, bright core with smooth anti-aliased perimeter
        float alpha = smoothstep(0.5, 0.08, r);

        // Radiant specular core
        vec3 finalColor = mix(vColor, vec3(1.0, 1.0, 1.0), (1.0 - smoothstep(0.0, 0.22, r)) * 0.55);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    // --- 2,000 Particle Geometry Allocation ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const directions = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      
      const radiusVariation = Math.pow(Math.random(), 0.65) * SPHERE_RADIUS;

      positions[i3] = radiusVariation * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radiusVariation * Math.cos(phi);
      positions[i3 + 2] = radiusVariation * Math.sin(phi) * Math.sin(theta);

      scales[i] = 0.6 + Math.random() * 0.8;
      phases[i] = Math.random();

      directions[i3] = (Math.random() - 0.5) * 0.2;
      directions[i3 + 1] = (Math.random() - 0.5) * 0.2;
      directions[i3 + 2] = (Math.random() - 0.5) * 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));

    // Colors matching user requirements (Electric Cyan, Molten Orange, Blazing White)
    const colorCyan = new THREE.Color('#00E5FF');   // Brilliant Electric Cyan
    const colorOrange = new THREE.Color('#FF5500'); // Fiery Molten Solar Orange
    const colorCenter = new THREE.Color('#FFFFFF'); // Blazing White Starburst

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouseWorld: { value: new THREE.Vector2(999, 999) },
        uMouseForce: { value: 1.0 },
        uAudioLevel: { value: 0 },
        uSpeedFactor: { value: 0 },
        uColorCyan: { value: colorCyan },
        uColorOrange: { value: colorOrange },
        uColorCenter: { value: colorCenter },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.NormalBlending, // Bold, solid, opaque particles over the Frosted Ice Blue backdrop
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    orbMasterGroup.add(particles);

    // --- 3D Orbital Light Rings & Star Constellations ---
    const orbitalGroup = new THREE.Group();
    orbMasterGroup.add(orbitalGroup);

    // Ring 1 (Primary Cyan/Blue Ring inclined at 45 deg)
    const ring1Geom = new THREE.TorusGeometry(3.6, 0.035, 16, 120);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00E5FF,
      transparent: true,
      opacity: 0.95,
      blending: THREE.NormalBlending,
    });
    const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    ring1.rotation.y = Math.PI / 6;
    orbitalGroup.add(ring1);

    // Ring 2 (Secondary Magenta/Coral Ring inclined at -35 deg)
    const ring2Geom = new THREE.TorusGeometry(3.2, 0.03, 16, 120);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xFF2D78,
      transparent: true,
      opacity: 0.92,
      blending: THREE.NormalBlending,
    });
    const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.y = Math.PI / 4;
    orbitalGroup.add(ring2);

    // Ring 3 (Outer Constellation Track)
    const ring3Geom = new THREE.TorusGeometry(4.2, 0.022, 16, 140);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0x6366F1,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
    });
    const ring3 = new THREE.Mesh(ring3Geom, ring3Mat);
    ring3.rotation.z = Math.PI / 8;
    orbitalGroup.add(ring3);

    // Star Node Beads on Orbital Rings (Glistening Starbursts)
    const starGeom = new THREE.SphereGeometry(0.11, 16, 16);
    const starMatCyan = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
    const starMatOrange = new THREE.MeshBasicMaterial({ color: 0xFFAA00 });
    const starNodes: THREE.Mesh[] = [];

    for (let k = 0; k < 6; k++) {
      const star = new THREE.Mesh(starGeom, k % 2 === 0 ? starMatCyan : starMatOrange);
      orbitalGroup.add(star);
      starNodes.push(star);
    }

    // --- Interactive Mouse Dynamics (Direct Window Tracking) ---
    const mouse = new THREE.Vector2(999, 999);
    const mouseWorldCurrent = new THREE.Vector2(999, 999);
    let targetMouseForce = 1.0;

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerDown = () => {
      targetMouseForce = 2.8; // Radiant shockwave pulse on click
      if (onActivate) onActivate();
    };

    const handlePointerUp = () => {
      targetMouseForce = 1.0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    // Resize Observer for perfect responsiveness
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // --- 60FPS Animation Loop ---
    const clock = new THREE.Clock();
    let animationFrameId: number;
    let currentOffsetX = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const current = stateRef.current;

      // Dynamic centering offset so the particle orb is NEVER overlapped by left drawer or prompt bar
      let targetOffsetX = 0;
      if (current.isDrawerOpen) {
        targetOffsetX = current.isChatExpanded ? 3.0 : 1.4;
      }
      currentOffsetX = THREE.MathUtils.lerp(currentOffsetX, targetOffsetX, 0.06);
      orbMasterGroup.position.x = currentOffsetX;

      // Speed & Audio Calculations (Active during inputs and responses)
      let speedFactor = 0.0;
      let statePulse = 0.0;
      if (current.agentState === 'working') {
        speedFactor = 2.2;
        statePulse = 0.5;
      } else if (current.agentState === 'speaking') {
        speedFactor = 1.4;
        statePulse = 0.75;
      } else if (current.agentState === 'listening') {
        speedFactor = 0.8;
        statePulse = 0.35; // Responsive breathing while listening / taking inputs
      }

      const effectiveAudio = Math.max(current.inputLevel || 0, current.outputLevel || 0, statePulse);

      // Compute exact 3D world position of cursor at z = 0 relative to orbMasterGroup
      const aspect = container.clientWidth / container.clientHeight;
      const vHalfHeight = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      const vHalfWidth = vHalfHeight * aspect;

      const cursorWorldX = mouse.x * vHalfWidth;
      const cursorWorldY = mouse.y * vHalfHeight;
      const localMouseX = cursorWorldX - currentOffsetX;
      const localMouseY = cursorWorldY;

      mouseWorldCurrent.lerp(new THREE.Vector2(localMouseX, localMouseY), 0.2);

      // Uniform updates
      particleMaterial.uniforms.uTime.value = elapsedTime;
      particleMaterial.uniforms.uMouseWorld.value.copy(mouseWorldCurrent);
      particleMaterial.uniforms.uMouseForce.value = THREE.MathUtils.lerp(
        particleMaterial.uniforms.uMouseForce.value,
        targetMouseForce,
        0.08
      );
      particleMaterial.uniforms.uAudioLevel.value = THREE.MathUtils.lerp(
        particleMaterial.uniforms.uAudioLevel.value,
        effectiveAudio,
        0.25
      );
      particleMaterial.uniforms.uSpeedFactor.value = THREE.MathUtils.lerp(
        particleMaterial.uniforms.uSpeedFactor.value,
        speedFactor,
        0.08
      );

      // Slowly rotate orbital constellation rings
      orbitalGroup.rotation.y = elapsedTime * 0.15;
      orbitalGroup.rotation.x = Math.sin(elapsedTime * 0.1) * 0.2;

      // Animate Star Nodes on Ring 1 and Ring 2
      starNodes.forEach((node, idx) => {
        const ringRadius = idx < 3 ? 3.6 : 3.2;
        const angle = elapsedTime * (0.4 + idx * 0.08) + (idx * Math.PI) / 3;
        node.position.x = Math.cos(angle) * ringRadius;
        node.position.z = Math.sin(angle) * ringRadius;
        node.position.y = Math.sin(angle * 2.0) * 0.8;
        node.scale.setScalar(1.0 + Math.sin(elapsedTime * 4.0 + idx) * 0.3);
      });

      // Camera micro-sway for depth
      camera.position.x = Math.sin(elapsedTime * 0.2) * 0.2;
      camera.position.y = Math.cos(elapsedTime * 0.2) * 0.2;
      camera.position.z = 20;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);

      geometry.dispose();
      particleMaterial.dispose();
      ring1Geom.dispose();
      ring1Mat.dispose();
      ring2Geom.dispose();
      ring2Mat.dispose();
      ring3Geom.dispose();
      ring3Mat.dispose();
      starGeom.dispose();
      starMatCyan.dispose();
      starMatOrange.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onActivate]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-auto ${className}`}
      style={{ touchAction: 'none' }}
    />
  );
};

export default JanuaryCosmicOrb;
