var colors = require('colors')
  , optimist = require('optimist')

exports = module.exports = optimist(process.argv.slice(2))



exports
  .describe('p', 'Port')
  .alias('p', 'port')

  .describe('h', 'Host')
  .alias('h', 'host')

  .describe('s', 'Secret')
  .alias('s', 'secret')


exports.read = function() {
  var argv = exports.argv

  if (argv.help) {
    optimist.showHelp()
    process.exit()
  }

  var env = process.env
  if (!argv.port && !env.SEAP_PORT) {
    console.error('Missing port number. Use the -p argument or set the envirioments variable SEAP_PORT.'.red)
    process.exit()
  }

  if (!argv.port && env.SEAP_PORT) argv.port = env.SEAP_PORT
  if (!argv.host && env.SEAP_HOST) argv.host = env.SEAP_HOST
  if (!argv.secret && env.SEAP_SECRET) argv.secret = env.SEAP_SECRET

  return argv

}
