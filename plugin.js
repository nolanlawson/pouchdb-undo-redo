'use strict';

var UNDO_STACK = '_local/undo-stack';

var pouchUtils = require('./pouch_utils');

module.exports = function (originalMethods) {

  function addToUndoStack(db, revision, callback) {
    originalMethods.get.apply(db, [UNDO_STACK, function (err, doc) {
      if (err) {
        if (err.name === 'not_found') {
          doc = {_id: UNDO_STACK, stack: []};
        } else {
          return callback(err);
        }
      }
      doc.stack.push(revision);
      originalMethods.put.apply(db, [doc], function (err, doc) {
        if (err) {
          return callback(err);
        }
        callback();
      });
    }]);
  }

  function wrap(methodName) {
    return pouchUtils.toPromise(pouchUtils.getArguments(function (args) {
      var db = this;

      var callback = args[args.length - 1];
      args[args.length - 1] = function (err, res) {
        if (err) {
          return callback(err);
        }
        if (Array.isArray(res)) {
          // todo
          console.log('todo');
        } else {
          addToUndoStack(db, res.rev, function (err) {
            if (err) {
              return callback(err);
            } else {
              return callback(res);
            }
          });
        }
      };
      originalMethods[methodName].apply(db, args);
    }));
  }

  var api = {};

  Object.keys(originalMethods).forEach(function (methodName) {
    api.methodName = wrap(methodName);
  });

  api.undo = pouchUtils.toPromise(function (callback) {

    var db = this;

    originalMethods.get.apply(db, [UNDO_STACK, function (err, doc) {
      if (err) {
        return callback(err);
      } else if (!doc.stack.length) {
        return callback(new Error('no more undos to make'));
      }
      var revToUndo = doc.stack.pop();



    }]);

  });

  return api;
};