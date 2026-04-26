"use client";

import React, { useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

interface PixelRocketHeroProps {
  title?: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export const PixelRocketHero: React.FC<PixelRocketHeroProps> = ({
  title = "To the Moon!",
  subtitle = "Embark on a new cosmic journey. Explore decentralized galaxies and claim your stake in the pixelated universe.",
  className = "",
  children,
}) => {
  const textControls = useAnimation();

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    textControls.start((i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05 + 1.0,
        duration: 1.2,
        ease: [0.2, 0.65, 0.3, 0.9],
      },
    }));

    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, [textControls]);

  return (
    <div
      className={`relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-sky-100 dark:bg-[#1a0033] ${className}`}
      style={{ fontFamily: "'Press Start 2P', system-ui" }}
    >
      <div
        className="absolute inset-0 z-[1] bg-cover bg-center opacity-35"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80)",
        }}
      />
      <PixelVoyagerCanvas />

      <div className="relative z-10 px-4 text-center">
        <h1
          className="text-5xl font-bold tracking-tighter text-slate-900 dark:text-white md:text-7xl"
          style={{ textShadow: "3px 3px 0px #ff00ff" }}
        >
          {title.split("").map((char, i) => (
            <motion.span
              key={`${char}-${i}`}
              custom={i}
              initial={{ opacity: 0, y: 50 }}
              animate={textControls}
              style={{ display: "inline-block" }}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        {subtitle ? (
          <motion.p
            custom={title.length}
            initial={{ opacity: 0, y: 30 }}
            animate={textControls}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300"
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>

      {children ? <div className="relative z-10 mt-8 w-full px-4">{children}</div> : null}
    </div>
  );
};

const PixelVoyagerCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 25;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mountRef.current.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0, 0);
    const clock = new THREE.Clock();
    const isDarkMode =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    bloomPass.threshold = 0;
    bloomPass.strength = isDarkMode ? 1.2 : 0.6;
    bloomPass.radius = 0;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const starGeometry = new THREE.BufferGeometry();
    const starVertices: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      starVertices.push(x, y, z);
    }
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: isDarkMode ? 0xffffff : 0x555555,
      size: 0.1,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(3, 5, 6);
    scene.add(ambientLight, directionalLight);

    const pixelSize = 0.2;
    const pixelGeo = new THREE.BoxGeometry(pixelSize, pixelSize, pixelSize);

    const coinGroup = new THREE.Group();
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, flatShading: true });
    for (let i = 0; i < 20; i++) {
      const coin = new THREE.Group();
      for (let p = 0; p < 15; p++) {
        const pixel = new THREE.Mesh(pixelGeo, coinMat);
        const angle = (p / 15) * Math.PI * 2;
        pixel.position.set(Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, 0);
        coin.add(pixel);
      }
      coin.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20
      );
      coinGroup.add(coin);
    }
    scene.add(coinGroup);

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      stars.rotation.y += delta * 0.01;
      stars.rotation.x = mouse.y * 0.04;
      stars.rotation.z = mouse.x * 0.04;

      coinGroup.children.forEach((coin, i) => {
        coin.rotation.z = elapsedTime * (i % 2 === 0 ? 1 : -1);
        coin.rotation.x = elapsedTime * 0.25;
      });

      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      mountRef.current?.removeChild(renderer.domElement);

      starGeometry.dispose();
      starMaterial.dispose();
      pixelGeo.dispose();
      coinMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};
