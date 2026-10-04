use crate::{LAYER_SEPARATOR_HEIGHT, layout, model::*};
use std::sync::Arc;

pub fn expand_units(request: &Request) -> Units {
    let mut units = Vec::new();
    for line in &request.order_lines {
        let product = Arc::new(
            request
                .products
                .iter()
                .find(|p| p.id == line.product_id)
                .unwrap()
                .clone(),
        );
        for index in 0..line.quantity as usize {
            units.push(Arc::new(Unit {
                instance_id: format!("{}-{}", product.id, index + 1),
                product: product.clone(),
                size: product.size,
                product_size: product.size,
                use_item_wrap: line.use_item_wrap,
            }));
        }
    }
    units.sort_by(|a, b| {
        number_cmp(b.size.max_face(), a.size.max_face())
            .then_with(|| number_cmp(b.size.volume(), a.size.volume()))
            .then_with(|| number_cmp(b.product.weight, a.product.weight))
            .then_with(|| a.product.fragility.cmp(&b.product.fragility))
    });
    units
}

pub fn unit_volume(units: &[Arc<Unit>]) -> f64 {
    units.iter().map(|u| u.size.volume()).sum()
}
pub fn unit_weight(units: &[Arc<Unit>]) -> f64 {
    units.iter().map(|u| u.product.weight).sum()
}

pub fn score_profile(strategy: Strategy) -> (f64, f64, f64, f64) {
    if strategy == Strategy::Stable {
        (54.0, 0.55, 0.3, 4.0)
    } else {
        (78.0, 0.2, 0.82, 1.0)
    }
}

pub fn single(units: &[Arc<Unit>], request: &Request) -> Vec<Recommendation> {
    if units.is_empty() {
        return Vec::new();
    }
    let strategy = request.strategy;
    let max_layers = request.max_layers.unwrap_or(2.0) as usize;
    let fragility = units.iter().map(|u| u.product.fragility).max().unwrap();
    let item_volume = unit_volume(units);
    let weight = unit_weight(units);
    let mut recommendations = Vec::new();
    for carton in &request.cartons {
        if carton.max_load_weight_grams.is_some_and(|max| weight > max) {
            continue;
        }
        for cushion in &request.cushions {
            let packaged: Units = units
                .iter()
                .map(|u| {
                    if !u.use_item_wrap {
                        return u.clone();
                    }
                    let padding = cushion.item_wrap_thickness * 2.0;
                    Arc::new(Unit {
                        size: Dimensions {
                            length: u.size.length + padding,
                            width: u.size.width + padding,
                            height: u.size.height + padding,
                        },
                        ..(**u).clone()
                    })
                })
                .collect();
            let packaged_volume = unit_volume(&packaged);
            let bottom = cushion.bottom_padding
                + if weight > 4500.0 {
                    8.0
                } else if weight > 3000.0 {
                    6.0
                } else if weight > 1800.0 {
                    4.0
                } else if weight > 700.0 {
                    2.0
                } else {
                    0.0
                };
            let bounds = Dimensions {
                length: carton.inner.length - cushion.side_padding * 2.0,
                width: carton.inner.width - cushion.side_padding * 2.0,
                height: carton.inner.height - cushion.top_padding - bottom,
            };
            if !bounds.valid() || packaged_volume > bounds.volume() {
                continue;
            }
            let top_fill = (if strategy == Strategy::Compact {
                12.0_f64
            } else {
                18.0
            } + if weight > 4000.0 {
                8.0
            } else if weight > 2500.0 {
                4.0
            } else {
                0.0
            } + match fragility {
                Fragility::High => 6.0,
                Fragility::Medium => 3.0,
                Fragility::Low => 0.0,
            })
            .max(cushion.top_padding);
            let Some((placements, layers)) = layout::pack(&packaged, bounds, strategy, max_layers)
            else {
                continue;
            };
            let separator_volume = layers.len().saturating_sub(1) as f64
                * bounds.length
                * bounds.width
                * LAYER_SEPARATOR_HEIGHT;
            let empty = (bounds.volume() - packaged_volume - separator_volume).max(0.0);
            let used = placements
                .iter()
                .fold(0.0_f64, |max, p| max.max(p.z + p.size.height));
            let top_empty = (bounds.height - used).max(0.0);
            let applied_top = top_fill.min(top_empty);
            let void_volume = layout::void_volume(bounds, &placements, &layers, applied_top);
            let stability = layout::stability(cushion, bounds, &placements, layers.len(), weight);
            let effective_fill = item_volume / bounds.volume();
            let mut protection = 0.0_f64;
            if strategy == Strategy::Compact && weight <= 2500.0 {
                protection = if cushion.stability_bonus >= 15.0 {
                    4.0
                } else if cushion.stability_bonus >= 10.0 {
                    1.0
                } else {
                    0.0
                };
                if fragility == Fragility::High {
                    protection = (protection - 1.0).max(0.0);
                }
            }
            let (fill_score, stability_score, empty_penalty, layer_penalty) =
                score_profile(strategy);
            let score = js_round(
                effective_fill * fill_score + stability * stability_score
                    - (empty / 1_000_000.0) * empty_penalty
                    - layers.len().saturating_sub(1) as f64 * layer_penalty
                    - protection,
            );
            recommendations.push(Recommendation {
                key: format!("{}:{}", carton.id, cushion.id),
                carton: carton.clone(),
                cushion: cushion.clone(),
                strategy,
                score,
                total_weight: weight,
                item_volume,
                empty_volume: empty,
                fill_rate: item_volume / carton.inner.volume(),
                effective_fill_rate: effective_fill,
                stability_score: stability,
                void_fill_units: (void_volume / cushion.void_fill_unit_volume).ceil(),
                recommended_void_fill_volume: void_volume,
                bottom_fill_height: bottom,
                top_void_fill_height: applied_top,
                top_empty_height: top_empty,
                unused_top_height: (top_empty - applied_top).max(0.0),
                unused_volume: (empty - void_volume).max(0.0),
                effective_inner: bounds,
                placements,
                layers,
                reasons: Vec::new(),
            });
        }
    }
    recommendations.sort_by(|a, b| {
        number_cmp(b.score, a.score)
            .then_with(|| number_cmp(a.carton.inner.volume(), b.carton.inner.volume()))
            .then_with(|| number_cmp(b.stability_score, a.stability_score))
    });
    recommendations
}
