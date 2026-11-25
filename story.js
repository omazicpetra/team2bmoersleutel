const scenes = [
  {
    label: 'For Guild members only',
    title: 'Inside the Blend',
    text: 'Step into a cellar of roughly 300 barrels. Here, Rowan and Mark introduce Calypso’s Temptation — a stout shaped by whiskey-soaked oak and a surprising collection of vanillas. Pull the lever and follow its story.',
    art: 'cellar',
    focus: '44% 35%'
  },
  {
    label: 'Inside the barrel',
    title: 'Three whiskeys.\nOne beginning.',
    text: 'Look into the dark beer. The blend brings together stout aged in wheat whiskey, rye whiskey and Heaven Hill corn whiskey barrels. Each cask leaves its own trace. But the woody notes you will taste have another source, too.',
    art: 'barrel',
    focus: '69% 48%'
  },
  {
    label: 'At the vanilla table',
    title: 'A world\nof vanilla.',
    text: 'Around ten varieties became tinctures and beer infusions. Madagascar offered a familiar base. Papua New Guinea recalled soft-serve ice cream. Comoros brought wood and tobacco notes. The trial blend was so convincing that the brewers doubled the vanilla for the finished beer.',
    art: 'vanilla',
    focus: '65% 42%'
  },
  {
    label: 'From the cellar to your glass',
    title: 'Take your time.',
    text: 'At home, the story comes together. Pour Calypso’s Temptation, take in the aroma and follow the soft vanilla into the deeper woody notes. Is that the barrel, or the Comoros vanilla? Give the long finish a moment to unfold.',
    art: 'bar',
    focus: '67% 52%'
  }
];

const pages = document.querySelector('#pages');
const nav = document.querySelector('#scene-nav');
const lever = document.querySelector('#lever');
const shaft = document.querySelector('#shaft');
const grip = document.querySelector('#grip');
const hint = document.querySelector('#hint');
const count = document.querySelector('#count');
const passage = document.querySelector('#passage');
const passageCamera = passage.querySelector('.passage-camera');
passageCamera.innerHTML = '<img class="story-media" src="assets/media/hall.png" alt="" />';
const media = [
 { image: 'room.png', video: 'room-v2.mp4' },
 { image: 'cauldron.jpg', video: 'cauldron-v3.mp4' },
 { image: 'vanilla.jpg', video: 'vanilla.mp4' },
 { image: 'home.png', video: 'home-v2.mp4' }
];

let current = 0;
let busy = false;
let pointer = null;
let startY = 0;
let leverProgress = 0;
let leverAnimation = null;
let suppressClick = false;
const cameraEasing = 'cubic-bezier(.45,0,.2,1)';



scenes.forEach((scene, index) => {
  const panel = document.createElement('section');
  panel.className = `scene scene-${scene.art}`;
  panel.setAttribute('aria-labelledby', `title-${index}`);
  panel.innerHTML = `<div class="camera"><div class="ambience"><video class="story-media scene-video" muted playsinline preload="auto" src="assets/media/${media[index].video}"></video></div></div><div class="scene-shade"></div>`;
  const article = document.createElement('article');
  const label = document.createElement('small');
  label.textContent = scene.label;
  const title = document.createElement('h1');
  title.id = `title-${index}`;
  title.textContent = scene.title;
  const paragraph = document.createElement('p');
  paragraph.textContent = scene.text;
  article.append(label, title, paragraph);
  panel.append(article);
  pages.append(panel);

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', scene.title.replace('\n', ' '));
  button.title = scene.title.replace('\n', ' ');
  button.addEventListener('click', () => navigate(index, false));
  nav.append(button);
});
const panels = [...pages.children];
// Keep the decoded final frame, then gently move its camera without replaying the clip.
panels.forEach(panel => {
  panel.querySelector('video').addEventListener('ended', () => {
    if (panel.classList.contains('scene-bar')) {
      // Fit this single zoom-in/out to the actual remaining voice-over time.
      const voice = storyAudio.activeVoice;
      const remaining = voice && storyAudio.context
        ? voice.endsAt - storyAudio.context.currentTime : 10;
      panel.style.setProperty('--home-camera-duration', `${Math.max(6, remaining)}s`);
    }
    panel.classList.add('holding-frame');
  });
});

function setLever(value) {
  leverProgress = value;
  const distance = value * 112;
  shaft.setAttribute('y2', String(19 + distance));
  grip.setAttribute('transform', `translate(0 ${distance})`);
}

function moveLever(target, duration) {
  if (leverAnimation) cancelAnimationFrame(leverAnimation);
  const initial = leverProgress;
  const started = performance.now();
  return new Promise(resolve => {
    function tick(now) {
      const time = Math.min(1, (now - started) / duration);
      const eased = time * time * (3 - 2 * time);
      setLever(initial + (target - initial) * eased);
      if (time < 1) {
        leverAnimation = requestAnimationFrame(tick);
      } else {
        leverAnimation = null;
        resolve();
      }
    }
    leverAnimation = requestAnimationFrame(tick);
  });
}

function updateControls() {
  panels.forEach((panel, index) => {
    panel.setAttribute('aria-hidden', String(index !== current));
    panel.inert = index !== current;
  });
  [...nav.children].forEach((button, index) => {
    button.setAttribute('aria-current', String(index === current));
  });
  const instruction = current === scenes.length - 1 ? 'Pull to begin again' : 'Pull down or tap';
  lever.setAttribute('aria-label', instruction);
  hint.textContent = instruction;
  count.textContent = `${current + 1} / ${scenes.length}`;
}

function animate(element, keyframes, options) {
  return element.animate(keyframes, { easing: cameraEasing, fill: 'both', ...options });
}

// Videos are intentionally not looped: the browser holds their final frame.
async function readyVideo(video) {
  if (video.readyState >= 2) return true;
  return new Promise(resolve => {
    const timer = setTimeout(() => done(false), 10000);
    function done(ok) { clearTimeout(timer); video.removeEventListener('loadeddata', good); video.removeEventListener('error', bad); resolve(ok); }
    function good() { done(true); }
    function bad() { done(false); }
    video.addEventListener('loadeddata', good, {once:true});
    video.addEventListener('error', bad, {once:true});
    video.load();
  });
}
async function startVideo(panel) {
  panel.classList.remove('holding-frame');
  const video = panel.querySelector('video');
  video.muted = true;
  video.pause();
  video.currentTime = 0;
  if (!(await readyVideo(video))) { video.style.opacity = '0'; return false; }
  try { await video.play(); video.style.opacity = '1'; return true; }
  catch { video.style.opacity = '0'; return false; }
}
// Synchronize with video time, not a wall-clock delay (buffering cannot desync it).
async function waitForVideoTime(video, seconds) {
  if (video.currentTime >= seconds || video.ended || video.error || video.paused) return;
  await new Promise(resolve => {
    const timer = setTimeout(done, 12000);
    function done() { clearTimeout(timer); video.removeEventListener('timeupdate', check); video.removeEventListener('ended', done); video.removeEventListener('error', done); resolve(); }
    function check() { if (video.currentTime >= seconds) done(); }
    video.addEventListener('timeupdate', check);
    video.addEventListener('ended', done, {once:true});
    video.addEventListener('error', done, {once:true});
  });
}
async function finishVideo(video) {
  if (video.ended || video.error || video.paused) return;
  await new Promise(resolve => {
    // A stalled connection must never lock the lever permanently.
    const timer = setTimeout(done, Math.max(12000, video.duration * 1000 + 6000));
    function done() { clearTimeout(timer); video.removeEventListener('ended', done); video.removeEventListener('error', done); resolve(); }
    video.addEventListener('ended', done, {once:true});
    video.addEventListener('error', done, {once:true});
  });
}
async function navigate(index, pullLever) {
  if (busy || index === current) return;
  busy = true;
  storyAudio.stopNarration();
  lever.setAttribute('aria-busy', 'true');
  const outgoing = panels[current], incoming = panels[index];
  const animations = [];
  const forwardClip = (current === 0 && index === 1) || (current === 1 && index === 2);
  const hallway = current === 2 && index === 3;
  try {
    if (pullLever) await moveLever(1, 560);
    outgoing.querySelector('video').pause();
    await readyVideo(incoming.querySelector('video'));
    incoming.style.opacity = '0';
    incoming.classList.add('visible'); incoming.style.zIndex = '2';
    incoming.querySelector('article').style.opacity = '0';
    animations.push(animate(outgoing.querySelector('article'), [{opacity:1},{opacity:0}], {duration:500}));
    if (hallway) {
      passage.classList.add('visible');
      // Fade INTO the hallway only. Never fade back to the old vanilla frame.
      const enter = animate(passage, [{opacity:0},{opacity:1}], {duration:550});
      const travel = animate(passageCamera, [{transform:'scale(1)'},{transform:'scale(2.5)'}], {duration:4200});
      animations.push(enter,travel);
      await enter.finished;
      outgoing.classList.remove('visible');
      await travel.finished;
      // The hallway remains fully opaque while the home clip prepares.
      await startVideo(incoming); incoming.style.opacity = '1';
      const exit = animate(passage, [{opacity:1},{opacity:0}], {duration:750});
      animations.push(exit); await exit.finished;
    } else {
      await startVideo(incoming);
      const fade = animate(incoming, [{opacity:0},{opacity:1}], {duration:650});
      animations.push(fade); await fade.finished; incoming.style.opacity = '1';
    }
    // The new clip settles on the cauldron at about 2 seconds.
    // Its remaining 16 seconds cover the 15.28-second narration without looping.
    if (index === 1) await waitForVideoTime(incoming.querySelector('video'), 2);
    else if (forwardClip) await finishVideo(incoming.querySelector('video'));
    current = index; updateControls(); incoming.classList.add('playing');
    const reveal = animate(incoming.querySelector('article'), [{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}], {duration:850});
    animations.push(reveal);
    storyAudio.playScene(index);
    await reveal.finished;
  } finally {
    outgoing.classList.remove('visible','playing');
    incoming.classList.add('visible','playing');
    incoming.style.zIndex = ''; incoming.style.opacity = '';
    incoming.querySelector('article').style.opacity = '';
    passage.classList.remove('visible');
    animations.forEach(a => a.cancel());
    current = index; updateControls();
    if (pullLever) await moveLever(0,680);
    busy = false; lever.removeAttribute('aria-busy');
  }
}

lever.addEventListener('pointerdown', event => {
  if (busy || !event.isPrimary || event.button !== 0) return;
  pointer = event.pointerId;
  startY = event.clientY;
  suppressClick = false;
  lever.setPointerCapture(pointer);
});
lever.addEventListener('pointermove', event => {
  if (!busy && event.pointerId === pointer) {
    setLever(Math.max(0, Math.min(1, (event.clientY - startY) / 105)));
  }
});
lever.addEventListener('pointerup', event => {
  if (event.pointerId !== pointer) return;
  const distance = event.clientY - startY;
  pointer = null;
  suppressClick = true;
  if (distance >= 40 || Math.abs(distance) < 7) {
    navigate((current + 1) % scenes.length, true);
  } else {
    busy = true;
    moveLever(0, 440).then(() => { busy = false; });
  }
});
lever.addEventListener('pointercancel', () => {
  if (pointer === null) return;
  pointer = null;
  busy = true;
  moveLever(0, 440).then(() => { busy = false; });
});
lever.addEventListener('click', event => {
  if (!suppressClick || event.detail === 0) navigate((current + 1) % scenes.length, true);
  suppressClick = false;
});
const storyAudio = new StoryAudio(
  document.querySelector('#music'),
  document.querySelector('#sound'),
  voiceoverConfig
);
const entryGate = document.querySelector('#entry-gate');
document.querySelector('#begin-story').addEventListener('click', () => {
  storyAudio.start();
  storyAudio.playScene(0);
  startVideo(panels[0]);
  entryGate.remove();
  document.querySelector('#story-content').inert = false;
  lever.focus({ preventScroll: true });
});
panels[0].classList.add('visible', 'playing');
updateControls();
