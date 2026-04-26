import React, { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import { Rocket } from "lucide-react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { cn } from "@/lib/utils";

type PixelRocketHeroProps = {
  title?: string;
  subtitle?: string;
  titleClassName?: string;
  children?: React.ReactNode;
  className?: string;
};

export const PixelRocketHero = ({
  title = "To the Moon!",
  subtitle = "",
  titleClassName,
  children,
  className,
}: PixelRocketHeroProps) => {
  const textControls = useAnimation();

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    textControls.start((i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05 + 1.0,
        duration: 1.1,
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
      className={cn(
        "relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-sky-100",
        className
      )}
      style={{ fontFamily: "'Press Start 2P', system-ui" }}
    >
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-35"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80)",
        }}
      />
      <PixelVoyagerCanvas />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_center,rgba(4,10,30,0.45)_0%,rgba(4,10,30,0.2)_45%,transparent_78%)]" />
      <HeroNav />

      <div className="relative z-10 px-4 text-center">
        {title ? (
          <h1
            className={cn(
              "text-4xl font-bold tracking-tight text-cyan-200 sm:text-6xl md:text-7xl",
              titleClassName
            )}
            style={{ textShadow: "3px 3px 0px #ff00ff" }}
          >
            {title.split("").map((char, i) => (
              <motion.span
                key={`${char}-${i}`}
                custom={i}
                initial={{ opacity: 0, y: 32 }}
                animate={textControls}
                style={{ display: "inline-block" }}
              >
                {char}
              </motion.span>
            ))}
          </h1>
        ) : null}

        {subtitle ? (
          <motion.p
            custom={title.length}
            initial={{ opacity: 0, y: 20 }}
            animate={textControls}
            className="mx-auto mt-4 max-w-xl text-xs leading-relaxed text-cyan-100/85 sm:text-sm"
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>

      <div className="relative z-10 mt-2 w-full px-4">{children}</div>
    </div>
  );
};

const HeroNav = () => {
  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.7, duration: 0.8 } }}
      className="absolute left-0 right-0 top-0 z-20 p-5"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2 rounded-none border-2 border-cyan-300/60 bg-slate-950/70 px-3 py-2 text-cyan-100 backdrop-blur-sm">
          <Rocket className="h-4 w-4 text-cyan-300" />
          <span className="text-[10px] font-bold uppercase tracking-wide sm:text-xs">Nebula Voyager</span>
        </div>
      </div>
    </motion.nav>
  );
};

const PixelVoyagerCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0, 0);
    const clock = new THREE.Clock();
    const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

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
      starVertices.push((Math.random() - 0.5) * 100);
      starVertices.push((Math.random() - 0.5) * 100);
      starVertices.push((Math.random() - 0.5) * 100);
    }
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: isDarkMode ? 0xffffff : 0x555555, size: 0.1 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const rocket = new THREE.Group();
    const pixelSize = 0.2;
    const pixelGeo = new THREE.BoxGeometry(pixelSize, pixelSize, pixelSize);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, flatShading: true });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0055ff, flatShading: true });
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x87ceeb,
      emissive: 0x87ceeb,
      emissiveIntensity: 0.5,
      flatShading: true,
    });
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(3, 5, 6);
    scene.add(ambientLight, directionalLight);

    for (let y = -4; y < 5; y++) {
      for (let x = -2; x < 3; x++) {
        if (Math.abs(x) === 2 && y > 1) continue;
        const pixel = new THREE.Mesh(pixelGeo, bodyMat);
        pixel.position.set(x * pixelSize, y * pixelSize, 0);
        rocket.add(pixel);
      }
    }
    for (let y = -3; y < -1; y++) {
      for (let x = -4; x < -2; x++) {
        const leftWingPixel = new THREE.Mesh(pixelGeo, wingMat);
        leftWingPixel.position.set(x * pixelSize, y * pixelSize, 0);
        rocket.add(leftWingPixel);
        const rightWingPixel = new THREE.Mesh(pixelGeo, wingMat);
        rightWingPixel.position.set(-x * pixelSize, y * pixelSize, 0);
        rocket.add(rightWingPixel);
      }
    }
    const cockpit = new THREE.Mesh(pixelGeo, cockpitMat);
    cockpit.position.set(0, 3 * pixelSize, pixelSize);
    rocket.add(cockpit);
    scene.add(rocket);

    const trailPool: THREE.Mesh[] = [];
    let trailIndex = 0;
    const trailSize = 200;
    const trailGeo = new THREE.BoxGeometry(pixelSize * 1.5, pixelSize * 1.5, pixelSize * 1.5);
    for (let i = 0; i < trailSize; i++) {
      const trailMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? (isDarkMode ? 0xff00ff : 0xff4500) : isDarkMode ? 0xee82ee : 0xffa500,
      });
      const particle = new THREE.Mesh(trailGeo, trailMat);
      particle.visible = false;
      particle.userData.life = 0;
      scene.add(particle);
      trailPool.push(particle);
    }

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
      coin.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20);
      coinGroup.add(coin);
    }
    scene.add(coinGroup);

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let animationFrameId = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      const targetPosition = new THREE.Vector3(mouse.x * 15, mouse.y * 10, 0);
      rocket.position.lerp(targetPosition, 0.05);
      rocket.rotation.y = (targetPosition.x - rocket.position.x) * 0.1;
      rocket.rotation.x = -(targetPosition.y - rocket.position.y) * 0.1;

      if (Math.random() > 0.3) {
        const particle = trailPool[trailIndex];
        particle.position.copy(rocket.position);
        particle.position.y -= 0.7;
        particle.scale.setScalar(1);
        particle.visible = true;
        particle.userData.life = 1;
        trailIndex = (trailIndex + 1) % trailSize;
      }

      trailPool.forEach((particle) => {
        if (particle.visible) {
          particle.userData.life -= delta * 1.5;
          particle.scale.setScalar(Math.max(particle.userData.life, 0));
          if (particle.userData.life <= 0) {
            particle.visible = false;
          }
        }
      });

      coinGroup.children.forEach((coin, i) => {
        coin.rotation.z = elapsedTime * (i % 2 === 0 ? 1 : -1);
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
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      mountRef.current?.removeChild(renderer.domElement);

      starGeometry.dispose();
      starMaterial.dispose();
      pixelGeo.dispose();
      trailGeo.dispose();
      bodyMat.dispose();
      wingMat.dispose();
      cockpitMat.dispose();
      coinMat.dispose();
      trailPool.forEach((particle) => {
        const mat = particle.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      });
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-[1]" />;
};

