mod layout;
pub mod model;
mod recommend;
mod split;

use model::{Plans, Request};
use std::collections::HashSet;

pub const LAYER_SEPARATOR_HEIGHT: f64 = 10.0;

pub fn recommend(request: &Request, limit: Option<usize>) -> Plans {
    if !valid_request(request) {
        return Plans::default();
    }
    let units = recommend::expand_units(request);
    let mut plans = Plans {
        single: recommend::single(&units, request),
        split: split::split(&units, request),
    };
    if let Some(limit) = limit {
        plans.single.truncate(limit);
        plans.split.truncate(limit);
    }
    plans
}

pub fn recommend_json(input: &str, limit: Option<usize>) -> Result<String, String> {
    let request: Request = serde_json::from_str(input).map_err(|error| error.to_string())?;
    serde_json::to_string(&recommend(&request, limit)).map_err(|error| error.to_string())
}

fn valid_request(request: &Request) -> bool {
    let positive = |v: f64| v.is_finite() && v > 0.0;
    let nonnegative = |v: f64| v.is_finite() && v >= 0.0;
    let mut ids = HashSet::new();
    if !request.products.iter().all(|p| ids.insert(&p.id)) {
        return false;
    }
    if request
        .max_layers
        .is_some_and(|v| !positive(v) || v.fract() != 0.0)
    {
        return false;
    }
    let mut order_ids = HashSet::new();
    request.order_lines.iter().all(|line| {
        order_ids.insert(&line.product_id)
            && line.quantity.is_finite()
            && line.quantity >= 0.0
            && line.quantity <= 999.0
            && line.quantity.fract() == 0.0
            && request
                .products
                .iter()
                .any(|p| p.id == line.product_id && p.size.valid() && positive(p.weight))
    }) && request
        .cartons
        .iter()
        .all(|c| c.inner.valid() && c.max_load_weight_grams.is_none_or(positive))
        && request.cushions.iter().all(|c| {
            [
                c.side_padding,
                c.top_padding,
                c.bottom_padding,
                c.item_wrap_thickness,
            ]
            .iter()
            .all(|v| nonnegative(*v))
                && positive(c.void_fill_unit_volume)
                && c.stability_bonus.is_finite()
        })
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn recommend_packing_plans(input: &str, limit: Option<usize>) -> Result<String, JsValue> {
        super::recommend_json(input, limit).map_err(|error| JsValue::from_str(&error))
    }

    #[wasm_bindgen]
    pub fn core_version() -> String {
        env!("CARGO_PKG_VERSION").into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_javascript_rounding() {
        assert_eq!(model::js_round(-1.5), -1.0);
        assert_eq!(model::js_round(1.5), 2.0);
        assert!(model::js_round(-0.5).is_sign_negative());
        assert_eq!(
            model::js_round(4_503_599_627_370_497.0),
            4_503_599_627_370_497.0
        );
    }

    #[test]
    fn malformed_requests_are_errors_not_panics() {
        assert!(recommend_json("{}", None).is_err());
        assert!(recommend_json("not-json", None).is_err());
    }

    #[test]
    fn empty_catalog_returns_empty_plans() {
        let request: Request =
            serde_json::from_str(r#"{"products":[],"cartons":[],"cushions":[],"orderLines":[]}"#)
                .unwrap();
        let plans = recommend(&request, Some(3));
        assert!(plans.single.is_empty() && plans.split.is_empty());
    }
}
