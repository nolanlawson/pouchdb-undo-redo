'use strict';

var UNDO_STACK = '_local/undo-stack';
var REDO_STACK = '_local/redo-stack';

var pouchUtils = require('./pouch-utils');

var sessionId = Math.floor(Math.random() * 1000000);

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
      id: id,
      session: sessionId
    });
    db.put(doc, function (err) {
      if (err) {
        return callback(err);
      }
      callback();
    });
  });
}

exports.postUndoable = pouchUtils.toPromise(function (doc, opts, callback) {
  var db = this;
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  db.post(doc, opts, function (err, res) {
    addToUndoStack(db, res.id, doc._rev || opts.rev, callback);
  });
});

exports.undo = pouchUtils.toPromise(function (callback) {

  var db = this;

  db.get(UNDO_STACK, function (err, undoStackDoc) {
    if (err) {
      if (err.name === 'not_found') {
        return callback(new Error('no more undos to make'));
      } else {
        return callback(err);
      }
    } else if (!undoStackDoc.stack.length) {
      return callback(new Error('no more undos to make'));
    }
    db.get(REDO_STACK, function (err, redoStackDoc) {
      if (err) {
        if (err.name === 'not_found') {
          redoStackDoc = {_id: REDO_STACK, stack: []};
        } else {
          return callback(err);
        }
      }

      var lastAction = undoStackDoc.stack.pop();

      function onGetOldDoc(oldDoc) {

        db.allDocs({keys: [lastAction.id], include_docs: true}, function (err, res) {
          if (err) {
            return callback(err);
          }
          var currentDoc = res.rows[0].doc;
          if (!currentDoc) {
            // deleted, and this is the only way to get the rev of a deleted doc
            currentDoc = {_deleted: true, _id: res.rows[0].id, _rev: res.rows[0].value.rev};
          }
          oldDoc._rev = currentDoc._rev;

          var docs = [oldDoc, undoStackDoc];
          db.bulkDocs({docs: docs}, function (err) {
            if (err) {
              return callback(err);
            }

            redoStackDoc.stack.push({
              id: oldDoc._id,
              rev: oldDoc._rev,
              session: sessionId
            });

            db.put(redoStackDoc, function (err) {
              if (err) {
                return callback(err);
              }

              callback(null, {
                ok: true,
                rev: lastAction.rev,
                id: lastAction.id
              });
            });
          });
        });
      }

      if (!lastAction.rev) {
        // doc didn't exist before this action
        return onGetOldDoc({_deleted: true, _id: lastAction.id});
      }

      db.get(lastAction.id, {rev: lastAction.rev}, function (err, oldDoc) {
        if (err) {
          return callback(err);
        }
        onGetOldDoc(oldDoc);
      });
    });
  });
});

exports.redo = pouchUtils.toPromise(function (callback) {
  var db = this;

  db.get(REDO_STACK, function (err, redoStackDoc) {
    if (err) {
      return callback(err);
    } else if (!redoStackDoc.stack.length) {
      return callback(new Error('no more redos to make'));
    }
    var lastUndo = redoStackDoc.stack.pop();
    db.get(lastUndo.id, {rev: lastUndo.rev}, function (err, oldDoc) {
      if (err) {
        return callback(err);
      }
      db.allDocs({keys: [lastUndo.id], include_docs: true}, function (err, res) {
        if (err) {
          return callback(err);
        }
        var currentDoc = res.rows[0].doc;
        if (!currentDoc) {
          // deleted, and this is the only way to get the rev of a deleted doc
          currentDoc = {_deleted: true, _id: res.rows[0].id, _rev: res.rows[0].value.rev};
        }
        oldDoc._rev = currentDoc._rev;
        var docs = [redoStackDoc, oldDoc];
        db.bulkDocs({docs: docs}, function (err) {
          if (err) {
            return callback(err);
          }
          callback(null, {
            ok: true,
            rev: lastUndo.rev,
            id: lastUndo.id
          });
        });
      });
    });
  });


});

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.pouchDB.plugin(module.exports);
}
