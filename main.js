(() => {
  const root = document.documentElement;
  const $ = (selector, base = document) => base.querySelector(selector);
  const $$ = (selector, base = document) => Array.from(base.querySelectorAll(selector));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CONFIG = {
    siteStartDate: '2026-06-04',
    typingTexts: [
      '今天也要向喜欢的未来靠近一点。',
      '把普通日子过成自己的星河。',
      '奔赴星辰大海，不负心中热爱。'
    ]
  };

  function currentTheme() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function updateThemeButton() {
    const dark = currentTheme() === 'dark';
    const text = $('#themeText');
    const icon = $('#themeIcon');
    const button = $('#themeBtn');
    if (text) text.textContent = dark ? '浅色' : '深色';
    if (button) {
      const label = dark ? '切换为浅色主题' : '切换为深色主题';
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    if (icon) icon.innerHTML = dark
      ? '<path d="M12 4v1.5M12 18.5V20M4 12h1.5M18.5 12H20M6.3 6.3l1 1M16.7 16.7l1 1M17.7 6.3l-1 1M7.3 16.7l-1 1"></path><circle cx="12" cy="12" r="4"></circle>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"></path>';
  }

  function initTheme() {
    // 默认进入网站强制深色，避免浏览器里旧的 light 缓存把页面变浅色。
    root.dataset.theme = 'dark';
    try { localStorage.setItem('theme', 'dark'); } catch (error) {}
    updateThemeButton();
    $('#themeBtn')?.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (error) {}
      updateThemeButton();
    });
  }

  function initTyping() {
    const el = $('#typeText');
    if (!el) return;
    if (prefersReducedMotion) {
      el.textContent = CONFIG.typingTexts[0];
      return;
    }
    let textIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const TYPE_BASE = 82;
    const DELETE_BASE = 42;
    const HOLD_AFTER_TYPE = 1550;
    const HOLD_AFTER_DELETE = 460;

    const nextDelay = (text, typedChar = '') => {
      if (deleting) return DELETE_BASE + Math.random() * 18;
      if ('，。！？、'.includes(typedChar)) return TYPE_BASE + 140;
      return TYPE_BASE + Math.random() * 26;
    };

    const tick = () => {
      const text = CONFIG.typingTexts[textIndex % CONFIG.typingTexts.length];

      if (!deleting) {
        charIndex = Math.min(text.length, charIndex + 1);
        el.textContent = text.slice(0, charIndex);
        if (charIndex < text.length) {
          setTimeout(tick, nextDelay(text, text[charIndex - 1]));
          return;
        }
        deleting = true;
        setTimeout(tick, HOLD_AFTER_TYPE);
        return;
      }

      charIndex = Math.max(0, charIndex - 1);
      el.textContent = text.slice(0, charIndex);
      if (charIndex > 0) {
        setTimeout(tick, nextDelay(text));
        return;
      }

      deleting = false;
      textIndex += 1;
      setTimeout(tick, HOLD_AFTER_DELETE);
    };

    setTimeout(tick, 260);
  }

  function initStars() {
    const canvas = $('#starsCanvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (prefersReducedMotion) {
      canvas.hidden = true;
      return;
    }
    let stars = [];
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.min(120, Math.floor(innerWidth * innerHeight / 11000)) }, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        r: Math.random() * 1.4 + .3,
        a: Math.random(),
        s: Math.random() * .018 + .006
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      stars.forEach((star) => {
        star.a += star.s;
        const alpha = .24 + Math.abs(Math.sin(star.a)) * .5;
        ctx.beginPath();
        ctx.fillStyle = `rgba(210,230,244,${alpha})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    resize(); draw();
    addEventListener('resize', resize, { passive: true });
  }

  function initMeteor() {
    const layer = $('#meteorLayer');
    if (!layer) return;
    if (prefersReducedMotion) {
      layer.hidden = true;
      return;
    }
    const spawn = () => {
      const meteor = document.createElement('span');
      meteor.className = 'meteor fly';
      meteor.style.left = `${Math.random() * 90 + 8}vw`;
      meteor.style.top = `${Math.random() * 45 + 4}vh`;
      meteor.style.animationDuration = `${Math.random() * 1.2 + 1.2}s`;
      layer.appendChild(meteor);
      setTimeout(() => meteor.remove(), 2600);
      setTimeout(spawn, Math.random() * 4200 + 2600);
    };
    setTimeout(spawn, 1200);
  }

  function initNavigation() {
    const backTop = $('#backTopBtn');
    const nav = $('#siteNav');
    const hasHero = Boolean($('.hero'));
    const onScroll = () => {
      const top = window.scrollY || document.documentElement.scrollTop || 0;
      backTop?.classList.toggle('is-hidden', top < 220);
      nav?.classList.toggle('nav-collapsed-top', hasHero && top <= 90);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    backTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    onScroll();

    $$('[data-scroll-target]').forEach((btn) => btn.addEventListener('click', (event) => {
      const target = $(btn.dataset.scrollTarget || '');
      if (!target) return;
      if (btn.matches('a[href^="#"]')) event.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }));

    $$('a[href="#messageBox"]').forEach((link) => link.addEventListener('click', () => {
      const details = $('.message-accordion');
      if (details) details.open = true;
    }));

    onScroll();
  }



  function initPhysicsBlocks() {
    const card = $('#physicsCard');
    const stage = $('#physicsStage');
    const loading = $('#physicsLoading');
    const staticGrid = $('#physicsStaticGrid');
    const toggleBtn = $('#physicsToggleBtn');
    if (!card || !stage || !staticGrid || !toggleBtn) return;

    let started = false;
    let loadingMatter = false;
    let engine = null;
    let render = null;
    let runner = null;
    let bodies = [];
    let blockEls = [];
    let stageWidth = 0;
    let stageHeight = 0;
    let animationFrameId = 0;
    let spawnQueue = [];
    let spawnTimer = 0;
    let attachDomDrag = null;

    function setButtonState(mode = 'static') {
      const active = mode === 'active';
      const waiting = mode === 'loading';
      toggleBtn.disabled = waiting;
      if (waiting) {
        toggleBtn.textContent = '物理效果加载中...';
      } else if (active) {
        toggleBtn.textContent = '关闭物理效果';
      } else {
        toggleBtn.textContent = '加载物理效果';
      }
    }

    function showLoading(text = '物理引擎加载中...') {
      if (!loading) return;
      loading.textContent = text;
      loading.classList.remove('is-hidden');
    }

    function hideLoading() {
      if (!loading) return;
      loading.classList.add('is-hidden');
    }

    const games = [
      { name: 'Astroneer', src: 'https://user15484.cn.imgto.link/public/20260629/img-5350.avif', ratio: 0.6667 },
      { name: 'Delta Force', src: 'https://user15484.cn.imgto.link/public/20260629/img-5355.avif', ratio: 0.7765 },
      { name: "Don't Starve", src: 'https://user15484.cn.imgto.link/public/20260629/img-5348.avif', ratio: 0.6667 },
      { name: "Garry's Mod", src: 'https://user15484.cn.imgto.link/public/20260629/img-5672.avif', ratio: 0.6655 },
      { name: 'Goat Simulator', src: 'https://user15484.cn.imgto.link/public/20260629/img-5368.avif', ratio: 0.6708 },
      { name: 'Half-Life', src: 'https://user15484.cn.imgto.link/public/20260629/img-5353.avif', ratio: 0.6961 },
      { name: 'Half-Life 2', src: 'https://user15484.cn.imgto.link/public/20260629/img-5354.avif', ratio: 0.727 },
      { name: 'Jalopy', src: 'https://user15484.cn.imgto.link/public/20260629/img-5360.avif', ratio: 0.6667 },
      { name: 'Left 4 Dead 2', src: 'https://user15484.cn.imgto.link/public/20260629/img-5352.avif', ratio: 0.6667 },
      { name: 'Lethal Company', src: 'https://user15484.cn.imgto.link/public/20260629/img-5357.avif', ratio: 0.6667 },
      { name: 'Minecraft', src: 'https://user15484.cn.imgto.link/public/20260629/img-5674.avif', ratio: 0.6655 },
      { name: 'Outer Wilds', src: 'https://user15484.cn.imgto.link/public/20260629/img-5342.avif', ratio: 0.7767 },
      { name: 'Rust', src: 'https://user15484.cn.imgto.link/public/20260629/img-5673.avif', ratio: 0.749 },
      { name: 'SCP: Secret Laboratory', src: 'https://user15484.cn.imgto.link/public/20260629/img-5344.avif', ratio: 0.7022 },
      { name: 'Slime Rancher', src: 'https://user15484.cn.imgto.link/public/20260629/img-5343.avif', ratio: 0.6655 },
      { name: 'Stardew Valley', src: 'https://user15484.cn.imgto.link/public/20260629/img-5328.avif', ratio: 0.75 },
      { name: 'Terraria', src: 'https://user15484.cn.imgto.link/public/20260629/img-5670.avif', ratio: 0.6655 },
      { name: 'The Forest', src: 'https://user15484.cn.imgto.link/public/20260629/img-5363.avif', ratio: 0.6667 },
      { name: 'Undertale', src: 'https://user15484.cn.imgto.link/public/20260629/img-5356.avif', ratio: 0.7636 },
      { name: 'Unturned', src: 'https://user15484.cn.imgto.link/public/20260629/img-5367.avif', ratio: 0.6699 },
      { name: 'VRChat', src: 'https://user15484.cn.imgto.link/public/20260629/img-5671.avif', ratio: 0.749 },
      { name: 'We Happy Few', src: 'https://user15484.cn.imgto.link/public/20260629/img-5362.avif', ratio: 0.7765 },
      { name: 'TO THE MOON', src: 'https://user15484.cn.imgto.link/public/20260629/img-5675.avif', ratio: 0.6667 },
      { name: 'Lost Castle', src: 'https://user15484.cn.imgto.link/public/20260629/img-5676.avif', ratio: 0.6667 }
    ];

    function renderStaticGrid() {
      staticGrid.innerHTML = games.map((game) => `
        <article class="physics-static-item" title="${game.name}">
          <img src="${game.src}" alt="${game.name}" loading="lazy" />
        </article>
      `).join('');
    }

    function loadMatter() {
      if (window.Matter) return Promise.resolve(window.Matter);
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js';
        script.async = true;
        script.onload = () => window.Matter ? resolve(window.Matter) : reject(new Error('Matter.js 未加载成功'));
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    function createDomBlock(game, width, height) {
      const el = document.createElement('div');
      el.className = 'game-physics-block';
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.dataset.game = game.name;
      el.style.opacity = '0';
      el.style.touchAction = 'none';

      const img = document.createElement('img');
      img.src = game.src;
      img.alt = game.name;
      img.draggable = false;
      img.loading = 'eager';
      img.onerror = () => {
        el.textContent = game.name;
        el.style.display = 'grid';
        el.style.placeItems = 'center';
        el.style.textAlign = 'center';
        el.style.fontSize = '11px';
        el.style.fontWeight = '900';
        el.style.color = '#fff';
      };
      el.appendChild(img);

      stage.appendChild(el);
      return el;
    }

    function buildBlocks(Matter, width) {
      const { Bodies } = Matter;
      const allGames = games.slice();
      const compactMobile = width < 460;
      const mobile = width < 700;
      const maxLongSide = compactMobile
        ? Math.max(62, Math.min(78, Math.floor(width / 8.2)))
        : mobile
          ? Math.max(56, Math.min(70, Math.floor(width / 9.6)))
          : Math.max(72, Math.min(98, Math.floor(width / 9.8)));
      const minShortSide = compactMobile ? 44 : (mobile ? 38 : 48);
      const safePadding = mobile ? (compactMobile ? 10 : 14) : 22;
      const spawnBand = Math.min(mobile ? (compactMobile ? 26 : 40) : 88, width * (mobile ? (compactMobile ? 0.038 : 0.06) : 0.14));

      bodies = [];
      blockEls = [];
      spawnQueue = [];

      allGames.forEach((game, index) => {
        let blockW, blockH;
        if (game.ratio >= 1) {
          blockW = maxLongSide;
          blockH = Math.max(minShortSide, Math.round(maxLongSide / game.ratio));
        } else {
          blockH = maxLongSide;
          blockW = Math.max(minShortSide, Math.round(maxLongSide * game.ratio));
        }

        const xBase = safePadding + blockW / 2 + 6;
        const x = Math.max(blockW / 2 + 10, Math.min(width - blockW / 2 - 10, xBase + Math.random() * spawnBand));
        const y = -blockH - 30 - index * 6;

        const body = Bodies.rectangle(x, y, blockW, blockH, {
          restitution: 0.48,
          friction: 0.72,
          frictionStatic: 0.78,
          frictionAir: 0.01,
          density: 0.0028,
          angle: (Math.random() - 0.5) * 0.18,
          render: { visible: false }
        });

        const el = createDomBlock(game, blockW, blockH);
        body.plugin = { domEl: el, width: blockW, height: blockH };

        spawnQueue.push(body);
        blockEls.push(el);
      });
    }

    function startSpawnSequence(Matter, world) {
      const { Composite } = Matter;
      if (spawnTimer) {
        window.clearTimeout(spawnTimer);
        spawnTimer = 0;
      }

      const dropNext = () => {
        const body = spawnQueue.shift();
        if (!body) {
          spawnTimer = 0;
          return;
        }
        const el = body.plugin?.domEl;
        if (el) el.style.opacity = '1';
        if (typeof attachDomDrag === 'function') attachDomDrag(body);
        bodies.push(body);
        Composite.add(world, body);
        spawnTimer = spawnQueue.length
          ? window.setTimeout(dropNext, 150 + Math.random() * 130)
          : 0;
      };

      spawnTimer = window.setTimeout(dropNext, 120);
    }

    function cleanupPhysics() {
      if (spawnTimer) {
        window.clearTimeout(spawnTimer);
        spawnTimer = 0;
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      if (runner && window.Matter?.Runner) {
        try { window.Matter.Runner.stop(runner); } catch (_) {}
      }
      if (render && window.Matter?.Render) {
        try { window.Matter.Render.stop(render); } catch (_) {}
        if (render.canvas?.parentNode) render.canvas.parentNode.removeChild(render.canvas);
        render.textures = {};
      }
      if (engine && window.Matter?.Engine) {
        try { window.Matter.Engine.clear(engine); } catch (_) {}
      }
      stage.querySelectorAll('.game-physics-block').forEach((el) => el.remove());
      stage.classList.remove('is-ready', 'is-physics-active');
      stage.classList.add('is-static');
      bodies = [];
      blockEls = [];
      spawnQueue = [];
      attachDomDrag = null;
      engine = null;
      render = null;
      runner = null;
      started = false;
      loadingMatter = false;
      hideLoading();
      setButtonState('static');
      renderStaticGrid();
    }

    function startPhysics(Matter) {
      if (started) return;
      started = true;
      loadingMatter = false;
      stage.classList.remove('is-static');
      stage.classList.add('is-physics-active');
      stage.classList.remove('is-ready');

      const { Engine, Render, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;
      const rect = stage.getBoundingClientRect();
      stageWidth = Math.max(320, Math.floor(rect.width));
      stageHeight = Math.max(320, Math.floor(rect.height));

      engine = Engine.create();
      engine.gravity.y = 1;

      render = Render.create({
        element: stage,
        engine,
        options: {
          width: stageWidth,
          height: stageHeight,
          wireframes: false,
          background: 'transparent',
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
        }
      });

      const wallThickness = 80;
      const floorInset = stageWidth < 700 ? 20 : 12;
      const floor = Bodies.rectangle(stageWidth / 2, stageHeight + wallThickness / 2 - floorInset, stageWidth + wallThickness * 2, wallThickness, {
        isStatic: true,
        label: 'floor',
        render: { visible: false }
      });
      const leftWall = Bodies.rectangle(-wallThickness / 2 + 4, stageHeight / 2, wallThickness, stageHeight * 2, {
        isStatic: true,
        label: 'leftWall',
        render: { visible: false }
      });
      const rightWall = Bodies.rectangle(stageWidth + wallThickness / 2 - 4, stageHeight / 2, wallThickness, stageHeight * 2, {
        isStatic: true,
        label: 'rightWall',
        render: { visible: false }
      });

      Composite.add(engine.world, [floor, leftWall, rightWall]);
      buildBlocks(Matter, stageWidth);

      const mouse = Mouse.create(render.canvas);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: {
          stiffness: 0.18,
          damping: 0.08,
          render: { visible: false }
        }
      });
      Composite.add(engine.world, mouseConstraint);
      render.mouse = mouse;

      render.canvas.style.pointerEvents = 'none';
      render.canvas.style.touchAction = 'pan-y';

      let activeDragBody = null;
      let activePointerId = null;
      let lastDragPoint = null;

      const getStagePoint = (event) => {
        const box = stage.getBoundingClientRect();
        return {
          x: event.clientX - box.left,
          y: event.clientY - box.top
        };
      };

      const clampPointInsideStage = (body, point) => {
        const halfW = Math.max(10, (body.bounds.max.x - body.bounds.min.x) / 2);
        const halfH = Math.max(10, (body.bounds.max.y - body.bounds.min.y) / 2);
        const inset = stageWidth < 700 ? 16 : 8;
        return {
          x: Math.min(stageWidth - halfW - inset, Math.max(halfW + inset, point.x)),
          y: Math.min(stageHeight - halfH - inset, Math.max(halfH + inset, point.y))
        };
      };

      attachDomDrag = (body) => {
        const el = body.plugin?.domEl;
        if (!el || el.dataset.dragBound === '1') return;
        el.dataset.dragBound = '1';

        const endDrag = (event) => {
          if (activeDragBody !== body) return;
          activeDragBody = null;
          activePointerId = null;
          lastDragPoint = null;
          try { el.releasePointerCapture?.(event.pointerId); } catch (_) {}
        };

        el.addEventListener('pointerdown', (event) => {
          activeDragBody = body;
          activePointerId = event.pointerId;
          const point = clampPointInsideStage(body, getStagePoint(event));
          lastDragPoint = point;
          Body.setPosition(body, point);
          Body.setVelocity(body, { x: 0, y: 0 });
          el.setPointerCapture?.(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
        }, { passive: false });

        el.addEventListener('pointermove', (event) => {
          if (activeDragBody !== body || activePointerId !== event.pointerId) return;
          const point = clampPointInsideStage(body, getStagePoint(event));
          Body.setPosition(body, point);
          if (lastDragPoint) {
            Body.setVelocity(body, {
              x: (point.x - lastDragPoint.x) * 0.35,
              y: (point.y - lastDragPoint.y) * 0.35
            });
          }
          lastDragPoint = point;
          event.preventDefault();
        }, { passive: false });

        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);
        el.addEventListener('lostpointercapture', () => {
          if (activeDragBody === body) {
            activeDragBody = null;
            activePointerId = null;
            lastDragPoint = null;
          }
        });
      };

      const clampBodyInsideStage = (body) => {
        if (!body || body.isStatic) return;
        const halfW = Math.max(10, (body.bounds.max.x - body.bounds.min.x) / 2);
        const halfH = Math.max(10, (body.bounds.max.y - body.bounds.min.y) / 2);
        const inset = stageWidth < 700 ? 16 : 8;
        const x = Math.min(stageWidth - halfW - inset, Math.max(halfW + inset, body.position.x));
        const y = Math.min(stageHeight - halfH - inset, Math.max(halfH + inset, body.position.y));
        if (x !== body.position.x || y !== body.position.y) {
          Body.setPosition(body, { x, y });
          Body.setVelocity(body, { x: body.velocity.x * 0.55, y: body.velocity.y * 0.55 });
        }
      };

      Events.on(engine, 'beforeUpdate', () => {
        if (activeDragBody) clampBodyInsideStage(activeDragBody);
        if (mouseConstraint.body) clampBodyInsideStage(mouseConstraint.body);
      });

      Events.on(engine, 'afterUpdate', () => {
        bodies.forEach(clampBodyInsideStage);
      });

      function syncDomBlocks() {
        bodies.forEach((body) => {
          const el = body.plugin?.domEl;
          if (!el) return;
          const w = body.plugin.width;
          const h = body.plugin.height;
          el.style.transform = `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) rotate(${body.angle}rad)`;
        });
        animationFrameId = requestAnimationFrame(syncDomBlocks);
      }

      Render.run(render);
      runner = Runner.create();
      Runner.run(runner, engine);
      syncDomBlocks();
      startSpawnSequence(Matter, engine.world);
      stage.classList.add('is-ready');
      hideLoading();
      setButtonState('active');
    }

    function showFallback() {
      loadingMatter = false;
      hideLoading();
      cleanupPhysics();
      const text = '物理引擎加载失败，请刷新页面重试。';
      if (loading) {
        loading.textContent = text;
        loading.classList.remove('is-hidden');
        window.setTimeout(() => {
          if (!started) loading.classList.add('is-hidden');
        }, 1800);
      }
    }

    toggleBtn.addEventListener('click', () => {
      if (loadingMatter) return;
      if (started) {
        cleanupPhysics();
        return;
      }
      loadingMatter = true;
      stage.classList.remove('is-static');
      stage.classList.add('is-physics-active');
      showLoading('物理引擎加载中...');
      setButtonState('loading');
      loadMatter().then(startPhysics).catch(showFallback);
    });

    renderStaticGrid();
    cleanupPhysics();
  }

  function initFooterRuntime() {
    const runFooter = $('#runFooter');
    if (!runFooter) return;
    const start = new Date(CONFIG.siteStartDate + 'T00:00:00');
    const update = () => {
      const diff = Math.max(0, Date.now() - start.getTime());
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor(diff / 3600000) % 24;
      const minutes = Math.floor(diff / 60000) % 60;
      const seconds = Math.floor(diff / 1000) % 60;
      runFooter.textContent = `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    update();
    setInterval(update, 1000);
  }

  initTheme();
  initTyping();
  initStars();
  initMeteor();
  initNavigation();
  initPhysicsBlocks();
  initFooterRuntime();
})();




/* 20260625 v17: music player robust playlist + single loop */
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('musicPanel');
  const toggleBtn = document.getElementById('musicToggleBtn');
  const closeBtn = document.getElementById('musicClose');
  const audio = document.getElementById('musicAudio');
  const cover = document.getElementById('musicCover');
  const title = document.getElementById('musicTitle');
  const artist = document.getElementById('musicArtist');
  const currentEl = document.getElementById('musicCurrent');
  const durationEl = document.getElementById('musicDuration');
  const seek = document.getElementById('musicSeek');
  const prevBtn = document.getElementById('musicPrev');
  const nextBtn = document.getElementById('musicNext');
  const playBtn = document.getElementById('musicPlay');
  const modeBtn = document.getElementById('musicMode');
  const listToggle = document.getElementById('musicListToggle');
  const oldList = document.getElementById('musicList');
  const oldPopover = document.getElementById('musicListPopover');

  if (!panel || !toggleBtn || !closeBtn || !audio || !cover || !title || !artist || !currentEl || !durationEl || !seek || !prevBtn || !nextBtn || !playBtn || !modeBtn || !listToggle) return;

  if (oldList) oldList.innerHTML = '';
  if (oldPopover) {
    oldPopover.classList.remove('is-open');
    oldPopover.setAttribute('aria-hidden', 'true');
    oldPopover.style.display = 'none';
  }

  let overlay = document.getElementById('musicPlaylistOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'musicPlaylistOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'region');
    overlay.setAttribute('aria-label', '播放列表');
    overlay.innerHTML = `
      <div class="music-playlist-head">
        <strong>播放列表</strong>
        <span id="musicPlaylistCount"></span>
      </div>
      <div id="musicPlaylistItems"></div>
    `;
    document.body.appendChild(overlay);
  }
  const playlistItems = overlay.querySelector('#musicPlaylistItems');

  const songs = [
    { title: 'Rain with Cappuccino - Lofi Remix ft. KAY440', artist: 'Venvn / HANA / KAY440', src: 'audio/rain-with-cappuccino.mp3', cover: 'images/music/rain-with-cappuccino.jpg' },
    { title: 'mure (Solo at Fluss)', artist: 'hideyuki hashimoto', src: 'audio/mure-solo-at-fluss.flac', cover: 'images/music/mure-solo-at-fluss.jpg' }
  ];
  const playlistCount = overlay.querySelector('#musicPlaylistCount');
  if (playlistCount) playlistCount.textContent = `${songs.length} 首`;

  const icons = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6L3 12l8 6V6Zm2 0h2v12h-2V6Z"></path></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12l10-6-10-6Z"></path></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"></path></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 6 8 6-8 6V6Zm-2 0H9v12h2V6Z"></path></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v2H5V6Zm0 5h14v2H5v-2Zm0 5h14v2H5v-2Z"></path></svg>',
    listMode: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5 20.5 7 17 10.5"></path><path d="M3.5 11V9.7A2.7 2.7 0 0 1 6.2 7H20"></path><path d="M7 20.5 3.5 17 7 13.5"></path><path d="M20.5 13v1.3a2.7 2.7 0 0 1-2.7 2.7H4"></path></svg>',
    singleMode: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.4 7.4A7.2 7.2 0 1 1 5.1 16.9"></path><path d="M6.4 3.8v3.6H2.9"></path></svg>'
  };

  let current = 0;
  let mode = 'list';
  let seeking = false;

  const formatTime = (value) => {
    const sec = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const setButtonLabels = () => {
    prevBtn.innerHTML = icons.prev;
    prevBtn.setAttribute('aria-label', '上一首');
    prevBtn.title = '上一首';

    nextBtn.innerHTML = icons.next;
    nextBtn.setAttribute('aria-label', '下一首');
    nextBtn.title = '下一首';

    listToggle.innerHTML = icons.list;
    listToggle.setAttribute('aria-label', '歌单');
    listToggle.title = '歌单';

    modeBtn.innerHTML = mode === 'list' ? icons.listMode : icons.singleMode;
    modeBtn.dataset.loopMode = mode;
    modeBtn.setAttribute('aria-label', mode === 'list' ? '列表循环' : '单曲循环');
    modeBtn.setAttribute('aria-pressed', mode === 'single' ? 'true' : 'false');
    modeBtn.title = mode === 'list' ? '列表循环' : '单曲循环';

    playBtn.innerHTML = audio.paused ? icons.play : icons.pause;
    playBtn.setAttribute('aria-label', audio.paused ? '播放' : '暂停');
    playBtn.title = audio.paused ? '播放' : '暂停';
  };

  const renderList = () => {
    playlistItems.innerHTML = songs.map((song, index) => `
      <button type="button" class="${index === current ? 'is-active' : ''}" data-index="${index}" title="${song.title} — ${song.artist}">
        <img src="${song.cover}" alt="${song.title} 专辑封面" loading="lazy" decoding="async" />
        <span class="music-list-text">
          <strong>${index + 1}. ${song.title}</strong>
          <span>${song.artist}</span>
        </span>
      </button>
    `).join('');
  };

  const updateTime = () => {
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    currentEl.textContent = formatTime(currentTime);
    durationEl.textContent = formatTime(duration);
    if (!seeking) {
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      seek.value = String(progress);
    }
  };

  const positionPlaylist = () => {
    if (!overlay.classList.contains('is-open')) return;
    const panelRect = panel.getBoundingClientRect();
    const compact = window.innerWidth <= 768;
    const margin = compact ? 8 : 12;
    const gap = 10;
    const width = Math.min(window.innerWidth - margin * 2, panelRect.width);
    const maxHeight = Math.min(compact ? 300 : 340, window.innerHeight - margin * 2);
    const estimatedHeight = Math.min(maxHeight, 58 + songs.length * 70);
    const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

    const left = panelRect.left + (panelRect.width - width) / 2;
    const roomBelow = window.innerHeight - panelRect.bottom - gap - margin;
    const roomAbove = panelRect.top - gap - margin;
    const placeAbove = roomBelow < estimatedHeight && roomAbove > roomBelow;
    const placement = placeAbove ? 'above' : 'below';
    let top = placeAbove
      ? panelRect.top - estimatedHeight - gap
      : panelRect.bottom + gap;

    top = clamp(top, margin, window.innerHeight - estimatedHeight - margin);

    overlay.dataset.placement = placement;
    overlay.style.setProperty('left', `${clamp(left, margin, window.innerWidth - width - margin)}px`, 'important');
    overlay.style.setProperty('top', `${top}px`, 'important');
    overlay.style.setProperty('width', `${width}px`, 'important');
    overlay.style.setProperty('max-height', `${maxHeight}px`, 'important');
    playlistItems.style.setProperty('max-height', `${Math.max(100, maxHeight - 56)}px`, 'important');
  };

  const closeList = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    listToggle.setAttribute('aria-expanded', 'false');
  };
  const openList = () => {
    renderList();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    listToggle.setAttribute('aria-expanded', 'true');
    positionPlaylist();
    requestAnimationFrame(positionPlaylist);
  };
  const closePanel = () => {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    closeList();
  };
  const openPanel = () => {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(positionPlaylist);
  };

  const loadSong = (index, autoPlay = false) => {
    current = (index + songs.length) % songs.length;
    const song = songs[current];
    audio.src = song.src;
    audio.load();
    cover.src = song.cover;
    title.textContent = song.title;
    title.title = song.title;
    artist.textContent = song.artist;
    currentEl.textContent = '0:00';
    durationEl.textContent = '0:00';
    seek.value = '0';
    renderList();
    setButtonLabels();
    if (overlay.classList.contains('is-open')) positionPlaylist();
    if (autoPlay) audio.play().catch(() => {});
  };

  const togglePlay = () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  toggleBtn.addEventListener('click', (event) => {
    event.preventDefault();
    if (panel.classList.contains('is-open')) closePanel();
    else openPanel();
  });
  closeBtn.addEventListener('click', () => {
    closePanel();
    toggleBtn.focus();
  });

  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', () => loadSong(current - 1, !audio.paused));
  nextBtn.addEventListener('click', () => loadSong(current + 1, !audio.paused));
  modeBtn.addEventListener('click', () => {
    mode = mode === 'list' ? 'single' : 'list';
    setButtonLabels();
    modeBtn.classList.remove('is-switching');
    void modeBtn.offsetWidth;
    modeBtn.classList.add('is-switching');
    window.setTimeout(() => modeBtn.classList.remove('is-switching'), 240);
  });
  listToggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (overlay.classList.contains('is-open')) closeList();
    else openList();
  });
  playlistItems.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-index]');
    if (!btn) return;
    loadSong(Number(btn.dataset.index), true);
    closeList();
  });

  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('input', () => {
    if (!audio.duration) return;
    const preview = (Number(seek.value) / 100) * audio.duration;
    currentEl.textContent = formatTime(preview);
  });
  const commitSeek = () => {
    if (audio.duration) audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    seeking = false;
  };
  seek.addEventListener('change', commitSeek);
  seek.addEventListener('pointerup', commitSeek);
  seek.addEventListener('touchend', commitSeek, { passive: true });

  audio.addEventListener('loadedmetadata', updateTime);
  audio.addEventListener('durationchange', updateTime);
  audio.addEventListener('canplay', updateTime);
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('play', () => {
    panel.classList.add('is-playing');
    setButtonLabels();
  });
  audio.addEventListener('pause', () => {
    panel.classList.remove('is-playing');
    setButtonLabels();
  });
  audio.addEventListener('ended', () => {
    if (mode === 'single') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      loadSong(current + 1, true);
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('#musicListToggle') || event.target.closest('#musicPlaylistOverlay')) return;
    if (!event.target.closest('#musicPanel') && !event.target.closest('#musicToggleBtn')) closeList();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeList();
      closePanel();
    }
  });
  window.addEventListener('resize', positionPlaylist, { passive: true });
  window.addEventListener('scroll', positionPlaylist, { passive: true });

  renderList();
  loadSong(0, false);
  toggleBtn.setAttribute('aria-expanded', 'false');
});


/* 20260625 v14: no jump hero fade */
document.addEventListener('DOMContentLoaded', () => {
  const brandLink = document.querySelector('#siteNav .brand');
  const aboutSection = document.querySelector('#aboutMe');
  if (brandLink && aboutSection) {
    brandLink.addEventListener('click', (event) => {
      event.preventDefault();
      aboutSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }

  const hero = document.querySelector('.hero');
  const heroPicture = document.querySelector('.hero-picture');
  const heroImg = document.querySelector('.hero-img');
  const heroText = document.querySelector('.hero-text');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hero && heroImg && heroPicture && aboutSection && !reduceMotion) {
    let ticking = false;
    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const smooth = (value) => value * value * (3 - 2 * value);

    const applyHeroState = () => {
      const aboutTop = aboutSection.getBoundingClientRect().top + window.scrollY;
      const endAt = Math.max(1, aboutTop - window.innerHeight * 0.10);
      let raw = clamp(window.scrollY / endAt);
      if (raw > 0.985) raw = 1;
      const p = smooth(raw);
      const remain = clamp(1 - p);
      hero.style.setProperty('--heroFade', String(remain));

      heroPicture.style.opacity = String(remain);
      heroImg.style.opacity = String(remain);
      heroImg.style.filter = `blur(${p * 22}px)`;
      heroImg.style.transform = `translate3d(0, ${p * 64}px, 0) scale(${1 + p * 0.03})`;

      if (heroText) {
        heroText.style.opacity = String(remain);
        heroText.style.transform = 'translate(-50%, -50%)';
        heroText.style.visibility = remain <= 0.01 ? 'hidden' : 'visible';
      }
      hero.classList.toggle('is-hero-gone', p >= 1);
      ticking = false;
    };

    const requestHeroState = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(applyHeroState);
    };

    applyHeroState();
    window.addEventListener('scroll', requestHeroState, { passive: true });
    window.addEventListener('resize', requestHeroState, { passive: true });
  }
});
