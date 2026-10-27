/**
 * Command registry: every command by name and alias.
 */
import * as draw from './draw.js';
import * as modify from './modify.js';
import * as annotate from './annotate.js';
import * as misc from './misc.js';
import { t } from '../../i18n/index.js';

/** Commands implemented by the application shell (files, panels, dialogs). */
const app = (name, label, icon, method, aliases = [], extra = {}) => ({
  name,
  label,
  icon,
  aliases,
  noRepeat: true,
  immediate: true,
  ...extra,
  run: (ed, args) => ed.app[method](args ?? extra.args),
});

const APP_COMMANDS = [
  app('NEW', t('New drawing'), 'file-plus', 'newDrawing', ['QNEW'], { needsDoc: false }),
  app('OPEN', t('Open'), 'folder-open', 'open', [], { needsDoc: false }),
  app('SAVE', t('Save'), 'save', 'save', ['QSAVE']),
  app('SAVEAS', t('Save as'), 'save-all', 'saveAs'),
  app('EXPORT', t('Export'), 'download', 'exportDialog', ['EXP']),
  app('DXFOUT', t('Export DXF'), 'download', 'exportDxf'),
  app('IMPORT', t('Import DXF'), 'upload', 'importFile', ['DXFIN'], { needsDoc: false }),
  app('PLOT', t('Plot'), 'printer', 'plotDialog', ['PRINT']),
  app('CLOSE', t('Close drawing'), 'x', 'closeDrawing'),
  app('LAYER', t('Layer properties'), 'layer-props', 'toggleLayers', ['LA', 'LAYERS']),
  app('PROPERTIES', t('Properties'), 'sliders', 'toggleProperties', ['PR', 'PROPS', 'CH']),
  app('UNITS', t('Drawing units'), 'units', 'unitsDialog', ['UN']),
  app('OPTIONS', t('Settings'), 'settings', 'settingsDialog', ['OP', 'SETTINGS'], { needsDoc: false }),
  app('DSETTINGS', t('Drafting settings'), 'osnap', 'draftingDialog', ['DS', 'OSNAP', 'SE']),
  app('STYLE', t('Text styles'), 'text-style', 'textStylesDialog', ['ST']),
  app('DIMSTYLE', t('Dimension styles'), 'dim-style', 'dimStylesDialog', ['D', 'DST']),
  app('LINETYPE', t('Linetypes'), 'lineweight', 'linetypesDialog', ['LT', 'LTYPE']),
  app('LTSCALE', t('Linetype scale'), 'lineweight', 'ltscalePrompt', ['LTS'], { immediate: false }),
  app('PURGE', t('Purge unused'), 'trash', 'purge', ['PU']),
  app('HELP', t('Help'), 'help', 'help', ['?'], { needsDoc: false }),
  app('SHORTCUTS', t('Keyboard shortcuts'), 'keyboard', 'shortcuts', [], { needsDoc: false }),
  app('QSELECT', t('Quick select'), 'quick-select', 'quickSelect'),
  app('BLOCKS', t('Blocks palette'), 'block-insert', 'toggleBlocks', ['BLOCKSPALETTE']),
  app('CLEANSCREEN', t('Clean screen'), 'clean-screen', 'toggleCleanScreen', ['CLEANSCREENON']),
  app('GRID', t('Grid display'), 'grid', 'toggleSetting', [], { args: 'grid' }),
];

/** Build the name/alias -> command map. */
export function buildRegistry() {
  const map = new Map();
  const all = [...Object.values(draw), ...Object.values(modify), ...Object.values(annotate), ...Object.values(misc), ...APP_COMMANDS].filter(
    (c) => c && typeof c === 'object' && c.name && typeof c.run === 'function',
  );
  for (const c of all) {
    map.set(c.name, c);
    for (const a of c.aliases || []) if (!map.has(a)) map.set(a, c);
  }
  return map;
}

/** Unique command list (for search and autocomplete). */
export function commandList(map) {
  return [...new Set(map.values())];
}
