#!/usr/bin/env node

var seaport = require('seaport'),
  , optimist = require('../lib/optimist.js')

optimist
  .demand(1)

var argv = optimist.read()

var ports = seaport.connect(argv.port, argv.host, argv)

ports.query(argv._[0], function(ps) {
  console.log(JSON.stringify(ps, undefined, 2));
  ports.close();
})
