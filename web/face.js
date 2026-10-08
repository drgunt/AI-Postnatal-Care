// Face capture + descriptor (face-api, vendored under /vendor/face-api). Runs entirely in the browser.
// NOTE: photo-based matching has no liveness check — it is a convenience second factor, not strong biometric auth.
(function () {
  let ready = null;
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('โหลดไลบรารีสแกนใบหน้าไม่สำเร็จ')); document.head.appendChild(s); }); }
  function init() {
    if (ready) return ready;
    ready = (async () => {
      if (!window.faceapi) await loadScript('/vendor/face-api/face-api.js');
      const f = window.faceapi, M = '/vendor/face-api/model';
      try { await f.tf.setBackend('webgl'); } catch { await f.tf.setBackend('cpu'); }
      await f.tf.ready();
      await Promise.all([f.nets.tinyFaceDetector.loadFromUri(M), f.nets.faceLandmark68Net.loadFromUri(M), f.nets.faceRecognitionNet.loadFromUri(M)]);
      return f;
    })().catch(e => { ready = null; throw e; });
    return ready;
  }
  async function toCanvas(file, max = 480) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }
  // -> { descriptor: number[128], photo: dataURL(jpeg) }; throws Thai-language Error if not exactly one clear face
  async function scan(file) {
    if (!file) throw new Error('กรุณาถ่ายภาพหรือเลือกรูปใบหน้า');
    const [f, canvas] = await Promise.all([init(), toCanvas(file)]);
    const found = await f.detectAllFaces(canvas, new f.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })).withFaceLandmarks().withFaceDescriptors();
    if (found.length === 0) throw new Error('ไม่พบใบหน้าในภาพ กรุณาถ่ายให้เห็นหน้าชัดเจนและมีแสงเพียงพอ');
    if (found.length > 1) throw new Error('พบหลายใบหน้าในภาพ กรุณาถ่ายเฉพาะใบหน้าของตัวเอง');
    return { descriptor: Array.from(found[0].descriptor), photo: canvas.toDataURL('image/jpeg', 0.85) };
  }
  window.PNCFace = { scan, init };
})();
