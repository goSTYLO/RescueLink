export const PHONE_MAX_LENGTH = 11;

export const sanitizePhoneInput = (value) =>
  String(value ?? '').replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);

export const isValidLocalPhone = (value) => /^09\d{9}$/.test(String(value ?? '').trim());

const EYE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

const EYE_OFF_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';

/** Attach show/hide toggle to a plain DOM password input (e.g. SweetAlert). */
export function attachPasswordToggle(inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.dataset.toggleAttached === 'true') return;

  input.dataset.toggleAttached = 'true';
  input.style.paddingRight = '2.5rem';

  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = '100%';
  input.parentNode?.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Show password');
  btn.style.cssText =
    'position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);border:none;background:transparent;color:#6b7280;cursor:pointer;padding:0.25rem;display:flex;align-items:center;';
  btn.innerHTML = EYE_SVG;

  let visible = false;
  btn.addEventListener('click', () => {
    visible = !visible;
    input.type = visible ? 'text' : 'password';
    btn.innerHTML = visible ? EYE_OFF_SVG : EYE_SVG;
    btn.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });

  wrapper.appendChild(btn);
}
