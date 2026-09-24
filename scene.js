import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const host = document.querySelector('.webgl-canvas');
const stage = document.querySelector('.navi-stage');
const note = document.querySelector('.navi-note');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;

async function start() {
  // Fixed canvas must not inherit a reveal element's transform.
  document.body.append(host);
  note.textContent = 'Navi geliyor…';
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 5000);
  camera.position.set(0, 0, 2000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x627e82, 2.4));
  const light = new THREE.DirectionalLight(0xfff6e7, 3);
  light.position.set(-400, 600, 1000); scene.add(light);
  const fill = new THREE.DirectionalLight(0x8cf0dd, 1.8);
  fill.position.set(500, 150, -400); scene.add(fill);
  const gltf = await new GLTFLoader().loadAsync('navi-tripo-web.glb');
  const model = gltf.scene, actor = new THREE.Group(), pivot = new THREE.Group();
  actor.add(pivot); pivot.add(model); scene.add(actor);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  model.position.sub(center); pivot.scale.setScalar(1 / size.y);
  const bones = [];
  model.traverse(node => {
    if (node.isBone) bones.push({ node, q: node.quaternion.clone(), p: node.position.clone(), s: node.scale.clone() });
  });
  // GLTFLoader removes ':' from animation binding names.
  const neck = bones.filter(b => /Head_[0-2]$/.test(b.node.name))
    .sort((a, b) => Number(a.node.name.split('_').pop()) - Number(b.node.name.split('_').pop()));
  const head = neck[0];
  const tails = bones.filter(b => /Tail_\d+$/.test(b.node.name))
    .sort((a, b) => Number(a.node.name.split('_').pop()) - Number(b.node.name.split('_').pop()));
  const feet = bones.filter(b => /Limb_\d+$/.test(b.node.name)
    && !b.node.children.some(child => child.isBone && /Limb_\d+$/.test(child.name)));
  const mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations.find(a => /walk/i.test(a.name));
  if (!clip || !head || !tails.length || feet.length < 4) throw new Error('Navi animation or rig bindings are missing');
  const walk = mixer.clipAction(clip).play(); walk.setEffectiveWeight(0);
  const controls = document.createElement('div');
  controls.className = 'navi-controls';
  controls.innerHTML = '<button type="button" data-action="walk">Gezin ↔</button><button type="button" data-action="hello">Selam ver ✦</button><button type="button" data-action="pause" aria-pressed="false">Hareketi durdur</button>';
  stage.append(controls);
  document.querySelector('.navi-hint').textContent = 'İmlecini takip eder · dokun, selam versin';
  // Each section owns a reserved visual area. Never park over text or links.
  const docks = [];
  function dock(parent, name, className = '') {
    const element = document.createElement('div');
    element.className = `navi-dock ${className}`;
    element.setAttribute('aria-hidden', 'true');
    const entry = { element, name };
    parent.append(element); docks.push(entry);
    return entry;
  }
  dock(stage, 'hero', 'navi-dock-hero');
  dock(document.querySelector('#hakkimda'), 'about', 'navi-dock-flow');
  document.querySelectorAll('.project-visual').forEach((element, i) => dock(element, `project-${i}`, 'navi-dock-project'));
  const quoteDock = dock(document.querySelector('.mini-navi'), 'quote', 'navi-dock-quote');
  dock(document.querySelector('#iletisim'), 'contact', 'navi-dock-flow');
  const railElement = document.createElement('div');
  railElement.className = 'navi-dock navi-dock-rail';
  railElement.setAttribute('aria-hidden', 'true');
  document.body.append(railElement);
  const railDock = { element: railElement, name: 'scroll-rail' };
  document.body.classList.add('navi-enabled');
  const point = new THREE.Vector2(), target = new THREE.Vector2(), pointer = new THREE.Vector2(), look = new THREE.Vector2();
  const offset = new THREE.Quaternion(), euler = new THREE.Euler();
  const parentRotation = new THREE.Quaternion(), localOffset = new THREE.Quaternion();
  const headWorld = new THREE.Vector3(), tailWorld = new THREE.Vector3();
  const worldEnd = new THREE.Vector3();
  const groundPoint = new THREE.Vector3(), projectedHead = new THREE.Vector3(), projectedFoot = new THREE.Vector3();
  const screenNdc = new THREE.Vector2(), groundRay = new THREE.Raycaster();
  head.node.getWorldPosition(headWorld); tails[0].node.getWorldPosition(tailWorld);
  // Calibrate the model's forward direction instead of assuming local bone axes.
  const frontYaw = -Math.atan2(headWorld.x - tailWorld.x, headWorld.z - tailWorld.z);
  // The generated rig's resting head points to the side. Centre its gaze on the
  // camera first, then apply cursor movement around that calibrated neutral pose.
  const neutralHeadYaw = .95;
  const neutralHeadPitch = .36;
  actor.rotation.y = frontYaw;
  let width, height, desiredSize = 180, elapsed = 0, last = 0, pointerActive = false;
  let activeDock = null, dockRect = null, drift = 0, opacity = 0, railMode = false, cameraPitch = 0;
  let paused = reduced.matches, walkWeight = 0, helloUntil = 0, farewellUntil = 0, helloBlend = 0, tourUntil = 0;
  let nextTour = 4, tourSide = 1, lastState = '';
  let previousScrollY = window.scrollY, scrollDirection = 1, scrollImpulse = 0, scrollingUntil = 0;
  let platformWasMoving = false, platformLandingUntil = 0;
  let platformShiftX = 0, platformShiftY = 0;
  let quoteReached = false;
  function resize() {
    pointerActive = false;
    width = innerWidth; height = innerHeight; renderer.setSize(width, height);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
  }
  function destination() {
    const quoteSection = quoteDock.element.closest('.navi-break');
    const quoteSectionRect = quoteSection.getBoundingClientRect();
    if (quoteSectionRect.top > height * .9) quoteReached = false;
    if (!quoteReached && quoteSectionRect.top < height * .72 && quoteSectionRect.bottom > 95) {
      quoteReached = true;
      farewell();
    }
    if (!quoteReached && quoteSectionRect.bottom < 95) {
      railElement.classList.remove('is-active', 'is-walking', 'is-greeting', 'is-landing');
      railMode = false; activeDock = null; dockRect = null;
      return;
    }
    if (quoteReached) {
      railElement.classList.remove('is-active', 'is-walking', 'is-greeting', 'is-landing');
      railMode = false;
      const rect = quoteDock.element.getBoundingClientRect();
      if (rect.bottom < 95) { activeDock = null; dockRect = null; return; }
      const changed = activeDock !== quoteDock;
      activeDock = quoteDock; dockRect = rect;
      desiredSize = Math.min(220, rect.height * .66, rect.width / 1.65);
      target.set(rect.left + rect.width * .53, rect.top + rect.height * .62);
      if (changed) { opacity = 0; drift = 0; tourUntil = 0; }
      point.copy(target);
      return;
    }
    const shouldUseRail = width > 760 && window.scrollY > Math.max(280, height * .52);
    railElement.classList.toggle('is-active', shouldUseRail);
    if (shouldUseRail) {
      const rect = railElement.getBoundingClientRect();
      const changed = activeDock !== railDock;
      railMode = true; activeDock = railDock; dockRect = rect;
      desiredSize = Math.min(105, rect.width * .64, rect.height * .56);
      target.set(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (changed) { opacity = 0; drift = 0; tourUntil = 0; point.copy(target); }
      else point.copy(target);
      return;
    }
    railMode = false;
    let best = null;
    for (const candidate of docks) {
      const rect = candidate.element.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 90));
      const ratio = visible / Math.max(rect.height, 1);
      const score = ratio + (candidate === activeDock ? .15 : 0);
      if (ratio > .2 && (!best || score > best.score)) best = { candidate, rect, score };
    }
    const changed = activeDock !== best?.candidate;
    activeDock = best?.candidate || null; dockRect = best?.rect || null;
    if (!dockRect) return;
    // Budget for the tail, body turning and animated poses in both dimensions.
    desiredSize = activeDock.name === 'hero'
      ? Math.min(305, dockRect.height * .9, dockRect.width / 1.1)
      : Math.min(190, dockRect.height * .78, dockRect.width / 1.9);
    target.set(dockRect.left + dockRect.width / 2, dockRect.top + dockRect.height / 2);
    if (changed) { opacity = 0; drift = 0; tourUntil = 0; }
    // Scroll is an immediate coordinate change, not character locomotion.
    point.copy(target);
  }
  function tour() { tourSide *= -1; tourUntil = elapsed + 4.5; nextTour = elapsed + 13; }
  function syncPause() {
    const button = controls.querySelector('[data-action="pause"]');
    button.textContent = paused ? 'Hareketi başlat' : 'Hareketi durdur';
    button.setAttribute('aria-pressed', String(paused));
  }
  function greet() {
    paused = false;
    farewellUntil = 0;
    helloUntil = elapsed + 3.2;
    tourUntil = 0;
    drift = 0;
    walkWeight = 0;
    nextTour = elapsed + 8;
  }
  function farewell() {
    greet();
    helloUntil = elapsed + 4;
    farewellUntil = helloUntil;
  }
  controls.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.action;
    if (action === 'pause') paused = !paused;
    if (action === 'walk') { paused = false; tour(); }
    if (action === 'hello') greet();
    syncPause();
  });
  function trackPointer(event) {
    if (event.pointerType === 'touch') return;
    pointer.set(event.clientX, event.clientY); pointerActive = true;
  }
  window.addEventListener('pointermove', trackPointer, { passive: true });
  window.addEventListener('scroll', () => {
    const delta = window.scrollY - previousScrollY;
    previousScrollY = window.scrollY;
    if (Math.abs(delta) < 1) return;
    scrollDirection = Math.sign(delta);
    scrollImpulse = Math.min(1, .42 + Math.abs(delta) / 90);
    // Let the current step finish after the wheel stops so the walk remains
    // visible during fast trackpad and mouse-wheel gestures.
    scrollingUntil = performance.now() + 750;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointerActive = false; });
  window.addEventListener('blur', () => { pointerActive = false; });
  window.addEventListener('pointerdown', event => {
    if (event.target.closest('button, a')) return;
    if (!paused && activeDock && Math.hypot(event.clientX - point.x - drift, event.clientY - point.y) < desiredSize * .6) greet();
  }, { passive: true });
  reduced.addEventListener('change', () => { paused = reduced.matches; syncPause(); });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { last = 0; });
  resize(); destination(); point.copy(target); syncPause();
  stage.classList.add('has-3d'); host.classList.add('ready');
  host.dataset.clip = clip.name; host.dataset.tailBones = String(tails.length); host.dataset.head = head.node.name;
  function addRotation(bone, x, y, z) {
    if (!bone) return;
    offset.setFromEuler(euler.set(x, y, z)); bone.node.quaternion.multiply(offset);
  }
  function addWorldRotation(bone, x, y, z) {
    if (!bone) return;
    actor.updateMatrixWorld(true);
    bone.node.parent.getWorldQuaternion(parentRotation);
    offset.setFromEuler(euler.set(x, y, z, 'YXZ'));
    localOffset.copy(parentRotation).invert().multiply(offset).multiply(parentRotation);
    bone.node.quaternion.premultiply(localOffset);
  }
  function rotateFromNeck(yaw, pitch) {
    const weights = [.48, .34, .18];
    neck.forEach((bone, index) => {
      actor.updateMatrixWorld(true);
      bone.node.parent.getWorldQuaternion(parentRotation);
      offset.setFromEuler(euler.set(pitch * weights[index], yaw * weights[index], 0, 'YXZ'));
      // Convert the screen-aligned turn into each neck bone's local space.
      localOffset.copy(parentRotation).invert().multiply(offset).multiply(parentRotation);
      bone.node.quaternion.premultiply(localOffset);
    });
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    if (document.hidden) return;
    if (!paused) elapsed += dt;
    if (!paused && elapsed > nextTour) tour();
    destination();
    const maxDrift = dockRect ? Math.max(0, (dockRect.width - desiredSize * 1.8) / 2 - 8) : 0;
    const desiredDrift = !paused && elapsed < tourUntil ? tourSide * Math.min(40, maxDrift) : 0;
    const dx = desiredDrift - drift;
    const scrollWalking = !paused && railMode && now < scrollingUntil;
    const moving = !paused && (Math.abs(dx) > 2 || scrollWalking);
    drift = damp(drift, desiredDrift, 2.2, dt);
    const desiredWalkWeight = scrollWalking ? Math.max(.72, scrollImpulse) : moving ? 1 : 0;
    walkWeight = damp(walkWeight, desiredWalkWeight, scrollWalking ? 11 : 7, dt);
    scrollImpulse = damp(scrollImpulse, 0, 5, dt);
    // Restore rest pose before blending, so procedural offsets cannot accumulate.
    for (const b of bones) { b.node.quaternion.copy(b.q); b.node.position.copy(b.p); b.node.scale.copy(b.s); }
    walk.setEffectiveWeight(paused ? 0 : walkWeight); mixer.update(paused ? 0 : dt);
    const hello = !paused && elapsed < helloUntil, farewellActive = hello && elapsed < farewellUntil;
    const strength = paused ? 0 : 1 - walkWeight * .65;
    const platformMoving = railMode && (moving || hello);
    if (platformWasMoving && !platformMoving && railMode) platformLandingUntil = now + 580;
    platformWasMoving = platformMoving;
    railElement.classList.toggle('is-walking', railMode && moving && !hello);
    railElement.classList.toggle('is-greeting', railMode && hello);
    railElement.classList.toggle('is-landing', railMode && now < platformLandingUntil);
    helloBlend = damp(helloBlend, hello ? 1 : 0, hello ? 9 : 6, dt);
    if (helloBlend > .002) {
      // Propagate the greeting through every segment instead of rotating a rigid tail.
      const greetingWave = Math.sin(elapsed * 6.2);
      addWorldRotation(tails[0], helloBlend * .32, helloBlend * (.6 + greetingWave * .24), helloBlend * Math.sin(elapsed * 6.2 + 1) * .06);
      tails.slice(1).forEach((b, i) => {
        const tip = (i + 1) / Math.max(1, tails.length - 1);
        const phase = elapsed * 6.2 - (i + 1) * .52;
        const sideFollow = .016 + tip * .038;
        const liftFollow = .008 + tip * .012;
        addRotation(b, 0, helloBlend * Math.sin(phase) * sideFollow, helloBlend * Math.cos(phase * .86) * liftFollow);
      });
    } else {
      tails.forEach((b, i) => {
        const tip = tails.length > 1 ? i / (tails.length - 1) : 0;
        const phase = elapsed * 3.8 - i * .48;
        addRotation(b, 0, strength * Math.sin(phase) * (.025 + tip * .02), strength * Math.cos(phase * .72) * (.015 + tip * .015));
      });
    }
    const bounce = paused || hello ? 0 : Math.sin(elapsed * (railMode ? 6.4 : 2.3)) * (railMode && scrollWalking ? 2 : 3);
    const railStep = railMode && scrollWalking ? scrollDirection * Math.sin(elapsed * 6.4) * 2.5 : 0;
    // Keep the companion upright in a stable front camera. Scroll movement is
    // expressed through the walk cycle, not by tilting the whole 3D world.
    cameraPitch = damp(cameraPitch, 0, 5, dt);
    camera.position.set(0, Math.sin(cameraPitch) * 2000, Math.cos(cameraPitch) * 2000);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    screenNdc.set(((point.x + drift) / width) * 2 - 1, 1 - ((point.y - bounce + railStep) / height) * 2);
    groundRay.setFromCamera(screenNdc, camera);
    const groundDistance = -groundRay.ray.origin.z / groundRay.ray.direction.z;
    groundRay.ray.at(groundDistance, groundPoint);
    actor.position.set(groundPoint.x, groundPoint.y, 0);
    actor.scale.setScalar(desiredSize * (1 + (paused || hello ? 0 : Math.sin(elapsed * 2.3) * .008)));
    pivot.rotation.x = damp(pivot.rotation.x, 0, 5, dt);
    actor.updateMatrixWorld(true);
    // Moving this generated spine bone exposes a handful of incorrectly
    // weighted polygons near the front foot. Keep the mesh intact and reveal
    // the tail with a subtle whole-character turn instead.
    const frontBodyShift = 0;
    actor.updateMatrixWorld(true); head.node.getWorldPosition(headWorld);
    projectedHead.copy(headWorld).project(camera);
    const headX = (projectedHead.x * .5 + .5) * width;
    const headY = (-projectedHead.y * .5 + .5) * height;
    const lookX = pointerActive && !paused ? clamp((pointer.x - headX) / Math.max(180, width * .35), -1, 1) : 0;
    const lookY = pointerActive && !paused ? clamp((pointer.y - headY) / Math.max(160, height * .3), -1, 1) : 0;
    look.x = damp(look.x, lookX, 10, dt); look.y = damp(look.y, lookY, 10, dt);
    // Cursor input never rotates the torso. The body turns only while locomoting.
    const facingTurn = railMode && scrollWalking ? scrollDirection * .08 : moving && !pointerActive ? Math.sign(dx) * .7 : 0;
    const facing = frontYaw + (railMode ? -.28 : 0) + facingTurn + helloBlend * .07;
    actor.rotation.y = damp(actor.rotation.y, facing, 4, dt);
    actor.rotation.z = paused ? 0 : Math.sin(elapsed * 1.4) * .018;
    const gazeStrength = paused ? 0 : 1;
    const pitchTravel = railMode ? (look.y < 0 ? look.y * .42 : look.y * .3) : look.y < 0 ? look.y * .68 : look.y * .36;
    const headPitch = neutralHeadPitch + gazeStrength * pitchTravel + gazeStrength * Math.sin(elapsed * 1.6) * .02;
    const heroYawTravel = look.x < 0 ? look.x * .86 : look.x * .62;
    const headYaw = neutralHeadYaw + gazeStrength * (railMode ? look.x * .55 : heroYawTravel);
    rotateFromNeck(headYaw, headPitch);
    actor.updateMatrixWorld(true);
    let footLeft = Infinity, footRight = -Infinity, footBottom = -Infinity;
    for (const foot of feet) {
      foot.node.getWorldPosition(worldEnd);
      projectedFoot.copy(worldEnd).project(camera);
      const footX = (projectedFoot.x * .5 + .5) * width;
      const footY = (-projectedFoot.y * .5 + .5) * height;
      footLeft = Math.min(footLeft, footX); footRight = Math.max(footRight, footX); footBottom = Math.max(footBottom, footY);
    }
    const platformBaseCenterX = dockRect ? dockRect.right - 101 : point.x;
    const platformBaseCenterY = height - 57.5;
    const desiredPlatformShiftX = railMode ? clamp((footLeft + footRight) * .5 - platformBaseCenterX, -18, 18) : 0;
    const desiredPlatformShiftY = railMode ? clamp(footBottom + 3 - platformBaseCenterY, -30, 34) : 0;
    platformShiftX = damp(platformShiftX, desiredPlatformShiftX, 15, dt);
    platformShiftY = damp(platformShiftY, desiredPlatformShiftY, 15, dt);
    railElement.style.setProperty('--platform-shift-x', `${platformShiftX.toFixed(2)}px`);
    railElement.style.setProperty('--platform-shift-y', `${platformShiftY.toFixed(2)}px`);
    const state = paused ? 'Dinleniyor' : farewellActive ? 'Görüşürüz Furkan! ✦' : hello ? 'Merhaba Furkan! ✦' : scrollWalking ? 'Seninle geliyor' : moving ? 'Biraz keşif zamanı' : 'İmlecini merak ediyor';
    if (state !== lastState) { note.textContent = state; lastState = state; }
    opacity = damp(opacity, activeDock ? 1 : 0, 12, dt);
    host.style.opacity = String(opacity);
    host.dataset.motion = JSON.stringify({ time: +mixer.time.toFixed(3), state, weight: +walkWeight.toFixed(3), hello: +helloBlend.toFixed(3), frontBodyShift: +frontBodyShift.toFixed(1), dock: activeDock?.name, rail: railMode, cameraPitch: +cameraPitch.toFixed(3), scrollWalking, platformShift: [+platformShiftX.toFixed(2), +platformShiftY.toFixed(2)], footScreen: [footLeft, footRight, footBottom], pointer: pointerActive ? pointer.toArray() : null, headScreen: [headX, headY], neck: neck.map(b => b.node.quaternion.toArray()), bodyYaw: +actor.rotation.y.toFixed(4), headYaw: +headYaw.toFixed(4), headPitch: +headPitch.toFixed(4), look: look.toArray(), x: +(point.x + drift).toFixed(1), y: +point.y.toFixed(1), size: desiredSize });
    // Clip all rendered pixels to the reserved area, including fast scrolling.
    renderer.setScissorTest(false); renderer.clear();
    if (dockRect) {
      const left = Math.max(0, dockRect.left), dockBottom = Math.max(0, height - dockRect.bottom);
      // The generated mesh contains a wrongly weighted triangle below one front
      // foot. Clip only pixels below the measured foot line, preserving the toes
      // while preventing that polygon from stretching into view in any pose.
      const footMargin = Math.max(6, desiredSize * .04);
      const footClipBottom = Number.isFinite(footBottom) ? height - Math.min(height, footBottom + footMargin) : 0;
      const bottom = Math.max(dockBottom, footClipBottom);
      const right = Math.min(width, dockRect.right), top = Math.min(height - 90, height - dockRect.top);
      if (right > left && top > bottom) {
        renderer.setScissor(left, bottom, right - left, top - bottom);
        renderer.setScissorTest(true); renderer.render(scene, camera);
      }
    }
  }
  requestAnimationFrame(frame);
}
if (host && stage) start().catch(error => {
  console.error('Navi sahnesi başlatılamadı:', error);
  note.textContent = 'Navi yüklenemedi; sayfayı yenile';
  stage.classList.remove('has-3d'); host.classList.remove('ready');
});
