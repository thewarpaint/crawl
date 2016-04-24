# Crawl

Simple web crawler

## Usage

`$ node main.js --url https://example.com/`

## Options

+ `-u, --url`
    Domain to analyze. If no protocol is specified `http` is assumed. Required.

+ `-o, --output`
    File in the current directory to write the sitemap to. Default: `sitemap.xml`.

+ `-d, --debug`
    Show ignored and failing URLs.

+ `-p, --pool-size`
    Show ignored and failing URLs.

+ `-e, --extras`
    Include extra static assets (JS, CSS) in the sitemap (experimental, not standard).

