/**
 * Layer Properties manager: create, rename, delete and edit layers, set the
 * current layer, and toggle visibility, freezing, locking and plotting.
 */
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { colorLabel, colorCss } from '../core/colors.js';
import { defaultLayer, LINEWEIGHTS, LW_DEFAULT } from '../core/schema.js';
import { lwLabel } from './combos.js';
import { confirmDialog } from './dialog.js';
import { preserveFocus } from './focus.js';
import { t } from '../i18n/index.js';

export class LayerManager {
  constructor(app) {
    this.app = app;
    this.query = '';
    this.selected = null;
    this.search = h('input.input.sm', { type: 'search', placeholder: t('Search layers'), 'aria-label': t('Search layers'), spellcheck: 'false' });
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.render();
    });
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    this.status = h('div.lm-status');
    // Explicit messages (not every re-render) are announced.
    this.live = h('div.sr-only', { role: 'status', 'aria-live': 'polite' });
    this.tbody = h('tbody');
    const th = (label, cls = '', title) => h(`th${cls}`, { scope: 'col', title: title || null }, label);
    this.table = h(
      'table.lm-table',
      { 'aria-label': t('Layers') },
      h(
        'thead',
        h(
          'tr',
          h('th.lm-c-cur', { scope: 'col' }, h('span.sr-only', t('Current'))),
          th(t('Name'), '.lm-c-name'),
          th(t('On'), '.lm-c-tg'),
          th(t('Freeze'), '.lm-c-tg'),
          th(t('Lock'), '.lm-c-tg'),
          th(t('Plot'), '.lm-c-tg'),
          th(t('Color'), '.lm-c-color'),
          th(t('Linetype'), '.lm-c-lt'),
          th(t('Lineweight'), '.lm-c-lw'),
          th(t('Transparency'), '.lm-c-tr'),
          th(t('Description'), '.lm-c-desc'),
        ),
      ),
      this.tbody,
    );
    this.el = h(
      'div.lm',
      h(
        'div.lm-toolbar',
        h('button.btn.sm', { type: 'button', onClick: () => this.newLayer(), 'data-tip': t('New layer'), 'data-tip-keys': 'Alt+N' }, icon('layer-new', 16), h('span', t('New'))),
        h('button.btn.sm', { type: 'button', onClick: () => this.deleteLayer(), 'data-tip': t('Delete layer') }, icon('layer-delete', 16), h('span', t('Delete'))),
        h('button.btn.sm', { type: 'button', onClick: () => this.makeCurrent(), 'data-tip': t('Set current'), 'data-tip-keys': 'Alt+C' }, icon('layer-current', 16), h('span', t('Set current'))),
        h('div.grow'),
        this.search,
      ),
      h('div.lm-scroll', this.table),
      this.status,
      this.live,
    );
    this.el.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.newLayer();
      } else if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        this.makeCurrent();
      }
    });
  }

  get drawing() {
    return this.app.doc.drawing;
  }

  refresh() {
    if (!this.el.isConnected) return;
    if (this.el.contains(document.activeElement) && document.activeElement.matches('input:not([type=search]), select')) return;
    preserveFocus(this.el, () => this.render());
  }

  usage() {
    const counts = new Map();
    for (const e of this.drawing.entities.values()) counts.set(e.layer, (counts.get(e.layer) || 0) + 1);
    return counts;
  }

  render() {
    if (!this.app.doc) return;
    const d = this.drawing;
    const counts = this.usage();
    const names = [...d.layers.keys()].sort((a, b) => (a === '0' ? -1 : b === '0' ? 1 : a.localeCompare(b, undefined, { numeric: true })));
    clear(this.tbody);
    let shown = 0;
    for (const name of names) {
      if (this.query && !name.toLowerCase().includes(this.query)) continue;
      shown++;
      const l = d.layers.get(name);
      const cur = name === d.header.clayer;
      const tg = (prop, onI, offI, label, invert = false) => {
        const active = invert ? !l[prop] : !!l[prop];
        return h(
          'td.lm-c-tg',
          h(
            'button.icon-btn.sm',
            {
              type: 'button',
              'aria-pressed': String(active),
              'aria-label': t('{label} for layer {name}', { label, name }),
              'data-tip': label,
              'data-key': `layer:${name}:${prop}`,
              onClick: (e) => {
                e.stopPropagation();
                if (prop === 'frozen' && cur && !l.frozen) {
                  this.say(t('The current layer cannot be frozen.'));
                  return;
                }
                this.app.setLayerProp(name, { [prop]: !l[prop] });
              },
            },
            icon(l[prop] ? onI : offI, 16),
          ),
        );
      };
      const nameCell = h('td.lm-c-name');
      const nameBtn = h(
        'button.lm-name',
        {
          type: 'button',
          'data-key': `layer:${name}:name`,
          'aria-pressed': String(this.selected === name),
          'aria-label': t('Layer {name}{cur}. Press F2 to rename.', { name, cur: cur ? t(', current') : '' }),
          onDblclick: () => this.rename(name, nameCell),
          onKeydown: (e) => {
            if (e.key === 'F2') {
              e.preventDefault();
              e.stopPropagation();
              this.rename(name, nameCell);
            }
          },
        },
        name,
      );
      nameCell.append(nameBtn);
      const lt = h('select.input.sm', { 'aria-label': t('Linetype for layer {name}', { name }) }, [...d.linetypes.keys()].map((n) => h('option', { value: n, selected: n === l.linetype }, n)));
      lt.addEventListener('change', () => this.app.setLayerProp(name, { linetype: lt.value }));
      const lw = h('select.input.sm', { 'aria-label': t('Lineweight for layer {name}', { name }) }, [LW_DEFAULT, ...LINEWEIGHTS].map((w) => h('option', { value: w, selected: w === l.lineweight }, lwLabel(w))));
      lw.addEventListener('change', () => this.app.setLayerProp(name, { lineweight: Number(lw.value) }));
      const tr = h('input.input.sm', { type: 'number', min: 0, max: 90, step: 5, value: l.transparency || 0, 'aria-label': t('Transparency for layer {name}', { name }) });
      tr.addEventListener('change', () => this.app.setLayerProp(name, { transparency: Math.max(0, Math.min(90, Number(tr.value) || 0)) }));
      const desc = h('input.input.sm', { type: 'text', value: l.description || '', 'aria-label': t('Description for layer {name}', { name }) });
      desc.addEventListener('change', () => this.app.setLayerProp(name, { description: desc.value }));
      for (const el of [tr, desc]) el.addEventListener('keydown', (e) => e.stopPropagation());
      const row = h(
        `tr${cur ? '.current' : ''}${this.selected === name ? '.selected' : ''}`,
        { onClick: () => this.select(name) },
        h(
          'td.lm-c-cur',
          h(
            'button.icon-btn.sm',
            { type: 'button', 'data-key': `layer:${name}:cur`, 'aria-label': cur ? t('{name} is the current layer', { name }) : t('Make {name} current', { name }), 'aria-pressed': String(cur), onClick: () => this.app.setCurrentLayer(name) },
            cur ? icon('check', 16) : h('span.lm-dot', { class: counts.get(name) ? 'used' : '' }),
          ),
        ),
        nameCell,
        tg('on', 'eye', 'eye-off', t('Visible')),
        tg('frozen', 'freeze', 'thaw', t('Frozen')),
        tg('locked', 'lock', 'unlock', t('Locked')),
        tg('plot', 'printer', 'x', t('Plot')),
        h(
          'td.lm-c-color',
          h(
            'button.input.sm.color-field',
            {
              type: 'button',
              'data-key': `layer:${name}:color`,
              'aria-label': t('Color for layer {name}: {color}', { name, color: colorLabel(l.color) }),
              onClick: async () => {
                const c = await this.app.colorDialog(l.color, { allowBy: false });
                if (c !== null && c !== undefined) this.app.setLayerProp(name, { color: c });
              },
            },
            h('span.swatch', { style: { background: colorCss(l.color) } }),
            h('span', colorLabel(l.color)),
          ),
        ),
        h('td.lm-c-lt', lt),
        h('td.lm-c-lw', lw),
        h('td.lm-c-tr', tr),
        h('td.lm-c-desc', desc),
      );
      this.tbody.append(row);
    }
    this.status.textContent = t('{shown} of {total} layers shown. Current layer: {current}.', { shown, total: names.length, current: d.header.clayer });
  }

  /** Show and announce a message. */
  say(msg) {
    this.status.textContent = msg;
    this.live.textContent = msg;
  }

  select(name) {
    this.selected = name;
    for (const tr of this.tbody.children) {
      const btn = tr.querySelector('.lm-name');
      const on = btn?.textContent === name;
      tr.classList.toggle('selected', on);
      btn?.setAttribute('aria-pressed', String(on));
    }
  }

  uniqueName(base = 'Layer') {
    const d = this.drawing;
    let i = 1;
    while (d.layers.has(`${base}${i}`)) i++;
    return `${base}${i}`;
  }

  newLayer() {
    const d = this.drawing;
    const name = this.uniqueName();
    const src = d.layers.get(this.selected) ?? null;
    const l = src ? { ...src, name, on: true, frozen: false, locked: false, description: '' } : defaultLayer(name);
    d.transaction(t('New layer'), () => d.setTable('layers', name, l));
    this.selected = name;
    this.render();
    const cell = [...this.tbody.querySelectorAll('.lm-name')].find((b) => b.textContent === name)?.parentElement;
    if (cell) this.rename(name, cell);
  }

  rename(name, cell) {
    if (name === '0') {
      this.say(t('Layer 0 cannot be renamed.'));
      return;
    }
    const inp = h('input.input.sm', { type: 'text', value: name, 'aria-label': t('New name for layer {name}', { name }) });
    clear(cell).append(inp);
    inp.focus();
    inp.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const v = inp.value.trim();
      let err = null;
      if (ok && v && v !== name) {
        err = this.app.renameLayer(name, v);
        if (!err) this.selected = v;
      }
      this.render();
      // Focus the (possibly renamed) layer again, and show any error after the re-render.
      const shown = err || !v ? name : v;
      [...this.tbody.querySelectorAll('.lm-name')].find((b) => b.textContent === shown)?.focus();
      if (err) this.say(err);
    };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    inp.addEventListener('blur', () => finish(true));
  }

  async deleteLayer() {
    const name = this.selected;
    const d = this.drawing;
    if (!name) {
      this.say(t('Select a layer to delete first.'));
      return;
    }
    if (name === '0' || name === d.header.clayer) {
      this.say(name === '0' ? t('Layer 0 cannot be deleted.') : t('The current layer cannot be deleted.'));
      return;
    }
    const used = this.usage().get(name) || 0;
    const inBlocks = [...d.blocks.values()].some((b) => b.entities.some((e) => e.layer === name));
    if (used || inBlocks) {
      const ok = await confirmDialog(t('Delete layer?'), t('"{name}" holds {used} object{plural}{blocks}. Deleting it also deletes those objects.', { name, used, plural: used === 1 ? '' : 's', blocks: inBlocks ? t(' and is used in blocks') : '' }), { confirm: t('Delete layer and objects'), danger: true });
      if (!ok) return;
    }
    d.transaction(t('Delete layer'), () => {
      for (const [id, e] of d.entities) if (e.layer === name) d.remove(id);
      for (const b of d.blocks.values()) {
        if (b.entities.some((e) => e.layer === name)) d.setBlock(b.name, { ...b, entities: b.entities.map((e) => (e.layer === name ? { ...e, layer: '0' } : e)) });
      }
      d.setTable('layers', name, null);
    });
    this.selected = null;
    this.render();
  }

  makeCurrent() {
    if (this.selected) this.app.setCurrentLayer(this.selected);
  }
}
