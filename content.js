(() => {
  // ─── Config ────────────────────────────────────────────────────────────────
  const CONFIG = {
    fps: 8,
    width: 64,
    height: 47,
    walkSpeed: 1, // px per frame
    runSpeed: 3, // px per frame
    jumpHeight: 20, // px above bottom at peak of jump
    runCooldown: 1000, // ms of no scrolling before returning to walk
    inactiveDeadMs: 5 * 60 * 1000, // ms of tab inactivity before dead animation
    minDirectionMs: 800, // min ms before a random direction change
    maxDirectionMs: 2500, // max ms before a random direction change
    animations: {
      walk: { frames: 10, loop: true },
      run: { frames: 8, loop: true },
      jump: { frames: 12, loop: false },
      idle: { frames: 10, loop: true },
      dead: { frames: 8, loop: false },
    },
  };

  // ─── State ──────────────────────────────────────────────────────────────────
  let state = "walk";
  let frameIndex = 0;
  let posX = 0;
  let facingRight = true;
  let visible = true;

  let posY = 0;

  let scrollTimer = null;
  let deadTimer = null;
  let intervalId = null;
  let directionTimer = null;

  // ─── DOM ────────────────────────────────────────────────────────────────────
  const wrapper = document.createElement("div");
  wrapper.id = "onri-sprite";

  const img = document.createElement("img");
  img.width = CONFIG.width;
  img.height = CONFIG.height;
  img.alt = "";
  img.draggable = false;

  wrapper.appendChild(img);
  document.body.appendChild(wrapper);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function frameUrl(animState, index) {
    return chrome.runtime.getURL(`sprites/${animState}/${animState}_${index + 1}.png`);
  }

  function applyVisibility() {
    wrapper.style.display = visible ? "" : "none";
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    frameIndex = 0;
  }

  function scheduleDirectionChange() {
    const delay = CONFIG.minDirectionMs + Math.random() * (CONFIG.maxDirectionMs - CONFIG.minDirectionMs);
    directionTimer = setTimeout(() => {
      if ((state === "walk" || state === "run") && Math.random() < 0.15) {
        facingRight = !facingRight;
        wrapper.classList.toggle("flipped", !facingRight);
      }
      scheduleDirectionChange();
    }, delay);
  }

  function updatePosition() {
    const speed = state === "run" ? CONFIG.runSpeed : CONFIG.walkSpeed;
    posX += facingRight ? speed : -speed;

    const maxX = window.innerWidth - CONFIG.width;
    if (posX >= maxX) {
      posX = maxX;
      facingRight = false;
    } else if (posX <= 0) {
      posX = 0;
      facingRight = true;
    }

    wrapper.style.left = posX + "px";
    wrapper.classList.toggle("flipped", !facingRight);
  }

  // ─── Animation tick ─────────────────────────────────────────────────────────
  function tick() {
    const anim = CONFIG.animations[state];

    // advance frame
    if (anim.loop) {
      frameIndex = (frameIndex + 1) % anim.frames;
    } else {
      if (frameIndex < anim.frames - 1) {
        frameIndex++;
      } else {
        // non-looping animation finished
        if (state === "jump") {
          posY = 0;
          wrapper.style.bottom = "0px";
          setState("walk");
        }
        // dead holds its last frame — no transition
      }
    }

    img.src = frameUrl(state, frameIndex);

    if (state === "walk" || state === "run" || state === "jump") {
      updatePosition();
    }

    if (state === "jump") {
      const totalFrames = CONFIG.animations.jump.frames;
      posY = Math.round(CONFIG.jumpHeight * Math.sin(Math.PI * (frameIndex / (totalFrames - 1))));
      wrapper.style.bottom = posY + "px";
    }
  }

  function startLoop() {
    if (intervalId === null) {
      intervalId = setInterval(tick, 1000 / CONFIG.fps);
    }
    if (directionTimer === null) {
      scheduleDirectionChange();
    }
  }

  function stopLoop() {
    if (intervalId === null) return;
    clearInterval(intervalId);
    intervalId = null;
    clearTimeout(directionTimer);
    directionTimer = null;
  }

  // ─── Event handlers ─────────────────────────────────────────────────────────
  window.addEventListener(
    "scroll",
    () => {
      if (!visible) return;
      if (state === "idle" || state === "dead") return;

      setState("run");

      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (state === "run") setState("walk");
      }, CONFIG.runCooldown);
    },
    { passive: true },
  );

  wrapper.addEventListener("click", () => {
    if (!visible) return;
    if (state === "dead") return;
    setState("jump");
    frameIndex = 0;
  });

  function onInactive() {
    clearTimeout(scrollTimer);
    clearTimeout(directionTimer);
    directionTimer = null;
    setState("idle");

    clearTimeout(deadTimer);
    deadTimer = setTimeout(() => {
      setState("dead");
      frameIndex = 0;
    }, CONFIG.inactiveDeadMs);
  }

  function onActive() {
    if (!visible) return;
    clearTimeout(deadTimer);
    deadTimer = null;
    setState("walk");
    startLoop();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      onInactive();
    } else {
      onActive();
    }
  });

  window.addEventListener("blur", onInactive);
  window.addEventListener("focus", onActive);

  // ─── Message listener (popup show/hide) ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "show") {
      visible = true;
      applyVisibility();
      if (!document.hidden) startLoop();
      chrome.storage.local.set({ visible: true });
    } else if (message.action === "hide") {
      visible = false;
      applyVisibility();
      stopLoop();
      chrome.storage.local.set({ visible: false });
    }
  });

  // ─── Init ───────────────────────────────────────────────────────────────────
  chrome.storage.local.get({ visible: true }, (result) => {
    visible = result.visible;
    applyVisibility();

    img.src = frameUrl(state, frameIndex);
    wrapper.style.left = posX + "px";

    if (visible && !document.hidden) {
      startLoop();
    }
  });
})();
