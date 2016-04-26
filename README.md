# Crawl

Simple web crawler

## Usage

`$ node main.js --url https://example.com/`

### Options

+ `-u, --url`
    Domain to analyze. If no protocol is specified `http` is assumed. Required.

+ `-o, --output`
    File in the current directory to write the sitemap to. Default: `sitemap.xml`.

+ `-d, --debug`
    Show ignored and failing URLs.

+ `-p, --pool-size`
    Maximum number of concurrent connections.

+ `-e, --extras`
    Include extra static assets (JS, CSS) in the sitemap (experimental, not standard).

## Features

+ Generate a sitemap from a domain recursively crawling all links in its pages
+ Include the date the page was last modified, as well as its MD5 hash
+ Include images and its captions from `alt` attributes
+ Handle connections in a pool with a maximum number of simultaneous sockets to avoid I/O or network errors
+ Optionally output the ignored (duplicated) URLs, as well as the ones that failed to be retrieved
+ Optionally include the JS and CSS static assets present in every page

## Design process and challenges

The first minor issues I found were avoiding following loops in the "site graph" and checking for variations
in the URLs for the same resource or URLs I should not follow even if within the same domain
(`#anchors`, for example).

From the beginning I tried to avoid using a regex approach to parse the pages and extract URLs because I
imagined in certain cases I would have required context, like tag names or other tag attributes. This turned
out to be true, but it could be worth doing a benchmark of the pros and cons of this approach.

I had some problems when defining the conditions when crawling has finished due to the asynchronous behaviour
of the problem. Making it synchronous was not an option. I tried with promises but settled for something less
sophisticated, but functional.

I decided to do XML generation with a library rather than manually because it's less error prone. However,
with more time on my hands I would evaluate the current solution vs generating it "manually" vs generating
the XML still with the library, but without the intermediate JSON object to see which one performs better.

In the beginning I assumed JS and CSS were supposed to be included in the static assets category, however I
didn't see any sitemap example including those. So I kept them as an optional feature, default is off.

## Future work

+ Add support for relative URLs, i.e., `home` rather than `/home`, as well as `../`
+ Add support for `<meta>` content attribute
+ Benchmark for XPath approach (current) vs regex
+ Add support for using SVG title and description tags as captions
+ Benchmark for JSON to XML approach (current) vs XML on the fly vs manual XML strings
+ Add retry logic for failed URLs and I/O errors
+ Improve error handling
+ Break down `Crawl.processUrl` into smaller, testable functions
+ Minimize/eliminate global variables and side effects, add tests
+ Develop a UI to display sitemaps in a more UX-focused way
+ Add support for `robots.txt`
+ Add support for `video` tags, investigate about `iframe` videos

## References

+ https://gocardless.com/sitemap.xml
+ https://gocardless.com/robots.txt

### Sitemaps

+ http://www.sitemaps.org/protocol.html
+ https://support.google.com/webmasters/answer/183668?hl=en&ref_topic=4581190
+ https://support.google.com/webmasters/answer/178636
+ https://developers.google.com/webmasters/videosearch/sitemaps#adding-video-content-to-a-sitemap

### Libraries

+ https://github.com/goto100/xpath
+ https://github.com/jindw/xmldom
+ https://github.com/kriskowal/q
+ https://github.com/michaelkourlas/node-js2xmlparser
+ https://github.com/request/request
+ https://github.com/yargs/yargs

#### Not used

+ https://github.com/dylang/node-xml
+ https://github.com/oozcitak/xmlbuilder-js
