use std::hint::black_box;
use std::time::{Duration, Instant};

use seo_core::{AnalyzeOptions, HeadingSnapshot, ImageSnapshot, LinkSnapshot, PageSnapshot};

fn main() {
    for (label, links, images, headings, text_chars, iterations) in [
        ("small", 20, 10, 12, 5_000, 200),
        ("medium", 500, 100, 100, 50_000, 50),
        ("large", 2_000, 500, 500, 100_000, 10),
    ] {
        let snapshot = snapshot(links, images, headings, text_chars);
        let options = AnalyzeOptions::default();
        for _ in 0..5 {
            black_box(seo_rules::analyze(black_box(&snapshot), black_box(&options)).unwrap());
        }
        let elapsed = (0..iterations).fold(Duration::ZERO, |total, _| {
            let started = Instant::now();
            black_box(seo_rules::analyze(black_box(&snapshot), black_box(&options)).unwrap());
            total + started.elapsed()
        });
        println!(
            "{label}: {iterations} audits, {:.2} ms/audit (links={links}, images={images}, headings={headings}, text_chars={text_chars})",
            elapsed.as_secs_f64() * 1_000.0 / iterations as f64
        );
    }
}

fn snapshot(links: usize, images: usize, headings: usize, text_chars: usize) -> PageSnapshot {
    let mut snapshot = PageSnapshot::default();
    snapshot.content.visible_text = "search-friendly content ".repeat(text_chars / 24);
    snapshot.content.html_length = (text_chars * 3) as u32;
    snapshot.content.paragraph_count = (text_chars / 400) as u32;
    snapshot.headings = (0..headings)
        .map(|index| HeadingSnapshot {
            level: (index % 6 + 1) as u8,
            text: format!("Section heading {index}"),
            location: format!("main > h{}", index + 1),
        })
        .collect();
    snapshot.links = (0..links)
        .map(|index| LinkSnapshot {
            href: format!("/page/{index}"),
            resolved_url: Some(format!("https://example.com/page/{index}")),
            accessible_name: format!("Read page {index}"),
            location: format!("main > a:nth-of-type({})", index + 1),
            ..LinkSnapshot::default()
        })
        .collect();
    snapshot.images = (0..images)
        .map(|index| ImageSnapshot {
            src: Some(format!("https://example.com/image-{index}.jpg")),
            alt_present: true,
            alt_value: format!("Example image {index}"),
            width_attr: Some(640),
            height_attr: Some(480),
            rendered_width: Some(640),
            rendered_height: Some(480),
            natural_width: Some(640),
            natural_height: Some(480),
            loading: Some("lazy".to_string()),
            fetch_priority: None,
            srcset: None,
            in_picture: false,
            broken: Some(false),
            location: format!("main > img:nth-of-type({})", index + 1),
        })
        .collect();
    snapshot
}
