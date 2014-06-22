/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');

//
// your plugin goes here
//
var thePlugin = require('../');
thePlugin(Pouch);

var chai = require('chai');
chai.use(require("chai-as-promised"));

//
// more variables you might want
//
var should = chai.should();
require('bluebird'); // var Promise = require('bluebird');

var dbs;
if (process.browser) {
  dbs = 'testdb' + Math.random() +
    ',http://localhost:5984/testdb' + Math.round(Math.random() * 100000);
} else {
  dbs = process.env.TEST_DB;
}

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  var db;

  beforeEach(function () {
    db = new Pouch(dbName);
    return db;
  });
  afterEach(function () {
    return Pouch.destroy(dbName);
  });
  describe(dbType + ': hello test suite', function () {

    it('should let me undo the first change', function () {
      return db.post({}).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(1);
        return db.undo();
      }).then(function (res) {
        res.ok.should.equal(true);
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(0);
        return db.undo().then(function (res) {
          should.not.exist(res);
        }).catch(function (err) {
          should.exist(err);
        });
      });
    });
/*
    it('should let me redo the first undo', function () {
      return db.post({}).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(1);
        return db.undo();
      }).then(function (res) {
        res.ok.should.equal(true);
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(0);
        return db.redo();
      }).then(function (res) {
        res.ok.should.equal(true);
        return db.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(1);
        return db.redo().then(function (res) {
          should.not.exist(res);
        }).catch(function (err) {
          should.exist(err);
        });
      });
    });*/
  });
}
