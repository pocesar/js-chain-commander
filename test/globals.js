process.env.NODE_ENV = 'test';

Q = require('bluebird');
expect = require('chai').expect;
domain = require('domain');
ChainCommander = require('../lib/chain-commander')(Q);
