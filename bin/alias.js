#!/usr/bin/env node

var alias = process.argv[2]
process.argv.splice(2, 1)

if (alias !== 'stable' && alias !== 'latest') return


var seaport = require('seaport')
  , optimist = require('../lib/optimist.js')

optimist
  .usage( [ 'Usage: sheep ' + alias + ' service@version'
          ].join('\r\n'))
  .demand(1)

var argv = optimist.read()

var ports = seaport.connect(argv.port, argv.host, argv)

ports.up(function(remote) {
  var service = argv._[0]
    , version = argv._[1]

  if (!version) {
    service = service.split('@', 2)
    version = service[1] || ''
    service = service[0] || ''
  }


  remote[alias](service, version, function(err, v) {
    if (err) {
      console.error(err)
    } else if (version) {
      console.log(('Set ' + alias + ' version for ' + service.green + ' to ' + version.green))
    } else {
      console.log(v)
    }
    ports.close()
  })

})
