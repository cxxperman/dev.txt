// Renders the film into video files, frame by frame — not in real time, so nothing is dropped.
// Runs in the page (it needs the page's drawAt and the browser's video encoder) and hands the result to
// the local server that served the page:  POST /<name>  →  promo/out/<name>.
//   window.renderPromo({ fps: 30 })  →  { mp4?: {...}, webm?: {...} }
// No libraries: the two containers are written by hand below (one video track, no sound).
'use strict';
(() => {
  const u8 = (...parts) => {
    const list = parts.flat(Infinity).map(p => (p instanceof Uint8Array ? p : typeof p === 'string' ? new TextEncoder().encode(p) : new Uint8Array([p])));
    const out = new Uint8Array(list.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of list) { out.set(p, at); at += p.length; }
    return out;
  };
  const be = (value, bytes) => { const b = new Uint8Array(bytes); let v = BigInt(Math.round(value)); for (let i = bytes - 1; i >= 0; i--) { b[i] = Number(v & 255n); v >>= 8n; } return b; };
  const u16 = v => be(v, 2), u32 = v => be(v, 4);

  // ───────── MP4 (H.264): the file every phone and messenger plays ─────────
  const box = (type, ...payload) => { const body = u8(payload); return u8(u32(body.length + 8), type, body); };
  const full = (type, version, flags, ...payload) => box(type, version, be(flags, 3), payload);
  const MATRIX = [u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)];
  function mp4(samples, w, h, fps, avcC) {
    const n = samples.length, scale = fps * 1000, total = samples.reduce((s, x) => s + x.data.length, 0);
    const ftyp = box('ftyp', 'isom', u32(0x200), 'isom', 'iso2', 'avc1', 'mp41');
    const build = offset => {
      const stbl = box('stbl',
        full('stsd', 0, 0, u32(1), box('avc1', new Uint8Array(6), u16(1), new Uint8Array(16), u16(w), u16(h), u32(0x480000), u32(0x480000), u32(0), u16(1), new Uint8Array(32), u16(0x18), u16(0xffff), box('avcC', avcC))),
        full('stts', 0, 0, u32(1), u32(n), u32(1000)),
        full('stss', 0, 0, u32(samples.filter(x => x.key).length), samples.map((x, i) => (x.key ? u32(i + 1) : []))),
        full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
        full('stsz', 0, 0, u32(0), u32(n), samples.map(x => u32(x.data.length))),
        full('stco', 0, 0, u32(1), u32(offset)));
      const minf = box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
      const mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(scale), u32(n * 1000), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), 'vide', new Uint8Array(12), 'VideoHandler', 0), minf);
      const ms = Math.round(n * 1000 / fps);
      const trak = box('trak', full('tkhd', 0, 7, u32(0), u32(0), u32(1), u32(0), u32(ms), new Uint8Array(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(w * 65536), u32(h * 65536)), mdia);
      return box('moov', full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x10000), u16(0x100), new Uint8Array(10), MATRIX, new Uint8Array(24), u32(2)), trak);
    };
    const moov = build(ftyp.length + build(0).length + 8);   // the sample data starts right after the header of mdat
    return new Blob([ftyp, moov, u32(total + 8), 'mdat', ...samples.map(x => x.data)], { type: 'video/mp4' });
  }

  // ───────── WebM (VP9): the fallback when the browser has no H.264 encoder ─────────
  const vint = n => { for (let len = 1; len <= 8; len++) if (n < 2 ** (7 * len) - 1) { const b = be(n, len); b[0] |= 1 << (8 - len); return b; } throw new Error('too big'); };
  const el = (id, ...payload) => { const body = u8(payload); return u8(id, vint(body.length), body); };
  const uint = v => { let bytes = 1; while (v >= 2 ** (8 * bytes)) bytes++; return be(v, bytes); };
  const f64 = v => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; };
  function webm(samples, w, h, fps, codecId) {
    const ms = i => Math.round(i * 1000 / fps);
    const clusters = [];
    let open = null;
    samples.forEach((x, i) => {
      if (x.key || !open) { open = { time: ms(i), blocks: [] }; clusters.push(open); }
      open.blocks.push(el([0xa3], 0x81, u16(ms(i) - open.time), x.key ? 0x80 : 0, x.data));
    });
    const info = el([0x15, 0x49, 0xa9, 0x66], el([0x2a, 0xd7, 0xb1], uint(1000000)), el([0x4d, 0x80], 'dev.txt'), el([0x57, 0x41], 'dev.txt'), el([0x44, 0x89], f64(ms(samples.length))));
    const tracks = el([0x16, 0x54, 0xae, 0x6b], el([0xae], el([0xd7], 1), el([0x73, 0xc5], 1), el([0x83], 1), el([0x86], codecId),
      el([0x23, 0xe3, 0x83], uint(Math.round(1e9 / fps))), el([0xe0], el([0xb0], uint(w)), el([0xba], uint(h)))));
    const body = [info, tracks, ...clusters.map(c => el([0x1f, 0x43, 0xb6, 0x75], el([0xe7], uint(c.time)), c.blocks))];
    const head = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x86], 1), el([0x42, 0xf7], 1), el([0x42, 0xf2], 4), el([0x42, 0xf3], 8), el([0x42, 0x82], 'webm'), el([0x42, 0x87], 4), el([0x42, 0x85], 2));
    const size = body.reduce((n, p) => n + p.length, 0);
    return new Blob([head, u8([0x18, 0x53, 0x80, 0x67], be(size, 8).map((b, i) => (i === 0 ? 0x01 : b))), ...body], { type: 'video/webm' });
  }

  async function encode(config, fps, status) {
    const { W, H, DURATION, drawAt } = window.promo;
    const canvas = document.getElementById('stage'), frames = Math.round(DURATION * fps), samples = [];
    let description = null, failed = null;
    const encoder = new VideoEncoder({
      output(chunk, meta) {
        const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
        samples.push({ data, key: chunk.type === 'key', ts: chunk.timestamp });
        if (meta && meta.decoderConfig && meta.decoderConfig.description) description = new Uint8Array(meta.decoderConfig.description.slice ? meta.decoderConfig.description.slice(0) : meta.decoderConfig.description);
      },
      error(e) { failed = e; },
    });
    encoder.configure(config);
    for (let i = 0; i < frames && !failed; i++) {
      drawAt(i / fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      status.frame = i + 1; status.frames = frames;
      while (encoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
    }
    await encoder.flush(); encoder.close();
    if (failed) throw failed;
    for (let i = 1; i < samples.length; i++) if (samples[i].ts < samples[i - 1].ts) throw new Error('frames came back out of order');
    return { samples, description, W, H };
  }

  window.renderStatus = { stage: 'idle' };
  window.renderPromo = async ({ fps = 30, bitrate = 9000000 } = {}) => {
    const st = window.renderStatus = { stage: 'start', result: {} };
    await window.promo.ready;
    const { W, H } = window.promo;
    const save = async (name, blob) => { const r = await fetch('/' + name, { method: 'POST', body: blob }); return { name, bytes: blob.size, saved: await r.text() }; };
    try {
      const avc = { codec: 'avc1.640028', width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } };
      if ((await VideoEncoder.isConfigSupported(avc)).supported) {
        st.stage = 'mp4';
        const r = await encode(avc, fps, st);
        if (!r.description) throw new Error('the encoder gave no avcC');
        st.result.mp4 = await save('dev-txt-promo.mp4', mp4(r.samples, W, H, fps, r.description));
        st.result.mp4.frames = r.samples.length;
      } else st.result.mp4 = { skipped: 'no H.264 encoder here' };
    } catch (e) { st.result.mp4 = { error: String(e && e.message || e) }; }
    try {
      const vp9 = { codec: 'vp09.00.40.08', width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality' };
      if ((await VideoEncoder.isConfigSupported(vp9)).supported) {
        st.stage = 'webm';
        const r = await encode(vp9, fps, st);
        st.result.webm = await save('dev-txt-promo.webm', webm(r.samples, W, H, fps, 'V_VP9'));
        st.result.webm.frames = r.samples.length;
      } else st.result.webm = { skipped: 'no VP9 encoder here' };
    } catch (e) { st.result.webm = { error: String(e && e.message || e) }; }
    st.stage = 'done';
    return st.result;
  };
})();
