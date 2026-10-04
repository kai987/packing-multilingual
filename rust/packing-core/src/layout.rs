use crate::{LAYER_SEPARATOR_HEIGHT, model::*};

#[derive(Clone)]
pub struct Row {
    pub y: f64,
    pub depth: f64,
    pub cursor: f64,
}
#[derive(Clone)]
pub struct Frame {
    pub z: f64,
    pub height: f64,
    pub rows: Vec<Row>,
}
#[derive(Clone, Copy)]
struct Orientation {
    size: Dimensions,
    product_size: Dimensions,
}
#[derive(Clone, Copy)]
enum Mode {
    ExistingRow,
    NewRow,
    NewLayer,
}
struct Candidate {
    mode: Mode,
    layer: usize,
    row: usize,
    x: f64,
    y: f64,
    z: f64,
    orientation: Orientation,
    score: f64,
    depth_delta: f64,
}
struct Tuning {
    layer: f64,
    footprint: f64,
    length: f64,
    width: f64,
    slack: f64,
    depth: f64,
    new_row: f64,
    new_layer: f64,
    same_layer: f64,
    same_row: f64,
    mixed: f64,
}

fn tuning(strategy: Strategy) -> Tuning {
    if strategy == Strategy::Stable {
        Tuning {
            layer: 180_000.0,
            footprint: 9.0,
            length: 10.0,
            width: 14.0,
            slack: 6.0,
            depth: 36.0,
            new_row: 150_000.0,
            new_layer: 600_000.0,
            same_layer: 8_500.0,
            same_row: 5_000.0,
            mixed: 4_200.0,
        }
    } else {
        Tuning {
            layer: 150_000.0,
            footprint: 7.0,
            length: 14.0,
            width: 18.0,
            slack: 8.0,
            depth: 20.0,
            new_row: 120_000.0,
            new_layer: 520_000.0,
            same_layer: 6_500.0,
            same_row: 3_500.0,
            mixed: 2_400.0,
        }
    }
}

fn fragility_penalty(fragility: Fragility, size: Dimensions, strategy: Strategy) -> f64 {
    let (vertical, flat, footprint) = if strategy == Strategy::Compact {
        (11.0, 14.0, 0.05)
    } else {
        (9.0, 16.0, 0.07)
    };
    let deficit = (size.length.max(size.width) - size.height).max(0.0);
    deficit * flat * fragility.rank() + size.length * size.width * footprint
        - size.height * vertical
}

fn support_penalty(fragility: Fragility, layer: usize, strategy: Strategy) -> f64 {
    let compact = strategy == Strategy::Compact;
    match fragility {
        Fragility::High if layer == 0 => {
            if compact {
                135_000.0
            } else {
                260_000.0
            }
        }
        Fragility::High => {
            if compact {
                20_000.0
            } else {
                8_000.0
            }
        }
        Fragility::Medium => layer as f64 * if compact { 45_000.0 } else { 65_000.0 },
        Fragility::Low => layer as f64 * if compact { 80_000.0 } else { 110_000.0 },
    }
}

fn orientations(unit: &Unit, strategy: Strategy) -> Vec<Orientation> {
    let outer = [unit.size.length, unit.size.width, unit.size.height];
    let core = [
        unit.product_size.length,
        unit.product_size.width,
        unit.product_size.height,
    ];
    let mut options: Vec<Orientation> = Vec::new();
    for [l, w, h] in [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0],
    ] {
        let option = Orientation {
            size: Dimensions {
                length: outer[l],
                width: outer[w],
                height: outer[h],
            },
            product_size: Dimensions {
                length: core[l],
                width: core[w],
                height: core[h],
            },
        };
        if let Some(index) = options.iter().position(|other| other.size == option.size) {
            options[index] = option;
        } else {
            options.push(option);
        }
    }
    options.sort_by(|a, b| {
        number_cmp(
            fragility_penalty(unit.product.fragility, a.size, strategy),
            fragility_penalty(unit.product.fragility, b.size, strategy),
        )
        .then_with(|| number_cmp(b.size.height, a.size.height))
        .then_with(|| number_cmp(a.size.length * a.size.width, b.size.length * b.size.width))
    });
    options
}

fn area(placements: &[Placement], layer: usize) -> f64 {
    placements
        .iter()
        .filter(|p| p.layer_index == layer)
        .map(|p| p.size.length * p.size.width)
        .sum()
}

fn supported(placements: &[Placement], layer: usize, x: f64, y: f64, size: Dimensions) -> bool {
    if layer == 0 {
        return true;
    }
    let footprint = size.length * size.width;
    let covered: f64 = placements
        .iter()
        .filter(|p| p.layer_index == layer - 1)
        .map(|p| {
            let length = ((x + size.length).min(p.x + p.size.length) - x.max(p.x)).max(0.0);
            let width = ((y + size.width).min(p.y + p.size.width) - y.max(p.y)).max(0.0);
            length * width
        })
        .sum();
    covered / footprint >= 0.72 && area(placements, layer - 1) > area(placements, layer) + footprint
}

fn choose(best: &mut Option<Candidate>, next: Candidate) {
    if best
        .as_ref()
        .is_none_or(|current| next.score < current.score)
    {
        *best = Some(next);
    }
}

fn candidate(
    unit: &Unit,
    layers: &[Frame],
    placements: &[Placement],
    bounds: Dimensions,
    strategy: Strategy,
    new_layer: bool,
    max_layers: usize,
) -> Option<Candidate> {
    let t = tuning(strategy);
    let mut best = None;
    for orientation in orientations(unit, strategy) {
        let size = orientation.size;
        // Preserve the TS orientation-first tie order.
        let mut orientation_best = None;
        for (layer_index, layer) in layers.iter().enumerate() {
            if size.height != layer.height {
                continue;
            }
            let layer_items: Vec<_> = placements
                .iter()
                .filter(|p| p.layer_index == layer_index)
                .collect();
            let same_layer = layer_items
                .iter()
                .filter(|p| p.product_id == unit.product.id)
                .count();
            let mixed = if !layer_items.is_empty() && same_layer == 0 {
                t.mixed
            } else {
                0.0
            };
            let base = layer_index as f64 * t.layer
                + if layer_index == 0 {
                    0.0
                } else {
                    size.length * size.width * t.footprint
                };
            for (row_index, row) in layer.rows.iter().enumerate() {
                let same_row = layer_items
                    .iter()
                    .filter(|p| p.row_index == row_index && p.product_id == unit.product.id)
                    .count();
                let delta = (size.width - row.depth).max(0.0);
                let used_width: f64 = layer.rows.iter().map(|r| r.depth).sum::<f64>() + delta;
                if used_width <= bounds.width
                    && row.cursor + size.length <= bounds.length
                    && supported(placements, layer_index, row.cursor, row.y, size)
                {
                    let remaining = bounds.length - (row.cursor + size.length);
                    let slack = row.depth.max(size.width) - size.width;
                    let score = base
                        + remaining * t.length
                        + slack * t.slack
                        + row.y * 2.0
                        + delta * t.depth
                        + mixed
                        - (same_layer as f64 * t.same_layer + same_row as f64 * t.same_row)
                        + support_penalty(unit.product.fragility, layer_index, strategy)
                        + fragility_penalty(unit.product.fragility, size, strategy);
                    choose(
                        &mut orientation_best,
                        Candidate {
                            mode: Mode::ExistingRow,
                            layer: layer_index,
                            row: row_index,
                            x: row.cursor,
                            y: row.y,
                            z: layer.z,
                            orientation,
                            score,
                            depth_delta: delta,
                        },
                    );
                }
            }
            let used_width: f64 = layer.rows.iter().map(|r| r.depth).sum();
            if used_width + size.width <= bounds.width
                && size.length <= bounds.length
                && supported(placements, layer_index, 0.0, used_width, size)
            {
                let score = base
                    + t.new_row
                    + (bounds.width - (used_width + size.width)) * t.width
                    + (bounds.length - size.length) * t.length
                    + used_width * 4.0
                    + mixed
                    - same_layer as f64 * t.same_layer
                    + support_penalty(unit.product.fragility, layer_index, strategy)
                    + fragility_penalty(unit.product.fragility, size, strategy);
                choose(
                    &mut orientation_best,
                    Candidate {
                        mode: Mode::NewRow,
                        layer: layer_index,
                        row: layer.rows.len(),
                        x: 0.0,
                        y: used_width,
                        z: layer.z,
                        orientation,
                        score,
                        depth_delta: 0.0,
                    },
                );
            }
        }
        let next_z = layers
            .last()
            .map_or(0.0, |l| l.z + l.height + LAYER_SEPARATOR_HEIGHT);
        let layer_index = layers.len();
        if new_layer
            && layer_index < max_layers
            && next_z + size.height <= bounds.height
            && size.length <= bounds.length
            && size.width <= bounds.width
            && supported(placements, layer_index, 0.0, 0.0, size)
        {
            let score = layer_index as f64 * t.layer
                + if layer_index == 0 {
                    0.0
                } else {
                    size.length * size.width * t.footprint
                }
                + t.new_layer
                + (bounds.width - size.width) * t.width
                + (bounds.length - size.length) * t.length
                + support_penalty(unit.product.fragility, layer_index, strategy)
                + fragility_penalty(unit.product.fragility, size, strategy);
            choose(
                &mut orientation_best,
                Candidate {
                    mode: Mode::NewLayer,
                    layer: layer_index,
                    row: 0,
                    x: 0.0,
                    y: 0.0,
                    z: next_z,
                    orientation,
                    score,
                    depth_delta: 0.0,
                },
            );
        }
        if let Some(next) = orientation_best {
            choose(&mut best, next);
        }
    }
    best
}

pub fn pack(
    units: &[std::sync::Arc<Unit>],
    bounds: Dimensions,
    strategy: Strategy,
    max_layers: usize,
) -> Option<(Vec<Placement>, Vec<Layer>)> {
    let mut layers: Vec<Frame> = Vec::new();
    let mut placements: Vec<Placement> = Vec::new();
    for unit in units {
        let c = candidate(
            unit,
            &layers,
            &placements,
            bounds,
            strategy,
            false,
            max_layers,
        )
        .or_else(|| {
            candidate(
                unit,
                &layers,
                &placements,
                bounds,
                strategy,
                true,
                max_layers,
            )
        })?;
        let size = c.orientation.size;
        match c.mode {
            Mode::NewLayer => layers.push(Frame {
                z: c.z,
                height: size.height,
                rows: vec![Row {
                    y: 0.0,
                    depth: size.width,
                    cursor: size.length,
                }],
            }),
            Mode::NewRow => layers[c.layer].rows.push(Row {
                y: c.y,
                depth: size.width,
                cursor: size.length,
            }),
            Mode::ExistingRow => {
                if c.depth_delta > 0.0 {
                    layers[c.layer].rows[c.row].depth += c.depth_delta;
                    for row in layers[c.layer].rows.iter_mut().skip(c.row + 1) {
                        row.y += c.depth_delta;
                    }
                    for p in &mut placements {
                        if p.layer_index == c.layer && p.row_index > c.row {
                            p.y += c.depth_delta;
                        }
                    }
                }
                layers[c.layer].rows[c.row].cursor += size.length;
            }
        }
        let product = &unit.product;
        placements.push(Placement {
            instance_id: unit.instance_id.clone(),
            product_id: product.id.clone(),
            brand: product.brand.clone(),
            name: product.name.clone(),
            category: product.category.clone(),
            color: product.color.clone(),
            use_item_wrap: unit.use_item_wrap,
            x: c.x,
            y: c.y,
            z: c.z,
            size,
            product_size: c.orientation.product_size,
            weight: product.weight,
            layer_index: c.layer,
            row_index: c.row,
        });
    }
    let length = placements
        .iter()
        .fold(0.0_f64, |max, p| max.max(p.x + p.size.length));
    let width = placements
        .iter()
        .fold(0.0_f64, |max, p| max.max(p.y + p.size.width));
    let x = ((bounds.length - length) / 2.0).max(0.0);
    let y = ((bounds.width - width) / 2.0).max(0.0);
    for p in &mut placements {
        p.x += x;
        p.y += y;
    }
    Some((
        placements,
        layers
            .iter()
            .enumerate()
            .map(|(index, l)| Layer {
                index,
                z: l.z,
                height: l.height,
            })
            .collect(),
    ))
}

pub fn stability(
    cushion: &Cushion,
    bounds: Dimensions,
    placements: &[Placement],
    layer_count: usize,
    weight: f64,
) -> f64 {
    let center = placements
        .iter()
        .map(|p| p.weight * ((p.z + p.size.height / 2.0) / bounds.height))
        .sum::<f64>()
        / weight;
    let lower = placements
        .iter()
        .filter(|p| p.z + p.size.height / 2.0 <= bounds.height / 2.0)
        .map(|p| p.weight)
        .sum::<f64>()
        / weight;
    let fill = placements.iter().map(|p| p.size.volume()).sum::<f64>() / bounds.volume();
    js_round(
        58.0 + cushion.stability_bonus + lower * 18.0
            - center * 22.0
            - layer_count.saturating_sub(1) as f64 * 5.0
            - ((0.58 - fill) * 42.0).max(0.0),
    )
    .clamp(1.0, 99.0)
}

pub fn void_volume(
    bounds: Dimensions,
    placements: &[Placement],
    layers: &[Layer],
    top_fill: f64,
) -> f64 {
    let mut volumes = Vec::new();
    let mut sorted_layers: Vec<_> = layers.iter().collect();
    sorted_layers.sort_by_key(|l| l.index);
    for layer in &sorted_layers {
        let mut items: Vec<_> = placements
            .iter()
            .filter(|p| p.layer_index == layer.index)
            .collect();
        items.sort_by(|a, b| {
            a.row_index
                .cmp(&b.row_index)
                .then_with(|| number_cmp(a.x, b.x))
        });
        let mut rows: indexmap::IndexMap<usize, (f64, f64, Vec<&Placement>)> =
            indexmap::IndexMap::new();
        for p in items {
            let row = rows
                .entry(p.row_index)
                .or_insert((p.y, p.size.width, Vec::new()));
            row.1 = row.1.max(p.size.width);
            row.2.push(p);
        }
        let mut rows: Vec<_> = rows.into_values().collect();
        rows.sort_by(|a, b| number_cmp(a.0, b.0));
        for (y, depth, items) in &mut rows {
            let mut cursor = 0.0;
            items.sort_by(|a, b| number_cmp(a.x, b.x));
            for p in items.iter() {
                if p.x > cursor {
                    volumes.push((p.x - cursor) * *depth * layer.height);
                }
                if p.size.width < *depth {
                    volumes.push(p.size.length * (*depth - p.size.width) * layer.height);
                }
                cursor = p.x + p.size.length;
            }
            if cursor < bounds.length {
                volumes.push((bounds.length - cursor) * *depth * layer.height);
            }
            let _ = y;
        }
        let mut cursor = 0.0_f64;
        for (y, depth, _) in &rows {
            if *y > cursor {
                volumes.push(bounds.length * (*y - cursor) * layer.height);
            }
            cursor = cursor.max(y + depth);
        }
        if cursor < bounds.width {
            volumes.push(bounds.length * (bounds.width - cursor) * layer.height);
        }
    }
    let used = sorted_layers
        .iter()
        .fold(0.0_f64, |max, l| max.max(l.z + l.height));
    let fill = top_fill.min((bounds.height - used).max(0.0));
    if fill > 0.0 {
        volumes.push(bounds.length * bounds.width * fill);
    }
    volumes.into_iter().filter(|v| *v > 0.0).sum()
}
