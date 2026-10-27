/**
 * Dialogs: files, export and plot, colors, units, drafting settings,
 * styles, linetypes, quick select, purge, help, shortcuts, command search
 * and the phone tool sheet.
 */
import { h, clear, MOD } from './dom.js';
import { icon } from './icons.js';
import { openDialog, toast } from './dialog.js';
import { PALETTE, colorLabel, colorCss, rgbToHex } from '../core/colors.js';
import { COLOR_BYLAYER, COLOR_BYBLOCK, UNITS } from '../core/schema.js';
import { STANDARD_LINETYPES } from '../core/linetypes.js';
import { defaultTextStyle, defaultDimStyle } from '../core/styles.js';
import { formatLinear, formatAngle } from '../core/units.js';
import { RecordingSink } from '../core/display.js';
import { emitEntity, makeContext } from '../core/tessellate.js';
import { SNAP_MODES } from '../editor/snap.js';
import { PAPER_SIZES, computePlot } from '../io/export/plot.js';
import { exportPdf } from '../io/export/pdf.js';
import { exportSvg } from '../io/export/svg.js';
import { exportPng, renderToCanvas } from '../io/export/raster.js';
import * as storage from '../io/storage.js';
import { NATIVE_EXT } from '../io/native.js';
import { commandList } from '../editor/commands/index.js';
import { lwLabel } from './combos.js';
import { roving } from './roving.js';
import { t } from '../i18n/index.js';

// Small form helpers ---------------------------------------------------------------

let fid = 0;
function field(label, control, hint) {
  const id = `f${++fid}`;
  const target = control.matches?.('input, select, textarea') ? control : control.querySelector?.('input, select, textarea');
  if (target) target.id = id;
  return h('div.field', h('label.field-label', { for: id }, label), control, hint ? h('p.field-hint', hint) : null);
}

function select(options, value, attrs = {}) {
  return h(
    'select.input',
    attrs,
    options.map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return h('option', { value: v, selected: String(v) === String(value) }, l);
    }),
  );
}

function num(value, attrs = {}) {
  return h('input.input', { type: 'number', value, step: 'any', inputmode: 'decimal', ...attrs });
}

function check(label, checked, attrs = {}) {
  const inp = h('input', { type: 'checkbox', checked, ...attrs });
  return h('label.check', inp, h('span', label));
}

function radios(name, options, value) {
  return h(
    'div.radios',
    { role: 'radiogroup' },
    options.map(([v, l, desc]) =>
      h('label.radio', h('input', { type: 'radio', name, value: v, checked: v === value }), h('span', h('strong', l), desc ? h('small', desc) : null)),
    ),
  );
}

function radioValue(root, name) {
  return root.querySelector(`input[name="${name}"]:checked`)?.value;
}

// Files ------------------------------------------------------------------------------

export async function openFileDialog(app) {
  const list = h('ul.file-list', { role: 'list' });
  const status = h('p.field-hint');
  let pick = null;
  let closeFn;
  const body = h(
    'div.open-dlg',
    h(
      'div.open-sources',
      h('button.btn.big', { type: 'button', onClick: () => ((pick = { source: 'device' }), closeFn()) }, icon('upload', 20), h('span', h('strong', t('Open from this device')), h('small', t('A .cad or .dxf file on your computer')))),
    ),
    h('h3.dlg-sub', t('Your Puter drive')),
    status,
    list,
  );
  const render = async () => {
    clear(list);
    if (!app.signedIn) {
      status.textContent = '';
      list.append(
        h(
          'li.file-empty',
          h('p', t('Sign in with Puter to open and save drawings in your cloud drive.')),
          h('button.btn.primary', { type: 'button', onClick: async () => ((await app.signIn()) ? render() : null) }, icon('log-in', 16), t('Sign in')),
        ),
      );
      return;
    }
    status.textContent = t('Loading...');
    let shown = 0;
    const loadPage = async (cursor) => {
      const { items: files, cursor: next } = await storage.cloudList(cursor);
      shown += files.length;
      status.textContent = shown ? t('{shown} drawing{plural} in {dir}', { shown, plural: shown === 1 ? '' : 's', dir: storage.CLOUD_DIR }) : t('No drawings in {dir} yet. Saved drawings appear here.', { dir: storage.CLOUD_DIR });
      list.querySelector('.file-more')?.remove();
      appendFiles(files);
      if (next) {
        list.append(
          h(
            'li.file-more',
            h(
              'button.btn.sm',
              {
                type: 'button',
                onClick: (e) => {
                  e.currentTarget.disabled = true;
                  loadPage(next).catch((err) => (status.textContent = t('Could not list your drive: {msg}', { msg: err?.message || err })));
                },
              },
              t('Show more'),
            ),
          ),
        );
      }
    };
    const appendFiles = (files) => {
      for (const f of files) {
        const when = f.modified ? new Date(f.modified * (f.modified < 1e12 ? 1000 : 1)).toLocaleString() : '';
        list.append(
          h(
            'li',
            h(
              'button.file-item',
              { type: 'button', onClick: () => ((pick = { source: 'cloud', path: f.path, name: f.name }), closeFn()) },
              icon(f.name.toLowerCase().endsWith('.dxf') ? 'file-text' : 'file', 18),
              h('span.file-name', f.name),
              h('span.file-meta', when),
            ),
          ),
        );
      }
    };
    try {
      await loadPage(null);
    } catch (err) {
      status.textContent = t('Could not list your drive: {msg}', { msg: err?.message || err });
    }
  };
  const p = openDialog({ title: t('Open drawing'), body, size: 'md', actions: [{ label: t('Cancel') }] });
  closeFn = () => document.querySelector('dialog[open]')?._close(null);
  render();
  await p;
  return pick;
}

export async function formatChoice(app, doc) {
  const def = doc.file?.kind || 'native';
  const body = h('div', radios('fmt', [['native', t('Drawing ({ext})', { ext: NATIVE_EXT }), t('Keeps everything exactly. Recommended.')], ['dxf', t('DXF (.dxf)'), t('Opens in most CAD programs.')]], def));
  const r = await openDialog({ title: t('Save as'), body, size: 'sm', actions: [{ label: t('Cancel') }, { label: t('Continue'), primary: true, onClick: () => radioValue(body, 'fmt') }] });
  return r || null;
}

export async function saveAsDialog(app, doc) {
  const name = h('input.input', { type: 'text', value: doc.name, spellcheck: 'false', 'aria-required': 'true' });
  const err = h('p.field-error', { role: 'alert' });
  const where = radios(
    'where',
    [
      ['cloud', t('Puter drive'), app.signedIn ? t('Saved in {dir} and available anywhere', { dir: storage.CLOUD_DIR }) : t('Requires signing in')],
      ['device', t('This device'), t('Download or save a file on your computer')],
    ],
    doc.file?.source === 'device' || !app.signedIn ? 'device' : 'cloud',
  );
  const fmt = radios('fmt', [['native', t('Drawing ({ext})', { ext: NATIVE_EXT }), t('Keeps everything exactly')], ['dxf', t('DXF (.dxf)'), t('For other CAD programs')]], doc.file?.kind || 'native');
  const body = h('form', { onSubmit: (e) => e.preventDefault() }, field(t('File name'), name), err, h('fieldset.fs', h('legend', t('Location')), where), h('fieldset.fs', h('legend', t('Format')), fmt));
  const r = await openDialog({
    title: t('Save drawing as'),
    body,
    size: 'md',
    actions: [
      { label: t('Cancel') },
      {
        label: t('Save'),
        primary: true,
        onClick: () => {
          const v = name.value.trim().replace(/\.(cad|dxf)$/i, '');
          if (!v || /[\\/:*?"<>|]/.test(v)) {
            err.textContent = t('Enter a file name without \\ / : * ? " < > or |.');
            name.setAttribute('aria-invalid', 'true');
            return false;
          }
          return { name: v, source: radioValue(body, 'where'), kind: radioValue(body, 'fmt') };
        },
      },
    ],
  });
  return r || null;
}

// Display lists for output -------------------------------------------------------------

/** Record the visible drawing (optionally only an area) as display-list items. */
export function recordDrawing(app, { tol, area } = {}) {
  const doc = app.doc;
  const sink = new RecordingSink();
  const ctx = makeContext(doc.drawing, { fg: [0, 0, 0], tol: tol ?? 0.01, plot: true, view: area ?? doc.index.extents() ?? [0, 0, 1, 1], pointSize: 1 });
  const ids = area ? doc.index.search(area[0], area[1], area[2], area[3], true) : [...doc.drawing.entities.keys()];
  const order = new Map([...doc.drawing.entities.keys()].map((id, i) => [id, i]));
  ids.sort((a, b) => order.get(a) - order.get(b));
  for (const id of ids) {
    const e = doc.drawing.get(id);
    if (!e) continue;
    try {
      emitEntity(e, sink, ctx);
    } catch {
      /* skip broken entity */
    }
  }
  return sink.items;
}

function areaFor(app, mode, win) {
  if (mode === 'window' && win) return win;
  if (mode === 'display') return app.camera.bounds();
  return app.doc.index.extents() ?? app.camera.bounds();
}

// Export --------------------------------------------------------------------------------

export async function exportDialog(app) {
  const doc = app.doc;
  if (!doc) return;
  const body = h('form', { onSubmit: (e) => e.preventDefault() });
  const fmt = radios(
    'fmt',
    [
      ['pdf', t('PDF'), t('Vector document at a paper size')],
      ['svg', t('SVG'), t('Vector image for the web and illustration tools')],
      ['png', t('PNG'), t('Raster image')],
      ['dxf', t('DXF'), t('Drawing exchange file for other CAD programs')],
    ],
    'pdf',
  );
  const areaSel = select([['extents', t('Drawing extents')], ['display', t('Current view')]], 'extents');
  const width = num(2400, { min: 100, max: 16000, step: 100 });
  const bg = select([['white', t('White')], ['transparent', t('Transparent')], ['dark', t('Dark')]], 'white');
  const mono = check(t('Black and white'), false);
  const lw = check(t('Plot lineweights'), true);
  body.append(h('fieldset.fs', h('legend', t('Format')), fmt), field(t('Area'), areaSel), h('div.row2', field(t('PNG width (pixels)'), width), field(t('Background'), bg)), mono, lw);
  const r = await openDialog({ title: t('Export'), body, size: 'md', actions: [{ label: t('Cancel') }, { label: t('Export'), primary: true, onClick: () => true }] });
  if (!r) return;
  const kind = radioValue(body, 'fmt');
  if (kind === 'dxf') return app.exportDxf();
  const area = areaFor(app, areaSel.value);
  const busy = toast(t('Exporting...'), { timeout: 0 });
  try {
    const items = recordDrawing(app, { area, tol: Math.max(area[2] - area[0], area[3] - area[1]) / 4000 });
    const monochrome = mono.querySelector('input').checked;
    const lineweights = lw.querySelector('input').checked;
    const background = bg.value === 'white' ? '#ffffff' : bg.value === 'dark' ? '#1f242c' : null;
    let blob, ext;
    if (kind === 'svg') {
      blob = new Blob([exportSvg(items, { area, monochrome, lineweights, background, width: 1600 })], { type: 'image/svg+xml' });
      ext = 'svg';
    } else if (kind === 'png') {
      const w = Math.max(100, Math.min(16000, Number(width.value) || 2400));
      const aw = area[2] - area[0] || 1,
        ah = area[3] - area[1] || 1;
      blob = await exportPng(items, { width: w, height: Math.max(100, Math.round((w * ah) / aw)), area, monochrome, lineweights, background, margin: 20 });
      ext = 'png';
    } else {
      const paper = aw4(area);
      const bytes = await exportPdf(items, { paper: paper.id, orientation: paper.orientation, area, scale: 'fit', units: doc.drawing.header.units, monochrome, lineweights, title: doc.name });
      blob = new Blob([bytes], { type: 'application/pdf' });
      ext = 'pdf';
    }
    busy.remove();
    await storage.deviceSave(blob, `${doc.name}.${ext}`, null);
  } catch (err) {
    busy.remove();
    app.fileError('export', err);
  }
}

function aw4(area) {
  const landscape = area[2] - area[0] >= area[3] - area[1];
  return { id: 'A3', orientation: landscape ? 'landscape' : 'portrait' };
}

// Plot -----------------------------------------------------------------------------------

const PLOT_KEY = 'cad.plot';

export async function plotDialog(app, state) {
  const doc = app.doc;
  if (!doc) return;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PLOT_KEY) || '{}');
  } catch {
    /* ignore */
  }
  const st = { paper: 'A3', orientation: 'landscape', areaMode: 'extents', fit: true, paperMm: 1, units: 100, center: true, margins: 10, monochrome: true, lineweights: true, ...saved, ...(state || {}) };
  const paper = select(PAPER_SIZES.map((p) => [p.id, t('{label} ({w} x {h} mm)', { label: p.label, w: Math.round(p.w), h: Math.round(p.h) })]), st.paper);
  const orient = select([['landscape', t('Landscape')], ['portrait', t('Portrait')]], st.orientation);
  const areaSel = select([['extents', t('Extents')], ['display', t('Display')], ['window', t('Window')]], st.areaMode);
  const pickBtn = h('button.btn.sm', { type: 'button' }, icon('zoom-window', 14), t('Pick window'));
  const fit = check(t('Fit to paper'), st.fit);
  const mmIn = num(st.paperMm, { min: 0.0001, 'aria-label': t('Paper millimetres') });
  const unitsIn = num(st.units, { min: 0.0001, 'aria-label': t('Drawing units') });
  const center = check(t('Center the plot'), st.center);
  const margins = num(st.margins, { min: 0, max: 50 });
  const mono = check(t('Black and white (monochrome)'), st.monochrome);
  const lw = check(t('Plot lineweights'), st.lineweights);
  const scaleText = h('p.field-hint', { 'aria-live': 'polite' });
  const preview = h('canvas.plot-preview', { width: 360, height: 260, role: 'img', 'aria-label': t('Plot preview') });
  const scaleRow = h('div.scale-row', mmIn, h('span', t('mm =')), unitsIn, h('span', t('units')));
  const form = h(
    'form.plot-form',
    { onSubmit: (e) => e.preventDefault() },
    h(
      'div.plot-cols',
      h(
        'div',
        field(t('Paper size'), paper),
        field(t('Orientation'), orient),
        field(t('Plot area'), h('div.inline', areaSel, pickBtn)),
        h('fieldset.fs', h('legend', t('Scale')), fit, scaleRow, scaleText),
        h('div.row2', field(t('Margins (mm)'), margins), h('div.field', center)),
        mono,
        lw,
      ),
      h('div.plot-prev', preview),
    ),
  );
  const read = () => {
    st.paper = paper.value;
    st.orientation = orient.value;
    st.areaMode = areaSel.value;
    st.fit = fit.querySelector('input').checked;
    st.paperMm = Number(mmIn.value) || 1;
    st.units = Number(unitsIn.value) || 1;
    st.center = center.querySelector('input').checked;
    st.margins = Math.max(0, Number(margins.value) || 0);
    st.monochrome = mono.querySelector('input').checked;
    st.lineweights = lw.querySelector('input').checked;
    scaleRow.classList.toggle('disabled', st.fit);
    for (const i of scaleRow.querySelectorAll('input')) i.disabled = st.fit;
    pickBtn.hidden = st.areaMode !== 'window';
  };
  const settingsFor = (area) => ({
    paper: st.paper,
    orientation: st.orientation,
    area,
    scale: st.fit ? 'fit' : { paper: st.paperMm, drawing: st.units },
    units: doc.drawing.header.units,
    margins: st.margins,
    center: st.center,
    monochrome: st.monochrome,
    lineweights: st.lineweights,
    title: doc.name,
  });
  let items = null;
  let itemsArea = null;
  const draw = () => {
    read();
    const area = areaFor(app, st.areaMode, st.window);
    if (!items || itemsArea?.join() !== area.join()) {
      items = recordDrawing(app, { area, tol: Math.max(area[2] - area[0], area[3] - area[1]) / 2000 });
      itemsArea = area;
    }
    const s = settingsFor(area);
    const plot = computePlot(s, area);
    scaleText.textContent = t('Scale {scale}', { scale: plot.scaleText });
    const box = { w: 360, h: 260 };
    const k = Math.min(box.w / plot.pageW, box.h / plot.pageH) * 0.92;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round(plot.pageW * k),
      ch = Math.round(plot.pageH * k);
    preview.width = cw * dpr;
    preview.height = ch * dpr;
    preview.style.width = `${cw}px`;
    preview.style.height = `${ch}px`;
    const ctx = preview.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, preview.width, preview.height);
    try {
      renderToCanvas(ctx, items, { ...s, dpi: (k * dpr * 25.4), background: '#ffffff' });
    } catch (err) {
      console.warn(err);
    }
    ctx.strokeStyle = 'rgba(31,111,235,0.6)';
    ctx.setLineDash([4, 3]);
    const pr = plot.printable;
    ctx.strokeRect(pr.x * k * dpr, (plot.pageH - pr.y - pr.h) * k * dpr, pr.w * k * dpr, pr.h * k * dpr);
  };
  form.addEventListener('change', draw);
  form.addEventListener('input', draw);
  let action = null;
  pickBtn.addEventListener('click', () => {
    action = 'pick';
    document.querySelector('dialog[open]')?._close('pick');
  });
  requestAnimationFrame(draw);
  const r = await openDialog({
    title: t('Plot'),
    body: form,
    size: 'lg',
    actions: [
      { label: t('Cancel') },
      { label: t('Save PNG'), onClick: () => 'png' },
      { label: t('Save PDF'), primary: true, onClick: () => 'pdf' },
    ],
  });
  read();
  const { window: win, ...persist } = st;
  try {
    localStorage.setItem(PLOT_KEY, JSON.stringify(persist));
  } catch {
    /* ignore */
  }
  if (r === 'pick' || action === 'pick') {
    const a = await app.editor.getPoint(t('First corner of plot window'), { noSnap: false }).catch(() => null);
    if (a && !a.option) {
      const b = await app.editor
        .getPoint(t('Opposite corner'), {
          rubber: false,
          onMove: (p) => {
            const s1 = app.camera.toScreen(a.x, a.y),
              s2 = app.camera.toScreen(p.x, p.y);
            app.editor.window = { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y };
          },
        })
        .catch(() => null);
      app.editor.window = null;
      app.editor._endRequest();
      app.cmdline.prompt(null);
      if (b && !b.option) st.window = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
    }
    return plotDialog(app, { ...st, areaMode: 'window' });
  }
  if (!r) return;
  const area = areaFor(app, st.areaMode, st.window);
  const s = settingsFor(area);
  const busy = toast(t('Preparing plot...'), { timeout: 0 });
  try {
    const plot = computePlot(s, area);
    const fine = recordDrawing(app, { area, tol: 0.02 / plot.scale });
    if (r === 'pdf') {
      const bytes = await exportPdf(fine, s);
      busy.remove();
      await storage.deviceSave(new Blob([bytes], { type: 'application/pdf' }), `${doc.name}.pdf`, null);
    } else {
      const blob = await exportPng(fine, { ...s, dpi: 200, background: '#ffffff' });
      busy.remove();
      await storage.deviceSave(blob, `${doc.name}.png`, null);
    }
  } catch (err) {
    busy.remove();
    app.fileError('plot', err);
  }
}

// Colors -----------------------------------------------------------------------------------

export async function colorDialog(app, initial, { allowBy = true } = {}) {
  let value = initial;
  const preview = h('span.swatch.lg');
  const label = h('span.color-label');
  const update = () => {
    preview.style.background = value === undefined ? 'transparent' : colorCss(value);
    label.textContent = value === undefined ? t('No change') : colorLabel(value);
    for (const b of body.querySelectorAll('button.aci')) b.setAttribute('aria-checked', String(Number(b.dataset.i) === value));
    if (typeof value === 'string') hex.value = value;
    else if (typeof value === 'number' && PALETTE[value]) hex.value = rgbToHex(PALETTE[value]);
  };
  const grid = h('div.aci-grid', { role: 'radiogroup', 'aria-label': t('Index colors') });
  const btn = (i) =>
    h('button.aci', {
      type: 'button',
      role: 'radio',
      'aria-label': colorLabel(i),
      'aria-checked': 'false',
      title: `${colorLabel(i)} (${PALETTE[i].join(', ')})`,
      'data-i': i,
      style: { background: `rgb(${PALETTE[i].join(',')})` },
      onClick: () => {
        value = i;
        update();
      },
    });
  // Main palette rows: hues across, value and saturation down.
  for (let row = 0; row < 10; row++) {
    for (let hue = 0; hue < 24; hue++) grid.append(btn(10 + hue * 10 + row));
  }
  const basics = h('div.aci-row', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(btn));
  const grays = h('div.aci-row', [250, 251, 252, 253, 254, 255].map(btn));
  const hex = h('input.input', { type: 'color', value: typeof initial === 'string' ? initial : '#ff0000', 'aria-label': t('True color') });
  hex.addEventListener('input', () => {
    value = hex.value;
    update();
  });
  const byBtns = allowBy
    ? h(
        'div.inline',
        h('button.btn.sm', { type: 'button', onClick: () => ((value = COLOR_BYLAYER), update()) }, t('ByLayer')),
        h('button.btn.sm', { type: 'button', onClick: () => ((value = COLOR_BYBLOCK), update()) }, t('ByBlock')),
      )
    : null;
  const body = h(
    'div.color-dlg',
    h('h3.dlg-sub', t('Index colors')),
    grid,
    h('div.aci-extra', basics, grays),
    h('div.color-foot', byBtns, h('label.inline', h('span', t('True color')), hex), h('div.grow'), preview, label),
  );
  const syncRoving = roving(body, 'button.aci', { h: 1, v: 24 });
  requestAnimationFrame(() => {
    update();
    syncRoving();
  });
  const r = await openDialog({ title: t('Select color'), body, size: 'lg', actions: [{ label: t('Cancel') }, { label: t('OK'), primary: true, onClick: () => ({ v: value }) }] });
  return r ? r.v : null;
}

// Units ------------------------------------------------------------------------------------

export async function unitsDialog(app) {
  const d = app.doc.drawing;
  const hd = d.header;
  const lin = select([['decimal', t('Decimal')], ['architectural', t('Architectural')], ['engineering', t('Engineering')], ['fractional', t('Fractional')], ['scientific', t('Scientific')]], hd.linearFormat);
  const linP = select([0, 1, 2, 3, 4, 5, 6, 7, 8].map((p) => [p, p]), hd.linearPrecision);
  const ang = select([['deg', t('Decimal degrees')], ['dms', t('Degrees, minutes, seconds')], ['rad', t('Radians')], ['grad', t('Gradians')]], hd.angularFormat);
  const angP = select([0, 1, 2, 3, 4, 5, 6, 7, 8].map((p) => [p, p]), hd.angularPrecision);
  const units = select(UNITS.map((u) => [u, { unitless: t('Unitless'), in: t('Inches'), ft: t('Feet'), mm: t('Millimeters'), cm: t('Centimeters'), m: t('Meters') }[u]]), hd.units);
  const sample = h('output.sample');
  const upd = () => {
    const tmp = { ...hd, linearFormat: lin.value, linearPrecision: Number(linP.value), angularFormat: ang.value, angularPrecision: Number(angP.value) };
    sample.textContent = t('Sample: {a}, {b}, {c}   Angle: {d}', { a: formatLinear(1.5, tmp), b: formatLinear(2.0039, tmp), c: formatLinear(0, tmp), d: formatAngle(Math.PI / 4, tmp, { symbol: true }) });
  };
  const body = h(
    'form',
    { onSubmit: (e) => e.preventDefault(), onChange: upd },
    h('div.row2', h('fieldset.fs', h('legend', t('Length')), field(t('Type'), lin), field(t('Precision'), linP)), h('fieldset.fs', h('legend', t('Angle')), field(t('Type'), ang), field(t('Precision'), angP))),
    field(t('Insertion scale (units of this drawing)'), units, t('Used when plotting to scale and when other drawings are inserted.')),
    sample,
  );
  upd();
  const r = await openDialog({ title: t('Drawing units'), body, size: 'md', actions: [{ label: t('Cancel') }, { label: t('OK'), primary: true, value: true }] });
  if (!r) return;
  d.transaction(t('Units'), () =>
    d.setHeader({ linearFormat: lin.value, linearPrecision: Number(linP.value), angularFormat: ang.value, angularPrecision: Number(angP.value), units: units.value }),
  );
}

// Drafting settings ------------------------------------------------------------------------

export async function draftingDialog(app) {
  const s = app.settings;
  const tabs = [t('Object snap'), t('Snap and grid'), t('Polar tracking'), t('Dynamic input')];
  const panels = [];
  const osnapBoxes = SNAP_MODES.map((m) => {
    const c = check(m.label, s.osnapModes.includes(m.id), { 'data-mode': m.id });
    c.prepend(h('span.snap-ico', icon(m.icon, 16)));
    return c;
  });
  const osOn = check(t('Object snap on (F3)'), s.osnap);
  const otOn = check(t('Object snap tracking on (F11)'), s.otrack);
  panels.push(
    h(
      'div',
      h('div.row2', osOn, otOn),
      h('div.snap-grid', osnapBoxes),
      h(
        'div.inline',
        h('button.btn.sm', { type: 'button', onClick: () => osnapBoxes.forEach((b) => (b.querySelector('input').checked = true)) }, t('Select all')),
        h('button.btn.sm', { type: 'button', onClick: () => osnapBoxes.forEach((b) => (b.querySelector('input').checked = false)) }, t('Clear all')),
      ),
    ),
  );
  const snapOn = check(t('Snap on (F9)'), s.snap);
  const snapSp = num(s.snapSpacing, { min: 0.0001 });
  const gridOn = check(t('Grid on (F7)'), s.grid);
  const gridSp = num(s.gridSpacing, { min: 0.0001 });
  panels.push(h('div', h('div.row2', h('fieldset.fs', h('legend', t('Snap')), snapOn, field(t('Spacing'), snapSp)), h('fieldset.fs', h('legend', t('Grid')), gridOn, field(t('Spacing'), gridSp)))));
  const polarOn = check(t('Polar tracking on (F10)'), s.polar);
  const inc = select([90, 45, 30, 22.5, 18, 15, 10, 5].map((a) => [a, `${a}`]), s.polarInc);
  const orthoOn = check(t('Ortho mode (F8)'), s.ortho);
  panels.push(h('div', polarOn, field(t('Increment angle (degrees)'), inc), orthoOn));
  const dynOn = check(t('Dynamic input (F12)'), s.dyn);
  const pickbox = num(s.pickbox, { min: 2, max: 20, step: 1 });
  const aperture = num(s.aperture, { min: 4, max: 40, step: 1 });
  panels.push(h('div', dynOn, h('div.row2', field(t('Pickbox size (px)'), pickbox), field(t('Snap aperture (px)'), aperture))));
  const tabBar = h('div.tabs', { role: 'tablist' });
  const panelHost = h('div.tab-panel#drafting-panel', { role: 'tabpanel' });
  const show = (i, focus = false) => {
    clear(tabBar);
    tabs.forEach((item, j) =>
      tabBar.append(
        h(
          'button.tab',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(j === i),
            'aria-controls': 'drafting-panel',
            tabindex: j === i ? '0' : '-1',
            onClick: () => show(j, true),
            onKeydown: (e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              show((j + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true);
            },
          },
          item,
        ),
      ),
    );
    clear(panelHost).append(panels[i]);
    if (focus) tabBar.querySelector('[aria-selected="true"]')?.focus();
  };
  show(0);
  const r = await openDialog({ title: t('Drafting settings'), body: h('div', tabBar, panelHost), size: 'md', actions: [{ label: t('Cancel') }, { label: t('OK'), primary: true, value: true }] });
  if (!r) return;
  const val = (c) => c.querySelector('input').checked;
  app.setSetting('osnapModes', osnapBoxes.filter(val).map((b) => b.querySelector('input').dataset.mode));
  app.setSetting('osnap', val(osOn));
  app.setSetting('otrack', val(otOn));
  app.setSetting('snap', val(snapOn));
  app.setSetting('snapSpacing', Math.max(1e-6, Number(snapSp.value) || 10));
  app.setSetting('grid', val(gridOn));
  app.setSetting('gridSpacing', Math.max(1e-6, Number(gridSp.value) || 10));
  app.setSetting('polar', val(polarOn));
  app.setSetting('polarInc', Number(inc.value));
  // Ortho and polar tracking cannot both be on; polar wins.
  app.setSetting('ortho', val(orthoOn) && !val(polarOn));
  app.setSetting('dyn', val(dynOn));
  app.setSetting('pickbox', Math.max(2, Math.min(20, Number(pickbox.value) || 5)));
  app.setSetting('aperture', Math.max(4, Math.min(40, Number(aperture.value) || 10)));
}

// Settings -------------------------------------------------------------------------------------

export async function settingsDialog(app) {
  const s = app.settings;
  const theme = radios('theme', [['system', t('System'), t('Follow the device setting')], ['light', t('Light')], ['dark', t('Dark')]], app.themePref);
  const trackpad = check(t('Two-finger scroll pans (pinch or Ctrl+scroll zooms)'), s.trackpadPan !== false);
  const selPrev = check(t('Highlight objects under the cursor'), s.selPreview);
  const ucs = check(t('Show the coordinate system icon'), s.showUcs !== false);
  const cmd = check(t('Show the command line'), s.showCmdLine !== false);
  const grip = num(s.gripSize, { min: 3, max: 12, step: 1 });
  const body = h('form', { onSubmit: (e) => e.preventDefault() }, h('fieldset.fs', h('legend', t('Theme')), theme), h('fieldset.fs', h('legend', t('Interaction')), trackpad, selPrev, field(t('Grip size (px)'), grip)), h('fieldset.fs', h('legend', t('Display')), ucs, cmd));
  const r = await openDialog({ title: t('Settings'), body, size: 'md', actions: [{ label: t('Cancel') }, { label: t('OK'), primary: true, value: true }] });
  if (!r) return;
  app.setTheme(radioValue(body, 'theme'));
  const v = (c) => c.querySelector('input').checked;
  app.setSetting('trackpadPan', v(trackpad));
  app.setSetting('selPreview', v(selPrev));
  app.setSetting('showUcs', v(ucs));
  app.setSetting('showCmdLine', v(cmd));
  app.setSetting('gripSize', Math.max(3, Math.min(12, Number(grip.value) || 5)));
}

// Styles ----------------------------------------------------------------------------------------

async function styleManager(app, { title, table, headerKey, make, fields, label }) {
  const d = app.doc.drawing;
  const names = [...d[table].keys()];
  let current = d.header[headerKey];
  let selected = current;
  const work = new Map(names.map((n) => [n, { ...d[table].get(n) }]));
  const list = h('ul.style-list', { 'aria-label': label });
  const form = h('div.style-form');
  const renderList = () => {
    const hadFocus = list.contains(document.activeElement);
    clear(list);
    for (const n of [...work.keys()]) {
      list.append(
        h(
          'li',
          h(
            'button.style-item',
            { type: 'button', 'aria-pressed': String(n === selected), onClick: () => ((selected = n), renderList(), renderForm()) },
            h('span', n),
            n === current ? h('span.badge', t('Current')) : null,
          ),
        ),
      );
    }
    if (hadFocus) list.querySelector('[aria-pressed="true"]')?.focus();
  };
  const renderForm = () => {
    clear(form);
    const st = work.get(selected);
    if (!st) return;
    for (const f of fields) {
      let ctl;
      if (f.options) {
        ctl = select(f.options, st[f.key]);
        ctl.addEventListener('change', () => (st[f.key] = f.number ? Number(ctl.value) : ctl.value));
      } else if (f.bool) {
        const c = check(f.label, !!st[f.key]);
        c.querySelector('input').addEventListener('change', (e) => (st[f.key] = e.target.checked));
        form.append(c);
        continue;
      } else {
        ctl = num(f.deg ? +((st[f.key] * 180) / Math.PI).toFixed(6) : st[f.key], { min: f.min ?? null });
        ctl.addEventListener('change', () => {
          const v = Number(ctl.value);
          if (Number.isFinite(v)) st[f.key] = f.deg ? (v * Math.PI) / 180 : v;
        });
      }
      form.append(field(f.label, ctl, f.hint));
    }
  };
  const actions = h(
    'div.inline',
    h('button.btn.sm', {
      type: 'button',
      onClick: () => {
        let i = 1;
        while (work.has(`Style${i}`)) i++;
        const n = `Style${i}`;
        work.set(n, { ...make(n), ...work.get(selected), name: n });
        selected = n;
        renderList();
        renderForm();
      },
    }, icon('plus', 14), t('New')),
    h('button.btn.sm', { type: 'button', onClick: () => ((current = selected), renderList()) }, t('Set current')),
    h('button.btn.sm', {
      type: 'button',
      onClick: () => {
        if (selected === 'Standard' || selected === current) return toast(t('The current and Standard styles cannot be deleted.'), { kind: 'error' });
        work.delete(selected);
        selected = current;
        renderList();
        renderForm();
      },
    }, icon('trash', 14), t('Delete')),
  );
  renderList();
  renderForm();
  const body = h('div.style-dlg', h('div.style-side', list, actions), form);
  const r = await openDialog({ title, body, size: 'lg', actions: [{ label: t('Cancel') }, { label: t('OK'), primary: true, value: true }] });
  if (!r) return;
  d.transaction(title, () => {
    for (const n of names) if (!work.has(n)) d.setTable(table, n, null);
    for (const [n, st] of work) d.setTable(table, n, { ...st, name: n });
    d.setHeader({ [headerKey]: current });
  });
}

export function textStylesDialog(app) {
  return styleManager(app, {
    title: t('Text styles'),
    table: 'textStyles',
    headerKey: 'textStyle',
    label: t('Text styles'),
    make: defaultTextStyle,
    fields: [
      { key: 'font', label: t('Font'), options: [['sans', t('Drafting (proportional)')], ['mono', t('Drafting (fixed width)')]] },
      { key: 'height', label: t('Height'), min: 0, hint: t('0 asks for the height each time text is placed.') },
      { key: 'widthFactor', label: t('Width factor'), min: 0.01 },
      { key: 'oblique', label: t('Oblique angle (degrees)'), deg: true },
    ],
  });
}

export function dimStylesDialog(app) {
  return styleManager(app, {
    title: t('Dimension styles'),
    table: 'dimStyles',
    headerKey: 'dimStyle',
    label: t('Dimension styles'),
    make: defaultDimStyle,
    fields: [
      { key: 'textHeight', label: t('Text height'), min: 0.0001 },
      { key: 'arrowType', label: t('Arrowheads'), options: [['closed', t('Closed filled')], ['open', t('Open')], ['tick', t('Architectural tick')], ['dot', t('Dot')], ['none', t('None')]] },
      { key: 'arrowSize', label: t('Arrow size'), min: 0 },
      { key: 'precision', label: t('Precision (decimal places)'), options: [0, 1, 2, 3, 4, 5, 6].map((p) => [p, p]), number: true },
      { key: 'textPlacement', label: t('Text placement'), options: [['above', t('Above the line')], ['centered', t('Centered in the line')]] },
      { key: 'textAlign', label: t('Text alignment'), options: [['aligned', t('Aligned with the line')], ['horizontal', t('Horizontal')]] },
      { key: 'extOffset', label: t('Extension line offset'), min: 0 },
      { key: 'extExtend', label: t('Extend beyond dimension line'), min: 0 },
      { key: 'textGap', label: t('Text gap'), min: 0 },
      { key: 'scale', label: t('Overall scale'), min: 0.0001 },
      { key: 'trailingZeros', label: t('Keep trailing zeros'), bool: true },
    ],
  });
}

// Linetypes ------------------------------------------------------------------------------------

export async function linetypesDialog(app) {
  const d = app.doc.drawing;
  const rows = STANDARD_LINETYPES.map((lt) => {
    const loaded = d.linetypes.has(lt.name);
    const c = check(`${lt.name}  ${lt.description}`, loaded, { 'data-name': lt.name });
    return c;
  });
  const lts = num(d.header.ltscale, { min: 0.000001 });
  const body = h('form', { onSubmit: (e) => e.preventDefault() }, h('p.field-hint', t('Checked linetypes are available in this drawing.')), h('div.lt-list', rows), field(t('Global linetype scale'), lts));
  const r = await openDialog({ title: t('Linetypes'), body, size: 'md', actions: [{ label: t('Cancel') }, { label: t('OK'), primary: true, value: true }] });
  if (!r) return;
  const used = new Set([...d.entities.values()].map((e) => e.linetype).concat([...d.layers.values()].map((l) => l.linetype)));
  d.transaction(t('Linetypes'), () => {
    for (const c of rows) {
      const inp = c.querySelector('input');
      const name = inp.dataset.name;
      if (inp.checked && !d.linetypes.has(name)) d.setTable('linetypes', name, { ...STANDARD_LINETYPES.find((l) => l.name === name) });
      if (!inp.checked && d.linetypes.has(name) && name !== 'Continuous' && !used.has(name)) d.setTable('linetypes', name, null);
    }
    const v = Number(lts.value);
    if (v > 0 && v !== d.header.ltscale) d.setHeader({ ltscale: v });
  });
}

// Quick select -----------------------------------------------------------------------------------

export async function quickSelectDialog(app) {
  const d = app.doc.drawing;
  const types = [...new Set([...d.entities.values()].map((e) => e.type))].sort();
  const typeSel = select([['*', t('All object types')], ...types.map((item) => [item, item[0].toUpperCase() + item.slice(1)])], '*');
  const prop = select([['layer', t('Layer')], ['color', t('Color')], ['linetype', t('Linetype')], ['lineweight', t('Lineweight')]], 'layer');
  const op = select([['eq', t('Equals')], ['ne', t('Does not equal')], ['any', t('Select all')]], 'eq');
  const valueHost = h('div');
  let valueCtl;
  const makeValue = () => {
    const vals = [...new Set([...d.entities.values()].filter((e) => typeSel.value === '*' || e.type === typeSel.value).map((e) => e[prop.value]))];
    const label = (v) => (prop.value === 'color' ? colorLabel(v) : prop.value === 'lineweight' ? lwLabel(v) : String(v));
    valueCtl = select(vals.map((v) => [JSON.stringify(v), label(v)]), JSON.stringify(vals[0]));
    clear(valueHost).append(field(t('Value'), valueCtl));
  };
  makeValue();
  const add = check(t('Add to the current selection'), false);
  const body = h('form', { onSubmit: (e) => e.preventDefault() }, field(t('Object type'), typeSel), field(t('Property'), prop), field(t('Operator'), op), valueHost, add);
  typeSel.addEventListener('change', makeValue);
  prop.addEventListener('change', makeValue);
  const r = await openDialog({ title: t('Quick select'), body, size: 'sm', actions: [{ label: t('Cancel') }, { label: t('Select'), primary: true, value: true }] });
  if (!r) return;
  const target = valueCtl?.value !== undefined ? JSON.parse(valueCtl.value) : undefined;
  const out = add.querySelector('input').checked ? new Set(app.doc.selection) : new Set();
  for (const [id, e] of d.entities) {
    if (typeSel.value !== '*' && e.type !== typeSel.value) continue;
    if (!d.layerEditable(e.layer)) continue;
    const v = e[prop.value];
    if (op.value === 'any' || (op.value === 'eq' && v === target) || (op.value === 'ne' && v !== target)) out.add(id);
  }
  app.editor.setSelection([...out]);
  app.cmdline.log(t('{count} object{plural} selected', { count: out.size, plural: out.size === 1 ? '' : 's' }), 'muted');
}

// Purge -----------------------------------------------------------------------------------------

export async function purgeDialog(app) {
  const d = app.doc.drawing;
  const usedLayers = new Set(['0', d.header.clayer]);
  const usedLts = new Set(['Continuous', 'ByLayer', 'ByBlock']);
  const usedText = new Set(['Standard', d.header.textStyle]);
  const usedDim = new Set(['Standard', d.header.dimStyle]);
  const usedBlocks = new Set();
  const scan = (list) => {
    for (const e of list) {
      usedLayers.add(e.layer);
      usedLts.add(e.linetype);
      if (e.style) {
        usedText.add(e.style);
        usedDim.add(e.style);
      }
      if (e.type === 'insert') usedBlocks.add(e.name);
    }
  };
  scan(d.entities.values());
  for (const b of d.blocks.values()) if (usedBlocks.has(b.name)) scan(b.entities);
  for (const l of d.layers.values()) usedLts.add(l.linetype);
  for (const s of d.dimStyles.values()) usedText.add(s.textStyle);
  const groups = [
    [t('Layers'), 'layers', [...d.layers.keys()].filter((n) => !usedLayers.has(n))],
    [t('Linetypes'), 'linetypes', [...d.linetypes.keys()].filter((n) => !usedLts.has(n))],
    [t('Text styles'), 'textStyles', [...d.textStyles.keys()].filter((n) => !usedText.has(n))],
    [t('Dimension styles'), 'dimStyles', [...d.dimStyles.keys()].filter((n) => !usedDim.has(n))],
    [t('Blocks'), 'blocks', [...d.blocks.keys()].filter((n) => !usedBlocks.has(n))],
  ];
  const total = groups.reduce((s, g) => s + g[2].length, 0);
  const body = h(
    'div.purge',
    total
      ? groups.filter((g) => g[2].length).map(([label, , names]) => h('section', h('h3.dlg-sub', t('{label} ({count})', { label, count: names.length })), h('p.purge-names', names.join(', '))))
      : h('p.dialog-text', t('Nothing to purge. Every layer, linetype, style and block is in use.')),
  );
  const r = await openDialog({ title: t('Purge unused items'), body, size: 'md', actions: total ? [{ label: t('Cancel') }, { label: t('Purge {total} item{plural}', { total, plural: total === 1 ? '' : 's' }), danger: true, value: true }] : [{ label: t('Close') }] });
  if (!r) return;
  d.transaction(t('Purge'), () => {
    for (const [, table, names] of groups) for (const n of names) table === 'blocks' ? d.setBlock(n, null) : d.setTable(table, n, null);
  });
  toast(t('Purged {total} unused item{plural}.', { total, plural: total === 1 ? '' : 's' }), { kind: 'success' });
}

// Help and shortcuts ------------------------------------------------------------------------------

const SHORTCUTS = [
  [t('General'), [[t('Command search'), `${MOD}+K`], [t('Repeat last command'), t('Enter or Space')], [t('Cancel'), 'Esc'], [t('Undo'), `${MOD}+Z`], [t('Redo'), `${MOD}+Y`], [t('Help'), 'F1'], [t('Command history'), 'F2']]],
  [t('Files'), [[t('New drawing'), `${MOD}+N`], [t('Open'), `${MOD}+O`], [t('Save'), `${MOD}+S`], [t('Save as'), `${MOD}+Shift+S`], [t('Plot'), `${MOD}+P`]]],
  [t('Editing'), [[t('Copy'), `${MOD}+C`], [t('Cut'), `${MOD}+X`], [t('Paste'), `${MOD}+V`], [t('Copy with base point'), `${MOD}+Shift+C`], [t('Select all'), `${MOD}+A`], [t('Erase selection'), 'Delete'], [t('Properties'), `${MOD}+1`]]],
  [t('Drafting aids'), [[t('Object snap'), 'F3'], [t('Grid'), 'F7'], [t('Ortho'), 'F8'], [t('Snap'), 'F9'], [t('Polar tracking'), 'F10'], [t('Object snap tracking'), 'F11'], [t('Dynamic input'), 'F12']]],
  [t('View'), [[t('Zoom'), t('Mouse wheel, pinch')], [t('Pan'), t('Middle drag, two-finger drag')], [t('Zoom extents'), t('Double click middle button')], [t('Pan with keys'), t('Arrow keys')], [t('Zoom in or out'), `${MOD}+= / ${MOD}+-`], [t('Clean screen'), `${MOD}+0`], [t('Command line'), `${MOD}+9`]]],
];

export function shortcutsDialog() {
  const body = h(
    'div.shortcuts',
    SHORTCUTS.map(([group, rows]) => h('section', h('h3.dlg-sub', group), h('dl.kv', rows.map(([a, b]) => [h('dt', a), h('dd', h('kbd', b))])))),
  );
  return openDialog({ title: t('Keyboard shortcuts'), body, size: 'lg', actions: [{ label: t('Close'), primary: true }] });
}

export function helpDialog(app) {
  const cmds = commandList(app.commands)
    .filter((c) => !['GRIPEDIT', 'TEXTEDIT'].includes(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const body = h(
    'div.help',
    h(
      'section',
      h('h3.dlg-sub', t('Getting started')),
      h(
        'ul.help-list',
        h('li', t('Pick a tool from the ribbon, or type a command name (or its short alias, like L for Line) and press Enter.')),
        h('li', t('Follow the prompt on the command line. Click the options shown there, or type the highlighted letter.')),
        h('li', t('Press Enter or Space to finish a command or repeat the last one. Press Esc to cancel.')),
        h('li', t('Select objects first and then pick a command, or start the command and select when asked.')),
        h('li', t('Drag from left to right to select objects fully inside the window; right to left selects everything the window touches.')),
        h('li', t('Drag the blue grips of selected objects to stretch them. Press Space while dragging to move, rotate, scale or mirror.')),
      ),
    ),
    h(
      'section',
      h('h3.dlg-sub', t('Typing coordinates')),
      h(
        'dl.kv',
        [
          ['10,20', t('Absolute point')],
          ['@5,0', t('Relative to the last point')],
          ['@50<30', t('Distance 50 at 30 degrees from the last point')],
          ['25', t('Distance along the current cursor direction')],
          ['<45', t('Lock the angle for the next point')],
        ].map(([a, b]) => [h('dt', h('kbd', a)), h('dd', b)]),
      ),
    ),
    h(
      'section',
      h('h3.dlg-sub', t('Commands ({count})', { count: cmds.length })),
      h(
        'dl.kv.cmds',
        cmds.map((c) => [h('dt', h('code', c.name), c.aliases?.length ? h('small', ` ${c.aliases.filter((a) => a.length <= 4).join(', ')}`) : null), h('dd', c.label)]),
      ),
    ),
  );
  return openDialog({ title: t('Help'), body, size: 'lg', actions: [{ label: t('Keyboard shortcuts'), onClick: () => (setTimeout(() => shortcutsDialog()), true) }, { label: t('Close'), primary: true }] });
}

// Command search ------------------------------------------------------------------------------------

export async function commandPalette(app) {
  const all = commandList(app.commands).filter((c) => !['GRIPEDIT', 'TEXTEDIT'].includes(c.name));
  const input = h('input.input.palette-input', { type: 'search', role: 'combobox', 'aria-expanded': 'true', 'aria-autocomplete': 'list', placeholder: t('Search commands'), 'aria-label': t('Search commands'), 'aria-controls': 'palette-list', autocomplete: 'off', spellcheck: 'false' });
  const list = h('ul.palette-list#palette-list', { role: 'listbox', 'aria-label': t('Commands') });
  let items = [];
  let index = 0;
  let chosen = null;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    items = all
      .map((c) => {
        const hay = `${c.label} ${c.name} ${(c.aliases || []).join(' ')}`.toLowerCase();
        const score = !q ? 1 : c.name.toLowerCase() === q || c.aliases?.some((a) => a.toLowerCase() === q) ? 100 : c.label.toLowerCase().startsWith(q) ? 50 : hay.includes(q) ? 10 : 0;
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.c.label.localeCompare(b.c.label))
      .slice(0, 50)
      .map((x) => x.c);
    index = Math.min(index, Math.max(0, items.length - 1));
    clear(list);
    items.forEach((c, i) =>
      list.append(
        h(
          'li.palette-item',
          { role: 'option', id: `pal-${i}`, 'aria-selected': String(i === index), onClick: () => pick(i) },
          icon(c.icon, 16),
          h('span.palette-label', c.label),
          h('span.palette-cmd', c.name),
        ),
      ),
    );
    input.setAttribute('aria-activedescendant', items.length ? `pal-${index}` : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (i) => {
    chosen = items[i];
    document.querySelector('dialog[open]')?._close(null);
  };
  input.addEventListener('input', () => ((index = 0), render()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      index = Math.min(items.length - 1, index + 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      index = Math.max(0, index - 1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length) pick(index);
    }
  });
  render();
  await openDialog({ title: t('Search commands'), body: h('div.palette', input, list), size: 'md', className: 'palette-dlg', initialFocus: 'input' });
  if (chosen) app.run(chosen.name);
}

// Phone tool sheet --------------------------------------------------------------------------------

export async function toolSheet(app, group) {
  let chosen = null;
  const grid = h(
    'div.tool-grid',
    group.cmds.map((name) => {
      const c = app.commands.get(name);
      return h('button.tool-tile', { type: 'button', onClick: () => ((chosen = name), document.querySelector('dialog[open]')?._close(null)) }, icon(c.icon, 24), h('span', c.label));
    }),
  );
  await openDialog({ title: group.label, body: grid, size: 'sheet', className: 'sheet' });
  if (chosen) app.run(chosen);
}
