#!/usr/bin/env node

var seaport = require('seaport')
  , optimist = require('../lib/optimist.js')

var argv = optimist.read()

var ports = seaport.connect(argv.port, argv.host, argv)

ports.query(function(ps) {
  console.log(JSON.stringify(ps, undefined, 2));
  ports.close();
})
