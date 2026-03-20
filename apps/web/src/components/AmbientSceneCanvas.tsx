import { useEffect, useRef } from 'react';

interface AmbientSceneCanvasProps {
  variant?: 'home' | 'room';
  className?: string;
}

interface BlobConfig {
  radius: number;
  color: string;
  speed: number;
  drift: number;
  originX: number;
  originY: number;
}

function buildBlobs(variant: 'home' | 'room'): BlobConfig[] {
  if (variant === 'room') {
    return [
      {
        radius: 210,
        color: 'rgba(100, 217, 255, 0.20)',
        speed: 0.00018,
        drift: 0.11,
        originX: 0.22,
        originY: 0.28,
      },
      {
        radius: 260,
        color: 'rgba(190, 98, 255, 0.22)',
        speed: 0.00014,
        drift: 0.09,
        originX: 0.78,
        originY: 0.22,
      },
      {
        radius: 230,
        color: 'rgba(76, 244, 197, 0.16)',
        speed: 0.00022,
        drift: 0.1,
        originX: 0.52,
        originY: 0.68,
      },
    ];
  }

  return [
    {
      radius: 250,
      color: 'rgba(100, 217, 255, 0.16)',
      speed: 0.00012,
      drift: 0.08,
      originX: 0.18,
      originY: 0.32,
    },
    {
      radius: 280,
      color: 'rgba(190, 98, 255, 0.18)',
      speed: 0.0001,
      drift: 0.07,
      originX: 0.82,
      originY: 0.18,
    },
    {
      radius: 320,
      color: 'rgba(76, 244, 197, 0.13)',
      speed: 0.00008,
      drift: 0.05,
      originX: 0.52,
      originY: 0.72,
    },
  ];
}

export function AmbientSceneCanvas({
  variant = 'home',
  className,
}: AmbientSceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const sceneCanvas = canvas;
    const sceneContext = context;
    const blobs = buildBlobs(variant);
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    let width = 0;
    let height = 0;
    let animationFrameId = 0;

    function resizeCanvas() {
      const nextWidth = sceneCanvas.clientWidth;
      const nextHeight = sceneCanvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = nextWidth;
      height = nextHeight;
      sceneCanvas.width = Math.max(1, Math.floor(nextWidth * dpr));
      sceneCanvas.height = Math.max(1, Math.floor(nextHeight * dpr));
      sceneContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawFrame(time: number) {
      sceneContext.clearRect(0, 0, width, height);

      for (const blob of blobs) {
        const x =
          width * blob.originX +
          Math.sin(time * blob.speed) * (width * blob.drift);
        const y =
          height * blob.originY +
          Math.cos(time * blob.speed * 1.2) * (height * blob.drift);
        const gradient = sceneContext.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          blob.radius,
        );

        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(0.5, blob.color.replace(/0\.\d+\)/, '0.07)'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        sceneContext.fillStyle = gradient;
        sceneContext.beginPath();
        sceneContext.arc(x, y, blob.radius, 0, Math.PI * 2);
        sceneContext.fill();
      }

      sceneContext.strokeStyle =
        variant === 'room'
          ? 'rgba(141, 155, 255, 0.12)'
          : 'rgba(141, 155, 255, 0.08)';
      sceneContext.lineWidth = 1;

      for (let index = 0; index < 6; index += 1) {
        const curveOffset = reducedMotion
          ? index * 20
          : index * 24 + time * 0.006;

        sceneContext.beginPath();
        sceneContext.ellipse(
          width * 0.5,
          height * 0.62,
          width * (0.24 + index * 0.06),
          height * (0.11 + index * 0.03),
          0,
          Math.PI + curveOffset * 0.003,
          Math.PI * 2 + curveOffset * 0.003,
        );
        sceneContext.stroke();
      }

      if (!reducedMotion) {
        animationFrameId = window.requestAnimationFrame(drawFrame);
      }
    }

    resizeCanvas();
    drawFrame(0);

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [variant]);

  return (
    <canvas ref={canvasRef} className={className} data-variant={variant} />
  );
}
