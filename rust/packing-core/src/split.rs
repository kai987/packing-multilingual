use crate::{
    model::*,
    recommend::{score_profile, single, unit_volume, unit_weight},
};
use indexmap::IndexMap;
use std::{collections::HashSet, sync::Arc};

fn count_signature(units: &[Arc<Unit>]) -> String {
    let mut counts = IndexMap::<&str, usize>::new();
    for unit in units {
        *counts.entry(&unit.product.id).or_default() += 1;
    }
    let mut entries: Vec<_> = counts.into_iter().collect();
    entries.sort_by(|a, b| id_cmp(a.0, b.0));
    entries
        .iter()
        .map(|(id, count)| format!("{id}:{count}"))
        .collect::<Vec<_>>()
        .join(",")
}

fn signature(groups: &[Units]) -> String {
    let mut keys: Vec<_> = groups.iter().map(|g| count_signature(g)).collect();
    keys.sort_by(|a, b| id_cmp(a, b));
    keys.join("|")
}

fn normalized(mut groups: Vec<Units>) -> Vec<Units> {
    for group in &mut groups {
        group.sort_by(|a, b| id_cmp(&a.instance_id, &b.instance_id));
    }
    groups.sort_by(|a, b| {
        number_cmp(unit_volume(b), unit_volume(a))
            .then_with(|| number_cmp(unit_weight(b), unit_weight(a)))
            .then_with(|| id_cmp(&count_signature(a), &count_signature(b)))
    });
    groups
}

fn grouping_score(groups: &[Units]) -> f64 {
    let volumes: Vec<_> = groups.iter().map(|g| unit_volume(g)).collect();
    let weights: Vec<_> = groups.iter().map(|g| unit_weight(g)).collect();
    let counts: Vec<_> = groups.iter().map(|g| g.len() as f64).collect();
    let spread = |values: &[f64]| {
        values.iter().copied().fold(f64::NEG_INFINITY, f64::max)
            - values.iter().copied().fold(f64::INFINITY, f64::min)
    };
    spread(&volumes) / 10_000.0 + spread(&weights) / 50.0 + spread(&counts) * 10.0
}

fn partitions(units: &[Arc<Unit>]) -> Vec<Vec<Units>> {
    if units.len() < 2 {
        return Vec::new();
    }
    let mut output = Vec::new();
    let mut seen = HashSet::new();
    if units.len() <= 12 {
        let fixed = units.len() - 1;
        for mask in 1..(1 << fixed) {
            let mut left = Vec::new();
            let mut right = vec![units[fixed].clone()];
            for (index, unit) in units.iter().enumerate().take(fixed) {
                if mask & (1 << index) != 0 {
                    left.push(unit.clone());
                } else {
                    right.push(unit.clone());
                }
            }
            let groups = vec![left, right];
            if seen.insert(signature(&groups)) {
                output.push(groups);
            }
        }
    } else {
        let mut sorted = units.to_vec();
        sorted.sort_by(|a, b| number_cmp(b.size.volume(), a.size.volume()));
        for strategy in 0..3 {
            let mut left = Vec::new();
            let mut right = Vec::new();
            for unit in &sorted {
                let assign_left = match strategy {
                    0 => unit_volume(&left) <= unit_volume(&right),
                    1 => unit_weight(&left) <= unit_weight(&right),
                    _ => unit.product.fragility == Fragility::High,
                };
                if assign_left {
                    left.push(unit.clone());
                } else {
                    right.push(unit.clone());
                }
            }
            if left.is_empty() {
                left.push(sorted[0].clone());
                right.retain(|u| u.instance_id != sorted[0].instance_id);
            }
            if right.is_empty() {
                right.push(sorted[0].clone());
                left.retain(|u| u.instance_id != sorted[0].instance_id);
            }
            let groups = vec![left, right];
            if groups.iter().all(|g| !g.is_empty()) && seen.insert(signature(&groups)) {
                output.push(groups);
            }
        }
    }
    output
}

fn groupings(units: &[Arc<Unit>], box_count: usize) -> Vec<Vec<Units>> {
    let mut frontier = vec![normalized(vec![units.to_vec()])];
    for _step in 1..box_count {
        let mut next = IndexMap::new();
        for grouping in &frontier {
            for (index, group) in grouping.iter().enumerate() {
                if group.len() < 2 {
                    continue;
                }
                let mut options = partitions(group);
                options.sort_by(|a, b| {
                    number_cmp(grouping_score(a), grouping_score(b))
                        .then_with(|| id_cmp(&signature(a), &signature(b)))
                });
                for partition in options.into_iter().take(6) {
                    let mut candidate = grouping[..index].to_vec();
                    candidate.extend(partition);
                    candidate.extend_from_slice(&grouping[index + 1..]);
                    let candidate = normalized(candidate);
                    next.insert(signature(&candidate), candidate);
                }
            }
        }
        frontier = next.into_values().collect();
        frontier.sort_by(|a, b| number_cmp(grouping_score(a), grouping_score(b)));
        frontier.truncate(24);
        if frontier.is_empty() {
            break;
        }
    }
    frontier
}

fn items(units: &[Arc<Unit>]) -> Vec<Item> {
    let mut summary: IndexMap<String, Item> = IndexMap::new();
    for unit in units {
        let product = &unit.product;
        let item = summary.entry(product.id.clone()).or_insert_with(|| Item {
            product_id: product.id.clone(),
            brand: product.brand.clone(),
            name: product.name.clone(),
            category: product.category.clone(),
            color: product.color.clone(),
            quantity: 0,
        });
        item.quantity += 1;
    }
    summary.into_values().collect()
}

fn combine(mut boxes: Vec<SplitBox>, strategy: Strategy) -> SplitRecommendation {
    for (index, b) in boxes.iter_mut().enumerate() {
        b.box_index = index + 1;
    }
    let sum = |value: fn(&Recommendation) -> f64| {
        boxes.iter().map(|b| value(&b.recommendation)).sum::<f64>()
    };
    let weight = sum(|r| r.total_weight);
    let item_volume = sum(|r| r.item_volume);
    let effective_volume = sum(|r| r.effective_inner.volume());
    let carton_volume = sum(|r| r.carton.inner.volume());
    let empty = sum(|r| r.empty_volume);
    let void = sum(|r| r.recommended_void_fill_volume);
    let unused = sum(|r| r.unused_volume);
    let effective_fill = if effective_volume > 0.0 {
        item_volume / effective_volume
    } else {
        0.0
    };
    let fill = if carton_volume > 0.0 {
        item_volume / carton_volume
    } else {
        0.0
    };
    let stability = if weight > 0.0 {
        js_round(sum(|r| r.stability_score * r.total_weight) / weight)
    } else {
        0.0
    };
    let (fill_weight, stability_weight, empty_penalty, _) = score_profile(strategy);
    let score = js_round(
        effective_fill * fill_weight + stability * stability_weight
            - (empty / 1_000_000.0) * empty_penalty
            - boxes.len().saturating_sub(1) as f64 * 1.6,
    );
    let key = boxes
        .iter()
        .map(|b| {
            let mut counts: Vec<_> = b
                .items
                .iter()
                .map(|i| format!("{}:{}", i.product_id, i.quantity))
                .collect();
            counts.sort_by(|a, b| id_cmp(a, b));
            format!(
                "{}:{}:{}",
                b.recommendation.carton.id,
                b.recommendation.cushion.id,
                counts.join(",")
            )
        })
        .collect::<Vec<_>>()
        .join("|");
    SplitRecommendation {
        key,
        strategy,
        score,
        box_count: boxes.len(),
        total_weight: weight,
        item_volume,
        total_empty_volume: empty,
        total_recommended_void_fill_volume: void,
        total_unused_volume: unused,
        fill_rate: fill,
        effective_fill_rate: effective_fill,
        stability_score: stability,
        boxes,
        reasons: Vec::new(),
    }
}

fn combinations(
    sets: &[Vec<Arc<Recommendation>>],
    current: &mut Vec<Arc<Recommendation>>,
    out: &mut Vec<Vec<Arc<Recommendation>>>,
) {
    if current.len() == sets.len() {
        out.push(current.clone());
        return;
    }
    for recommendation in &sets[current.len()] {
        current.push(recommendation.clone());
        combinations(sets, current, out);
        current.pop();
    }
}

pub fn split(units: &[Arc<Unit>], request: &Request) -> Vec<SplitRecommendation> {
    if units.len() < 2 {
        return Vec::new();
    }
    let max_boxes = units.len().min(5);
    let largest = request
        .cartons
        .iter()
        .fold(0.0_f64, |max, c| max.max(c.inner.volume()));
    if unit_volume(units) > largest * max_boxes as f64 {
        return Vec::new();
    }
    let mut results: IndexMap<String, SplitRecommendation> = IndexMap::new();
    let mut cache: std::collections::HashMap<String, Vec<Arc<Recommendation>>> =
        std::collections::HashMap::new();
    for count in 2..=max_boxes {
        for groups in groupings(units, count) {
            let mut sets = Vec::new();
            for group in &groups {
                let mut ids: Vec<_> = group.iter().map(|u| u.instance_id.clone()).collect();
                ids.sort_by(|a, b| id_cmp(a, b));
                let key = ids.join("|");
                let recommendations = cache.entry(key).or_insert_with(|| {
                    let mut options = single(group, request);
                    options.truncate(2);
                    options.into_iter().map(Arc::new).collect()
                });
                sets.push(recommendations.clone());
            }
            if sets.iter().any(|set| set.is_empty()) {
                continue;
            }
            let mut options = Vec::new();
            combinations(&sets, &mut Vec::new(), &mut options);
            let summaries: Vec<_> = groups.iter().map(|group| Arc::new(items(group))).collect();
            for combination in options {
                let mut boxes: Vec<_> = combination
                    .into_iter()
                    .enumerate()
                    .map(|(index, recommendation)| SplitBox {
                        box_index: index + 1,
                        recommendation,
                        items: summaries[index].clone(),
                    })
                    .collect();
                boxes.sort_by(|a, b| {
                    number_cmp(
                        b.recommendation.carton.inner.volume(),
                        a.recommendation.carton.inner.volume(),
                    )
                    .then_with(|| {
                        number_cmp(b.recommendation.total_weight, a.recommendation.total_weight)
                    })
                });
                let combined = combine(boxes, request.strategy);
                if results
                    .get(&combined.key)
                    .is_none_or(|current| combined.score > current.score)
                {
                    results.insert(combined.key.clone(), combined);
                }
            }
        }
    }
    let mut results: Vec<_> = results.into_values().collect();
    results.sort_by(|a, b| {
        number_cmp(b.score, a.score)
            .then_with(|| number_cmp(b.effective_fill_rate, a.effective_fill_rate))
            .then_with(|| a.box_count.cmp(&b.box_count))
            .then_with(|| number_cmp(a.total_empty_volume, b.total_empty_volume))
    });
    results
}
