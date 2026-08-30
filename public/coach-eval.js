const state = { mode: 'coach', session: null, messages: [], sending: false, finished: false };

const elements = {
  intro: document.querySelector('#intro'),
  workspace: document.querySelector('#workspace'),
  feedback: document.querySelector('#feedback'),
  roleCards: [...document.querySelectorAll('[data-mode]')],
  startButton: document.querySelector('#start-test'),
  startError: document.querySelector('#start-error'),
  activeRoleLabel: document.querySelector('#active-role-label'),
  remainingTurns: document.querySelector('#remaining-turns'),
  messages: document.querySelector('#test-messages'),
  starterPrompts: document.querySelector('#starter-prompts'),
  chatForm: document.querySelector('#test-chat-form'),
  input: document.querySelector('#test-input'),
  sendButton: document.querySelector('#send-test-message'),
  chatError: document.querySelector('#chat-error'),
  finishButton: document.querySelector('#finish-test'),
  feedbackForm: document.querySelector('#feedback-form'),
  feedbackError: document.querySelector('#feedback-error'),
  feedbackThanks: document.querySelector('#feedback-thanks'),
  submitFeedback: document.querySelector('#submit-feedback'),
};

elements.roleCards.forEach(card => card.addEventListener('click', () => selectRole(card.dataset.mode)));
elements.startButton.addEventListener('click', startTest);
elements.starterPrompts.addEventListener('click', event => {
  const button = event.target.closest('[data-prompt]');
  if (!button) return;
  elements.input.value = button.dataset.prompt;
  elements.input.focus();
});
elements.chatForm.addEventListener('submit', sendMessage);
elements.input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});
elements.finishButton.addEventListener('click', openFeedback);
elements.feedbackForm.addEventListener('submit', submitFeedback);

function selectRole(mode) {
  if (state.session) return;
  state.mode = mode === 'mentor' ? 'mentor' : 'coach';
  elements.roleCards.forEach(card => {
    const selected = card.dataset.mode === state.mode;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  updateStarterPrompts();
}

function updateStarterPrompts() {
  const prompts = state.mode === 'mentor'
    ? [
      ['Chci rozjet osobní značku, ale nevím, čím se odlišit ani jaký obsah tvořit.', 'Osobní značka a obsah'],
      ['Můj obsah je obecný a nepřináší mi klientky. Potřebuji zjistit, co změnit.', 'Obsah nepřináší klientky'],
      ['Stydím se prodávat a nevím, jak svou nabídku komunikovat přirozeně.', 'Prodej bez tlačení'],
    ]
    : [
      ['Odkládám jeden důležitý krok a potřebuji pochopit, co mě skutečně brzdí.', 'Odkládám důležitý krok'],
      ['Rozhoduji se mezi dvěma možnostmi a pořád se točím v kruhu.', 'Nemohu se rozhodnout'],
      ['Vím, co bych měla udělat, ale nedaří se mi to opravdu začít dělat.', 'Vím co, ale nezačnu'],
    ];
  [...elements.starterPrompts.querySelectorAll('[data-prompt]')].forEach((button, index) => {
    button.dataset.prompt = prompts[index][0];
    button.textContent = prompts[index][1];
  });
}

async function startTest() {
  elements.startButton.disabled = true;
  setError(elements.startError, '');
  try {
    state.session = await jsonRequest('/api/public-coach-test/session', { mode: state.mode });
    elements.intro.hidden = true;
    elements.workspace.hidden = false;
    elements.activeRoleLabel.textContent = state.mode === 'mentor' ? 'ELITEA MENTORKA' : 'ELITEA KOUČKA';
    updateRemaining();
    appendMessage('assistant', state.mode === 'mentor'
      ? 'Přines cíl, problém nebo rozpracovaný výstup. Budu se ptát jen na údaje, které skutečně mění doporučení, a jakmile jich bude dost, vytvořím konkrétní řešení. Co chceš posunout?'
      : 'Přines problém, u kterého chceš pochopit, kde se skutečně láme, a dojít k použitelnému posunu. Co právě řešíš?');
    elements.input.focus();
  } catch (error) {
    setError(elements.startError, error.message);
    elements.startButton.disabled = false;
  }
}

async function sendMessage(event) {
  event.preventDefault();
  const content = elements.input.value.trim();
  if (!content || state.sending || !state.session || state.finished) return;
  state.sending = true;
  elements.sendButton.disabled = true;
  elements.input.disabled = true;
  elements.starterPrompts.hidden = true;
  setError(elements.chatError, '');
  state.messages.push({ role: 'user', content });
  appendMessage('user', content);
  elements.input.value = '';
  const pending = appendMessage('assistant pending', 'Elitea přemýšlí nad tím, co jsi napsala…');
  try {
    const payload = await jsonRequest('/api/public-coach-test/chat', {
      sessionToken: state.session.token,
      messages: state.messages,
    });
    pending.remove();
    state.messages.push({ role: 'assistant', content: payload.answer });
    state.session = payload.session;
    appendMessage('assistant', payload.answer);
    updateRemaining();
    elements.finishButton.disabled = state.session.turnsUsed < 2;
    if (state.session.remainingTurns <= 0) finishConversation();
  } catch (error) {
    pending.remove();
    state.messages.pop();
    elements.input.value = content;
    setError(elements.chatError, error.message);
  } finally {
    state.sending = false;
    if (!state.finished) {
      elements.sendButton.disabled = false;
      elements.input.disabled = false;
      elements.input.focus();
    }
  }
}

function finishConversation() {
  state.finished = true;
  elements.input.disabled = true;
  elements.sendButton.disabled = true;
  elements.finishButton.disabled = false;
  elements.finishButton.textContent = 'Ohodnotit dokončený test';
}

function openFeedback() {
  if (!state.session || state.session.turnsUsed < 2) return;
  state.finished = true;
  elements.workspace.hidden = true;
  elements.feedback.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitFeedback(event) {
  event.preventDefault();
  if (!elements.feedbackForm.reportValidity()) return;
  elements.submitFeedback.disabled = true;
  setError(elements.feedbackError, '');
  const form = new FormData(elements.feedbackForm);
  try {
    await jsonRequest('/api/public-coach-test/feedback', {
      sessionToken: state.session.token,
      evaluatorName: form.get('evaluatorName'),
      contact: form.get('contact'),
      usefulness: Number(form.get('usefulness')),
      roleFidelity: Number(form.get('roleFidelity')),
      wouldUse: form.get('wouldUse'),
      notes: form.get('notes'),
      transcriptConsent: form.get('transcriptConsent') === 'on',
      messages: state.messages,
    });
    elements.feedbackForm.hidden = true;
    elements.feedbackThanks.hidden = false;
  } catch (error) {
    setError(elements.feedbackError, error.message);
    elements.submitFeedback.disabled = false;
  }
}

function appendMessage(kind, content) {
  const article = document.createElement('article');
  article.className = `message ${kind}`;
  const label = document.createElement('b');
  label.textContent = kind.startsWith('user') ? 'TY' : (state.mode === 'mentor' ? 'ELITEA MENTORKA' : 'ELITEA KOUČKA');
  const text = document.createElement('div');
  text.textContent = content;
  article.append(label, text);
  elements.messages.append(article);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return article;
}

function updateRemaining() {
  elements.remainingTurns.textContent = String(state.session?.remainingTurns ?? 0);
}

function setError(element, message) {
  element.textContent = message || '';
  element.hidden = !message;
}

async function jsonRequest(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Něco se nepovedlo. Zkus to prosím znovu.');
  return payload;
}

updateStarterPrompts();
