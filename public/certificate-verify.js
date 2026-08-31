const form = document.querySelector('#certificate-verify-form');
const fileInput = document.querySelector('#certificate-file');
const fileLabel = document.querySelector('#file-label');
const button = document.querySelector('#verify-button');
const message = document.querySelector('#verify-message');
const validResult = document.querySelector('#valid-result');
const invalidResult = document.querySelector('#invalid-result');

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileLabel.textContent = file?.name || 'Vyber PDF certifikát';
  resetResult();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  resetResult();
  const file = fileInput.files?.[0];
  if (!file) return showMessage('Nejprve vyber PDF certifikát.');
  if (file.size > 12 * 1024 * 1024) return showMessage('PDF je větší než povolených 12 MB.');
  button.disabled = true;
  button.textContent = 'Ověřuji podpis…';
  try {
    const response = await fetch('/api/certificates/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Ověření se nepodařilo.');
    if (!result.verified) {
      invalidResult.hidden = false;
      return;
    }
    document.querySelector('#verified-name').textContent = result.certificate.memberName;
    document.querySelector('#verified-course').textContent = result.certificate.courseTitle;
    document.querySelector('#verified-completed').textContent = new Intl.DateTimeFormat('cs-CZ', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Prague',
    }).format(new Date(result.certificate.completedAt));
    document.querySelector('#verified-issuer').textContent = result.certificate.issuer;
    validResult.hidden = false;
  } catch (error) {
    showMessage(error?.message || 'Ověření se nepodařilo.');
  } finally {
    button.disabled = false;
    button.textContent = 'Ověřit pravost';
  }
});

function resetResult() {
  message.hidden = true;
  validResult.hidden = true;
  invalidResult.hidden = true;
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}
