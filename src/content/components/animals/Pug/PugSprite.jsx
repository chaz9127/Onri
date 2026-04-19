import { useState, useEffect, useRef } from 'react';

const SHEET_W = 677;
const SHEET_H = 478;
const FRAME   = 32;  // native frame px
const CELL    = 64;  // frame + gap (32+32)
const SCALE   = 1;   // display at 2×
const DISPLAY = FRAME * SCALE; // 64px

const CONFIG = {
  fps: 8,
  width: DISPLAY,
  height: DISPLAY,
  walkSpeed: 1,
  runSpeed: 3,
  jumpHeight: 20,
  runCooldown: 1000,
  inactiveDeadMs: 5 * 60 * 1000,
  minDirectionMs: 800,
  maxDirectionMs: 2500,
  animations: {
    walk:  { row: 4, frames: 5,  loop: true  },
    run:   { row: 5, frames: 8,  loop: true  },
    jump:  { row: 0, frames: 11, loop: false },
    idle:  { row: 2, frames: 5,  loop: true  },
    sleep: { row: 3, frames: 9,  loop: false },
  },
};

const sheetUrl = chrome.runtime.getURL('sprites/pug/animations.png');

function bgPosition(row, col) {
  return `-${col * CELL * SCALE}px -${row * CELL * SCALE}px`;
}

export default function PugSprite() {
  const [renderState, setRenderState] = useState({
    row: CONFIG.animations.walk.row,
    frameIndex: 0,
    left: 0,
    bottom: 0,
    flipped: false,
  });

  const animState   = useRef('walk');
  const frameIndex  = useRef(0);
  const posX        = useRef(0);
  const facingRight = useRef(true);
  const posY        = useRef(0);

  const intervalId     = useRef(null);
  const scrollTimer    = useRef(null);
  const deadTimer      = useRef(null);
  const directionTimer = useRef(null);

  const stepsRef = useRef(0);

  useEffect(() => {
    chrome.storage.local.get({ steps_pug: 0 }, (result) => {
      stepsRef.current = result.steps_pug;
    });

    function addStep() {
      stepsRef.current += 1;
      chrome.storage.local.set({ steps_pug: stepsRef.current });
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
            addStep();
          }
          // sleep holds its last frame
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
        row: CONFIG.animations[animState.current].row,
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
          width: DISPLAY + 4, // weird sprite sheet
          height: DISPLAY,
          backgroundImage: `url(${sheetUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: bgPosition(renderState.row, renderState.frameIndex),
          backgroundSize: `${SHEET_W * SCALE}px ${SHEET_H * SCALE}px`,
          imageRendering: 'pixelated',
          transform: renderState.flipped ? 'scaleX(-1)' : undefined,
        }}
      />
    </div>
  );
}
