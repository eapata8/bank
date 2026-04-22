"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function CreditCard3D({
  style,
  cardholderName = "LEON BANK",
  variant = "visa",
}: {
  style?: React.CSSProperties;
  cardholderName?: string;
  variant?: "visa" | "mastercard";
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth || 400;
    const H = container.clientHeight || 300;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    /* ── Scene / Camera ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 5);

    /* ── Controls ── */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = 0.6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 5, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const isMC = variant === "mastercard";

    const accent1Light = new THREE.PointLight(isMC ? 0xeb001b : 0x533afd, 2, 8);
    accent1Light.position.set(-3, 2, 2);
    scene.add(accent1Light);

    const accent2Light = new THREE.PointLight(isMC ? 0xf79e1b : 0xea2261, 1.5, 8);
    accent2Light.position.set(3, -2, 1);
    scene.add(accent2Light);

    /* ── Card texture helpers ── */
    function makeCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      draw(canvas.getContext("2d")!);
      return new THREE.CanvasTexture(canvas);
    }

    /* ── Front face ── */
    const frontTex = makeCanvas(1024, 640, (ctx) => {
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 1024, 640);
      if (isMC) {
        grad.addColorStop(0, "#1a0500");
        grad.addColorStop(0.45, "#3d0d00");
        grad.addColorStop(1, "#6b1500");
      } else {
        grad.addColorStop(0, "#1c1e54");
        grad.addColorStop(0.5, "#2d2080");
        grad.addColorStop(1, "#533afd");
      }
      ctx.fillStyle = grad;
      ctx.roundRect(0, 0, 1024, 640, 32);
      ctx.fill();

      // Decorative circles
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(820, -40, 280, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(900, 600, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Subtle grid lines
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let x = 0; x < 1024; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke();
      }
      for (let y = 0; y < 640; y += 64) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // EMV Chip
      const chipX = 80, chipY = 220;
      const cGrad = ctx.createLinearGradient(chipX, chipY, chipX + 100, chipY + 72);
      cGrad.addColorStop(0, "#d4a84b");
      cGrad.addColorStop(0.5, "#f0c860");
      cGrad.addColorStop(1, "#b8922e");
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.roundRect(chipX, chipY, 100, 72, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(chipX + 33, chipY); ctx.lineTo(chipX + 33, chipY + 72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(chipX + 67, chipY); ctx.lineTo(chipX + 67, chipY + 72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(chipX, chipY + 24); ctx.lineTo(chipX + 100, chipY + 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(chipX, chipY + 48); ctx.lineTo(chipX + 100, chipY + 48); ctx.stroke();

      // NFC icon
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(218, 258, 16 + i * 14, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.stroke();
      }

      // Card number
      ctx.font = "bold 56px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.letterSpacing = "4px";
      ctx.fillText(isMC ? "5412  ••••  ••••  7891" : "4732  ••••  ••••  8291", 72, 440);
      ctx.letterSpacing = "0px";

      // Expiry & CVV labels
      ctx.font = "300 28px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText("EXPIRATION", 72, 510);
      ctx.fillText("CVV", 300, 510);

      ctx.font = "400 36px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("12 / 28", 72, 555);
      ctx.fillText("•••", 300, 555);

      // Cardholder
      ctx.font = "400 38px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.80)";
      ctx.fillText(cardholderName.toUpperCase(), 72, 608);

      // Network logo
      if (isMC) {
        // Mastercard: two overlapping circles
        const cx = 900, cy = 568, r = 52;
        // Red circle
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "#EB001B";
        ctx.beginPath();
        ctx.arc(cx - 30, cy, r, 0, Math.PI * 2);
        ctx.fill();
        // Yellow/orange circle (blends naturally over red)
        ctx.fillStyle = "#F79E1B";
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(cx + 30, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // MASTERCARD label below circles
        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.textAlign = "center";
        ctx.fillText("MASTERCARD", cx, cy + 72);
        ctx.textAlign = "left";
      } else {
        // VISA italic
        ctx.font = "italic bold 76px serif";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.textAlign = "right";
        ctx.fillText("VISA", 960, 600);
        ctx.textAlign = "left";
      }

      // Brand mark (shield icon) top-left
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.roundRect(72, 60, 60, 60, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(102, 72); ctx.lineTo(82, 80); ctx.lineTo(82, 96);
      ctx.quadraticCurveTo(82, 108, 102, 114);
      ctx.quadraticCurveTo(122, 108, 122, 96);
      ctx.lineTo(122, 80); ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(93, 93); ctx.lineTo(99, 100); ctx.lineTo(112, 87);
      ctx.stroke();

      // Bank name
      ctx.font = "300 32px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText("Leon Bank", 142, 97);
    });

    /* ── Back face ── */
    const backTex = makeCanvas(1024, 640, (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 1024, 640);
      if (isMC) {
        grad.addColorStop(0, "#6b1500");
        grad.addColorStop(1, "#1a0500");
      } else {
        grad.addColorStop(0, "#533afd");
        grad.addColorStop(1, "#1c1e54");
      }
      ctx.fillStyle = grad;
      ctx.roundRect(0, 0, 1024, 640, 32);
      ctx.fill();

      ctx.fillStyle = "#111";
      ctx.fillRect(0, 100, 1024, 100);

      ctx.fillStyle = "#f0ede8";
      ctx.fillRect(72, 240, 720, 68);
      ctx.font = "italic 30px serif";
      ctx.fillStyle = "#555";
      ctx.fillText("Authorized Signature", 90, 282);

      ctx.fillStyle = "#fff";
      ctx.fillRect(800, 240, 150, 68);
      ctx.font = "bold 42px monospace";
      ctx.fillStyle = "#333";
      ctx.textAlign = "center";
      ctx.fillText(isMC ? "789" : "291", 875, 285);
      ctx.textAlign = "left";

      ctx.font = "300 24px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText("© 2026 Leon Bank — Environnement de démonstration", 72, 560);
      ctx.fillText("Ce service est fictif et à usage éducatif uniquement.", 72, 595);
    });

    /* ── Card geometry ── */
    const CARD_W = 3.37, CARD_H = 2.125, CARD_D = 0.04;
    const geo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);

    const edgeTex = makeCanvas(64, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 64, 0);
      if (isMC) {
        g.addColorStop(0, "#1a0500"); g.addColorStop(1, "#6b1500");
      } else {
        g.addColorStop(0, "#1c1e54"); g.addColorStop(1, "#533afd");
      }
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    });

    const materials = [
      new THREE.MeshStandardMaterial({ map: edgeTex }),
      new THREE.MeshStandardMaterial({ map: edgeTex }),
      new THREE.MeshStandardMaterial({ map: edgeTex }),
      new THREE.MeshStandardMaterial({ map: edgeTex }),
      new THREE.MeshStandardMaterial({ map: frontTex }),
      new THREE.MeshStandardMaterial({ map: backTex }),
    ];
    materials.forEach((m) => { m.metalness = 0.3; m.roughness = 0.4; });

    const card = new THREE.Mesh(geo, materials);
    card.castShadow = true;
    scene.add(card);

    /* ── Floating particles ── */
    const particleGeo = new THREE.BufferGeometry();
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 10;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleColor = isMC ? 0xeb001b : 0x533afd;
    const particleMat = new THREE.PointsMaterial({ color: particleColor, size: 0.04, transparent: true, opacity: 0.6 });
    scene.add(new THREE.Points(particleGeo, particleMat));

    /* ── Resize observer ── */
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    /* ── Animation ── */
    let frame: number;
    const timer = new THREE.Timer();

    function animate() {
      frame = requestAnimationFrame(animate);
      timer.update();
      const t = timer.getElapsed();

      card.position.y = Math.sin(t * 0.8) * 0.06;
      card.rotation.z = Math.sin(t * 0.5) * 0.015;

      accent1Light.position.x = Math.sin(t * 0.7) * 3;
      accent1Light.position.y = Math.cos(t * 0.5) * 2;
      accent2Light.position.x = Math.cos(t * 0.6) * 3;
      accent2Light.position.y = Math.sin(t * 0.8) * 2;

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geo.dispose();
      particleGeo.dispose();
      materials.forEach((m) => m.dispose());
      frontTex.dispose();
      backTex.dispose();
      edgeTex.dispose();
      particleMat.dispose();
    };
  }, [cardholderName, variant]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", ...style }} />;
}
