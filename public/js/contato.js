/* The contact page: copy the address. element.style is CSSOM, which style-src 'self' allows —
   only style attributes in markup are blocked. Messages come from the button's data-ok /
   data-fail (the EN/ES pages set them); the Portuguese page has none and keeps these. */
(function () {
  var btn = document.getElementById('copy-email'), status = document.getElementById('form-status');
  if (!btn || !status) return;
  var okMsg = btn.getAttribute('data-ok') || 'Endereço copiado.';
  var failMsg = btn.getAttribute('data-fail') || 'Copie o endereço acima: comercial@winserv.com.br';
  function show(msg, isErr) { status.textContent = msg; status.className = isErr ? 'err' : 'ok'; status.style.display = 'block'; }
  btn.addEventListener('click', function () {
    if (!navigator.clipboard) { show(failMsg, true); return; }
    navigator.clipboard.writeText('comercial@winserv.com.br')
      .then(function () { show(okMsg, false); })
      .catch(function () { show(failMsg, true); });
  });
})();
