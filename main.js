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
    dom = require('xmldom').DOMParser,
    fs = require('fs'),
    Q = require('q'),
    request = require('request'),
    utils = require('./utils'),
    xmlparser = require('js2xmlparser'),
    xpath = require('xpath');

// Globals
var sitemap = {
      url: []
    },
    uniqueUrls = {},
    pendingUrls = {},
    errorUrls = {},
    ignoredUrls = {},
    processedCount = 0,
    pooledRequest = request.defaults({ pool: { maxSockets: argv['pool-size'] } }),
    rootInfo = getUrlInfo(argv.url),
    rootUrl = rootInfo.fullUrl,
    imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg'],
    imageTags = ['img', 'svg'],
    startTime = new Date();

function main() {
  getSitemap(rootUrl).then(function (xmlString) {
    saveXML(argv.output, xmlString);
  });
}

function getSitemap(url) {
  let deferred = Q.defer();

  processUrl(url, deferred);

  return deferred.promise;
}

function processUrl(url, deferred) {
  if(!uniqueUrls[url]) {
    let page = {
      loc: url,
      'image:image': [],
      'video:video': []
    };

    if(argv.extras) {
      page['script:script'] = [];
      page['style:style'] = [];
    }

    sitemap.url.push(page);
    uniqueUrls[url] = true;
    pendingUrls[url] = true;

    pooledRequest(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        if(response.headers['last-modified']) {
          page.lastmod = utils.formatDate(response.headers['last-modified']);
        }

        page['content:hash'] = utils.getMD5Hash(body);

        let attributes = ['href', 'src'],
            doc = new dom({ errorHandler: function() {} }).parseFromString(body),
            nodes = [];

        attributes.forEach(function (attribute) {
          try {
            nodes = nodes.concat(xpath.select(`//@${ attribute }`, doc));
          } catch(e) {
            errorUrls[url] = e.toString();
          }
        });

        nodes.forEach(function (node) {
          if(node.nodeValue) {
            let info = getUrlInfo(node.nodeValue, rootInfo);

            if(info.follow) {
              let details = {};

              if(isImageNode(node)) {
                let alt = node.ownerElement.getAttribute('alt');

                if(alt) {
                  details['image:caption'] = alt;
                }

                details['image:loc'] = info.fullUrl;
                page['image:image'].push(details);
              } else if(isCSSNode(node)) {
                if(argv.extras) {
                  details['style:loc'] = info.fullUrl;
                  page['style:style'].push(details);
                }
              } else if(isJSNode(node)) {
                if(argv.extras) {
                  details['script:loc'] = info.fullUrl;
                  page['script:script'].push(details);
                }
              } else {
                processUrl(info.fullUrl, deferred);
              }
            } else {
              if(!uniqueUrls[info.fullUrl]) {
                uniqueUrls[info.fullUrl] = true;
                ignoredUrls[info.fullUrl] = true;
              }
            }
          }
        });
      } else {
        errorUrls[url] = error + ' ' +
          (response && response.statusCode ? response.statusCode : 'undefined status code');
      }

      processedCount++;
      delete pendingUrls[url];

      let pendingCount = Object.keys(pendingUrls).length;

      process.stdout.write(`Processed: ${ processedCount }     Pending: ${ pendingCount }     \r`);

      if(!pendingCount) {
        console.log(`\nEllapsed time: ${ utils.formatMs(utils.getDiffFromNow(startTime)) }`);

        if(argv.debug) {
          console.log(`Ignored: ${ JSON.stringify(ignoredUrls, null, 2) }`);
          console.log(`Failed: ${ JSON.stringify(errorUrls, null, 2) }`);
        }

        deferred.resolve(xmlparser('urlset', sitemap));
      }
    });
  }
}

function getUrlInfo(url, root) {
  var info = {},
      parts;

  if(url[0] === '#') {
    info.follow = false;
    info.fullUrl = `${ root.fullUrl }${ url }`;
  } else {
    // Get protocol
    parts = url.split('//');
    info.protocol = parts.length === 2 ? (parts[0].replace(':', '') || 'http') : 'http';

    parts = parts.length === 2 ? parts[1] : parts[0];

    // Get domain
    if(parts[0] === '/') {
      info.protocol = rootInfo.protocol;
      info.domain = rootInfo.domain;
      info.path = parts;
    } else {
      let index = parts.indexOf('/');

      info.domain = index === -1 ? parts : parts.substring(0, index);
      info.path = index === -1 ? '/' : `/${ parts.substring(index + 1) }`;
    }

    // Get anchor
    parts = info.path.split('#');
    info.path = parts[0];
    info.anchor = parts[1] || '';

    // Determine if the URL should be followed or not
    if(root) {
      info.follow = info.domain === rootInfo.domain;
    }

    info.fullUrl = `${ info.protocol }://${ info.domain }${ info.path }`;
  }

  return info;
}

function isCSSNode(node) {
  return /\.css$/.test(node.nodeValue) || node.ownerElement.getAttribute('rel') === 'stylesheet' ||
    node.ownerElement.getAttribute('type') === 'text/css';
}

function isJSNode(node) {
  return /\.js$/.test(node.nodeValue) || node.ownerElement.tagName === 'script';
}

function isImageNode(node) {
  let extension = node.nodeValue.split('.').pop();

  return imageTags.indexOf(node.ownerElement.tagName) !== -1 || imageExtensions.indexOf(extension) !== -1;
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
