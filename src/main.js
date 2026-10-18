import '@fontsource-variable/playfair-display/wght.css';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/dm-sans/wght.css';
import './style.css';

const stage = document.querySelector('#invite-stage');
const openInvitationButton = document.querySelector('#open-invitation');
const stageHint = document.querySelector('#stage-hint-text');
const soundToggle = document.querySelector('#sound-toggle');
const soundControls = [...document.querySelectorAll('[data-sound-control]')];
const toast = document.querySelector('#toast');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let toastTimeout;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 3600);
}

// The paper and envelope are built from CSS layers so the invitation remains crisp
// and interactive at every screen size.
function setInvitationOpen(isOpen, shouldScroll = false) {
  stage.classList.toggle('is-open', isOpen);
  stage.setAttribute('aria-pressed', String(isOpen));
  stage.setAttribute('aria-label', isOpen ? 'Close the opened wedding invitation' : 'Open the sealed three-dimensional invitation');
  openInvitationButton.setAttribute('aria-pressed', String(isOpen));
  openInvitationButton.querySelector('span').textContent = isOpen ? 'Close invitation' : 'Open your invitation';
  stageHint.textContent = isOpen ? 'Your invitation is unsealed' : 'Tap to unseal your invitation';

  if (shouldScroll && window.matchMedia('(max-width: 820px)').matches) {
    stage.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
  }
}

stage.addEventListener('click', () => {
  setInvitationOpen(!stage.classList.contains('is-open'));
});
openInvitationButton.addEventListener('click', () => {
  setInvitationOpen(!stage.classList.contains('is-open'), true);
});

const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
if (canHover.matches && !reducedMotion.matches) {
  stage.addEventListener('pointermove', (event) => {
    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    stage.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`);
    stage.style.setProperty('--tilt-y', `${(x * 6).toFixed(2)}deg`);
  });
  stage.addEventListener('pointerleave', () => {
    stage.style.setProperty('--tilt-x', '0deg');
    stage.style.setProperty('--tilt-y', '0deg');
  });
}

// A small, original Web Audio soundscape: warm sustained tones with occasional
// soft chimes. It starts only after a guest chooses to play it.
let audioContext;
let masterGain;
let reverbNode;
let musicInterval;
let suspendTimeout;
let chimeIndex = 0;
let isSoundOn = false;
const chimeNotes = [523.25, 659.25, 783.99, 587.33, 698.46, 880, 783.99, 659.25];

function makeImpulseResponse(context, seconds = 2.7, decay = 2.8) {
  const length = Math.floor(context.sampleRate * seconds);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const samples = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const fade = Math.pow(1 - index / length, decay);
      samples[index] = (Math.random() * 2 - 1) * fade;
    }
  }
  return impulse;
}

function setSoundControls(active) {
  isSoundOn = active;
  soundToggle.setAttribute('aria-pressed', String(active));
  soundToggle.setAttribute('aria-label', active ? 'Turn off the invitation soundscape' : 'Turn on the invitation soundscape');
  soundToggle.querySelector('.sound-label').textContent = active ? 'Sound on' : 'Sound off';
  soundControls.forEach((control) => {
    control.setAttribute('aria-pressed', String(active));
    control.setAttribute('aria-label', active ? 'Pause the invitation soundscape' : 'Play the invitation soundscape');
  });
}

function playChime() {
  if (!audioContext || !masterGain || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;
  const frequency = chimeNotes[chimeIndex % chimeNotes.length];
  const pan = Math.sin(chimeIndex * 0.7) * 0.3;
  const panner = audioContext.createStereoPanner();
  panner.pan.setValueAtTime(pan, now);

  const bell = audioContext.createOscillator();
  const bellEnvelope = audioContext.createGain();
  bell.type = 'sine';
  bell.frequency.setValueAtTime(frequency, now);
  bellEnvelope.gain.setValueAtTime(0.0001, now);
  bellEnvelope.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
  bellEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
  bell.connect(bellEnvelope);
  bellEnvelope.connect(panner);
  panner.connect(masterGain);
  if (reverbNode) panner.connect(reverbNode);

  const overtone = audioContext.createOscillator();
  const overtoneEnvelope = audioContext.createGain();
  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(frequency * 2.01, now);
  overtoneEnvelope.gain.setValueAtTime(0.0001, now);
  overtoneEnvelope.gain.exponentialRampToValueAtTime(0.035, now + 0.018);
  overtoneEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
  overtone.connect(overtoneEnvelope);
  overtoneEnvelope.connect(panner);

  bell.start(now);
  bell.stop(now + 2.9);
  overtone.start(now);
  overtone.stop(now + 1.35);
  chimeIndex += 1;
}

async function turnSoundOn() {
  try {
    window.clearTimeout(suspendTimeout);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio is not supported in this browser.');

    if (!audioContext) {
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0;

      const padFilter = audioContext.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 720;
      padFilter.Q.value = 0.35;
      const padGain = audioContext.createGain();
      padGain.gain.value = 0.21;
      padFilter.connect(padGain);
      padGain.connect(masterGain);

      [146.83, 220, 293.66].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const voiceGain = audioContext.createGain();
        oscillator.type = index === 0 ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index === 1 ? -4 : index === 2 ? 4 : 0;
        voiceGain.gain.value = index === 0 ? 0.36 : 0.2;
        oscillator.connect(voiceGain);
        voiceGain.connect(padFilter);
        oscillator.start();
      });

      reverbNode = audioContext.createConvolver();
      reverbNode.buffer = makeImpulseResponse(audioContext);
      const wetGain = audioContext.createGain();
      wetGain.gain.value = 0.14;
      reverbNode.connect(wetGain);
      wetGain.connect(masterGain);
      masterGain.connect(audioContext.destination);
    }

    await audioContext.resume();
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), audioContext.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.48, audioContext.currentTime + 1.1);
    setSoundControls(true);
    playChime();
    window.clearInterval(musicInterval);
    musicInterval = window.setInterval(playChime, 3150);
  } catch (error) {
    setSoundControls(false);
    showToast('Sound is not available in this browser. You can still enjoy the invitation.');
    console.warn('Unable to start the invitation soundscape:', error);
  }
}

function turnSoundOff() {
  window.clearInterval(musicInterval);
  setSoundControls(false);
  if (!audioContext || !masterGain) return;
  masterGain.gain.cancelScheduledValues(audioContext.currentTime);
  masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), audioContext.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
  window.clearTimeout(suspendTimeout);
  suspendTimeout = window.setTimeout(() => {
    if (!isSoundOn && audioContext?.state === 'running') audioContext.suspend();
  }, 550);
}

function toggleSound() {
  if (isSoundOn) turnSoundOff();
  else turnSoundOn();
}

soundToggle.addEventListener('click', toggleSound);
soundControls.forEach((control) => control.addEventListener('click', toggleSound));

// Compact mobile menu; links close it immediately after navigation.
const menuToggle = document.querySelector('#menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function setMenuOpen(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  mobileNav.hidden = !open;
}
menuToggle.addEventListener('click', () => setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true'));
mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));

// Countdown uses Hyderabad time (UTC+05:30) so the date stays consistent for guests.
const weddingDate = new Date('2027-02-07T17:00:00+05:30');
const countdownNodes = {
  days: document.querySelector('#countdown-days'),
  hours: document.querySelector('#countdown-hours'),
  minutes: document.querySelector('#countdown-minutes'),
};
function updateCountdown() {
  const remaining = Math.max(0, weddingDate.getTime() - Date.now());
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  countdownNodes.days.textContent = String(days).padStart(2, '0');
  countdownNodes.hours.textContent = String(hours).padStart(2, '0');
  countdownNodes.minutes.textContent = String(minutes).padStart(2, '0');
}
updateCountdown();
window.setInterval(updateCountdown, 60_000);

// Download a calendar file locally; there is no external calendar tracking.
document.querySelector('#calendar-button').addEventListener('click', () => {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aarav and Ananya//Wedding Invitation//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:aarav-ananya-wedding-20270207@invitation.local',
    `DTSTAMP:${now}`,
    'DTSTART:20270207T113000Z',
    'DTEND:20270207T170000Z',
    'SUMMARY:Aarav & Ananya — Wedding Celebration',
    'LOCATION:Taj Falaknuma Palace, Hyderabad, Telangana, India',
    'DESCRIPTION:Join Aarav and Ananya for a garden soirée, ceremony, dinner and dancing.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const calendarUrl = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const download = document.createElement('a');
  download.href = calendarUrl;
  download.download = 'aarav-and-ananya-wedding.ics';
  document.body.append(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(calendarUrl), 1000);
  showToast('Your calendar invitation is ready.');
});

// This RSVP is intentionally a front-end demo. Connect this handler to an RSVP
// service or form endpoint before using it for real guest replies.
const rsvpForm = document.querySelector('#rsvp-form');
const rsvpSuccess = document.querySelector('#rsvp-success');
const successName = document.querySelector('#success-name');
const successMessage = document.querySelector('#success-message');
rsvpForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!rsvpForm.reportValidity()) return;
  const reply = new FormData(rsvpForm);
  const guestName = String(reply.get('name') || '').trim();
  const attending = reply.get('attendance') === 'joyfully-accepts';
  successName.textContent = guestName || 'dear friend.';
  successMessage.textContent = attending
    ? 'We’re so glad you’ll be celebrating with us. Save a dance for the happy couple!'
    : 'We’ll miss you on the day, but we’re sending a little love your way.';
  rsvpForm.hidden = true;
  rsvpSuccess.hidden = false;
  rsvpSuccess.focus?.();
});
document.querySelector('#edit-reply').addEventListener('click', () => {
  rsvpSuccess.hidden = true;
  rsvpForm.hidden = false;
  document.querySelector('#guest-name').focus();
});
