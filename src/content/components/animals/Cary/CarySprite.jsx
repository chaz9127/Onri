import { useState, useEffect, useRef } from 'react';

const CONFIG = {
  fps: 8,
  width: 48,
  height: 48,
  walkSpeed: 1,
  runSpeed: 3,
  jumpHeight: 20,
  runCooldown: 1000,
  inactiveDeadMs: 5 * 60 * 1000,
  minDirectionMs: 800,
  maxDirectionMs: 2500,
  animations: {
    walk:  { frames: 4,  loop: true },
    run:   { frames: 6,  loop: true },
    jump:  { frames: 15, loop: false },
    idle:  { frames: 7,  loop: true },
    sleep: { frames: 4,  loop: false }, // stays on last frame like dead
  },
};

function sheetUrl(animState) {
  return chrome.runtime.getURL(`sprites/cary/${animState}.png`);
}

export default function CarySprite() {
  const [renderState, setRenderState] = useState({
    animState: 'walk',
    frameIndex: 0,
    left: 0,
    bottom: 0,
    flipped: false,
  });

  // Mutable animation state in refs — avoids stale closures inside setInterval
  const animState   = useRef('walk');
  const frameIndex  = useRef(0);
  const posX        = useRef(0);
  const facingRight = useRef(true);
  const posY        = useRef(0);

  // Timer refs
  const intervalId     = useRef(null);
  const scrollTimer    = useRef(null);
  const deadTimer      = useRef(null);
  const directionTimer = useRef(null);

  // Step counter — persisted to chrome.storage.local
  const stepsRef = useRef(0);

  // Main animation engine — set up once on mount, torn down on unmount
  useEffect(() => {
    chrome.storage.local.get({ steps_cary: 0 }, (result) => {
      stepsRef.current = result.steps_cary;
    });

    function addStep() {
      stepsRef.current += 1;
      chrome.storage.local.set({ steps_cary: stepsRef.current });
    }
    function setState(next) {
      if (animState.current === next) return;
      animState.current = next;
      frameIndex.current = 0;
    }

    function scheduleDirectionChange() {
      const delay =
        CONFIG.minDirectionMs +
        Math.random() * (CONFIG.maxDirectionMs - CONFIG.minDirectionMs);
      directionTimer.current = setTimeout(() => {
        if (
          (animState.current === 'walk' || animState.current === 'run') &&
          Math.random() < 0.15
        ) {
          facingRight.current = !facingRight.current;
        }
        scheduleDirectionChange();
      }, delay);
    }

    function updatePosition() {
      const speed =
        animState.current === 'run' ? CONFIG.runSpeed : CONFIG.walkSpeed;
      posX.current += facingRight.current ? speed : -speed;

      const maxX = window.innerWidth - CONFIG.width;
      if (posX.current >= maxX) {
        posX.current = maxX;
        facingRight.current = false;
      } else if (posX.current <= 0) {
        posX.current = 0;
        facingRight.current = true;
      }
    }

    function tick() {
      const anim = CONFIG.animations[animState.current];

      if (anim.loop) {
        frameIndex.current = (frameIndex.current + 1) % anim.frames;
        // Step at halfway point and at wrap (full cycle) for walk/run
        if (animState.current === 'walk' || animState.current === 'run') {
          const mid = Math.floor(anim.frames / 2);
          if (frameIndex.current === mid || frameIndex.current === 0) {
            addStep();
          }
        }
      } else {
        if (frameIndex.current < anim.frames - 1) {
          frameIndex.current++;
        } else {
          if (animState.current === 'jump') {
            posY.current = 0;
            setState('walk');
            addStep(); // 1 step when jump cycle completes
          }
          // sleep holds its last frame — no transition
        }
      }

      if (
        animState.current === 'walk' ||
        animState.current === 'run' ||
        animState.current === 'jump'
      ) {
        updatePosition();
      }

      if (animState.current === 'jump') {
        const totalFrames = CONFIG.animations.jump.frames;
        posY.current = Math.round(
          CONFIG.jumpHeight *
            Math.sin(Math.PI * (frameIndex.current / (totalFrames - 1)))
        );
      }

      setRenderState({
        animState: animState.current,
        frameIndex: frameIndex.current,
        left: posX.current,
        bottom: posY.current,
        flipped: !facingRight.current,
      });
    }

    function startLoop() {
      if (intervalId.current === null) {
        intervalId.current = setInterval(tick, 1000 / CONFIG.fps);
      }
      if (directionTimer.current === null) {
        scheduleDirectionChange();
      }
    }

    function stopLoop() {
      if (intervalId.current === null) return;
      clearInterval(intervalId.current);
      intervalId.current = null;
      clearTimeout(directionTimer.current);
      directionTimer.current = null;
    }

    function onInactive() {
      clearTimeout(scrollTimer.current);
      clearTimeout(directionTimer.current);
      directionTimer.current = null;
      setState('idle');

      clearTimeout(deadTimer.current);
      deadTimer.current = setTimeout(() => {
        setState('sleep');
        frameIndex.current = 0;
      }, CONFIG.inactiveDeadMs);
    }

    function onActive() {
      clearTimeout(deadTimer.current);
      deadTimer.current = null;
      setState('walk');
      startLoop();
    }

    const handleScroll = () => {
      if (animState.current === 'idle' || animState.current === 'sleep') return;
      setState('run');
      clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        if (animState.current === 'run') setState('walk');
      }, CONFIG.runCooldown);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) onInactive();
      else onActive();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', onInactive);
    window.addEventListener('focus', onActive);

    if (!document.hidden) startLoop();

    return () => {
      stopLoop();
      clearTimeout(scrollTimer.current);
      clearTimeout(deadTimer.current);
      clearTimeout(directionTimer.current);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', onInactive);
      window.removeEventListener('focus', onActive);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    if (animState.current === 'sleep') return;
    animState.current = 'jump';
    frameIndex.current = 0;
  };

  return (
    <div
      className="onri-sprite"
      style={{ left: renderState.left + 'px', bottom: renderState.bottom + 'px' }}
      onClick={handleClick}
    >
      <div
        style={{
          width: CONFIG.width,
          height: CONFIG.height,
          backgroundImage: `url(${sheetUrl(renderState.animState)})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `-${renderState.frameIndex * CONFIG.width}px 0`,
          backgroundSize: 'auto 100%',
          imageRendering: 'pixelated',
          transform: renderState.flipped ? 'scaleX(-1)' : undefined,
        }}
      />
    </div>
  );
}
