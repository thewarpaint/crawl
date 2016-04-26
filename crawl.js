'use strict';

var dom = require('xmldom').DOMParser,
    Q = require('q'),
    request = require('request'),
    utils = require('./utils'),
    xmlparser = require('js2xmlparser'),
    xpath = require('xpath');

var Crawl,
    errorUrls = {},
    ignoredUrls = {},
    pendingUrls = {},
    uniqueUrls = {},
    imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg'],
    imageTags = ['img', 'svg'],
    options,
    pooledRequest,
    processedCount = 0,
    rootInfo,
    sitemap = {
      url: []
    };

Crawl = {
  getSitemap: function (rootUrl, crawlOptions) {
    let deferred = Q.defer();

    options = crawlOptions;
    rootInfo = Crawl.getUrlInfo(rootUrl);
    pooledRequest = request.defaults({ pool: { maxSockets: options.poolSize } });

    Crawl.processUrl(rootInfo.fullUrl, deferred);

    return deferred.promise;
  },

  processUrl: function (url, deferred) {
    if(!uniqueUrls[url]) {
      let page = {
        loc: url,
        'image:image': [],
        'video:video': []
      };

      if(options.extras) {
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
              let info = Crawl.getUrlInfo(node.nodeValue, rootInfo);

              if(info.follow) {
                let details = {};

                if(Crawl.isImageNode(node)) {
                  let alt = node.ownerElement.getAttribute('alt');

                  if(alt) {
                    details['image:caption'] = alt;
                  }

                  details['image:loc'] = info.fullUrl;
                  page['image:image'].push(details);
                } else if(Crawl.isCSSNode(node)) {
                  if(options.extras) {
                    details['style:loc'] = info.fullUrl;
                    page['style:style'].push(details);
                  }
                } else if(Crawl.isJSNode(node)) {
                  if(options.extras) {
                    details['script:loc'] = info.fullUrl;
                    page['script:script'].push(details);
                  }
                } else {
                  Crawl.processUrl(info.fullUrl, deferred);
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
          if(options.debug) {
            console.log(`\nIgnored: ${ JSON.stringify(ignoredUrls, null, 2) }`);
            console.log(`Failed: ${ JSON.stringify(errorUrls, null, 2) }`);
          }

          deferred.resolve(xmlparser('urlset', sitemap));
        }
      });
    }
  },

  getUrlInfo: function (url, root) {
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
  },

  isCSSNode: function (node) {
    return /\.css$/.test(node.nodeValue) || node.ownerElement.getAttribute('rel') === 'stylesheet' ||
      node.ownerElement.getAttribute('type') === 'text/css';
  },

  isJSNode: function (node) {
    return /\.js$/.test(node.nodeValue) || node.ownerElement.tagName === 'script';
  },

  isImageNode: function (node) {
    let extension = node.nodeValue.split('.').pop();

    return imageTags.indexOf(node.ownerElement.tagName) !== -1 || imageExtensions.indexOf(extension) !== -1;
  }
};

module.exports = exports = Crawl;
