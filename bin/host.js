#!/usr/bin/env node

var seaport = require('seaport')
  , optimist = require('../lib/optimist.js')

optimist
  .usage( [ 'Usage: sheep host <command> [args]'
          , ''
          , 'Commands:'
          , ''
          , ' list [<service>[@<version>]]'
          , ' add <hostname> <service>[@<version>]'
          , ' del <hostname>'
          ].join('\r\n'))
  .demand(1)


var argv = optimist.read()
var cmd = argv._[0]

if (!~['list', 'add', 'del'].indexOf(cmd)) return optimist.showHelp()

var ports = seaport.connect(argv.port, argv.host, argv)

function responseHandle(cb) {
  return function(err, info) {
    if (err) {
      console.error(err)
    } if (typeof cb === 'function') {
        cb(info)
    } else {
      if (cb) {
        console.log(cb)
      }
      if (info) {
        console.log(info)
      }
      if (!info && !cb) {
        console.log('Success'.green)
      }
    }
    ports.close()
  }
}

ports.up(function(remote) {

  if (cmd === 'list') {
    remote.hosts.list(argv._[1], responseHandle())

  } else if (cmd === 'add') {
    remote.hosts.add(argv._[1], argv._[2], responseHandle((argv._[1] + ' is now assosiated with ' + argv._[2]).green))

  } else if (cmd === 'del') {
    remote.hosts.del(argv._[1], responseHandle((argv._[1] + ' is no longer assosiated with any service ').green))

  }
})
