import React, { useEffect, useRef } from 'react';

export default function InteractiveBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Mouse interaction (wind)
    const mouse = { x: -1000, y: -1000, radius: 200 };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);

    // Particle physics (Snowflakes)
    const snowflakes = [];
    const snowflakeCount = 200; // Denser for snow

    class Snowflake {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        // Size between 1 and 3
        this.size = Math.random() * 2 + 1;
        // Fall speed based on size
        this.vy = (Math.random() * 1 + 0.5) * (this.size / 2);
        // Horizontal drift
        this.vx = Math.random() * 1 - 0.5;
        this.baseVx = this.vx;
        // Sway offset
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.02;
      }

      update() {
        // Natural falling and swaying
        this.angle += this.spin;
        this.x += this.vx + Math.sin(this.angle) * 0.5;
        this.y += this.vy;

        // Reset to top if it goes off bottom
        if (this.y > canvas.height + 10) {
          this.y = -10;
          this.x = Math.random() * canvas.width;
        }
        // Wrap horizontally
        if (this.x > canvas.width + 10) this.x = -10;
        if (this.x < -10) this.x = canvas.width + 10;

        // Mouse interaction (Wind/Repulsion)
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
          // Push snowflakes away from the mouse
          const forceDirectionX = dx / distance;
          const force = (mouse.radius - distance) / mouse.radius;
          const pushX = forceDirectionX * force * 5;
          
          this.x -= pushX;
          // Slowly recover original velocity
          this.vx = this.baseVx - pushX * 0.1;
        } else {
          // Return to normal horizontal speed
          this.vx += (this.baseVx - this.vx) * 0.05;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        // Slate/Silvery color so it's visible on the light dashboard background
        ctx.fillStyle = `rgba(148, 163, 184, ${0.4 + this.size * 0.15})`; 
        ctx.fill();
      }
    }

    // Initialize snowflakes
    for (let i = 0; i < snowflakeCount; i++) {
      snowflakes.push(new Snowflake());
    }

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw snowflakes
      snowflakes.forEach(flake => {
        flake.update();
        flake.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ backgroundColor: '#f8f9fa' }} // Light dashboard background
    />
  );
}
