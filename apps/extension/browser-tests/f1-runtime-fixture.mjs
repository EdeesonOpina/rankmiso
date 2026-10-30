import { createServer } from "node:http";
import process from "node:process";

function fixturePage(title, links = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="RankMiso F1-D controlled local fixture"></head><body><h1>${title}</h1><h2>Audit fixture</h2>${links}</body></html>`;
}

const primary = createServer((request, response) => {
  const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
  console.log(`${new Date().toISOString()} primary ${request.method} ${path}`);
  if (path === "/robots.txt") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("User-agent: *\nDisallow: /blocked\n");
  } else if (path === "/slow") {
    response.writeHead(200, { "content-type": "text/html" });
    const timer = setTimeout(() => response.end(fixturePage("Slow response")), 15_000);
    response.on("close", () => {
      clearTimeout(timer);
      console.log(`${new Date().toISOString()} primary client-closed /slow`);
    });
  } else if (path === "/redirect-same") {
    response.writeHead(302, { location: "/fast" });
    response.end();
  } else if (path === "/redirect-other-origin") {
    response.writeHead(302, { location: "http://127.0.0.2:8766/target" });
    response.end();
  } else if (path === "/fast" || path === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      fixturePage(
        path === "/" ? "RankMiso F1-D Permission Fixture" : "Fast fixture page",
        '<a href="/fast">Fast page</a><a href="/slow">Delayed page</a><a href="/blocked">Robots blocked</a><a href="/redirect-same">Same-origin redirect</a><a href="/redirect-other-origin">Other-origin redirect</a>',
      ),
    );
  } else if (path === "/many") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    const links = Array.from(
      { length: 105 },
      (_, index) => `<a href="/page/${index}">Page ${index}</a>`,
    ).join("");
    response.end(fixturePage("RankMiso F1-D 105 Page Fixture", links));
  } else if (/^\/page\/\d+$/.test(path)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixturePage(`Fixture ${path.split("/").at(-1)}`));
  } else {
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    response.end(fixturePage("Not found"));
  }
});

const otherOrigin = createServer((request, response) => {
  const path = new URL(request.url || "/", "http://127.0.0.2").pathname;
  console.log(`${new Date().toISOString()} second-origin ${request.method} ${path}`);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(fixturePage("Second-origin target"));
});

primary.listen(8765, "127.0.0.1", () => {
  console.log("RankMiso fixture: http://127.0.0.1:8765/");
});
otherOrigin.listen(8766, "127.0.0.2", () => {
  console.log("Redirect boundary fixture: http://127.0.0.2:8766/target");
});

function close() {
  primary.close();
  otherOrigin.close();
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
