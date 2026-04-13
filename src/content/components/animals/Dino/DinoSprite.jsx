import { useState, useEffect, useRef } from 'react';

const CONFIG = {
  fps: 8,
  width: 64,
  height: 47,
  walkSpeed: 1,
  runSpeed: 3,
  jumpHeight: 20,
  runCooldown: 1000,
  inactiveDeadMs: 5 * 60 * 1000,
  minDirectionMs: 800,
  maxDirectionMs: 2500,
  animations: {
    walk: { frames: 10, loop: true },
    run:  { frames: 8,  loop: true },
    jump: { frames: 12, loop: false },
    idle: { frames: 10, loop: true },
    dead: { frames: 8,  loop: false },
  },
};

function frameUrl(animState, index) {
  return chrome.runtime.getURL(
    `sprites/dino/${animState}/${animState}_${index + 1}.png`
  );
}

export default function DinoSprite({ visible }) {
  const [renderState, setRenderState] = useState({
    src: frameUrl('walk', 0),
    left: 0,
    bottom: 0,
    flipped: false,
  });

  // Mutable animation state kept in refs — avoids stale closures inside setInterval
  const animState   = useRef('walk');
  const frameIndex  = useRef(0);
  const posX        = useRef(0);
  const facingRight = useRef(true);
  const posY        = useRef(0);
  const visibleRef  = useRef(visible);

  // Timer refs
  const intervalId     = useRef(null);
  const scrollTimer    = useRef(null);
  const deadTimer      = useRef(null);
  const directionTimer = useRef(null);

  // Expose loop controls so the visibility effect can trigger them
  const startLoopRef = useRef(null);
  const stopLoopRef  = useRef(null);

  // Keep visibleRef current with the prop
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Main animation engine — set up once on mount, torn down on unmount
  useEffect(() => {
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
      } else {
        if (frameIndex.current < anim.frames - 1) {
          frameIndex.current++;
        } else {
          if (animState.current === 'jump') {
            posY.current = 0;
            setState('walk');
          }
          // dead holds its last frame — no transition
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
        src: frameUrl(animState.current, frameIndex.current),
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
        setState('dead');
        frameIndex.current = 0;
      }, CONFIG.inactiveDeadMs);
    }

    function onActive() {
      if (!visibleRef.current) return;
      clearTimeout(deadTimer.current);
      deadTimer.current = null;
      setState('walk');
      startLoop();
    }

    // Expose to the visibility effect
    startLoopRef.current = startLoop;
    stopLoopRef.current  = stopLoop;

    const handleScroll = () => {
      if (!visibleRef.current) return;
      if (animState.current === 'idle' || animState.current === 'dead') return;
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

    if (visibleRef.current && !document.hidden) {
      startLoop();
    }

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

  // React to visible prop changes
  useEffect(() => {
    if (visible) {
      if (!document.hidden) startLoopRef.current?.();
    } else {
      stopLoopRef.current?.();
    }
  }, [visible]);

  const handleClick = () => {
    if (!visibleRef.current) return;
    if (animState.current === 'dead') return;
    animState.current = 'jump';
    frameIndex.current = 0;
  };

  if (!visible) return null;

  return (
    <div
      id="onri-sprite"
      style={{ left: renderState.left + 'px', bottom: renderState.bottom + 'px' }}
      className={renderState.flipped ? 'flipped' : ''}
      onClick={handleClick}
    >
      <img
        src={renderState.src}
        width={CONFIG.width}
        height={CONFIG.height}
        alt=""
        draggable={false}
      />
    </div>
  );
}
