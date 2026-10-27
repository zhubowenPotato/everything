/**
 * Block library palette: thumbnails of the drawing's block definitions.
 * Click to insert; rename or delete unused blocks from the item menu.
 */
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { drawPreview } from './preview.js';
import { openDialog, promptDialog, confirmDialog } from './dialog.js';
import { showMenu } from './menu.js';
import { t } from '../i18n/index.js';

export class BlockLibrary {
  constructor(app) {
    this.app = app;
    this.query = '';
    this.search = h('input.input.sm', { type: 'search', placeholder: t('Search blocks'), 'aria-label': t('Search blocks'), spellcheck: 'false' });
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.render();
    });
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    this.grid = h('ul.bl-grid', { role: 'list' });
    this.empty = h('p.bl-empty', t('This drawing has no blocks yet. Select objects and use Create block (B) to make one.'));
    this.el = h(
      'div.bl',
      h('div.bl-toolbar', this.search, h('button.btn.sm', { type: 'button', onClick: () => app.run('BLOCK'), 'data-tip': t('Create block') }, icon('block-create', 16), h('span', t('Create')))),
      this.grid,
      this.empty,
    );
  }

  names() {
    return [...this.app.doc.drawing.blocks.keys()].filter((n) => !n.startsWith('*')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  refresh() {
    if (this.el.isConnected) this.render();
  }

  render() {
    if (!this.app.doc) return;
    const d = this.app.doc.drawing;
    const names = this.names().filter((n) => !this.query || n.toLowerCase().includes(this.query));
    clear(this.grid);
    this.empty.hidden = this.names().length > 0;
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();
    for (const name of names) {
      const b = d.blocks.get(name);
      const canvas = h('canvas.bl-thumb', { width: 120, height: 84, 'aria-hidden': 'true' });
      const item = h(
        'li.bl-item',
        h(
          'button.bl-btn',
          { type: 'button', 'aria-label': t('Insert {name}', { name }), onClick: () => this.app.run('INSERT', { name }) },
          canvas,
          h('span.bl-name', name),
        ),
        h(
          'button.icon-btn.sm.bl-more',
          {
            type: 'button',
            'aria-label': t('More actions for {name}', { name }),
            'aria-haspopup': 'menu',
            onClick: (e) =>
              showMenu(e.currentTarget, [
                { label: t('Insert'), icon: 'block-insert', action: () => this.app.run('INSERT', { name }) },
                { label: t('Rename...'), action: () => this.rename(name) },
                { label: t('Delete'), icon: 'trash', action: () => this.remove(name) },
              ]),
          },
          icon('more', 16),
        ),
      );
      this.grid.append(item);
      requestAnimationFrame(() => drawPreview(canvas, d, b.entities, { fg }));
    }
  }

  usage(name) {
    const d = this.app.doc.drawing;
    let n = 0;
    for (const e of d.entities.values()) if (e.type === 'insert' && e.name === name) n++;
    for (const b of d.blocks.values()) for (const e of b.entities) if (e.type === 'insert' && e.name === name) n++;
    return n;
  }

  async rename(name) {
    const d = this.app.doc.drawing;
    const v = await promptDialog(t('Rename block'), t('New name'), name, {
      validate: (s) => (!s ? t('Enter a name.') : /[<>/\\":;?*|=`]/.test(s) ? t('That name has characters that are not allowed.') : s !== name && d.blocks.has(s) ? t('A block with that name exists.') : null),
    });
    if (!v || v === name) return;
    d.transaction(t('Rename block'), () => {
      const b = d.blocks.get(name);
      d.setBlock(v, { ...b, name: v });
      d.setBlock(name, null);
      for (const [id, e] of d.entities) if (e.type === 'insert' && e.name === name) d.update(id, { name: v });
      for (const bl of d.blocks.values()) if (bl.entities.some((e) => e.type === 'insert' && e.name === name)) d.setBlock(bl.name, { ...bl, entities: bl.entities.map((e) => (e.type === 'insert' && e.name === name ? { ...e, name: v } : e)) });
    });
  }

  async remove(name) {
    const d = this.app.doc.drawing;
    const used = this.usage(name);
    if (used) {
      await openDialog({ title: t('Block in use'), body: h('p.dialog-text', t('"{name}" is used {used} time{plural}. Erase or explode those references first.', { name, used, plural: used === 1 ? '' : 's' })), size: 'sm', actions: [{ label: t('OK'), primary: true }] });
      return;
    }
    if (!(await confirmDialog(t('Delete block?'), t('Delete the definition of "{name}"?', { name }), { confirm: t('Delete'), danger: true }))) return;
    d.transaction(t('Delete block'), () => d.setBlock(name, null));
  }

  /** Let the user pick a block; resolves with its name or null. */
  async choose() {
    const d = this.app.doc.drawing;
    const names = this.names();
    if (!names.length) return null;
    let chosen = null;
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();
    const list = h('ul.bl-grid.choose', { role: 'listbox', 'aria-label': t('Blocks') });
    let close;
    for (const name of names) {
      const canvas = h('canvas.bl-thumb', { width: 120, height: 84, 'aria-hidden': 'true' });
      list.append(
        h(
          'li.bl-item',
          { role: 'none' },
          h(
            'button.bl-btn',
            {
              type: 'button',
              role: 'option',
              onClick: () => {
                chosen = name;
                close?.();
              },
            },
            canvas,
            h('span.bl-name', name),
          ),
        ),
      );
      requestAnimationFrame(() => drawPreview(canvas, d, d.blocks.get(name).entities, { fg }));
    }
    const p = openDialog({ title: t('Insert block'), body: list, size: 'lg', actions: [{ label: t('Cancel') }] });
    close = () => document.querySelector('dialog[open]')?._close(null);
    await p;
    return chosen;
  }
}
