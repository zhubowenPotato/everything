/**
 * Ribbon layout. Each tab has panels; each panel lists items:
 *   { cmd, size: 'lg' | 'sm', label?, icon?, args?, variants?: [...] }
 *   { type: 'combo', combo: 'layer' | 'color' | 'linetype' | 'lineweight' | 'textStyle' | 'dimStyle' }
 *   { type: 'toggle', setting, label, icon }
 * `more` items appear in the panel's overflow menu.
 *
 * Labels and titles are wrapped in t() for localisation; command names,
 * icons, args and settings stay as-is.
 */
import { t } from '../i18n/index.js';

export const RIBBON = [
  {
    id: 'home',
    label: t('Home'),
    panels: [
      {
        title: t('Draw'),
        items: [
          { cmd: 'LINE', size: 'lg' },
          { cmd: 'PLINE', size: 'lg' },
          {
            cmd: 'CIRCLE',
            size: 'lg',
            variants: [
              { label: t('Center, Radius'), icon: 'circle', args: { mode: 'cr' } },
              { label: t('Center, Diameter'), icon: 'circle', args: { mode: 'cd' } },
              { label: t('2-Point'), icon: 'circle-2p', args: { mode: '2p' } },
              { label: t('3-Point'), icon: 'circle-3p', args: { mode: '3p' } },
              { label: t('Tan, Tan, Radius'), icon: 'circle-ttr', args: { mode: 'ttr' } },
            ],
          },
          {
            cmd: 'ARC',
            size: 'lg',
            variants: [
              { label: t('3-Point'), icon: 'arc', args: {} },
              { label: t('Start, Center, End'), icon: 'arc-sce', args: { mode: 'sce' } },
              { label: t('Center, Start, End'), icon: 'arc-cse', args: { mode: 'cse' } },
              { label: t('Start, End, Radius'), icon: 'arc-ser', args: { mode: 'ser' } },
            ],
          },
          { cmd: 'RECTANG', size: 'sm', variants: [{ label: t('Rectangle'), icon: 'rectangle', cmd: 'RECTANG' }, { label: t('Polygon'), icon: 'polygon', cmd: 'POLYGON' }] },
          {
            cmd: 'ELLIPSE',
            size: 'sm',
            variants: [
              { label: t('Center'), icon: 'ellipse', args: { mode: 'center' } },
              { label: t('Axis, End'), icon: 'ellipse', args: {} },
              { label: t('Elliptical arc'), icon: 'ellipse-arc', args: { mode: 'arc' } },
            ],
          },
          { cmd: 'HATCH', size: 'sm' },
          { cmd: 'SPLINE', size: 'sm' },
          { cmd: 'XLINE', size: 'sm' },
          { cmd: 'POINT', size: 'sm' },
        ],
        more: ['RAY', 'POLYGON', 'DONUT', 'REVCLOUD'],
      },
      {
        title: t('Modify'),
        items: [
          { cmd: 'MOVE', size: 'sm' },
          { cmd: 'COPY', size: 'sm' },
          { cmd: 'STRETCH', size: 'sm' },
          { cmd: 'ROTATE', size: 'sm' },
          { cmd: 'MIRROR', size: 'sm' },
          { cmd: 'SCALE', size: 'sm' },
          { cmd: 'TRIM', size: 'sm', variants: [{ label: t('Trim'), icon: 'trim', cmd: 'TRIM' }, { label: t('Extend'), icon: 'extend', cmd: 'EXTEND' }] },
          { cmd: 'FILLET', size: 'sm', variants: [{ label: t('Fillet'), icon: 'fillet', cmd: 'FILLET' }, { label: t('Chamfer'), icon: 'chamfer', cmd: 'CHAMFER' }] },
          { cmd: 'ARRAYRECT', size: 'sm', label: t('Array'), variants: [{ label: t('Rectangular array'), icon: 'array-rect', cmd: 'ARRAYRECT' }, { label: t('Polar array'), icon: 'array-polar', cmd: 'ARRAYPOLAR' }] },
          { cmd: 'ERASE', size: 'sm', iconOnly: true },
          { cmd: 'EXPLODE', size: 'sm', iconOnly: true },
          { cmd: 'OFFSET', size: 'sm', iconOnly: true },
        ],
        more: ['JOIN', 'BREAK', 'BREAKATPOINT', 'LENGTHEN', 'ALIGN', { label: t('Bring to front'), cmd: 'DRAWORDER', args: { where: 'front' }, icon: 'draw-order' }, { label: t('Send to back'), cmd: 'DRAWORDER', args: { where: 'back' }, icon: 'draw-order' }],
      },
      {
        title: t('Annotation'),
        items: [
          { cmd: 'MTEXT', size: 'lg', label: t('Text'), variants: [{ label: t('Multiline text'), icon: 'mtext', cmd: 'MTEXT' }, { label: t('Single line text'), icon: 'text', cmd: 'TEXT' }] },
          {
            cmd: 'DIMLINEAR',
            size: 'lg',
            label: t('Dimension'),
            variants: [
              { label: t('Linear'), icon: 'dim-linear', cmd: 'DIMLINEAR' },
              { label: t('Aligned'), icon: 'dim-aligned', cmd: 'DIMALIGNED' },
              { label: t('Angular'), icon: 'dim-angular', cmd: 'DIMANGULAR' },
              { label: t('Radius'), icon: 'dim-radius', cmd: 'DIMRADIUS' },
              { label: t('Diameter'), icon: 'dim-diameter', cmd: 'DIMDIAMETER' },
              { label: t('Ordinate'), icon: 'dim-ordinate', cmd: 'DIMORDINATE' },
            ],
          },
          { cmd: 'LEADER', size: 'sm' },
          { cmd: 'DIMCONTINUE', size: 'sm', label: t('Continue') },
          { cmd: 'DIMBASELINE', size: 'sm', label: t('Baseline') },
        ],
      },
      {
        title: t('Layers'),
        wide: true,
        items: [
          { cmd: 'LAYER', size: 'lg', label: t('Layer Properties') },
          { type: 'combo', combo: 'layer' },
          { type: 'row', items: [{ cmd: 'LAYOFF', iconOnly: true }, { cmd: 'LAYISO', iconOnly: true }, { cmd: 'LAYFRZ', iconOnly: true }, { cmd: 'LAYLCK', iconOnly: true }, { cmd: 'LAYMCUR', label: t('Make Current') }] },
          { type: 'row', items: [{ cmd: 'LAYON', iconOnly: true }, { cmd: 'LAYUNISO', iconOnly: true }, { cmd: 'LAYTHW', iconOnly: true }, { cmd: 'LAYULK', iconOnly: true }, { cmd: 'LAYMATCH', label: t('Match Layer') }] },
        ],
      },
      {
        title: t('Block'),
        items: [
          { cmd: 'INSERT', size: 'lg', label: t('Insert') },
          { cmd: 'BLOCK', size: 'sm', label: t('Create') },
          { cmd: 'BLOCKS', size: 'sm', label: t('Library') },
        ],
      },
      {
        title: t('Properties'),
        wide: true,
        items: [
          { cmd: 'MATCHPROP', size: 'lg', label: t('Match Properties') },
          { type: 'combo', combo: 'color' },
          { type: 'combo', combo: 'linetype' },
          { type: 'combo', combo: 'lineweight' },
        ],
      },
      {
        title: t('Utilities'),
        items: [
          {
            cmd: 'DIST',
            size: 'lg',
            label: t('Measure'),
            variants: [
              { label: t('Distance'), icon: 'measure-dist', cmd: 'DIST' },
              { label: t('Area'), icon: 'measure-area', cmd: 'AREA' },
              { label: t('Point coordinates'), icon: 'id-point', cmd: 'ID' },
              { label: t('List'), icon: 'list', cmd: 'LIST' },
            ],
          },
          { cmd: 'QSELECT', size: 'sm', iconOnly: true },
          { cmd: 'SELECTALL', size: 'sm', iconOnly: true },
          { cmd: 'SELECTSIMILAR', size: 'sm', iconOnly: true },
        ],
      },
      {
        title: t('Clipboard'),
        items: [
          { cmd: 'PASTECLIP', size: 'lg', label: t('Paste') },
          { cmd: 'CUTCLIP', size: 'sm', iconOnly: true },
          { cmd: 'COPYCLIP', size: 'sm', iconOnly: true },
          { cmd: 'COPYBASE', size: 'sm', iconOnly: true },
        ],
      },
    ],
  },
  {
    id: 'insert',
    label: t('Insert'),
    panels: [
      {
        title: t('Block'),
        items: [
          { cmd: 'INSERT', size: 'lg', label: t('Insert') },
          { cmd: 'BLOCK', size: 'lg', label: t('Create Block') },
          { cmd: 'BLOCKS', size: 'lg', label: t('Block Library') },
          { cmd: 'EXPLODE', size: 'lg' },
        ],
      },
      {
        title: t('Import'),
        items: [
          { cmd: 'IMPORT', size: 'lg', label: t('Import DXF') },
          { cmd: 'PASTECLIP', size: 'lg', label: t('Paste') },
        ],
      },
    ],
  },
  {
    id: 'annotate',
    label: t('Annotate'),
    panels: [
      {
        title: t('Text'),
        wide: true,
        items: [
          { cmd: 'MTEXT', size: 'lg', label: t('Multiline Text') },
          { cmd: 'TEXT', size: 'lg', label: t('Single Line') },
          { type: 'combo', combo: 'textStyle' },
          { type: 'combo', combo: 'textHeight' },
        ],
      },
      {
        title: t('Dimensions'),
        wide: true,
        items: [
          { cmd: 'DIM', size: 'lg', label: t('Dimension') },
          { cmd: 'DIMLINEAR', size: 'sm', label: t('Linear') },
          { cmd: 'DIMALIGNED', size: 'sm', label: t('Aligned') },
          { cmd: 'DIMANGULAR', size: 'sm', label: t('Angular') },
          { cmd: 'DIMRADIUS', size: 'sm', label: t('Radius') },
          { cmd: 'DIMDIAMETER', size: 'sm', label: t('Diameter') },
          { cmd: 'DIMORDINATE', size: 'sm', label: t('Ordinate') },
          { cmd: 'DIMCONTINUE', size: 'sm', label: t('Continue') },
          { cmd: 'DIMBASELINE', size: 'sm', label: t('Baseline') },
          { type: 'combo', combo: 'dimStyle' },
        ],
      },
      {
        title: t('Leaders'),
        items: [{ cmd: 'LEADER', size: 'lg', label: t('Leader') }],
      },
      {
        title: t('Styles'),
        items: [
          { cmd: 'STYLE', size: 'lg', label: t('Text Styles') },
          { cmd: 'DIMSTYLE', size: 'lg', label: t('Dimension Styles') },
        ],
      },
    ],
  },
  {
    id: 'view',
    label: t('View'),
    panels: [
      {
        title: t('Navigate'),
        items: [
          { cmd: 'ZOOMEXTENTS', size: 'lg', label: t('Extents') },
          { cmd: 'ZOOM', size: 'lg', label: t('Window'), args: { mode: 'window' } },
          { cmd: 'PAN', size: 'lg' },
          { cmd: 'ZOOM', size: 'sm', label: t('Zoom In'), icon: 'zoom-in', args: { mode: 'in' } },
          { cmd: 'ZOOM', size: 'sm', label: t('Zoom Out'), icon: 'zoom-out', args: { mode: 'out' } },
          { cmd: 'ZOOM', size: 'sm', label: t('Previous'), icon: 'zoom-prev', args: { mode: 'previous' } },
        ],
      },
      {
        title: t('Palettes'),
        items: [
          { cmd: 'PROPERTIES', size: 'lg' },
          { cmd: 'LAYER', size: 'lg', label: t('Layers') },
          { cmd: 'BLOCKS', size: 'lg', label: t('Blocks') },
        ],
      },
      {
        title: t('Display'),
        items: [
          { type: 'toggle', setting: 'grid', label: t('Grid'), icon: 'grid' },
          { type: 'toggle', setting: 'lwDisplay', label: t('Lineweight'), icon: 'lineweight' },
          { type: 'toggle', setting: 'showUcs', label: t('Coordinate Icon'), icon: 'ucs-icon' },
          { type: 'toggle', setting: 'showCmdLine', label: t('Command Line'), icon: 'cmd-line' },
          { cmd: 'REGEN', size: 'sm', label: t('Regenerate') },
          { cmd: 'CLEANSCREEN', size: 'sm', label: t('Clean Screen') },
        ],
      },
      {
        title: t('Interface'),
        items: [{ type: 'theme' }],
      },
    ],
  },
  {
    id: 'manage',
    label: t('Manage'),
    panels: [
      {
        title: t('Drawing Setup'),
        items: [
          { cmd: 'UNITS', size: 'lg', label: t('Units') },
          { cmd: 'LINETYPE', size: 'lg', label: t('Linetypes') },
          { cmd: 'STYLE', size: 'lg', label: t('Text Styles') },
          { cmd: 'DIMSTYLE', size: 'lg', label: t('Dim Styles') },
        ],
      },
      {
        title: t('Settings'),
        items: [
          { cmd: 'DSETTINGS', size: 'lg', label: t('Drafting') },
          { cmd: 'OPTIONS', size: 'lg', label: t('Settings') },
          { cmd: 'SHORTCUTS', size: 'lg', label: t('Shortcuts') },
        ],
      },
      {
        title: t('Cleanup'),
        items: [{ cmd: 'PURGE', size: 'lg', label: t('Purge') }],
      },
    ],
  },
  {
    id: 'output',
    label: t('Output'),
    panels: [
      {
        title: t('Plot'),
        items: [{ cmd: 'PLOT', size: 'lg', label: t('Plot') }],
      },
      {
        title: t('Export'),
        items: [
          { cmd: 'EXPORT', size: 'lg', label: t('Export') },
          { cmd: 'DXFOUT', size: 'lg', label: t('DXF') },
        ],
      },
    ],
  },
];

/** Contextual tab shown while the hatch command runs. */
export const HATCH_TAB = { id: 'hatch', label: t('Hatch Creation'), contextual: true };
