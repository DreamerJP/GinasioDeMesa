addEventListener('error', evento => {
  if (!evento.target?.matches?.('script[type="module"]')) return;
  document.getElementById('aviso-entrada').textContent = 'Não consegui carregar o ginásio. Se usar bloqueador de anúncios, libere este site e tente de novo.';
  document.getElementById('tentar-de-novo').hidden = false;
}, true);

addEventListener('click', evento => {
  if (evento.target.closest?.('#tentar-de-novo')) location.reload();
});