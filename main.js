'use strict';

var dom = require('xmldom').DOMParser,
    request = require('request'),
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
    rootUrl = 'http://example.com/',
    pooledRequest = request.defaults({ pool: { maxSockets: 8 } }),
    rootInfo = getUrlInfo(rootUrl),
    imageTags = ['img', 'svg'],
    imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg'];

function main() {
  getSitemap(rootUrl);
}

function getSitemap(url) {
  if(!uniqueUrls[url]) {
    let page = {
      loc: url,
      'image:image': [],
      'script:script': [],
      'style:style': [],
      'video:video': []
    };

    sitemap.url.push(page);
    uniqueUrls[url] = true;
    pendingUrls[url] = true;

    pooledRequest(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        if(response.headers['last-modified']) {
          page.lastmod = formatDate(response.headers['last-modified']);
        }

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
                details.loc = info.fullUrl;
                page['style:style'].push(details);
              } else if(isJSNode(node)) {
                details.loc = info.fullUrl;
                page['script:script'].push(details);
              } else {
                getSitemap(info.fullUrl);
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
        console.log('Ignored:', JSON.stringify(ignoredUrls, null, 2));
        console.log('Failed:', JSON.stringify(errorUrls, null, 2));
        console.log(xmlparser('urlset', sitemap));
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

function datePad(number) {
  return number < 10 ? '0' + number : number;
}

function formatDate(dateString) {
  let date = new Date(dateString);

  return `${ date.getFullYear() }-${ datePad(date.getMonth() + 1) }-${ date.getDate() }`;
}

main();
