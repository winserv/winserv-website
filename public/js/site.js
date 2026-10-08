/* Every page: the mobile menu, and the e-mail beacon (spec 2026-10-08 §7).
   The beacon carries only the page it was clicked on; the mailto: link works without it. */
(function () {
  var b = document.getElementById('burger'), m = document.getElementById('mobile-menu');
  if (b && m) {
    b.addEventListener('click', function () { var o = m.classList.toggle('open'); b.classList.toggle('open', o); });
    m.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { m.classList.remove('open'); b.classList.remove('open'); });
    });
  }
  var slug = location.pathname.replace(/^\//, '').replace(/\.html$/, '') || 'inicio';
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (navigator.sendBeacon) navigator.sendBeacon('/e/contato-email?p=' + encodeURIComponent(slug));
    });
  });
})();
