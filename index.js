'use strict';

var utils = require('./pouch-utils');


module.exports = function (PouchDB) {

  var methods = ['post', 'put', 'bulkDocs', 'remove', 'putAttachment', 'removeAttachment'];

  var originalMethods = {};

  methods.forEach(function (method) {
    originalMethods[method] = PouchDB.prototype[method];
  });

  PouchDB.plugin(require('./plugin')(originalMethods));
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  module.exports(window.PouchDB);
}
