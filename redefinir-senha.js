const form = document.querySelector('#resetForm');
const message = document.querySelector('#message');
const button = document.querySelector('#resetButton');
const params = new URLSearchParams(window.location.hash.slice(1));
const accessToken = params.get('access_token');
const refreshToken = params.get('refresh_token');
const recoveryType = params.get('type');

if (!accessToken || !refreshToken || recoveryType !== 'recovery') {
  form.hidden = true;
  message.textContent = 'Este link é inválido ou expirou. Volte ao login e solicite outro link de recuperação.';
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
  button.disabled = true;
  message.textContent = 'Atualizando sua senha...';
  try {
    const response = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        password
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a senha.');
    window.history.replaceState({}, document.title, window.location.pathname);
    form.hidden = true;
    message.textContent = 'Senha atualizada com sucesso! Agora volte ao login e entre com sua nova senha.';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
