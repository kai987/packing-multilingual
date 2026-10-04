use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
pub struct Dimensions {
    pub length: f64,
    pub width: f64,
    pub height: f64,
}

impl Dimensions {
    pub fn volume(self) -> f64 {
        self.length * self.width * self.height
    }
    pub fn valid(self) -> bool {
        [self.length, self.width, self.height]
            .iter()
            .all(|v| v.is_finite() && *v > 0.0)
    }
    pub fn max_face(self) -> f64 {
        (self.length * self.width)
            .max(self.length * self.height)
            .max(self.width * self.height)
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Strategy {
    #[default]
    Compact,
    Stable,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Fragility {
    Low,
    Medium,
    High,
}

impl Fragility {
    pub fn rank(self) -> f64 {
        match self {
            Self::Low => 1.0,
            Self::Medium => 2.0,
            Self::High => 3.0,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: String,
    pub brand: String,
    pub name: String,
    pub category: String,
    pub size: Dimensions,
    pub weight: f64,
    pub fragility: Fragility,
    pub color: String,
    pub note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_yen: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Carton {
    pub id: String,
    pub code: String,
    pub label: String,
    pub service: String,
    pub inner: Dimensions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outer: Option<Dimensions>,
    pub volumetric_weight_grams: Option<f64>,
    pub max_load_weight_grams: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_yen: Option<f64>,
    pub note: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Cushion {
    pub id: String,
    pub name: String,
    pub item_wrap_thickness: f64,
    pub side_padding: f64,
    pub top_padding: f64,
    pub bottom_padding: f64,
    pub stability_bonus: f64,
    pub void_fill_unit_volume: f64,
    pub note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderLine {
    pub product_id: String,
    pub quantity: f64,
    pub use_item_wrap: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub products: Vec<Product>,
    pub cartons: Vec<Carton>,
    pub cushions: Vec<Cushion>,
    pub order_lines: Vec<OrderLine>,
    #[serde(default)]
    pub strategy: Strategy,
    pub max_layers: Option<f64>,
}

#[derive(Clone, Debug)]
pub struct Unit {
    pub instance_id: String,
    pub product: Arc<Product>,
    pub size: Dimensions,
    pub product_size: Dimensions,
    pub use_item_wrap: bool,
}
pub type Units = Vec<Arc<Unit>>;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    pub instance_id: String,
    pub product_id: String,
    pub name: String,
    pub brand: String,
    pub category: String,
    pub color: String,
    pub use_item_wrap: bool,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    #[serde(flatten)]
    pub size: Dimensions,
    pub product_size: Dimensions,
    pub weight: f64,
    pub layer_index: usize,
    pub row_index: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Layer {
    pub index: usize,
    pub z: f64,
    pub height: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub key: String,
    pub carton: Carton,
    pub cushion: Cushion,
    pub strategy: Strategy,
    pub score: f64,
    pub total_weight: f64,
    pub item_volume: f64,
    pub empty_volume: f64,
    pub fill_rate: f64,
    pub effective_fill_rate: f64,
    pub stability_score: f64,
    pub void_fill_units: f64,
    pub recommended_void_fill_volume: f64,
    pub bottom_fill_height: f64,
    pub top_void_fill_height: f64,
    pub top_empty_height: f64,
    pub unused_top_height: f64,
    pub unused_volume: f64,
    pub effective_inner: Dimensions,
    pub placements: Vec<Placement>,
    pub layers: Vec<Layer>,
    pub reasons: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub product_id: String,
    pub brand: String,
    pub name: String,
    pub category: String,
    pub color: String,
    pub quantity: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitBox {
    pub box_index: usize,
    pub recommendation: Arc<Recommendation>,
    pub items: Arc<Vec<Item>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitRecommendation {
    pub key: String,
    pub strategy: Strategy,
    pub score: f64,
    pub box_count: usize,
    pub total_weight: f64,
    pub item_volume: f64,
    pub total_empty_volume: f64,
    pub total_recommended_void_fill_volume: f64,
    pub total_unused_volume: f64,
    pub fill_rate: f64,
    pub effective_fill_rate: f64,
    pub stability_score: f64,
    pub boxes: Vec<SplitBox>,
    pub reasons: Vec<String>,
}

#[derive(Debug, Default, Serialize)]
pub struct Plans {
    pub single: Vec<Recommendation>,
    pub split: Vec<SplitRecommendation>,
}

pub fn number_cmp(a: f64, b: f64) -> std::cmp::Ordering {
    a.partial_cmp(&b).unwrap_or(std::cmp::Ordering::Equal)
}
pub fn id_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}
// JS Math.round rounds negative half-ties toward positive infinity.
pub fn js_round(value: f64) -> f64 {
    let lower = value.floor();
    let rounded = if value - lower < 0.5 {
        lower
    } else {
        value.ceil()
    };
    if rounded == 0.0 && value.is_sign_negative() {
        -0.0
    } else {
        rounded
    }
}
