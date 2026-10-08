/* contato.html: copy the address. element.style is CSSOM, which style-src 'self' allows —
   only style attributes in markup are blocked. */
(function () {
  var btn = document.getElementById('copy-email'), status = document.getElementById('form-status');
  if (!btn || !status) return;
  function show(msg, isErr) { status.textContent = msg; status.className = isErr ? 'err' : 'ok'; status.style.display = 'block'; }
  btn.addEventListener('click', function () {
    if (!navigator.clipboard) { show('Copie o endereço acima: comercial@winserv.com.br', true); return; }
    navigator.clipboard.writeText('comercial@winserv.com.br')
      .then(function () { show('Endereço copiado.', false); })
      .catch(function () { show('Copie o endereço acima: comercial@winserv.com.br', true); });
  });
})();
