/**
 * Editing commands: erase, move, copy, rotate, scale, mirror, offset, trim,
 * extend, fillet, chamfer, arrays, stretch, break, join, explode, lengthen,
 * match properties and draw order.
 */
import { opts } from '../input.js';
import { t } from '../../i18n/index.js';
import {
  transformEntity,
  offsetEntity,
  trimEntity,
  extendEntity,
  fillet,
  filletPolyline,
  chamfer,
  chamferPolyline,
  breakEntity,
  breakAtPoint,
  joinEntities,
  explodePolyline,
  toPrims,
  closestPoint,
  lengthOf,
  splineFromFitPoints,
} from '../../core/geom/index.js';
import { insertMatrix, mulMatrix } from '../../core/tessellate.js';
import { buildDimension, buildLeader } from '../../core/dims.js';
import { COLOR_BYBLOCK, LW_BYBLOCK } from '../../core/schema.js';
import { M, TAU, dist, angleOf, norm, fresh } from './util.js';

const transformAll = (ed, ids, m, copy, label) =>
  ed.commit(label, () => {
    const out = [];
    for (const id of ids) {
      const e = ed.drawing.get(id);
      if (!e) continue;
      const te = transformEntity(e, m);
      out.push(copy ? ed.drawing.add(fresh(te)).id : ed.drawing.replace(id, te).id);
    }
    return out;
  });

function showSelection(ed, ids) {
  ed.renderer.setSelection(new Set(ids));
}

export const ERASE = {
  name: 'ERASE',
  aliases: ['E', 'DELETE'],
  label: t('Erase'),
  icon: 'erase',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    ed.commit(t('Erase'), () => ids.forEach((id) => ed.drawing.remove(id)));
    ed.clearSelection();
    ed.ui.log(t('{n} object{s} erased', { n: ids.length, s: ids.length === 1 ? '' : 's' }), 'muted');
  },
};

export const MOVE = {
  name: 'MOVE',
  aliases: ['M'],
  label: t('Move'),
  icon: 'move',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const base = await ed.getPoint(t('Base point'), { options: opts('Displacement') });
    if (!base) return;
    if (base.option === 'displacement') {
      const d = await ed.getPoint(t('Displacement (x,y)'), {});
      if (!d || d.option) return;
      transformAll(ed, ids, M.translate(d.x, d.y), false, t('Move'));
      ed.clearSelection();
      return;
    }
    const to = await ed.getPoint(t('Second point'), {
      base,
      onMove: (p) => ed.renderer.setDragMatrix(M.translate(p.x - base.x, p.y - base.y)),
    });
    ed.renderer.setDragMatrix(null);
    if (!to || to.option) return;
    transformAll(ed, ids, M.translate(to.x - base.x, to.y - base.y), false, t('Move'));
    ed.clearSelection();
  },
};

export const COPY = {
  name: 'COPY',
  aliases: ['CO', 'CP'],
  label: t('Copy'),
  icon: 'copy',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const base = await ed.getPoint(t('Base point'));
    if (!base || base.option) return;
    for (;;) {
      const to = await ed.getPoint(t('Second point (Enter to finish)'), {
        base,
        options: opts('Array'),
        onMove: (p) => ed.renderer.setDragMatrix(M.translate(p.x - base.x, p.y - base.y)),
      });
      ed.renderer.setDragMatrix(null);
      if (!to) break;
      if (to.option === 'array') {
        const n0 = await ed.getNumber(t('Number of items to array'), { default: 3, min: 2, max: 10000 });
        if (!Number.isFinite(n0)) continue;
        const n = Math.max(2, Math.round(n0));
        const last = await ed.getPoint(t('Second point'), {
          base,
          onMove: (p) => ed.renderer.setDragMatrix(M.translate(p.x - base.x, p.y - base.y)),
        });
        if (!last || last.option) continue;
        ed.commit(t('Copy'), () => {
          for (let i = 1; i < n; i++) transformAll(ed, ids, M.translate((last.x - base.x) * i, (last.y - base.y) * i), true, t('Copy'));
        });
        continue;
      }
      transformAll(ed, ids, M.translate(to.x - base.x, to.y - base.y), true, t('Copy'));
    }
    ed.clearSelection();
  },
};

export const ROTATE = {
  name: 'ROTATE',
  aliases: ['RO'],
  label: t('Rotate'),
  icon: 'rotate',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const base = await ed.getPoint(t('Base point'));
    if (!base || base.option) return;
    let copy = false;
    for (;;) {
      const a = await ed.getAngle(t('Rotation angle'), {
        base,
        default: ed.lastRotation ?? 0,
        options: opts('Copy', 'Reference'),
        onMove: (p) => ed.renderer.setDragMatrix(M.rotate(angleOf(base, p), base.x, base.y)),
      });
      ed.renderer.setDragMatrix(null);
      if (a === null) return;
      if (a.option === 'copy') {
        copy = true;
        ed.ui.log(t('Rotating a copy of the selected objects.'), 'muted');
        continue;
      }
      if (a.option === 'reference') {
        const r0 = await ed.getAngle(t('Reference angle'), { default: 0 });
        if (typeof r0 !== 'number') return;
        const r1 = await ed.getAngle(t('New angle'), {
          base,
          onMove: (p) => ed.renderer.setDragMatrix(M.rotate(angleOf(base, p) - r0, base.x, base.y)),
        });
        ed.renderer.setDragMatrix(null);
        if (typeof r1 !== 'number') return;
        transformAll(ed, ids, M.rotate(r1 - r0, base.x, base.y), copy, t('Rotate'));
        break;
      }
      ed.lastRotation = a;
      transformAll(ed, ids, M.rotate(a, base.x, base.y), copy, t('Rotate'));
      break;
    }
    ed.clearSelection();
  },
};

export const SCALE = {
  name: 'SCALE',
  aliases: ['SC'],
  label: t('Scale'),
  icon: 'scale',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const base = await ed.getPoint(t('Base point'));
    if (!base || base.option) return;
    let copy = false;
    for (;;) {
      const k = await ed.getDistance(t('Scale factor'), {
        base,
        default: ed.lastScale ?? 1,
        options: opts('Copy', 'Reference'),
        onMove: (p) => ed.renderer.setDragMatrix(M.scale(Math.max(1e-9, dist(base, p)), base.x, base.y)),
      });
      ed.renderer.setDragMatrix(null);
      if (k === null) return;
      if (k.option === 'copy') {
        copy = true;
        continue;
      }
      if (k.option === 'reference') {
        const l0 = await ed.getDistance(t('Reference length'), { default: 1 });
        if (typeof l0 !== 'number' || l0 <= 0) return;
        const l1 = await ed.getDistance(t('New length'), {
          base,
          onMove: (p) => ed.renderer.setDragMatrix(M.scale(Math.max(1e-9, dist(base, p) / l0), base.x, base.y)),
        });
        ed.renderer.setDragMatrix(null);
        if (typeof l1 !== 'number' || l1 <= 0) return;
        transformAll(ed, ids, M.scale(l1 / l0, base.x, base.y), copy, t('Scale'));
        break;
      }
      if (!(k > 0)) {
        ed.ui.log(t('The scale factor must be greater than zero.'), 'error');
        continue;
      }
      ed.lastScale = k;
      transformAll(ed, ids, M.scale(k, base.x, base.y), copy, t('Scale'));
      break;
    }
    ed.clearSelection();
  },
};

export const MIRROR = {
  name: 'MIRROR',
  aliases: ['MI'],
  label: t('Mirror'),
  icon: 'mirror',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const a = await ed.getPoint(t('First point of mirror line'));
    if (!a || a.option) return;
    const b = await ed.getPoint(t('Second point of mirror line'), {
      base: a,
      onMove: (p) => ed.renderer.setDragMatrix(dist(a, p) > 1e-12 ? M.mirror(a, p) : null),
    });
    ed.renderer.setDragMatrix(null);
    if (!b || b.option || dist(a, b) < 1e-12) return;
    const erase = await ed.getKeyword(t('Erase source objects?'), opts('Yes', 'No'), 'no');
    if (erase === null) return;
    transformAll(ed, ids, M.mirror(a, b), erase !== 'yes', t('Mirror'));
    ed.clearSelection();
  },
};

export const OFFSET = {
  name: 'OFFSET',
  aliases: ['O'],
  label: t('Offset'),
  icon: 'offset',
  async run(ed) {
    ed.clearSelection();
    const d = await ed.getDistance(t('Offset distance'), { default: ed.offsetDist ?? 'through', options: opts('Through') });
    if (d === null) return;
    const through = d === 'through' || d.option === 'through';
    if (!through) {
      if (!(d > 0)) {
        ed.ui.log(t('The offset distance must be greater than zero.'), 'error');
        return;
      }
      ed.offsetDist = d;
    } else ed.offsetDist = 'through';
    const filter = (e) => ['line', 'xline', 'ray', 'circle', 'arc', 'ellipse', 'polyline', 'spline'].includes(e.type);
    for (;;) {
      const pick = await ed.getEntity(t('Select object to offset (Enter to finish)'), { filter });
      if (!pick || pick.option) return;
      ed.setSelection([pick.id]);
      const ent = pick.ent;
      const side = await ed.getPoint(through ? t('Through point') : t('Point on side to offset'), {
        preview: (p) => {
          const dd = through ? distanceTo(ent, p) : d;
          if (!(dd > 0)) return [];
          try {
            const r = offsetEntity(ent, dd, p.x, p.y);
            return r ? (Array.isArray(r) ? r : [r]) : [];
          } catch {
            return [];
          }
        },
      });
      ed.clearSelection();
      if (!side || side.option) return;
      const dd = through ? distanceTo(ent, side) : d;
      let r = null;
      try {
        r = offsetEntity(ent, dd, side.x, side.y);
      } catch {
        r = null;
      }
      if (!r) {
        ed.ui.log(t('That object cannot be offset by this distance.'), 'error');
        continue;
      }
      ed.commit(t('Offset'), () => (Array.isArray(r) ? r : [r]).forEach((e) => ed.drawing.add(fresh(e))));
    }
  },
};

function distanceTo(ent, p) {
  try {
    const c = closestPoint(ent, p.x, p.y);
    return Math.hypot(c.x - p.x, c.y - p.y);
  } catch {
    return 0;
  }
}

/** Primitives of visible geometric entities overlapping a rectangle, excluding some ids. */
function cuttingPrims(ed, rect, exclude, onlyIds) {
  const out = [];
  const ids = onlyIds ?? ed.doc.index.search(rect[0], rect[1], rect[2], rect[3], true);
  for (const id of ids) {
    if (exclude && exclude.has(id)) continue;
    const e = ed.drawing.get(id);
    if (!e || !ed.drawing.layerVisible(e.layer)) continue;
    try {
      for (const p of toPrims(e)) out.push(p);
    } catch {
      /* not geometric */
    }
  }
  return out;
}

async function trimOrExtend(ed, extendFirst) {
  ed.clearSelection();
  let edges = null;
  // Steps made by this command, so Undo never reaches earlier work.
  let steps = 0;
  const filter = (e) => ['line', 'xline', 'ray', 'circle', 'arc', 'ellipse', 'polyline', 'spline'].includes(e.type);
  for (;;) {
    const verb = extendFirst ? 'extend' : 'trim';
    const pick = await ed.getEntity(t('Select object to {verb} (Shift to {other}, Enter to finish)', { verb: t(verb), other: t(extendFirst ? 'trim' : 'extend') }), {
      filter,
      options: [...opts('Edges', 'Undo'), { key: 'R', label: 'eRase', value: 'erase' }],
    });
    if (!pick) return;
    if (pick.option === 'edges') {
      ed.ui.log(t('Select the cutting or boundary edges, then press Enter. Press Enter right away to use every object.'), 'muted');
      const ids = await ed.getSelection(t('Select edges'), { fresh: true });
      edges = ids.length ? ids : null;
      ed.clearSelection();
      continue;
    }
    if (pick.option === 'undo') {
      if (steps > 0) {
        ed.drawing.undo();
        steps--;
      } else ed.ui.log(t('Nothing to undo in this command.'), 'muted');
      continue;
    }
    if (pick.option === 'erase') {
      const e = await ed.getEntity(t('Select object to erase'));
      if (e && !e.option) {
        ed.commit(t('Erase'), () => ed.drawing.remove(e.id));
        steps++;
      }
      continue;
    }
    const ent = pick.ent;
    const doExtend = extendFirst !== !!ed.shiftDown;
    if (doExtend) {
      const v = ed.camera.bounds();
      const prims = cuttingPrims(ed, v, new Set([pick.id]), edges);
      let r = null;
      try {
        r = extendEntity(ent, prims, pick.x, pick.y);
      } catch {
        r = null;
      }
      if (!r) ed.ui.log(t('No boundary in that direction.'), 'error');
      else {
        ed.commit(t('Extend'), () => ed.drawing.replace(pick.id, r));
        steps++;
      }
    } else {
      const b = ed.doc.index.bounds(pick.id) ?? ed.camera.bounds();
      const pad = (b[2] - b[0] + b[3] - b[1]) * 0.01 + 1e-9;
      const prims = cuttingPrims(ed, [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], new Set([pick.id]), edges);
      // A closed polyline can cut itself only through other objects; open ones may self-cut.
      let r = null;
      try {
        r = trimEntity(ent, prims, pick.x, pick.y);
      } catch (err) {
        console.warn(err);
        ed.ui.log(t('That object could not be trimmed.'), 'error');
        continue;
      }
      if (!r) {
        // Nothing crosses it: trimming removes it entirely, as an eraser would.
        ed.commit(t('Trim'), () => ed.drawing.remove(pick.id));
      } else {
        ed.commit(t('Trim'), () => {
          if (r.remove !== false) ed.drawing.remove(pick.id);
          for (const e of r.add || []) ed.drawing.add(fresh({ ...ent, ...e, id: undefined }));
        });
      }
      steps++;
    }
  }
}

export const TRIM = { name: 'TRIM', aliases: ['TR'], label: t('Trim'), icon: 'trim', run: (ed) => trimOrExtend(ed, false) };
export const EXTEND = { name: 'EXTEND', aliases: ['EX'], label: t('Extend'), icon: 'extend', run: (ed) => trimOrExtend(ed, true) };

async function filletOrChamfer(ed, isChamfer) {
  ed.clearSelection();
  // The kernel fillets lines and arcs, and chamfers lines.
  const filter = (e) => (isChamfer ? e.type === 'line' : e.type === 'line' || e.type === 'arc');
  let multiple = false;
  for (;;) {
    const r = isChamfer ? ed.chamferD ?? [0, 0] : ed.filletR ?? 0;
    const desc = isChamfer ? t('distances {a}, {b}', { a: r[0], b: r[1] }) : t('radius {v}', { v: r });
    const first = await ed.getEntity(t('Select first object (current {desc})', { desc }), {
      filter,
      options: isChamfer ? opts('Distance', 'Polyline', 'Multiple') : opts('Radius', 'Polyline', 'Multiple'),
    });
    if (!first) return;
    if (first.option === 'radius') {
      const v = await ed.getDistance(t('Fillet radius'), { default: r });
      if (typeof v === 'number' && v >= 0) ed.filletR = v;
      continue;
    }
    if (first.option === 'distance') {
      const d1 = await ed.getDistance(t('First chamfer distance'), { default: r[0] });
      if (typeof d1 !== 'number') continue;
      const d2 = await ed.getDistance(t('Second chamfer distance'), { default: d1 });
      if (typeof d2 !== 'number') continue;
      ed.chamferD = [d1, d2];
      continue;
    }
    if (first.option === 'multiple') {
      multiple = true;
      continue;
    }
    if (first.option === 'polyline') {
      const p = await ed.getEntity(t('Select 2D polyline'), { filter: (e) => e.type === 'polyline' });
      if (!p || p.option) continue;
      let out = null;
      try {
        out = isChamfer ? chamferPolyline(p.ent, r[0], r[1]) : filletPolyline(p.ent, r);
      } catch {
        out = null;
      }
      if (out) ed.commit(isChamfer ? t('Chamfer') : t('Fillet'), () => ed.drawing.replace(p.id, out));
      if (!multiple) return;
      continue;
    }
    ed.setSelection([first.id]);
    const second = await ed.getEntity(t('Select second object (Shift for a sharp corner)'), { filter: (e) => filter(e) });
    ed.clearSelection();
    if (!second || second.option) return;
    const sharp = !!ed.shiftDown;
    let res = null;
    try {
      if (isChamfer) res = chamfer(first.ent, first, second.ent, second, sharp ? 0 : r[0], sharp ? 0 : r[1]);
      else res = fillet(first.ent, first, second.ent, second, sharp ? 0 : r);
    } catch (err) {
      res = null;
      console.warn(err);
    }
    if (!res) {
      ed.ui.log(isChamfer ? t('Those objects cannot be chamfered.') : t('Those objects cannot be filleted with this radius.'), 'error');
    } else {
      ed.commit(isChamfer ? t('Chamfer') : t('Fillet'), () => {
        // A null side means that object shrank to nothing.
        if (res.e1) ed.drawing.replace(first.id, res.e1);
        else ed.drawing.remove(first.id);
        if (second.id !== first.id) {
          if (res.e2) ed.drawing.replace(second.id, res.e2);
          else ed.drawing.remove(second.id);
        }
        const extra = res.arc || res.line;
        if (extra) ed.drawing.add(fresh(extra));
      });
    }
    if (!multiple) return;
  }
}

export const FILLET = { name: 'FILLET', aliases: ['F'], label: t('Fillet'), icon: 'fillet', run: (ed) => filletOrChamfer(ed, false) };
export const CHAMFER = { name: 'CHAMFER', aliases: ['CHA'], label: t('Chamfer'), icon: 'chamfer', run: (ed) => filletOrChamfer(ed, true) };

export const ARRAYRECT = {
  name: 'ARRAYRECT',
  aliases: ['AR', 'ARRAY'],
  label: t('Rectangular array'),
  icon: 'array-rect',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const b = ids
      .map((id) => ed.doc.index.bounds(id))
      .filter(Boolean)
      .reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    const w = Number.isFinite(b[0]) ? (b[2] - b[0]) * 1.5 || 10 : 10,
      h = Number.isFinite(b[1]) ? (b[3] - b[1]) * 1.5 || 10 : 10;
    const c0 = await ed.getNumber(t('Number of columns'), { default: ed.arrCols ?? 4, min: 1, max: 10000 });
    if (!Number.isFinite(c0)) return;
    const r0 = await ed.getNumber(t('Number of rows'), { default: ed.arrRows ?? 3, min: 1, max: 10000 });
    if (!Number.isFinite(r0)) return;
    const cols = Math.max(1, Math.round(c0)),
      rows = Math.max(1, Math.round(r0));
    if (cols * rows * ids.length > 200000) {
      ed.ui.log(t('That array would create too many objects (limit 200,000).'), 'error');
      return;
    }
    const dx = await ed.getDistance(t('Distance between columns'), { default: ed.arrDx ?? w });
    if (typeof dx !== 'number') return;
    const dy = await ed.getDistance(t('Distance between rows'), { default: ed.arrDy ?? h });
    if (typeof dy !== 'number') return;
    Object.assign(ed, { arrCols: cols, arrRows: rows, arrDx: dx, arrDy: dy });
    ed.commit(t('Array'), () => {
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (!r && !c) continue;
          const m = M.translate(c * dx, r * dy);
          for (const id of ids) ed.drawing.add(fresh(transformEntity(ed.drawing.get(id), m)));
        }
    });
    ed.clearSelection();
  },
};

export const ARRAYPOLAR = {
  name: 'ARRAYPOLAR',
  aliases: ['ARP'],
  label: t('Polar array'),
  icon: 'array-polar',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const c = await ed.getPoint(t('Center point of array'));
    if (!c || c.option) return;
    const n0 = await ed.getNumber(t('Number of items'), { default: ed.polarItems ?? 6, min: 2, max: 10000 });
    if (!Number.isFinite(n0)) return;
    const n = Math.max(2, Math.round(n0));
    const fill = await ed.getAngle(t('Angle to fill (+ counter-clockwise, - clockwise)'), { default: TAU });
    if (typeof fill !== 'number') return;
    const rot = await ed.getKeyword(t('Rotate items as copied?'), opts('Yes', 'No'), 'yes');
    if (rot === null) return;
    ed.polarItems = n;
    const full = Math.abs(Math.abs(fill) - TAU) < 1e-9;
    const step = full ? fill / n : fill / (n - 1);
    ed.commit(t('Polar array'), () => {
      for (let i = 1; i < n; i++) {
        const a = step * i;
        let m = M.rotate(a, c.x, c.y);
        for (const id of ids) {
          const e = ed.drawing.get(id);
          if (rot === 'no') {
            // Move each object along the arc without turning it.
            const b = ed.doc.index.bounds(id);
            const ctr = b ? { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 } : c;
            const p = M.apply(m, ctr);
            ed.drawing.add(fresh(transformEntity(e, M.translate(p.x - ctr.x, p.y - ctr.y))));
          } else ed.drawing.add(fresh(transformEntity(e, m)));
        }
        m = null;
      }
    });
    ed.clearSelection();
  },
};

export const STRETCH = {
  name: 'STRETCH',
  aliases: ['S'],
  label: t('Stretch'),
  icon: 'stretch',
  async run(ed) {
    ed.clearSelection();
    const a = await ed.getPoint(t('First corner of crossing window'));
    if (!a || a.option) return;
    const b = await ed.getPoint(t('Opposite corner'), {
      base: a,
      rubber: false,
      noSnap: true,
      onMove: (p) => {
        const s1 = ed.camera.toScreen(a.x, a.y),
          s2 = ed.camera.toScreen(p.x, p.y);
        ed.window = { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, crossing: true };
      },
    });
    ed.window = null;
    if (!b || b.option) return;
    const rect = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
    const ids = ed.windowSelect(rect[0], rect[1], rect[2], rect[3], true);
    if (!ids.length) return;
    ed.setSelection(ids);
    const base = await ed.getPoint(t('Base point'));
    if (!base || base.option) return;
    const inside = (x, y) => x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3];
    const stretchAll = (dx, dy) => ids.map((id) => [id, stretchEntity(ed.drawing.get(id), inside, dx, dy)]);
    ed.renderer.setHidden(new Set(ids));
    const to = await ed.getPoint(t('Second point'), { base, preview: (p) => stretchAll(p.x - base.x, p.y - base.y).map((x) => x[1]) });
    ed.renderer.setHidden(new Set());
    if (!to || to.option) return;
    ed.commit(t('Stretch'), () => {
      for (const [id, e] of stretchAll(to.x - base.x, to.y - base.y)) ed.drawing.replace(id, e);
    });
    ed.clearSelection();
  },
};

/** Move the parts of an entity whose defining points lie inside the window. */
export function stretchEntity(e, inside, dx, dy) {
  const mv = (x, y) => (inside(x, y) ? [x + dx, y + dy] : [x, y]);
  switch (e.type) {
    case 'line': {
      const [x1, y1] = mv(e.x1, e.y1),
        [x2, y2] = mv(e.x2, e.y2);
      return { ...e, x1, y1, x2, y2 };
    }
    case 'polyline': {
      const p = e.pts.slice();
      for (let i = 0; i < p.length; i += 3) [p[i], p[i + 1]] = mv(p[i], p[i + 1]);
      return { ...e, pts: p };
    }
    case 'arc': {
      const s = { x: e.cx + e.r * Math.cos(e.start), y: e.cy + e.r * Math.sin(e.start) };
      const end = { x: e.cx + e.r * Math.cos(e.end), y: e.cy + e.r * Math.sin(e.end) };
      if (inside(s.x, s.y) && inside(end.x, end.y)) return transformEntity(e, M.translate(dx, dy));
      return e;
    }
    case 'dimension': {
      const [x1, y1] = mv(e.x1, e.y1),
        [x2, y2] = mv(e.x2, e.y2);
      const moved = inside(e.x1, e.y1) && inside(e.x2, e.y2);
      return { ...e, x1, y1, x2, y2, ...(moved ? { lx: e.lx + dx, ly: e.ly + dy } : {}) };
    }
    case 'leader': {
      const p = e.pts.slice();
      for (let i = 0; i < p.length; i += 2) [p[i], p[i + 1]] = mv(p[i], p[i + 1]);
      return { ...e, pts: p };
    }
    case 'spline': {
      const ctrl = e.ctrl.slice();
      for (let i = 0; i < ctrl.length; i += 2) [ctrl[i], ctrl[i + 1]] = mv(ctrl[i], ctrl[i + 1]);
      const fit = (e.fit || []).slice();
      for (let i = 0; i < fit.length; i += 2) [fit[i], fit[i + 1]] = mv(fit[i], fit[i + 1]);
      // A spline defined by fit points is rebuilt through them so curve and data agree.
      if (fit.length >= 4) {
        const s = splineFromFitPoints(fit, e.closed);
        if (s) return { ...e, ...s, fit };
      }
      return { ...e, ctrl, fit };
    }
    default: {
      // Objects with a single reference point move when it is inside.
      const ref = refPoint(e);
      if (ref && inside(ref.x, ref.y)) return transformEntity(e, M.translate(dx, dy));
      return e;
    }
  }
}

function refPoint(e) {
  if (e.cx !== undefined) return { x: e.cx, y: e.cy };
  if (e.x !== undefined) return { x: e.x, y: e.y };
  if (e.type === 'hatch' && e.loops?.[0]) return { x: e.loops[0][0], y: e.loops[0][1] };
  return null;
}

export const BREAK = {
  name: 'BREAK',
  aliases: ['BR'],
  label: t('Break'),
  icon: 'break',
  async run(ed) {
    ed.clearSelection();
    const filter = (e) => ['line', 'xline', 'ray', 'circle', 'arc', 'ellipse', 'polyline'].includes(e.type);
    const pick = await ed.getEntity(t('Select object (the pick point is the first break point)'), { filter });
    if (!pick || pick.option) return;
    ed.setSelection([pick.id]);
    let p1 = { x: pick.x, y: pick.y };
    let p2 = await ed.getPoint(t('Second break point'), { options: opts('First point') });
    if (!p2) return;
    if (p2.option) {
      p1 = await ed.getPoint(t('First break point'));
      if (!p1 || p1.option) return;
      p2 = await ed.getPoint(t('Second break point'), { base: p1 });
      if (!p2 || p2.option) return;
    }
    ed.clearSelection();
    let out = null;
    try {
      const c1 = closestPoint(pick.ent, p1.x, p1.y),
        c2 = closestPoint(pick.ent, p2.x, p2.y);
      out = breakEntity(pick.ent, c1.x, c1.y, c2.x, c2.y);
    } catch {
      out = null;
    }
    if (!out) return ed.ui.log(t('That object cannot be broken there.'), 'error');
    ed.commit(t('Break'), () => {
      ed.drawing.remove(pick.id);
      for (const e of out) ed.drawing.add(fresh({ ...pick.ent, ...e, id: undefined }));
    });
  },
};

export const BREAKATPOINT = {
  name: 'BREAKATPOINT',
  aliases: ['BAP'],
  label: t('Break at point'),
  icon: 'break-point',
  async run(ed) {
    ed.clearSelection();
    const filter = (e) => ['line', 'arc', 'ellipse', 'polyline', 'spline'].includes(e.type);
    const pick = await ed.getEntity(t('Select object to break'), { filter });
    if (!pick || pick.option) return;
    ed.setSelection([pick.id]);
    const p = await ed.getPoint(t('Break point'));
    ed.clearSelection();
    if (!p || p.option) return;
    let out = null;
    try {
      const c = closestPoint(pick.ent, p.x, p.y);
      out = breakAtPoint(pick.ent, c.x, c.y);
    } catch {
      out = null;
    }
    if (!out || !out.length) return ed.ui.log(t('That object cannot be broken there.'), 'error');
    ed.commit(t('Break at point'), () => {
      ed.drawing.remove(pick.id);
      for (const e of out) ed.drawing.add(fresh({ ...pick.ent, ...e, id: undefined }));
    });
  },
};

export const JOIN = {
  name: 'JOIN',
  aliases: ['J'],
  label: t('Join'),
  icon: 'join',
  async run(ed) {
    const ids = await ed.getSelection(t('Select objects to join'));
    if (ids.length < 2) {
      if (ids.length) ed.ui.log(t('Select at least two objects to join.'), 'error');
      return;
    }
    const ents = ids.map((id) => ed.drawing.get(id));
    let res;
    try {
      res = joinEntities(ents, 1e-6 * Math.max(1, ...ents.map((e) => Math.abs(e.x1 ?? e.cx ?? 1))));
    } catch (err) {
      console.warn(err);
      res = null;
    }
    if (!res || !res.consumedIds?.length) {
      ed.ui.log(t('Nothing could be joined. Objects must touch end to end.'), 'error');
      return;
    }
    ed.commit(t('Join'), () => {
      for (const id of res.consumedIds) ed.drawing.remove(id);
      for (const e of res.result) ed.drawing.add(fresh(e));
    });
    ed.clearSelection();
    ed.ui.log(t('{consumed} objects joined into {result}', { consumed: res.consumedIds.length, result: res.result.length }), 'muted');
  },
};

/** Plain entities that an entity breaks into, or null if it cannot be exploded. */
export function explodeOne(ed, e) {
  const d = ed.drawing;
  switch (e.type) {
    case 'polyline':
      return explodePolyline(e);
    case 'insert': {
      const block = d.blocks.get(e.name);
      if (!block) return null;
      const m = insertMatrix(e, block);
      return block.entities.map((sub) => {
        const te = transformEntity(sub, m);
        return {
          ...te,
          layer: sub.layer === '0' ? e.layer : sub.layer,
          color: sub.color === COLOR_BYBLOCK ? e.color : sub.color,
          lineweight: sub.lineweight === LW_BYBLOCK ? e.lineweight : sub.lineweight,
          linetype: sub.linetype === 'ByBlock' ? e.linetype : sub.linetype,
        };
      });
    }
    case 'dimension':
    case 'leader': {
      const ds = d.dimStyles.get(e.style) ?? d.dimStyles.get('Standard');
      const g = e.type === 'leader' ? buildLeader(e, ds, d.header) : buildDimension(e, ds, d.header);
      if (!g) return null;
      const out = [];
      const base = { layer: e.layer, color: e.color, linetype: 'ByLayer', lineweight: e.lineweight, ltscale: 1 };
      for (const l of g.lines) {
        const pts = [];
        for (let i = 0; i < l.pts.length; i += 2) pts.push(l.pts[i], l.pts[i + 1], 0);
        if (l.pts.length === 4 && !l.closed) out.push({ ...base, type: 'line', x1: l.pts[0], y1: l.pts[1], x2: l.pts[2], y2: l.pts[3] });
        else out.push({ ...base, type: 'polyline', pts, closed: !!l.closed, width: 0 });
      }
      for (const f of g.fills) out.push({ ...base, type: 'hatch', pattern: 'SOLID', scale: 1, angle: 0, loops: f.map((r) => ringToLoop(r)) });
      if (g.text && g.text.value) out.push({ ...base, type: 'text', widthFactor: 1, oblique: 0, style: ds.textStyle, ...g.text });
      return out;
    }
    case 'mtext': {
      const lines = String(e.value).split('\n');
      const pitch = e.h * 1.6667 * (e.lineSpacing || 1);
      return lines.map((v, i) => ({
        ...e,
        type: 'text',
        value: v,
        x: e.x + Math.sin(e.rot || 0) * (pitch * i + e.h),
        y: e.y - Math.cos(e.rot || 0) * (pitch * i + e.h),
        halign: 'left',
        valign: 'baseline',
        widthFactor: 1,
        oblique: 0,
      }));
    }
    case 'hatch':
      return (e.loops || []).map((l) => ({
        type: 'polyline',
        layer: e.layer,
        color: e.color,
        linetype: e.linetype,
        lineweight: e.lineweight,
        ltscale: e.ltscale ?? 1,
        pts: l.slice(),
        closed: true,
        width: 0,
      }));
  }
  return null;
}

function ringToLoop(r) {
  const out = [];
  for (let i = 0; i < r.length; i += 2) out.push(r[i], r[i + 1], 0);
  return out;
}

export const EXPLODE = {
  name: 'EXPLODE',
  aliases: ['X'],
  label: t('Explode'),
  icon: 'explode',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    let count = 0;
    ed.commit(t('Explode'), () => {
      for (const id of ids) {
        const e = ed.drawing.get(id);
        const parts = explodeOne(ed, e);
        if (!parts) continue;
        ed.drawing.remove(id);
        for (const p of parts) ed.drawing.add(fresh(p));
        count++;
      }
    });
    ed.clearSelection();
    if (!count) ed.ui.log(t('None of the selected objects can be exploded.'), 'error');
    else ed.ui.log(t('{n} object{s} exploded', { n: count, s: count === 1 ? '' : 's' }), 'muted');
  },
};

export const LENGTHEN = {
  name: 'LENGTHEN',
  aliases: ['LEN'],
  label: t('Lengthen'),
  icon: 'lengthen',
  async run(ed) {
    ed.clearSelection();
    const mode = await ed.getKeyword(t('Measure'), [...opts('Delta', 'Total', 'Percent')], ed.lenMode ?? 'delta');
    if (!mode) return;
    ed.lenMode = mode;
    const label = { delta: t('Length to add (negative to shorten)'), total: t('Total length'), percent: t('Percent of current length') }[mode];
    const v = await ed.getDistance(label, { default: ed.lenValue?.[mode] ?? (mode === 'percent' ? 100 : 1) });
    if (typeof v !== 'number') return;
    ed.lenValue = { ...(ed.lenValue || {}), [mode]: v };
    for (;;) {
      const pick = await ed.getEntity(t('Select an end to change (Enter to finish)'), { filter: (e) => e.type === 'line' || e.type === 'arc' });
      if (!pick || pick.option) return;
      const e = pick.ent;
      const len = lengthOf(e);
      const target = mode === 'delta' ? len + v : mode === 'total' ? v : (len * v) / 100;
      if (!(target > 1e-12)) {
        ed.ui.log(t('The new length must be greater than zero.'), 'error');
        continue;
      }
      let next;
      if (e.type === 'line') {
        const nearStart = Math.hypot(pick.x - e.x1, pick.y - e.y1) < Math.hypot(pick.x - e.x2, pick.y - e.y2);
        const ux = (e.x2 - e.x1) / len,
          uy = (e.y2 - e.y1) / len;
        next = nearStart ? { ...e, x1: e.x2 - ux * target, y1: e.y2 - uy * target } : { ...e, x2: e.x1 + ux * target, y2: e.y1 + uy * target };
      } else {
        const sweep = target / e.r;
        if (sweep >= TAU) {
          ed.ui.log(t('That length would close the arc.'), 'error');
          continue;
        }
        const ps = { x: e.cx + e.r * Math.cos(e.start), y: e.cy + e.r * Math.sin(e.start) };
        const pe = { x: e.cx + e.r * Math.cos(e.end), y: e.cy + e.r * Math.sin(e.end) };
        const nearStart = dist(pick, ps) < dist(pick, pe);
        next = nearStart ? { ...e, start: norm(e.end - sweep) } : { ...e, end: norm(e.start + sweep) };
      }
      ed.commit(t('Lengthen'), () => ed.drawing.replace(pick.id, next));
    }
  },
};

export const MATCHPROP = {
  name: 'MATCHPROP',
  aliases: ['MA', 'PAINTER'],
  label: t('Match properties'),
  icon: 'match-props',
  async run(ed) {
    ed.clearSelection();
    const src = await ed.getEntity(t('Select source object'));
    if (!src || src.option) return;
    const s = src.ent;
    ed.setSelection([src.id]);
    for (;;) {
      const dst = await ed.getEntity(t('Select destination object (Enter to finish)'));
      if (!dst || dst.option) break;
      const patch = { layer: s.layer, color: s.color, linetype: s.linetype, lineweight: s.lineweight, ltscale: s.ltscale ?? 1 };
      const d = dst.ent;
      if ((d.type === 'text' || d.type === 'mtext') && (s.type === 'text' || s.type === 'mtext')) Object.assign(patch, { h: s.h, style: s.style });
      if (d.type === 'dimension' && s.type === 'dimension') patch.style = s.style;
      if (d.type === 'hatch' && s.type === 'hatch') Object.assign(patch, { pattern: s.pattern, scale: s.scale, angle: s.angle });
      ed.commit(t('Match properties'), () => ed.drawing.update(dst.id, patch));
    }
    ed.clearSelection();
  },
};

export const DRAWORDER = {
  name: 'DRAWORDER',
  aliases: ['DR'],
  label: t('Draw order'),
  icon: 'draw-order',
  async run(ed, args) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    const where = args?.where ?? (await ed.getKeyword(t('Draw order'), [{ key: 'F', label: 'Front', value: 'front' }, { key: 'B', label: 'Back', value: 'back' }], 'front'));
    if (!where) return;
    ed.commit(t('Draw order'), () => ed.drawing.reorder(ids, where === 'front'));
    ed.clearSelection();
  },
};

export const ALIGNCMD = {
  name: 'ALIGN',
  aliases: ['AL'],
  label: t('Align'),
  icon: 'align',
  async run(ed) {
    const ids = await ed.getSelection();
    if (!ids.length) return;
    showSelection(ed, ids);
    const s1 = await ed.getPoint(t('First source point'));
    if (!s1 || s1.option) return;
    const d1 = await ed.getPoint(t('First destination point'), { base: s1 });
    if (!d1 || d1.option) return;
    const s2 = await ed.getPoint(t('Second source point (Enter to only move)'));
    if (!s2 || s2.option) {
      transformAll(ed, ids, M.translate(d1.x - s1.x, d1.y - s1.y), false, t('Align'));
      ed.clearSelection();
      return;
    }
    const d2 = await ed.getPoint(t('Second destination point'), { base: s2 });
    if (!d2 || d2.option) return;
    const scale = await ed.getKeyword(t('Scale objects to the alignment points?'), opts('Yes', 'No'), 'no');
    if (scale === null) return;
    const a = angleOf(d1, d2) - angleOf(s1, s2);
    let m = mulMatrix(M.rotate(a, d1.x, d1.y), M.translate(d1.x - s1.x, d1.y - s1.y));
    if (scale === 'yes') {
      const k = dist(d1, d2) / Math.max(1e-12, dist(s1, s2));
      m = mulMatrix(M.scale(k, d1.x, d1.y), m);
    }
    transformAll(ed, ids, m, false, t('Align'));
    ed.clearSelection();
  },
};
