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

    // --- Exact 2,000 Motion Particles with obstruction-free scale ---
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // 100% transparent clear background
    container.appendChild(renderer.domElement);

    // --- Custom GLSL Vertex Shader for Dual-Energy Swirling Core ---
    const vertexShader = `
      uniform float uTime;
      uniform vec2 uMouse;
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
        // Base spherical coordinates
        vec3 pos = position;

        // 1. Dual-Vortex Swirling Flow (Counter-rotating polar vortices)
        float polarAngle = atan(pos.z, pos.x);
        float distFromY = length(pos.xz);
        
        // Swirl speed increases with audio and agent activity
        float swirlSpeed = (1.2 + uSpeedFactor * 0.8) * (1.0 + uAudioLevel * 1.5);
        float swirlAngle = uTime * swirlSpeed * 0.5 + aPhase * 6.2831;

        // Bipolar spiral twisting
        float twist = (pos.y > 0.0 ? 1.0 : -1.0) * (2.0 / (distFromY + 0.8));
        float totalAngle = polarAngle + swirlAngle * 0.4 + twist * sin(uTime * 0.8 + aPhase * 3.14);

        pos.x = cos(totalAngle) * distFromY;
        pos.z = sin(totalAngle) * distFromY;

        // 2. Audio Wave Breathing & Shockwaves
        float breath = sin(uTime * 2.0 + aPhase * 6.28) * 0.15;
        if (uAudioLevel > 0.01) {
          float audioPulse = sin(length(pos) * 3.0 - uTime * 8.0) * (uAudioLevel * 0.9);
          pos += normalize(pos) * (breath + audioPulse);
        } else {
          pos += normalize(pos) * breath;
        }

        // 3. Mouse Interactive Deflection
        vec3 mouseWorld = vec3(uMouse.x * 6.0, uMouse.y * 6.0, 2.0);
        float mouseDist = distance(pos, mouseWorld);
        if (mouseDist < 5.0) {
          vec3 repelDir = normalize(pos - mouseWorld);
          float force = (5.0 - mouseDist) / 5.0;
          pos += repelDir * (force * uMouseForce * 1.8);
        }

        // 4. Color Calculation (Dual Cyan/Blue vs Solar Orange/Magenta)
        // Upper hemisphere is Cyan/Blue, lower hemisphere is Orange/Magenta
        float hemisphereFactor = smoothstep(-1.5, 1.5, pos.y);
        vec3 streamColor = mix(uColorOrange, uColorCyan, hemisphereFactor);

        // Core starburst brightness
        float centerDist = length(pos);
        float centerGlow = 1.0 - smoothstep(0.0, 3.2, centerDist);
        vColor = mix(streamColor, uColorCenter, centerGlow * (0.6 + uAudioLevel * 0.4));

        vDist = centerDist;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        float pointSize = (aScale * 38.0 + uAudioLevel * 25.0) * (18.0 / -mvPosition.z);
        gl_PointSize = clamp(pointSize, 2.0, 60.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    // --- Custom GLSL Fragment Shader for Radiant Photonic Glow ---
    const fragmentShader = `
      varying vec3 vColor;
      varying float vDist;

      void main() {
        // High quality circular particle with soft gaussian flare
        float r = length(gl_PointCoord - vec2(0.5));
        if (r > 0.5) discard;

        float intensity = exp(-r * 5.0);
        float edgeAlpha = 1.0 - smoothstep(0.1, 0.5, r);
        float alpha = edgeAlpha * intensity * 0.95;

        gl_FragColor = vec4(vColor, alpha);
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

      // Distribute particles across sphere volume and shell
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      
      // Density concentrated toward core and glowing rim
      const radiusVariation = Math.pow(Math.random(), 0.65) * SPHERE_RADIUS;

      positions[i3] = radiusVariation * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radiusVariation * Math.cos(phi);
      positions[i3 + 2] = radiusVariation * Math.sin(phi) * Math.sin(theta);

      scales[i] = 0.5 + Math.random() * 0.8;
      phases[i] = Math.random();

      directions[i3] = (Math.random() - 0.5) * 0.2;
      directions[i3 + 1] = (Math.random() - 0.5) * 0.2;
      directions[i3 + 2] = (Math.random() - 0.5) * 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));

    // Colors matching the user's reference image
    const colorCyan = new THREE.Color('#00E5FF');   // Brilliant Electric Cyan
    const colorOrange = new THREE.Color('#FF6A00'); // Fiery Molten Solar Orange
    const colorCenter = new THREE.Color('#FFFFFF'); // Blazing White Starburst

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
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
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // --- 3D Orbital Light Rings & Star Constellations (As in Image) ---
    const orbitalGroup = new THREE.Group();

    // Ring 1 (Primary Cyan/Blue Ring inclined at 45 deg)
    const ring1Geom = new THREE.TorusGeometry(3.6, 0.026, 16, 120);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    ring1.rotation.y = Math.PI / 6;
    orbitalGroup.add(ring1);

    // Ring 2 (Secondary Magenta/Orange Ring inclined at -35 deg)
    const ring2Geom = new THREE.TorusGeometry(3.2, 0.022, 16, 120);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xff4899,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.y = Math.PI / 4;
    orbitalGroup.add(ring2);

    // Ring 3 (Outer Equatorial Constellation Track)
    const ring3Geom = new THREE.TorusGeometry(4.2, 0.016, 16, 140);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const ring3 = new THREE.Mesh(ring3Geom, ring3Mat);
    ring3.rotation.z = Math.PI / 8;
    orbitalGroup.add(ring3);

    // Star Node Beads on Orbital Rings (Glistening Starbursts)
    const starGeom = new THREE.SphereGeometry(0.09, 12, 12);
    const starMatCyan = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const starMatOrange = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const starNodes: THREE.Mesh[] = [];

    for (let k = 0; k < 6; k++) {
      const star = new THREE.Mesh(starGeom, k % 2 === 0 ? starMatCyan : starMatOrange);
      orbitalGroup.add(star);
      starNodes.push(star);
    }

    scene.add(orbitalGroup);

    // --- Interactive Mouse Dynamics ---
    const mouse = new THREE.Vector2(0, 0);
    let targetMouseForce = 1.0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const handlePointerDown = () => {
      targetMouseForce = 2.8; // Radiant shockwave on click
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

    // --- Animation Loop ---
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
      currentOffsetX = THREE.MathUtils.lerp(currentOffsetX, targetOffsetX, 0.05);

      // Speed & Audio Calculations
      let speedFactor = 0.0;
      if (current.agentState === 'working') speedFactor = 1.8;
      else if (current.agentState === 'speaking') speedFactor = 1.2;
      else if (current.agentState === 'listening') speedFactor = 0.5;

      const currentAudio = Math.max(current.inputLevel || 0, current.outputLevel || 0);

      // Uniform updates
      particleMaterial.uniforms.uTime.value = elapsedTime;
      particleMaterial.uniforms.uMouse.value.lerp(mouse, 0.08);
      particleMaterial.uniforms.uMouseForce.value = THREE.MathUtils.lerp(
        particleMaterial.uniforms.uMouseForce.value,
        targetMouseForce,
        0.08
      );
      particleMaterial.uniforms.uAudioLevel.value = THREE.MathUtils.lerp(
        particleMaterial.uniforms.uAudioLevel.value,
        currentAudio,
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

      // Camera positioning with obstruction avoidance
      camera.position.x = currentOffsetX + Math.sin(elapsedTime * 0.2) * 0.3 + mouse.x * 0.5;
      camera.position.y = Math.cos(elapsedTime * 0.2) * 0.3 + mouse.y * 0.5;
      camera.position.z = 20;
      camera.lookAt(currentOffsetX, 0, 0);

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
