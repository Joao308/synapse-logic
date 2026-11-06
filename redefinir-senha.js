(() => {
  const form = document.querySelector('#resetForm');
  const message = document.querySelector('#message');
  const button = document.querySelector('#resetButton');
  if (!form || !message || !button) return;

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hashParams.get('access_token');
  const recoveryType = hashParams.get('type');

  if (!accessToken || recoveryType !== 'recovery') {
    form.hidden = true;
    message.textContent = 'Link inválido ou expirado. Volte ao login e solicite um novo e-mail de recuperação.';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.querySelector('#newPassword').value;
    const confirmation = document.querySelector('#confirmPassword').value;

    if (password.length < 10) {
      message.textContent = 'A senha precisa ter pelo menos 10 caracteres.';
      return;
    }
    if (password !== confirmation) {
      message.textContent = 'As senhas não coincidem.';
      return;
    }
    if (!accessToken || recoveryType !== 'recovery') {
      message.textContent = 'Link inválido ou expirado. Solicite outro e-mail.';
      return;
    }

    button.disabled = true;
    message.style.color = '#cbd5e1';
    message.textContent = 'Atualizando sua senha...';
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || `Erro ${response.status} ao atualizar a senha.`);
      window.history.replaceState({}, document.title, window.location.pathname);
      form.hidden = true;
      message.style.color = '#86efac';
      message.textContent = 'Senha atualizada com sucesso! Volte ao site e entre com a nova senha.';
    } catch (error) {
      message.style.color = '#fca5a5';
      message.textContent = error.message || 'Falha ao atualizar a senha. Tente solicitar um novo link.';
    } finally {
      button.disabled = false;
    }
  });
})();
