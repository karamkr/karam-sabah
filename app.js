// -------------------- Helpers --------------------
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str){ return escapeHtml(str); }

function getParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

async function fetchWorks() {
  // ملاحظة: fetch يحتاج سيرفر محلي (Live Server)
  const res = await fetch("./works.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load works.json (HTTP " + res.status + ")");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("works.json must be an array");
  return data;
}

// -------------------- Preloader --------------------
window.addEventListener("load", () => {
  const p = qs("#preloader");
  if (!p) return;
  p.classList.add("hide");
  setTimeout(() => p.remove(), 500);
});

// -------------------- Typed (only on index) --------------------
if (window.Typed && qs("#typed")) {
  new Typed("#typed", {
    strings: [
      "أطوّر <strong style='color:#fbb040'>تطبيقات إبداعية</strong>.",
      "أحب <strong style='color:#fbb040'>تصاميم UI/UX</strong>.",
      "أعمل من <strong style='color:#fbb040'>العراق — الموصل</strong>."
    ],
    typeSpeed: 40,
    backSpeed: 22,
    backDelay: 1100,
    loop: true,
    smartBackspace: true
  });
}

// -------------------- Smooth scroll --------------------
qsa('a[href^="#"]').forEach(a => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || id === "#") return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// -------------------- Index Works: FIRST image only --------------------
async function initIndexWorks() {
  const grid = qs("#worksGrid");
  if (!grid) return;

  try {
    const works = await fetchWorks();

    if (works.length === 0) {
      grid.innerHTML = `<div class="card" style="padding:14px;">لا توجد أعمال بعد.</div>`;
      return;
    }

    grid.innerHTML = works.map((w, i) => {
      const title = escapeHtml(w.title ?? "");
      const desc = escapeHtml(w.description ?? "");
      const firstImg = (Array.isArray(w.images) && w.images.length) ? String(w.images[0]) : "";

      return `
        <a class="work-link" href="./work.html?i=${i}" aria-label="فتح ${title}">
          <article class="work-card">
            <img class="work-thumb" src="${escapeAttr(firstImg)}" alt="${title}" loading="lazy">
            <div class="work-body">
              <h3>${title}</h3>
              <p>${desc}</p>
            </div>
          </article>
        </a>
      `;
    }).join("");

    // لو صورة ما تحمل: نخليها تختفي بدل ما تضل فاضية
    qsa(".work-thumb").forEach(img => {
      img.addEventListener("error", () => {
        img.style.display = "none";
      }, { once: true });
    });

  } catch (e) {
    // هذا غالباً يحدث عند فتح file:// بدون سيرفر
    console.error("WORKS LOAD ERROR:", e);
    grid.innerHTML = `
      <div class="card" style="padding:14px; line-height:1.9;">
        لم يتم تحميل الأعمال.<br>
        شغّل المشروع عبر <b>Live Server</b> (VS Code) أو أي سيرفر محلي.
      </div>
    `;
  }
}

// -------------------- Work Page: gallery + thumbs + lightbox --------------------
async function initWorkPage() {
  const titleEl = qs("#workTitle");
  const descEl = qs("#workDesc");
  const mainImg = qs("#mainImg");
  const thumbsEl = qs("#thumbs");
  if (!titleEl || !descEl || !mainImg || !thumbsEl) return;

  const iParam = getParam("i");
  const index = Number(iParam);

  if (!Number.isFinite(index) || index < 0) {
    titleEl.textContent = "العمل غير محدد";
    descEl.textContent = "ارجع لصفحة الأعمال واختر عملاً.";
    return;
  }

  try {
    const works = await fetchWorks();
    const work = works[index];

    if (!work) {
      titleEl.textContent = "العمل غير موجود";
      descEl.textContent = "تأكد من رقم العمل في الرابط.";
      return;
    }

    const images = Array.isArray(work.images) ? work.images.filter(Boolean).map(String) : [];
    titleEl.textContent = work.title ?? "عمل";
    descEl.textContent = work.description ?? "";

    if (images.length === 0) {
      mainImg.alt = work.title ?? "Work";
      mainImg.src = "";
      descEl.textContent = "لا توجد صور لهذا العمل.";
      return;
    }

    let current = 0;

    function setCurrent(i) {
      current = (i + images.length) % images.length;
      mainImg.src = images[current];
      mainImg.alt = `${work.title ?? "Work"} - ${current + 1}`;
      qsa(".thumb").forEach((t, idx) => t.classList.toggle("active", idx === current));
    }

    thumbsEl.innerHTML = images.map((src, idx) => `
      <button class="thumb ${idx===0?'active':''}" type="button" aria-label="صورة ${idx+1}">
        <img src="${escapeAttr(src)}" alt="${escapeHtml(work.title ?? 'Work')} - thumb ${idx+1}" loading="lazy">
      </button>
    `).join("");

    qsa(".thumb").forEach((btn, idx) => btn.addEventListener("click", () => setCurrent(idx)));

    // أخطاء تحميل الصورة الرئيسية/المصغرات
    mainImg.addEventListener("error", () => {
      mainImg.style.display = "none";
    }, { once: true });

    setCurrent(0);

    // Lightbox
    const lb = qs("#lightbox");
    const lbImg = qs("#lbImg");
    const lbClose = qs("#lbClose");
    const lbPrev = qs("#lbPrev");
    const lbNext = qs("#lbNext");
    const zoomBtn = qs("#zoomBtn");

    function openLb() {
      if (!lb || !lbImg) return;
      lb.classList.add("open");
      lb.setAttribute("aria-hidden", "false");
      lbImg.src = images[current];
      document.body.style.overflow = "hidden";
    }
    function closeLb() {
      if (!lb) return;
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    function lbSet(i) {
      current = (i + images.length) % images.length;
      setCurrent(current);
      if (lbImg) lbImg.src = images[current];
    }

    if (zoomBtn) zoomBtn.addEventListener("click", openLb);
    if (lbClose) lbClose.addEventListener("click", closeLb);
    if (lb) lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
    if (lbPrev) lbPrev.addEventListener("click", () => lbSet(current - 1));
    if (lbNext) lbNext.addEventListener("click", () => lbSet(current + 1));

    window.addEventListener("keydown", (e) => {
      if (!lb || !lb.classList.contains("open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") lbSet(current + 1);
      if (e.key === "ArrowRight") lbSet(current - 1);
    });

  } catch (e) {
    console.error("WORK PAGE ERROR:", e);
    titleEl.textContent = "خطأ";
    descEl.textContent = "تعذّر تحميل العمل. شغّل الموقع عبر Live Server.";
  }
}

// -------------------- Background Particles --------------------
(function bgParticles(){
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const canvas = qs('#bgCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  let w = 0, h = 0;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let MAX_PARTICLES = 70;
  const particles = [];

  const colors = [
    'rgba(251,176,64,0.75)',
    'rgba(251,176,64,0.45)',
    'rgba(142,209,252,0.55)',
    'rgba(255,255,255,0.22)'
  ];

  function resize(){
    w = canvas.clientWidth = window.innerWidth;
    h = canvas.clientHeight = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    MAX_PARTICLES = Math.min(95, Math.max(55, Math.floor((w * h) / 24000)));
  }
  function rand(min, max){ return Math.random() * (max - min) + min; }
  function createParticle(){
    const r = rand(1.2, 3.2);
    const speed = rand(0.15, 0.55);
    const angle = rand(0, Math.PI * 2);
    return {
      x: rand(0, w),
      y: rand(0, h),
      r,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      c: colors[(Math.random() * colors.length) | 0],
      tw: rand(0.004, 0.012),
      t: rand(0, Math.PI * 2)
    };
  }
  function init(){
    particles.length = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) particles.push(createParticle());
  }
  function draw(){
    ctx.clearRect(0, 0, w, h);

    const g1 = ctx.createRadialGradient(w*0.75, h*0.15, 0, w*0.75, h*0.15, Math.min(w,h)*0.55);
    g1.addColorStop(0, 'rgba(251,176,64,0.06)');
    g1.addColorStop(1, 'rgba(251,176,64,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0,0,w,h);

    const g2 = ctx.createRadialGradient(w*0.15, h*0.25, 0, w*0.15, h*0.25, Math.min(w,h)*0.6);
    g2.addColorStop(0, 'rgba(142,209,252,0.05)');
    g2.addColorStop(1, 'rgba(142,209,252,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0,0,w,h);

    for (let i = 0; i < particles.length; i++){
      const p = particles[i];
      for (let j = i + 1; j < particles.length; j++){
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 135){
          const a = (1 - dist/135) * 0.18;
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles){
      p.t += p.tw;
      const twinkle = 0.55 + Math.sin(p.t) * 0.25;

      ctx.beginPath();
      ctx.fillStyle = p.c.replace(/0\.\d+\)/, () => `${Math.max(0.12, Math.min(0.85, twinkle))})`);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
    }

    requestAnimationFrame(draw);
  }

  resize();
  init();
  draw();

  let t;
  window.addEventListener('resize', ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{ resize(); init(); }, 120);
  }, { passive:true });
})();

initIndexWorks();
initWorkPage();