const WHATSAPP_NUMBER = "5531996569799";
const supporters=document.getElementById("supporters"),views=document.getElementById("views"),potentialViews=document.getElementById("potentialViews");
const formatNumber=v=>new Intl.NumberFormat("pt-BR").format(v);
function updateCalculator(){const s=Math.max(0,Number(supporters.value||0)),v=Math.max(0,Number(views.value||0));potentialViews.textContent=formatNumber(s*v);const box=potentialViews.closest(".calc-result");if(box){box.classList.remove("ping");void box.offsetWidth;box.classList.add("ping")}potentialViews.style.transform="scale(1.06)";requestAnimationFrame(()=>{potentialViews.style.transform="scale(1)"})}
supporters.addEventListener("input",updateCalculator);views.addEventListener("input",updateCalculator);updateCalculator();document.getElementById("year").textContent=new Date().getFullYear();
const params=new URLSearchParams(window.location.search);const utm={source:params.get("utm_source")||"",medium:params.get("utm_medium")||"",campaign:params.get("utm_campaign")||"",content:params.get("utm_content")||""};
const leadSubmitBtn=document.getElementById("leadSubmitBtn"),formStatus=document.getElementById("formStatus");
document.getElementById("leadForm").addEventListener("submit",function(event){event.preventDefault();if(!/^\d+$/.test(WHATSAPP_NUMBER)){alert("Configure o número do WhatsApp no código antes de publicar.");return}const data=new FormData(event.currentTarget);const text=["Olá! Tenho interesse em conhecer o Avatar.","",`Nome: ${data.get("name")}`,`Campanha/candidatura: ${data.get("campaign")}`,`Cargo: ${data.get("role")}`,`Cidade/UF: ${data.get("city")}`,`Meu WhatsApp: ${data.get("phone")}`,`Base ativa estimada: ${data.get("baseSize")}`,data.get("message")?`Interesse/comentário: ${data.get("message")}`:"","",utm.source?`Origem: ${utm.source}`:"",utm.medium?`Mídia: ${utm.medium}`:"",utm.campaign?`Campanha UTM: ${utm.campaign}`:"",utm.content?`Conteúdo UTM: ${utm.content}`:""].filter(Boolean).join("\n");leadSubmitBtn.disabled=true;leadSubmitBtn.textContent="Enviando…";formStatus.hidden=false;setTimeout(function(){window.location.href=`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`},700)});
window.addEventListener("pageshow",function(e){if(e.persisted){leadSubmitBtn.disabled=false;leadSubmitBtn.textContent="Continuar pelo WhatsApp";formStatus.hidden=true}});

/* ================= Camada de experiência: rolagem, revelação, tilt 3D e rede ================= */
(function(){
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarse = window.matchMedia("(pointer: coarse)").matches;

  /* --- Barra de progresso + nav com vidro ao rolar --- */
  var nav = document.querySelector(".nav");
  var bar = document.getElementById("progressBar");
  function onScroll(){
    var doc = document.documentElement;
    var scrolled = (doc.scrollTop || document.body.scrollTop);
    var height = (doc.scrollHeight - doc.clientHeight) || 1;
    if (bar) bar.style.width = Math.min(100, (scrolled / height) * 100) + "%";
    if (nav) nav.classList.toggle("nav-scrolled", scrolled > 8);
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- Revelação ao rolar --- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add("is-visible"); });
  }

  /* --- Tilt 3D (mouse) para hero-card e showcase-frame --- */
  if (!reduceMotion && !isCoarse) {
    document.querySelectorAll(".tilt").forEach(function(el){
      var raf = null;
      el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
      el.addEventListener("pointermove", function(e){
        var rect = el.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        var rotY = px * 10;
        var rotX = py * -10;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function(){
          el.style.transform = "perspective(1200px) rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg) translateZ(6px)";
        });
      });
      el.addEventListener("pointerleave", function(){
        if (raf) cancelAnimationFrame(raf);
        el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
      });
    });
  }

  /* --- Rede de distribuição animada no hero (canvas) --- */
  var canvas = document.getElementById("network-canvas");
  if (canvas && canvas.getContext && !isCoarse) {
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var nodes = [], W = 0, H = 0, hub = null, raf2 = null, visible = true;

    function size(){
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function seed(){
      nodes = [];
      hub = { x: W * 0.62, y: H * 0.34, r: 6 };
      var count = W < 560 ? 16 : 30;
      for (var i = 0; i < count; i++) {
        var ang = Math.random() * Math.PI * 2;
        var dist = 90 + Math.random() * (Math.min(W, H) * 0.42);
        nodes.push({
          x: hub.x + Math.cos(ang) * dist,
          y: hub.y + Math.sin(ang) * dist,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          r: 1.6 + Math.random() * 2.1,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    function step(t){
      if (!visible) { raf2 = requestAnimationFrame(step); return; }
      ctx.clearRect(0, 0, W, H);

      nodes.forEach(function(n){
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });

      ctx.lineWidth = 1;
      nodes.forEach(function(n){
        var dx = n.x - hub.x, dy = n.y - hub.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var op = Math.max(0, 0.16 - d / 3200);
        ctx.strokeStyle = "rgba(37,99,235," + op.toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      });

      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var dx2 = a.x - b.x, dy2 = a.y - b.y;
          var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d2 < 96) {
            ctx.strokeStyle = "rgba(37,99,235," + (0.08 * (1 - d2 / 96)).toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = "rgba(15,23,42,.9)";
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(37,99,235,.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.r + 5 + Math.sin(t / 700) * 2, 0, Math.PI * 2);
      ctx.stroke();

      nodes.forEach(function(n){
        var pulse = 0.55 + Math.sin(t / 900 + n.phase) * 0.35;
        ctx.fillStyle = "rgba(37,99,235," + pulse.toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      raf2 = requestAnimationFrame(step);
    }

    function start(){ size(); seed(); if (!reduceMotion) { raf2 = requestAnimationFrame(step); } else { step(0); } }
    window.addEventListener("resize", function(){ size(); seed(); });
    document.addEventListener("visibilitychange", function(){ visible = !document.hidden; });
    start();
  }
})();
