// ─────────────────────────────────────────────────────────────
// ARKE — JavaScript del navegador (front)
// Sin librerías: JS "puro" para que se entienda qué hace cada cosa.
// ─────────────────────────────────────────────────────────────
(function () {
  'use strict';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // ── Menú mobile ────────────────────────────────────────────
  const toggle = $('[data-menu-toggle]');
  const nav = $('[data-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('abierto'));
    const item = $('[data-nav-item]');
    // En mobile, el primer toque en "Productos" abre las categorías
    item?.firstElementChild.addEventListener('click', (e) => {
      if (window.innerWidth <= 860 && !item.classList.contains('abierto')) {
        e.preventDefault();
        item.classList.add('abierto');
      }
    });
  }

  // ── Slider de la home ──────────────────────────────────────
  const slider = $('[data-slider]');
  if (slider) {
    const slides = $$('[data-slide]', slider);
    const puntos = $('[data-puntos]', slider);
    let actual = 0;
    let timer;
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', `Ir al slide ${i + 1}`);
      b.addEventListener('click', () => ir(i));
      puntos.appendChild(b);
    });
    function ir(i) {
      actual = (i + slides.length) % slides.length;
      slides.forEach((s, j) => s.classList.toggle('activo', j === actual));
      $$('button', puntos).forEach((b, j) => b.classList.toggle('activo', j === actual));
      clearInterval(timer);
      timer = setInterval(() => ir(actual + 1), 6000);
    }
    $('[data-prev]', slider).addEventListener('click', () => ir(actual - 1));
    $('[data-next]', slider).addEventListener('click', () => ir(actual + 1));
    ir(0);
  }

  // ── Video del hero ─────────────────────────────────────────
  const video = $('[data-video-hero]');
  const btnPausa = $('[data-video-pausa]');
  if (video && btnPausa) {
    let pausadoPorUsuario = false;
    const mostrarEstado = () => {
      btnPausa.textContent = video.paused ? '▶' : '❚❚';
      btnPausa.setAttribute('aria-label', video.paused ? 'Reproducir video' : 'Pausar video');
    };
    video.addEventListener('play', mostrarEstado);
    video.addEventListener('pause', mostrarEstado);
    btnPausa.addEventListener('click', () => {
      pausadoPorUsuario = !video.paused;
      if (video.paused) video.play(); else video.pause();
    });
    // Respeta a quien pidió "reducir movimiento" en su sistema o "ahorro de datos" en el celu
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento || navigator.connection?.saveData) {
      pausadoPorUsuario = true;
      video.removeAttribute('autoplay');
      video.pause();
    }
    // Si el hero no está en pantalla (scrolleaste hacia abajo), pausamos: ahorra batería y CPU
    new IntersectionObserver(([e]) => {
      if (pausadoPorUsuario) return;
      if (e.isIntersecting) video.play().catch(() => {}); else video.pause();
    }).observe(video);
    mostrarEstado();
  }

  // ── Buscador predictivo (usa la API del backend) ───────────
  const buscador = $('[data-buscador]');
  if (buscador) {
    const input = $('input[name=q]', buscador);
    const caja = $('[data-sugerencias]', buscador);
    let espera;
    let seleccion = -1;
    const fmt = (n) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    input.addEventListener('input', () => {
      clearTimeout(espera);
      const q = input.value.trim();
      if (q.length < 2) return caja.classList.remove('visible');
      espera = setTimeout(async () => {
        try {
          const res = await fetch('/api/sugerencias?q=' + encodeURIComponent(q));
          const items = await res.json();
          seleccion = -1;
          caja.innerHTML = items.length
            ? items.map((p) => `<a href="${p.url}">${p.imagen ? `<img src="${esc(p.imagen)}" alt="">` : ''}<span>${esc(p.nombre)}</span>${p.precio ? `<span class="precio">${fmt(p.precio)}</span>` : ''}</a>`).join('') +
              `<a class="todos" href="/productos?q=${encodeURIComponent(q)}">Ver todos los resultados</a>`
            : `<a class="todos" href="/productos?q=${encodeURIComponent(q)}">Buscar "${esc(q)}"</a>`;
          caja.classList.add('visible');
        } catch (e) { /* si falla, se usa la búsqueda normal */ }
      }, 220);
    });
    input.addEventListener('keydown', (e) => {
      const links = $$('a', caja);
      if (!caja.classList.contains('visible') || !links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        seleccion = (seleccion + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach((a, i) => a.classList.toggle('sel', i === seleccion));
      } else if (e.key === 'Enter' && seleccion >= 0) {
        e.preventDefault();
        window.location = links[seleccion].href;
      } else if (e.key === 'Escape') caja.classList.remove('visible');
    });
    document.addEventListener('click', (e) => { if (!buscador.contains(e.target)) caja.classList.remove('visible'); });
  }

  // ── Listado: ordenar y filtros en mobile ───────────────────
  $('[data-orden]')?.addEventListener('change', (e) => { window.location = e.target.value; });
  $('[data-toggle-filtros]')?.addEventListener('click', () => $('[data-filtros]').classList.toggle('abierto'));

  // ── Ficha de producto ──────────────────────────────────────
  const ficha = $('[data-ficha]');
  if (ficha) {
    const principal = $('[data-img-principal]');
    const minis = $$('[data-miniaturas] button');
    const fuentes = minis.length ? minis.map((b) => b.dataset.src) : principal ? [principal.src] : [];
    let idxActual = 0;

    function mostrarImagen(i) {
      if (!principal || !fuentes.length) return;
      idxActual = (i + fuentes.length) % fuentes.length;
      principal.src = fuentes[idxActual];
      minis.forEach((b, j) => b.classList.toggle('activo', j === idxActual));
      minis[idxActual]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
    minis.forEach((b) => b.addEventListener('click', () => mostrarImagen(Number(b.dataset.idx))));

    // Lightbox (zoom de imagen)
    const lb = $('[data-lightbox]');
    const lbImg = $('[data-lb-img]');
    const abrirLb = () => { lbImg.src = fuentes[idxActual]; lb.classList.add('abierto'); };
    const moverLb = (d) => { mostrarImagen(idxActual + d); lbImg.src = fuentes[idxActual]; };
    $('[data-galeria-principal]')?.addEventListener('click', () => fuentes.length && abrirLb());
    $('[data-lb-cerrar]')?.addEventListener('click', () => lb.classList.remove('abierto'));
    $('[data-lb-ant]')?.addEventListener('click', () => moverLb(-1));
    $('[data-lb-sig]')?.addEventListener('click', () => moverLb(1));
    lb?.addEventListener('click', (e) => { if (e.target === lb) lb.classList.remove('abierto'); });
    document.addEventListener('keydown', (e) => {
      if (!lb?.classList.contains('abierto')) return;
      if (e.key === 'Escape') lb.classList.remove('abierto');
      if (e.key === 'ArrowLeft') moverLb(-1);
      if (e.key === 'ArrowRight') moverLb(1);
    });

    // Colores
    let colorElegido = $('.color.activo')?.dataset.color || '';
    $$('.color').forEach((btn) => btn.addEventListener('click', () => {
      $$('.color').forEach((b) => { b.classList.remove('activo'); b.setAttribute('aria-checked', 'false'); });
      btn.classList.add('activo');
      btn.setAttribute('aria-checked', 'true');
      colorElegido = btn.dataset.color;
      const label = $('[data-color-elegido]');
      if (label) label.textContent = colorElegido;
      const stock = $('[data-stock-visible]');
      if (stock) stock.textContent = Number(btn.dataset.stock).toLocaleString('es-AR');
      if (btn.dataset.imgIdx !== '') mostrarImagen(Number(btn.dataset.imgIdx));
      actualizarWpp();
    }));

    // Cantidad
    const cant = $('[data-cantidad]');
    const minimo = Number(ficha.dataset.minimo) || 1;
    const paso = minimo >= 50 ? 10 : 1;
    $('[data-menos]')?.addEventListener('click', () => { cant.value = Math.max(1, Number(cant.value) - paso); actualizarWpp(); });
    $('[data-mas]')?.addEventListener('click', () => { cant.value = Number(cant.value) + paso; actualizarWpp(); });
    cant?.addEventListener('input', actualizarWpp);

    // Botón "Consultar por WhatsApp" con el mensaje armado
    const btnWpp = $('[data-consultar-wpp]');
    function actualizarWpp() {
      const d = ficha.dataset;
      const lineas = [
        '¡Hola ARKE! Quiero consultar por este producto:',
        `• ${d.nombre}${d.codigo ? ` (Cód. ${d.codigo})` : ''}`,
        colorElegido ? `• Color: ${colorElegido}` : null,
        `• Cantidad: ${cant ? cant.value : minimo}`,
        d.url,
      ].filter(Boolean);
      btnWpp.href = `https://wa.me/${d.whatsapp}?text=${encodeURIComponent(lineas.join('\n'))}`;
    }
    if (btnWpp) actualizarWpp();
  }
})();
