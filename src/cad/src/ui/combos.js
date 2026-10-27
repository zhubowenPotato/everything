/**
 * Property combos for the ribbon: layer, color, linetype, lineweight, text
 * style, text height and dimension style. With objects selected a combo
 * shows their shared value (blank when they differ) and changes them;
 * otherwise it shows and changes the current value for new objects.
 */
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { showMenu, closeMenus } from './menu.js';
import { colorLabel, colorCss } from '../core/colors.js';
import { COLOR_BYLAYER, COLOR_BYBLOCK, LW_BYLAYER, LW_BYBLOCK, LW_DEFAULT, LINEWEIGHTS } from '../core/schema.js';
import { t } from '../i18n/index.js';

export function lwLabel(lw) {
  if (lw === LW_BYLAYER) return t('ByLayer');
  if (lw === LW_BYBLOCK) return t('ByBlock');
  if (lw === LW_DEFAULT) return t('Default');
  return `${(lw / 100).toFixed(2)} mm`;
}

/** Shared value of `key` across the selection, or undefined if they differ. */
export function selectionValue(app, key) {
  const d = app.doc?.drawing;
  const sel = app.doc?.selection;
  if (!d || !sel || !sel.size) return { has: false };
  let v;
  let first = true;
  for (const id of sel) {
    const e = d.get(id);
    if (!e) continue;
    if (first) {
      v = e[key];
      first = false;
    } else if (e[key] !== v) return { has: true, varies: true };
  }
  return { has: true, value: v };
}

function swatch(css) {
  return h('span.swatch', { style: { background: css } });
}

function lwSample(lw) {
  const px = lw >= 0 ? Math.max(1, Math.min(6, Math.round((lw / 100) * 4))) : 1;
  return h('span.lw-sample', { style: { borderTopWidth: `${px}px` } });
}

function ltSample(pattern) {
  if (!pattern || !pattern.length) return h('span.lt-sample.solid');
  const total = pattern.reduce((s, v) => s + Math.abs(v), 0) || 1;
  const k = 28 / total;
  const segs = [];
  let x = 0;
  for (const v of pattern) {
    const w = v === 0 ? 1.5 : Math.abs(v) * k;
    if (v >= 0) segs.push(`<rect x="${x.toFixed(1)}" y="0" width="${Math.max(1.5, w).toFixed(1)}" height="1.5"/>`);
    x += w;
  }
  const el = h('span.lt-sample');
  el.innerHTML = `<svg width="56" height="2" viewBox="0 0 56 2" aria-hidden="true"><g fill="currentColor">${segs.join('')}<g transform="translate(28 0)">${segs.join('')}</g></g></svg>`;
  return el;
}

export function buildCombo(app, kind) {
  const button = h('button.combo', { type: 'button', 'aria-haspopup': 'menu' });
  const el = h('div.combo-wrap', { 'data-combo': kind }, button);
  const labels = { layer: t('Layer'), color: t('Color'), linetype: t('Linetype'), lineweight: t('Lineweight'), textStyle: t('Text style'), dimStyle: t('Dimension style'), textHeight: t('Text height') };
  button.dataset.tip = labels[kind];

  const refresh = () => {
    const d = app.doc?.drawing;
    if (!d) return;
    clear(button);
    const hd = d.header;
    let content = [];
    let aria = labels[kind];
    switch (kind) {
      case 'layer': {
        const s = selectionValue(app, 'layer');
        const name = s.has ? (s.varies ? '' : s.value) : hd.clayer;
        const l = d.layers.get(name);
        content = [
          h('span.layer-flags', l ? [icon(l.on ? 'eye' : 'eye-off', 14), icon(l.frozen ? 'freeze' : 'thaw', 14), icon(l.locked ? 'lock' : 'unlock', 14)] : null),
          l ? swatch(colorCss(l.color)) : null,
          h('span.combo-text', name || t('Varies')),
        ];
        aria = t('Layer: {name}', { name: name || t('varies') });
        break;
      }
      case 'color': {
        const s = selectionValue(app, 'color');
        const c = s.has ? (s.varies ? undefined : s.value) : hd.ccolor;
        const layerColor = d.layers.get(hd.clayer)?.color ?? 7;
        content = [c === undefined ? null : swatch(colorCss(c, layerColor)), h('span.combo-text', c === undefined ? t('Varies') : colorLabel(c))];
        aria = t('Color: {value}', { value: c === undefined ? t('varies') : colorLabel(c) });
        break;
      }
      case 'linetype': {
        const s = selectionValue(app, 'linetype');
        const v = s.has ? (s.varies ? undefined : s.value) : hd.cltype;
        const lt = d.linetypes.get(v);
        content = [ltSample(lt?.pattern), h('span.combo-text', v ?? t('Varies'))];
        aria = t('Linetype: {value}', { value: v ?? t('varies') });
        break;
      }
      case 'lineweight': {
        const s = selectionValue(app, 'lineweight');
        const v = s.has ? (s.varies ? undefined : s.value) : hd.clweight;
        content = [v === undefined ? null : lwSample(v), h('span.combo-text', v === undefined ? t('Varies') : lwLabel(v))];
        aria = t('Lineweight: {value}', { value: v === undefined ? t('varies') : lwLabel(v) });
        break;
      }
      case 'textStyle':
        content = [icon('text-style', 14), h('span.combo-text', hd.textStyle)];
        aria = t('Text style: {name}', { name: hd.textStyle });
        break;
      case 'dimStyle':
        content = [icon('dim-style', 14), h('span.combo-text', hd.dimStyle)];
        aria = t('Dimension style: {name}', { name: hd.dimStyle });
        break;
      case 'textHeight':
        content = [h('span.combo-prefix', t('Height')), h('span.combo-text', String(+hd.textHeight.toFixed(4)))];
        aria = t('Text height: {value}', { value: hd.textHeight });
        break;
    }
    button.append(...content.filter(Boolean), h('span.combo-caret', icon('chevron-down', 12)));
    button.setAttribute('aria-label', aria);
  };

  button.addEventListener('click', () => {
    const d = app.doc?.drawing;
    if (!d) return;
    const hd = d.header;
    const hasSel = app.doc.selection.size > 0;
    let items = [];
    switch (kind) {
      case 'layer':
        showLayerMenu(app, button, refresh);
        return;
      case 'color': {
        const pick = (c) => () => app.applyProperty('color', c);
        const cur = hasSel ? selectionValue(app, 'color').value : hd.ccolor;
        items = [
          { label: t('ByLayer'), icon: swatch(colorCss(COLOR_BYLAYER, d.layers.get(hd.clayer)?.color)), checked: cur === COLOR_BYLAYER, radio: true, action: pick(COLOR_BYLAYER) },
          { label: t('ByBlock'), icon: swatch('var(--fg)'), checked: cur === COLOR_BYBLOCK, radio: true, action: pick(COLOR_BYBLOCK) },
          { separator: true },
          ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({ label: colorLabel(i), icon: swatch(colorCss(i)), checked: cur === i, radio: true, action: pick(i) })),
          { separator: true },
          { label: t('More colors...'), icon: 'palette', action: async () => {
            const c = await app.colorDialog(cur);
            if (c !== null && c !== undefined) app.applyProperty('color', c);
          } },
        ];
        break;
      }
      case 'linetype': {
        const cur = hasSel ? selectionValue(app, 'linetype').value : hd.cltype;
        items = [
          { label: t('ByLayer'), checked: cur === 'ByLayer', radio: true, action: () => app.applyProperty('linetype', 'ByLayer') },
          { label: t('ByBlock'), checked: cur === 'ByBlock', radio: true, action: () => app.applyProperty('linetype', 'ByBlock') },
          { separator: true },
          ...[...d.linetypes.values()].map((lt) => ({ label: lt.name, icon: ltSample(lt.pattern), checked: cur === lt.name, radio: true, action: () => app.applyProperty('linetype', lt.name) })),
          { separator: true },
          { label: t('Load linetypes...'), icon: 'lineweight', action: () => app.run('LINETYPE') },
        ];
        break;
      }
      case 'lineweight': {
        const cur = hasSel ? selectionValue(app, 'lineweight').value : hd.clweight;
        items = [LW_BYLAYER, LW_BYBLOCK, LW_DEFAULT, ...LINEWEIGHTS].map((w) => ({ label: lwLabel(w), icon: lwSample(w), checked: cur === w, radio: true, action: () => app.applyProperty('lineweight', w) }));
        break;
      }
      case 'textStyle':
        items = [...d.textStyles.keys()].map((n) => ({ label: n, checked: hd.textStyle === n, radio: true, action: () => app.applyStyle('textStyle', n) }));
        items.push({ separator: true }, { label: t('Manage text styles...'), icon: 'text-style', action: () => app.run('STYLE') });
        break;
      case 'dimStyle':
        items = [...d.dimStyles.keys()].map((n) => ({ label: n, checked: hd.dimStyle === n, radio: true, action: () => app.applyStyle('dimStyle', n) }));
        items.push({ separator: true }, { label: t('Manage dimension styles...'), icon: 'dim-style', action: () => app.run('DIMSTYLE') });
        break;
      case 'textHeight':
        items = [1, 1.8, 2.5, 3.5, 5, 7, 10, 14, 20].map((v) => ({ label: String(v), checked: hd.textHeight === v, radio: true, action: () => app.applyStyle('textHeight', v) }));
        items.push({ separator: true }, { label: t('Other...'), action: () => app.promptTextHeight() });
        break;
    }
    showMenu(button, items, { label: labels[kind], className: 'combo-menu' });
  });

  refresh();
  return { el, refresh };
}

function showLayerMenu(app, anchor, refresh) {
  const d = app.doc.drawing;
  const hasSel = app.doc.selection.size > 0;
  const rows = [];
  const names = [...d.layers.keys()].sort((a, b) => (a === '0' ? -1 : b === '0' ? 1 : a.localeCompare(b, undefined, { numeric: true })));
  for (const name of names) {
    const l = d.layers.get(name);
    const toggle = (prop, onIcon, offIcon, label) =>
      h(
        'button.icon-btn.sm',
        {
          type: 'button',
          'aria-label': t('{label} {name}', { label, name }),
          'aria-pressed': String(!!l[prop]),
          'data-tip': label,
          onClick: (e) => {
            e.stopPropagation();
            app.setLayerProp(name, { [prop]: !l[prop] });
            closeMenus();
            showLayerMenu(app, anchor, refresh);
          },
        },
        icon(l[prop] ? onIcon : offIcon, 15),
      );
    const current = name === d.header.clayer;
    rows.push(
      h(
        'div.layer-row',
        { role: 'none' },
        h('span.layer-toggles', toggle('on', 'eye', 'eye-off', t('Show or hide')), toggle('frozen', 'freeze', 'thaw', t('Freeze or thaw')), toggle('locked', 'lock', 'unlock', t('Lock or unlock'))),
        h(
          'button.menu-item.layer-name',
          {
            type: 'button',
            role: 'menuitemradio',
            'data-key': `layer-menu:${name}`,
            'aria-checked': String(current && !hasSel),
            onClick: () => {
              closeMenus();
              if (hasSel) app.applyProperty('layer', name);
              else app.setCurrentLayer(name);
            },
          },
          swatch(colorCss(l.color)),
          h('span.menu-label', name),
          current ? h('span.badge', t('Current')) : null,
        ),
      ),
    );
  }
  const list = h('div.layer-list', rows);
  showMenu(anchor, [{ custom: list }, { separator: true }, { label: t('Layer properties...'), icon: 'layer-props', action: () => app.run('LAYER') }], {
    label: t('Layers'),
    className: 'layer-menu',
    focusFirst: true,
    // Reopened after a toggle: focus still returns to the combo.
    rootFocus: anchor,
  });
}
