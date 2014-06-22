'use strict';

var UNDO_STACK = '_local/undo-stack';

var pouchUtils = require('./pouch-utils');

module.exports = function (originalMethods) {

  function addToUndoStack(db, id, revision, callback) {
    db.get(UNDO_STACK, function (err, doc) {
      if (err) {
        if (err.name === 'not_found') {
          doc = {_id: UNDO_STACK, stack: []};
        } else {
          return callback(err);
        }
      }
      doc.stack.push({
        rev: revision,
        id: id
      });
      originalMethods.put.apply(db, [doc], function (err) {
        if (err) {
          return callback(err);
        }
        callback();
      });
    });
  }

  function wrap(methodName) {
    return pouchUtils.toPromise(pouchUtils.getArguments(function (args) {
      var db = this;

      var oldRev;
      var arg;
      var i;
      // assume either the first object with a rev or the last string
      // is the rev
      for (i = 0; i < args.length - 1; i++) {
        arg = args[i];
        if (typeof arg === 'object' && arg !== null && arg._rev) {
          oldRev = arg._rev;
          break;
        }
      }
      if (!oldRev) {
        for (i = args.length - 1; i >= 1; i--) {
          arg = args[i];
          if (typeof arg === 'string') {
            oldRev = arg._rev;
            break;
          }
        }
      }

      var callback = args[args.length - 1];
      args[args.length - 1] = function (err, res) {
        if (err) {
          return callback(err);
        }
        addToUndoStack(db, res.id, oldRev, function (err) {
          if (err) {
            return callback(err);
          } else {
            return callback(res);
          }
        });
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

    db.get(UNDO_STACK, function (err, undoStackDoc) {
      if (err) {
        return callback(err);
      } else if (!undoStackDoc.stack.length) {
        return callback(new Error('no more undos to make'));
      }
      var lastAction = undoStackDoc.stack.pop();

      db.get(lastAction.id, {rev: lastAction.rev}, function (err, oldDoc) {
        if (err) {
          return callback(err);
        }
        db.get(lastAction.id, function (err, currentDoc) {
          if (err) {
            return callback(err);
          }
          oldDoc._rev = currentDoc._rev;
          var docs = [oldDoc, undoStackDoc];
          originalMethods.bulkDocs.apply({docs: docs}, [oldDoc, function (err) {
            if (err) {
              return callback(err);
            }
            return {
              ok: true,
              rev: lastAction.rev,
              id: lastAction.id
            };
          }]);
        });
      });
    });
  });

  return api;
};