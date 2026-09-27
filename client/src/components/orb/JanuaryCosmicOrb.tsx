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
  const isClickedRef = useRef(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Synchronize state ref without unmounting Three.js instance
  useEffect(() => {
    stateRef.current = { agentState, emotionState, inputLevel, outputLevel, isDrawerOpen, isChatExpanded };
  }, [agentState, emotionState, inputLevel, outputLevel, isDrawerOpen, isChatExpanded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Exactly 20,000 Tiny Interactive Motion Particles ---
    const PARTICLE_COUNT = 20000;
    const SPHERE_RADIUS = 2.45;

    // --- Scene & Camera Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 19);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // 100% transparent clear canvas
    container.appendChild(renderer.domElement);

    // Master Group for responsive centering (prevents overlap with drawer and prompt bar)
    const orbMasterGroup = new THREE.Group();
    scene.add(orbMasterGroup);

    // --- High-Performance GLSL Shaders with 3D Curl Turbulence ---
    const vertexShader = `
      uniform float uTime;
      uniform vec2 uMouseWorld;
      uniform float uMouseForce;
      uniform float uAudioLevel;
      uniform float uSpeedFactor;
      uniform vec3 uParticleColor;
      uniform vec3 uGlowColor;

      attribute vec3 aBasePos;
      attribute vec4 aRandoms; // [phase, scale, speed, seed]

      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlow;

      // High-performance divergence-free curl vector field for silky-smooth 60 FPS simulation
      vec3 curlNoise(vec3 p) {
        float t = uTime * 0.4;
        float x = sin(p.y * 2.2 + t) + cos(p.z * 1.8 + t * 0.85);
        float y = sin(p.z * 1.9 + t * 1.1) + cos(p.x * 2.3 - t * 0.75);
        float z = sin(p.x * 2.1 - t * 0.9) + cos(p.y * 1.7 + t * 1.25);
        return normalize(vec3(x, y, z));
      }

      void main() {
        vec3 base = aBasePos;

        // 1. Dual Spherical Orbital Motion
        float distFromY = length(base.xz);
        float polarAngle = atan(base.z, base.x);

        float orbitSpeed = (0.4 + uSpeedFactor * 0.6) * aRandoms.z * (1.0 + uAudioLevel * 0.9);
        float currentAngle = polarAngle + uTime * orbitSpeed * 0.45 + aRandoms.x * 6.2831;

        // Polar recirculation flow
        float twist = sin(uTime * 0.6 + base.y * 1.8) * 0.35;
        currentAngle += twist;

        vec3 orbPos = vec3(
          cos(currentAngle) * distFromY,
          base.y + sin(uTime * 0.8 + aRandoms.x * 6.28) * 0.12,
          sin(currentAngle) * distFromY
        );

        // 2. Realistic 3D Curl Turbulence along Spherical Surface
        vec3 noiseCoord = orbPos * 0.45 + vec3(uTime * 0.1 * aRandoms.z, uTime * 0.08, aRandoms.w);
        vec3 curl = curlNoise(noiseCoord);

        float curlAmp = 0.22 + uSpeedFactor * 0.15 + uAudioLevel * 0.25;
        vec3 displaced = orbPos + curl * curlAmp;

        // Spherical surface constraint: softly pulls back to ideal spherical radius
        float currentRadius = length(displaced);
        float targetRadius = length(base);
        vec3 finalPos = normalize(displaced) * mix(currentRadius, targetRadius, 0.55);

        // 3. Audio & Vocal Acoustic Breathing
        float breath = sin(uTime * 2.2 + aRandoms.x * 6.28) * 0.08;
        if (uAudioLevel > 0.01) {
          float acousticPulse = sin(length(finalPos) * 3.8 - uTime * 9.0) * (uAudioLevel * 0.8);
          finalPos += normalize(finalPos) * (breath + acousticPulse);
        } else {
          finalPos += normalize(finalPos) * breath;
        }

        // 4. Mouse Interactive Deflection (Accurately projected to 3D cursor position)
        vec2 mouseDelta = finalPos.xy - uMouseWorld;
        float mouseDist = length(mouseDelta);
        if (mouseDist < 4.0) {
          vec2 repelDir = normalize(mouseDelta);
          float force = (4.0 - mouseDist) / 4.0;
          float smoothForce = force * force * (3.0 - 2.0 * force);
          finalPos.xy += repelDir * (smoothForce * uMouseForce * 2.0);
          finalPos.z += sin(smoothForce * 3.1415) * 1.4;
        }

        // 5. Realistic Color & Shading Dynamics
        float distFromCenter = length(finalPos);
        float rimFactor = smoothstep(1.2, 2.7, distFromCenter);
        
        // Dynamic blend between core particle color and outer rim refraction
        vColor = mix(uParticleColor, uGlowColor, rimFactor * 0.35);
        vAlpha = 0.85 + aRandoms.x * 0.15;
        vGlow = rimFactor;

        // Tiny, ultra-refined micro-particles with perspective scaling
        vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
        float pSize = (aRandoms.y * 18.0 + uAudioLevel * 14.0) * (19.0 / -mvPosition.z);
        gl_PointSize = clamp(pSize, 1.5, 26.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    // --- Custom GLSL Fragment Shader for Photorealistic Quantum Dust ---
    const fragmentShader = `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlow;

      void main() {
        float r = length(gl_PointCoord - vec2(0.5));
        if (r > 0.5) discard;

        // Photorealistic point spread function (Gaussian core + silky photonic glow)
        float core = smoothstep(0.5, 0.05, r);
        float glow = exp(-r * 6.0);
        float alpha = mix(glow, core, 0.75) * vAlpha;

        // Specular highlight at the center of each micro-particle
        vec3 specular = vec3(1.0) * pow(max(0.0, 1.0 - r * 2.2), 3.0) * 0.45;
        vec3 finalColor = vColor + specular;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    // --- 20,000 Particle Geometry Allocation via Fibonacci Spherical Lattice ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const basePositions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT * 4);

    const goldenRatio = (1.0 + Math.sqrt(5.0)) / 2.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const i4 = i * 4;

      // Fibonacci sphere mapping with volumetric shell depth
      const theta = 2.0 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1.0 - 2.0 * (i + 0.5) / PARTICLE_COUNT);

      // Layered shell distribution for rich 3D volume
      const shellVariation = SPHERE_RADIUS * (0.84 + Math.pow(Math.random(), 2.0) * 0.36);

      const x = shellVariation * Math.sin(phi) * Math.cos(theta);
      const y = shellVariation * Math.cos(phi);
      const z = shellVariation * Math.sin(phi) * Math.sin(theta);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      basePositions[i3] = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;

      randoms[i4] = Math.random();                 // Phase offset
      randoms[i4 + 1] = 0.35 + Math.random() * 0.85; // Micro-scale size
      randoms[i4 + 2] = 0.7 + Math.random() * 0.7;  // Speed variation
      randoms[i4 + 3] = Math.random() * 100.0;     // Noise seed
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aBasePos', new THREE.BufferAttribute(basePositions, 3));
    geometry.setAttribute('aRandoms', new THREE.BufferAttribute(randoms, 4));

    // Dynamic Color States
    const colorCurrent = new THREE.Color('#0A0E17'); // Default: Tiny deep black/carbon obsidian particles
    const colorTarget = new THREE.Color('#0A0E17');
    const glowCurrent = new THREE.Color('#1E293B');
    const glowTarget = new THREE.Color('#1E293B');

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouseWorld: { value: new THREE.Vector2(999, 999) },
        uMouseForce: { value: 1.0 },
        uAudioLevel: { value: 0 },
        uSpeedFactor: { value: 0 },
        uParticleColor: { value: colorCurrent },
        uGlowColor: { value: glowCurrent },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.NormalBlending, // Crisp, ultra-clean normal blending with smooth alpha
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    orbMasterGroup.add(particles);

    // --- Interactive Mouse Dynamics (Direct Window Tracking) ---
    const mouse = new THREE.Vector2(999, 999);
    const mouseWorldCurrent = new THREE.Vector2(999, 999);
    let targetMouseForce = 1.0;

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerDown = () => {
      targetMouseForce = 2.6; // Radiant shockwave pulse on click
      isClickedRef.current = true;

      // Reset click state after 3.5 seconds unless state overrides
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        isClickedRef.current = false;
      }, 3500);

      if (onActivate) onActivate();
    };

    const handlePointerUp = () => {
      targetMouseForce = 1.0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    // Resize Observer for 60FPS fluid responsiveness
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

      // Obstruction avoidance offset so orb is never overlapped by drawer or prompt bar
      let targetOffsetX = 0;
      if (current.isDrawerOpen) {
        targetOffsetX = current.isChatExpanded ? 3.0 : 1.4;
      }
      currentOffsetX = THREE.MathUtils.lerp(currentOffsetX, targetOffsetX, 0.06);
      orbMasterGroup.position.x = currentOffsetX;

      // --- Color State Engine: Mouse Click -> Green, Response -> Cyan, Synthesis -> Amber/Purple, Awake -> Teal, Sleep -> Midnight Slate, Default -> Black ---
      if (isClickedRef.current) {
        // Clicked state: Hyper-vivid Emerald Green
        colorTarget.set('#00FF88');
        glowTarget.set('#059669');
      } else if (current.agentState === 'speaking') {
        // Response state: Radiant Electric Azure Cyan
        colorTarget.set('#00E5FF');
        glowTarget.set('#0284C7');
      } else if (current.agentState === 'working') {
        // Synthesis state: High-energy Cyber Violet & Amber
        colorTarget.set('#A855F7');
        glowTarget.set('#F59E0B');
      } else if (current.agentState === 'listening') {
        // Awake / Listening state: Bioluminescent Aqua Teal
        colorTarget.set('#06B6D4');
        glowTarget.set('#0D9488');
      } else if (current.agentState === 'sleeping') {
        // Sleep state: Deep Midnight Slate Obsidian
        colorTarget.set('#1E1B4B');
        glowTarget.set('#0F172A');
      } else {
        // Default / Standby: 20,000 Tiny Black Carbon Ink Particles
        colorTarget.set('#0B0F17');
        glowTarget.set('#1E293B');
      }

      // Smooth color morphing
      colorCurrent.lerp(colorTarget, 0.08);
      glowCurrent.lerp(glowTarget, 0.08);

      // Speed & Audio Calculations (Fluid organic response during inputs and responses)
      let speedFactor = 0.0;
      let statePulse = 0.0;
      if (current.agentState === 'working') {
        speedFactor = 2.4;
        statePulse = 0.55;
      } else if (current.agentState === 'speaking') {
        speedFactor = 1.6;
        statePulse = 0.8;
      } else if (current.agentState === 'listening') {
        speedFactor = 0.9;
        statePulse = 0.35;
      } else if (isClickedRef.current) {
        speedFactor = 1.8;
        statePulse = 0.6;
      }

      const effectiveAudio = Math.max(current.inputLevel || 0, current.outputLevel || 0, statePulse);

      // 3D Mouse Cursor World Projection
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

      // Subtle slow continuous organic tumble of the sphere
      orbMasterGroup.rotation.y = elapsedTime * 0.08;
      orbMasterGroup.rotation.x = Math.sin(elapsedTime * 0.05) * 0.1;

      // Camera micro-sway for depth
      camera.position.x = Math.sin(elapsedTime * 0.2) * 0.15;
      camera.position.y = Math.cos(elapsedTime * 0.2) * 0.15;
      camera.position.z = 19;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);

      geometry.dispose();
      particleMaterial.dispose();
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
