import { useEffect, useRef } from 'react';
import './christmas-theme.css';

// Set VITE_CHRISTMAS_THEME=false in the frontend environment to disable the seasonal layer.
const enabled = import.meta.env.VITE_CHRISTMAS_THEME !== 'false';

function createSnowflake(width, height) {
  const depth = Math.random();
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.65 + depth * 2.15,
    depth,
    speed: 0.16 + depth * 0.48,
    drift: (Math.random() - 0.5) * 0.2,
    phase: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.012,
    blur: depth > 0.82 ? 0.65 : 0,
    flake: depth > 0.7 && Math.random() > 0.58,
  };
}

export default function ChristmasAtmosphere({ children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    document.body.classList.add('christmas-enabled');

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return () => document.body.classList.remove('christmas-enabled');
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let flakes = [];
    let frameId = 0;
    let previousFrame = 0;

    function resize() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      flakes = Array.from(
        { length: Math.min(54, Math.max(20, Math.round((width * height) / 30000))) },
        () => createSnowflake(width, height),
      );
      draw(0, false);
    }

    function draw(timestamp, animate = true) {
      context.clearRect(0, 0, width, height);
      const delta = Math.min((timestamp - previousFrame) || 16, 40) / 16;
      previousFrame = timestamp;

      flakes.forEach((flake) => {
        if (animate) {
          flake.phase += 0.008 * delta;
          flake.y += flake.speed * delta;
          flake.x += (flake.drift + Math.sin(flake.phase) * 0.16) * delta;
          flake.rotation += flake.rotationSpeed * delta;
          if (flake.y > height + 8) {
            flake.y = -8;
            flake.x = Math.random() * width;
          }
          if (flake.x < -8) flake.x = width + 8;
          if (flake.x > width + 8) flake.x = -8;
        }

        context.save();
        context.translate(flake.x, flake.y);
        context.rotate(flake.rotation);
        context.globalAlpha = 0.2 + flake.depth * 0.46;
        context.filter = flake.blur ? `blur(${flake.blur}px)` : 'none';
        context.shadowColor = 'rgba(207, 231, 255, 0.7)';
        context.shadowBlur = flake.depth > 0.68 ? 5 : 1;
        const snowGlow = context.createRadialGradient(
          -flake.radius * 0.3,
          -flake.radius * 0.35,
          0,
          0,
          0,
          flake.radius * 1.4,
        );
        snowGlow.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        snowGlow.addColorStop(0.58, 'rgba(239, 248, 255, 0.78)');
        snowGlow.addColorStop(1, 'rgba(185, 213, 241, 0)');
        context.fillStyle = snowGlow;
        context.beginPath();
        context.arc(0, 0, flake.radius, 0, Math.PI * 2);
        context.fill();

        if (flake.flake) {
          context.lineWidth = 0.55;
          context.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          context.beginPath();
          context.moveTo(-flake.radius * 1.7, 0);
          context.lineTo(flake.radius * 1.7, 0);
          context.moveTo(0, -flake.radius * 1.7);
          context.lineTo(0, flake.radius * 1.7);
          context.stroke();
        }
        context.restore();
      });
    }

    function animate(timestamp) {
      if (timestamp - previousFrame >= 30) draw(timestamp);
      frameId = window.requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    if (!reduceMotion) frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      document.body.classList.remove('christmas-enabled');
    };
  }, []);

  return (
    <>
      {enabled && <canvas ref={canvasRef} className="christmas-snowfall" aria-hidden="true" />}
      {children}
    </>
  );
}
