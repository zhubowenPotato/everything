/**
 * Application chrome: title bar with the application menu and quick access
 * tools, ribbon, drawing tabs, the canvas workspace with its docked
 * palettes and navigation bar, the command line, the status bar, and the
 * compact toolbar used on phones.
 */
import { h, clear, MOD } from './dom.js';
import { icon } from './icons.js';
import { showMenu } from './menu.js';
import { commandTip } from './ribbon.js';
import { t } from '../i18n/index.js';

export const REPO_URL = 'https://github.com/heyputer/everything';

export function buildShell(app) {
  const qat = (cmd, ic, label, keys) => {
    const d = app.commands.get(cmd);
    return h('button.icon-btn.qat-btn', { type: 'button', 'aria-label': label, ...commandTip(d, label), 'data-tip-keys': keys || null, onClick: () => app.run(cmd) }, icon(ic, 17));
  };
  const undoBtn = qat('U', 'undo', t('Undo'), `${MOD}+Z`);
  const redoBtn = qat('REDO', 'redo', t('Redo'), `${MOD}+Y`);
  const appBtn = h(
    'button.app-btn',
    { type: 'button', 'aria-label': t('Application menu'), 'aria-haspopup': 'menu', 'data-tip': t('Application menu'), onClick: (e) => app.appMenu(e.currentTarget) },
    h('span.app-logo', icon('logo', 18)),
    icon('chevron-down', 12),
  );
  const title = h('div.title');
  const search = h(
    'button.search-btn',
    { type: 'button', 'aria-label': t('Search commands'), 'aria-haspopup': 'dialog', 'data-tip': t('Search commands'), 'data-tip-keys': `${MOD}+K`, onClick: () => app.commandPalette() },
    icon('search', 15),
    h('span.search-text', t('Search commands')),
    h('kbd', `${MOD} K`),
  );
  const account = h('div.account');
  const langBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('Language'), 'aria-haspopup': 'menu', 'data-tip': t('Language'), onClick: (e) => app.languageMenu(e.currentTarget) }, icon('globe', 17));
  const themeBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('Theme'), 'aria-haspopup': 'menu', 'data-tip': t('Theme'), onClick: (e) => app.themeMenu(e.currentTarget) }, icon('monitor', 17));
  const github = h(
    'a.icon-btn.github-link',
    { href: REPO_URL, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('Source code on GitHub (opens in a new tab)'), 'data-tip': t('Source code on GitHub') },
    icon('github', 17),
  );
  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('Help'), 'data-tip': t('Help'), 'data-tip-keys': 'F1', onClick: () => app.help() }, icon('help', 17));
  const moreBtn = h('button.icon-btn.only-phone', { type: 'button', 'aria-label': t('More'), 'aria-haspopup': 'menu', onClick: (e) => app.appMenu(e.currentTarget) }, icon('more', 18));

  const titlebar = h(
    'header.titlebar',
    h(
      'div.tb-left',
      appBtn,
      h(
        'div.qat',
        { role: 'toolbar', 'aria-label': t('Quick access') },
        h('span.qat-files.hide-phone', qat('NEW', 'file-plus', t('New drawing'), `${MOD}+N`), qat('OPEN', 'folder-open', t('Open'), `${MOD}+O`), qat('SAVE', 'save', t('Save'), `${MOD}+S`)),
        h('span.qat-sep.hide-phone'),
        undoBtn,
        redoBtn,
        h('span.qat-sep.hide-phone'),
        h('span.hide-phone', qat('PLOT', 'printer', t('Plot'), `${MOD}+P`)),
      ),
    ),
    title,
    h('div.tb-right', search, langBtn, themeBtn, helpBtn, github, account, moreBtn),
  );

  const doctabs = h('div.doctabs', { role: 'tablist', 'aria-label': t('Open drawings') });
  const newTab = h('button.icon-btn.doctab-new', { type: 'button', 'aria-label': t('New drawing'), 'data-tip': t('New drawing'), onClick: () => app.run('NEW') }, icon('plus', 16));
  const docbar = h('div.docbar', doctabs, newTab);

  // Canvas
  const glCanvas = h('canvas.gl-canvas', { 'aria-hidden': 'true' });
  const overlay = h('canvas.overlay-canvas', {
    tabindex: '0',
    role: 'application',
    'aria-label': t('Drawing area. Type a command or use the ribbon. Press F1 for help.'),
    'aria-describedby': 'canvas-help',
  });
  const canvasHelp = h(
    'p.sr-only#canvas-help',
    t('Use the mouse or touch to pick points and select objects. Type commands such as LINE or CIRCLE and press Enter. Coordinates can be typed as x,y or @distance<angle.'),
  );
  const nav = h(
    'div.viewnav',
    { role: 'toolbar', 'aria-label': t('Navigation'), 'aria-orientation': 'vertical' },
    navBtn(app, 'pan', t('Pan'), () => app.run('PAN')),
    navBtn(app, 'zoom-extents', t('Zoom extents'), () => app.editor.zoomExtents()),
    navBtn(app, 'zoom-window', t('Zoom window'), () => app.run('ZOOM', { mode: 'window' })),
    navBtn(app, 'zoom-in', t('Zoom in'), () => app.editor.zoomBy(1.6)),
    navBtn(app, 'zoom-out', t('Zoom out'), () => app.editor.zoomBy(1 / 1.6)),
  );
  const emptyState = h('div.empty-state', { hidden: true });
  const canvasWrap = h('div.canvas-wrap', glCanvas, overlay, canvasHelp, nav, emptyState);

  // Dock with palettes
  const dockTabs = h('div.dock-tabs', { role: 'tablist', 'aria-label': t('Palettes') });
  const dockBody = h('div.dock-body');
  const dockClose = h('button.icon-btn.sm', { type: 'button', 'aria-label': t('Close palette'), 'data-tip': t('Close palette'), onClick: () => app.closeDock() }, icon('x', 16));
  const dockResize = h('div.dock-resize', { role: 'separator', 'aria-orientation': 'vertical', 'aria-label': t('Resize palette'), tabindex: '0' });
  const dock = h('aside.dock', { hidden: true, 'aria-label': t('Palettes') }, dockResize, h('div.dock-head', dockTabs, dockClose), dockBody);
  const workspace = h('div.workspace', canvasWrap, dock);

  // Phone toolbar
  const phonebar = h('nav.phonebar', { 'aria-label': t('Tools') });

  const root = h('div.app-root', titlebar, h('div.ribbon-slot'), docbar, workspace, h('div.status-slot'), phonebar);
  return { root, titlebar, title, account, themeBtn, undoBtn, redoBtn, doctabs, glCanvas, overlay, canvasWrap, nav, emptyState, dock, dockTabs, dockBody, dockResize, workspace, phonebar, github };
}

function navBtn(app, ic, label, fn) {
  return h('button.icon-btn.nav-btn', { type: 'button', 'aria-label': label, 'data-tip': label, onClick: fn }, icon(ic, 17));
}

/** Render drawing tabs. */
export function renderDocTabs(app, el) {
  clear(el);
  app.docs.forEach((doc, i) => {
    const active = doc === app.doc;
    const tab = h(
      `div.doctab${active ? '.active' : ''}`,
      { role: 'presentation' },
      h(
        'button.doctab-btn',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': String(active),
          tabindex: active ? '0' : '-1',
          title: doc.file?.path || doc.name,
          onClick: () => app.activate(doc),
          onAuxclick: (e) => {
            if (e.button === 1) app.closeDrawing(doc);
          },
          onKeydown: (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + app.docs.length) % app.docs.length;
              app.activate(app.docs[j]);
              requestAnimationFrame(() => el.querySelector('.doctab.active .doctab-btn')?.focus());
            } else if (e.key === 'Delete') {
              // Keep the key from also erasing objects in the drawing.
              e.preventDefault();
              e.stopPropagation();
              app.closeDrawing(doc);
            }
          },
          onContextmenu: (e) => {
            e.preventDefault();
            showMenu({ x: e.clientX, y: e.clientY }, [
              { label: t('Save'), icon: 'save', action: () => app.save(doc) },
              { label: t('Save as...'), icon: 'save-all', action: () => app.saveAs(doc) },
              { separator: true },
              { label: t('Close'), icon: 'x', action: () => app.closeDrawing(doc) },
              { label: t('Close all others'), action: () => app.closeOthers(doc) },
            ]);
          },
        },
        h('span.doctab-name', doc.name),
        doc.drawing.modified ? [h('span.doctab-dot', { 'aria-hidden': 'true' }), h('span.sr-only', t(', unsaved changes'))] : null,
      ),
      // Mouse shortcut only: keyboard users close a tab with Delete or its context menu.
      h('button.icon-btn.sm.doctab-close', { type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: t('Close {name}', { name: doc.name }), onClick: () => app.closeDrawing(doc) }, icon('x', 14)),
    );
    el.append(tab);
  });
}

/** Tool groups for the phone toolbar. */
export const PHONE_GROUPS = [
  { id: 'draw', label: t('Draw'), icon: 'line', cmds: ['LINE', 'PLINE', 'CIRCLE', 'ARC', 'RECTANG', 'POLYGON', 'ELLIPSE', 'SPLINE', 'HATCH', 'POINT', 'XLINE', 'REVCLOUD'] },
  { id: 'modify', label: t('Modify'), icon: 'move', cmds: ['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR', 'OFFSET', 'TRIM', 'EXTEND', 'FILLET', 'CHAMFER', 'ARRAYRECT', 'ARRAYPOLAR', 'STRETCH', 'ERASE', 'EXPLODE', 'JOIN', 'BREAK', 'MATCHPROP'] },
  { id: 'annotate', label: t('Annotate'), icon: 'dim-linear', cmds: ['MTEXT', 'TEXT', 'DIMLINEAR', 'DIMALIGNED', 'DIMANGULAR', 'DIMRADIUS', 'DIMDIAMETER', 'LEADER', 'DIMCONTINUE', 'DIMBASELINE'] },
  { id: 'layers', label: t('Layers'), icon: 'layer-props', action: 'LAYER' },
  { id: 'props', label: t('Properties'), icon: 'sliders', action: 'PROPERTIES' },
];
