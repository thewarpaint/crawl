'use strict';

var argv = require('yargs')
      .usage('Usage: $0 [options]')
      .example('$0 --domain https://example.com/ --output example-sitemap.xml',
        'generate a sitemap for https://example.com/ and save in example-sitemap.xml')
      .demand('url')
      .alias('url', 'u')
      .nargs('url', 1)
      .describe('url', 'Domain to analyze, if no protocol is specified, http is assumed')
      .alias('output', 'o')
      .nargs('output', 1)
      .describe('output', 'File in the current directory to write the sitemap to')
      .alias('debug', 'd')
      .describe('debug', 'Show ignored and failing URLs')
      .alias('pool-size', 'p')
      .describe('pool-size', 'Maximum number of concurrent connections')
      .nargs('pool-size', 1)
      .alias('extras', 'e')
      .describe('extras', 'Include extra static assets (JS, CSS) in the sitemap (experimental, not standard)')
      .default({ debug: false, extras: false, output: 'sitemap.xml', 'pool-size': 8 })
      .argv,
    Crawl = require('./crawl'),
    fs = require('fs'),
    utils = require('./utils');

// Globals
var sitemap = {
      url: []
    },
    uniqueUrls = {},
    pendingUrls = {},
    errorUrls = {},
    ignoredUrls = {},
    options = {
      debug: argv.debug,
      extras: argv.extras,
      poolSize: argv['pool-size']
    },
    processedCount = 0,
    rootInfo = Crawl.getUrlInfo(argv.url),
    rootUrl = rootInfo.fullUrl,
    imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg'],
    imageTags = ['img', 'svg'],
    startTime = new Date();

function main() {
  Crawl.getSitemap(rootUrl, options).then(function (xmlString) {
    saveXML(argv.output, xmlString);
    console.log(`\nEllapsed time: ${ utils.formatMs(utils.getDiffFromNow(startTime)) }`);
  });
}

function saveXML(dest, xmlString) {
  fs.writeFile(`${ dest }`, xmlString, function (error) {
    if(error) {
      console.log(`Writing ${ dest } failed: ${ error }`);
    } else {
      console.log(`Sitemap saved to ${ dest }`);
    }
  });
}

main();
