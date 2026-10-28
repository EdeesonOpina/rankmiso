use seo_core::{AnalyzeOptions, EngineError, PageSnapshot};
use seo_rules::{analyze, rankmiso_may_fetch};
use seo_rules::sitemap::{self, SitemapDocument};
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
