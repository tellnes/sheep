#!/usr/bin/env node

var sheep = require('..')
  , optimist = require('optimist')
  , net = require('net')


var argv = optimist
  .usage('Setup a sheep server')

  .describe('http-port', 'HTTP Proxy port')
  .default('http-port', 8080)

  .describe('http-host', 'HTTP Proxy host')
  .default('http-host', '0.0.0.0')

  .describe('xforward', 'Add common proxy headers')
  .boolean('xforward')
  .default('xforward', true)

  .describe('sea-port', 'Seaport port')
  .default('sea-port', 7000)
  .alias('sea-port', 'p')

  .describe('sea-host', 'Seaport host')
  .default('sea-host', '127.0.0.1')

  .describe('range', 'Seaport port range')
  .default('range', '*:10000-20000')
  .alias('range', 'r')

  .describe('secret', 'Seaport secret')
  .alias('secret', 's')

  .describe('rootname', 'Root domain name')

  .describe('uuid', 'UUID Header name')
  .default('uuid', 'X-UID')

  .describe('datafile', 'Datafile')
  .default('datafile', 'sheep.json')
  .alias('datafile', 'datafile')

  .describe('default-target-port', 'Default proxy target port')

  .describe('default-target-host', 'Default proxy target host')

  .describe('mdns', 'Setup mdns advertisement')

  .describe('silent', 'Silent mode')
  .boolean('silent')

  .describe('help', 'You\'re staring at it')
  .boolean('help')
  .alias('help', 'h')

  .argv


if (argv.help) {
  optimist.showHelp()
  return
}


// Parse range attribute

var ranges = {}
if (!Array.isArray(argv.range)) argv.range = [argv.range]
argv.range.forEach(function(range) {
  range = range.split(':', 2)
  ranges[range[0]] = range[1].split('-', 2).map(Number)
})

Object.keys(ranges).forEach(function(addr) {
  if (addr !== '*' && !net.isIP(addr)) {
    console.error(addr + ' is not an valid ip address')
    process.exit()
  }

  var range = ranges[addr]
  if (range[0] > range[1] || range[1] > 65535 || range[0] <= 0) {
    console.error('Invalid port range for address ' + addr)
    process.exit()
  }
})

argv.range = ranges



var server = sheep(argv)

server.listen ( [ argv['sea-port']
                , argv['sea-host']
                ]
              , [ argv['http-port']
                , argv['http-host']
                ]
              )
