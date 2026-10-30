# Sitemaps

The report section **Sitemaps** inspects sitemap files. It does not crawl the URLs inside them, and a listed URL is not an indexed URL. A bounded crawl of the current origin is the separate Site section.

Chromium can discover files after you choose **Discover sitemaps** and allow that site. Discovery reads `Sitemap` lines from robots.txt, including more than one, and checks `/sitemap.xml` and `/sitemap_index.xml` as common paths. A missing robots.txt or a missing common path is not proof that the site has no sitemap. An address on another host is shown and not requested. Redirects that leave the site are not followed. Requests omit cookies.

Firefox's standalone Sitemaps destination retains local XML import and does not fetch sitemaps. Site Explorer may read sitemap URLs only as part of a crawl the user explicitly starts; this does not enable standalone network discovery.

The browser extracts XML. Rust reports findings such as invalid XML, a rejected DTD, a nested sitemap index, a missing or relative loc, a duplicate URL, and a lastmod that is not a date. `changefreq` and `priority` are legacy fields. A bad value is a note, not a ranking claim.

A sitemap index is followed one level. An index that points at another index is a compatibility finding, and the inner index is not followed.

Processing stops at 8 files, 500 URL entries, and 512 KB per file. A stopped check says the result is partial. The active-page lookup says **Unknown** when the read did not finish, **Found** or **Not in the processed files** only after a complete URL list, and **Not checked** before a run.

Gzip opens with the browser's decompression stream when that stream exists. If it does not, the file is reported as compressed and unread.

Exports are CSV downloads after confirmation. Formula characters are prefixed. Page text is not uploaded.

The older optional site check still fetches only the first sitemap named in robots.txt. The explorer is the place that reads the rest.
