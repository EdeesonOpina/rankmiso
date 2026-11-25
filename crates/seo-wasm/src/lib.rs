use seo_core::{AnalyzeOptions, EngineError, PageSnapshot};
use seo_rules::crawler_access::{self, AccessRequest};
use seo_rules::readiness::{self, ReadinessRequest};
use seo_rules::rendering::{self, RenderingComparison};
use seo_rules::site_relations::{self, RelationsInput};
use seo_rules::sitemap::{self, SitemapDocument};
use seo_rules::{analyze, rankmiso_may_fetch};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = engineVersion)]
pub fn engine_version() -> String {
    format!("{}@{}", seo_core::ENGINE_NAME, seo_core::RULESET_VERSION)
}

#[wasm_bindgen]
pub fn analyze_page(snapshot_json: &str, options_json: &str) -> Result<String, JsValue> {
    let snapshot: PageSnapshot = serde_json::from_str(snapshot_json)
        .map_err(|error| js_error(EngineError::new("INVALID_JSON", error.to_string())))?;
    let options = if options_json.trim().is_empty() {
        AnalyzeOptions::default()
    } else {
        serde_json::from_str(options_json)
            .map_err(|error| js_error(EngineError::new("INVALID_OPTIONS", error.to_string())))?
    };
    match analyze(&snapshot, &options) {
        Ok(result) => serde_json::to_string(&result)
            .map_err(|error| js_error(EngineError::new("ENCODE_FAILED", error.to_string()))),
        Err(error) => Err(js_error(error)),
    }
}

#[wasm_bindgen]
pub fn analyze_sitemap(document_json: &str) -> Result<String, JsValue> {
    let document: SitemapDocument = serde_json::from_str(document_json)
        .map_err(|error| js_error(EngineError::new("INVALID_JSON", error.to_string())))?;
    match sitemap::analyze(&document) {
        Ok(result) => serde_json::to_string(&result)
            .map_err(|error| js_error(EngineError::new("ENCODE_FAILED", error.to_string()))),
        Err(error) => Err(js_error(error)),
    }
}

/// Compares the initial HTML with the rendered page. Findings are not part of the page score.
#[wasm_bindgen]
pub fn analyze_rendering(comparison_json: &str) -> Result<String, JsValue> {
    let comparison: RenderingComparison = serde_json::from_str(comparison_json)
        .map_err(|error| js_error(EngineError::new("INVALID_JSON", error.to_string())))?;
    match rendering::analyze(&comparison) {
        Ok(result) => serde_json::to_string(&result)
            .map_err(|error| js_error(EngineError::new("ENCODE_FAILED", error.to_string()))),
        Err(error) => Err(js_error(error)),
    }
}

/// Reads robots.txt, robots meta tags, and X-Robots-Tag for each crawler or control token.
#[wasm_bindgen]
pub fn analyze_crawler_access(request_json: &str) -> Result<String, JsValue> {
    let request: AccessRequest = serde_json::from_str(request_json)
        .map_err(|error| js_error(EngineError::new("INVALID_JSON", error.to_string())))?;
    match crawler_access::analyze(&request) {
        Ok(result) => serde_json::to_string(&result)
            .map_err(|error| js_error(EngineError::new("ENCODE_FAILED", error.to_string()))),
        Err(error) => Err(js_error(error)),
    }
}

/// Content readiness for AI-assisted discovery. Findings are not part of the page score.
#[wasm_bindgen]
pub fn analyze_readiness(request_json: &str) -> Result<String, JsValue> {
    let request: ReadinessRequest = serde_json::from_str(request_json)
        .map_err(|error| js_error(EngineError::new("INVALID_JSON", error.to_string())))?;
    match readiness::analyze(&request) {
        Ok(result) => serde_json::to_string(&result)
            .map_err(|error| js_error(EngineError::new("ENCODE_FAILED", error.to_string()))),
        Err(error) => Err(js_error(error)),
    }
}

/// Canonical and hreflang relationships across one Site Explorer crawl.
#[wasm_bindgen]
pub fn analyze_site_relations(input_json: &str) -> Result<String, JsValue> {
    let input: RelationsInput = serde_json::from_str(input_json)
        .map_err(|error| js_error(EngineError::new("INVALID_JSON", error.to_string())))?;
    match site_relations::analyze(&input) {
        Ok(result) => serde_json::to_string(&result)
            .map_err(|error| js_error(EngineError::new("ENCODE_FAILED", error.to_string()))),
        Err(error) => Err(js_error(error)),
    }
}

#[wasm_bindgen]
pub fn crawl_permitted(robots_body: &str, path: &str) -> bool {
    rankmiso_may_fetch(robots_body, path)
}

fn js_error(error: EngineError) -> JsValue {
    JsValue::from_str(&serde_json::to_string(&error).unwrap_or_else(|_| {
        "{\"code\":\"ENCODE_FAILED\",\"message\":\"Could not encode the engine error.\"}"
            .to_string()
    }))
}
