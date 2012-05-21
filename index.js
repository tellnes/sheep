
var seaport = require('seaport')
  , httpProxy = require('http-proxy')
  , RoutingProxy = httpProxy.RoutingProxy
  , EventEmitter = require('events').EventEmitter
  , semver = require('semver')
  , fs = require('fs')
  , path = require('path')
  , Cookies = require('cookies')
  , uuid = require('node-uuid').v4


module.exports = sheep


function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}



function sheep(opts) {
  opts = opts || {}

  var server = new EventEmitter()
    , datafile = opts.datafile ? path.resolve(opts.datafile) : process.cwd() + '/sheep.json'
    , rootnameRegexp = opts.rootname ? new RegExp(escapeRegExp(opts.rootname) + '$') : null
    , data
    , serviceCounter = 0
    , proxy = new RoutingProxy(opts)
    , ports = seaport.createServer(opts)
    , httpServers = []
    , logger = opts.logger || console
    , uuidHeader = opts.uuid
    , middlewares = []
    , defaultTarget
    , mdnsAds = []


  // Read data file
  try {
    data = JSON.parse(fs.readFileSync(datafile))
  } catch(err) { }

  if (typeof data !== 'object') data = {}

  data.services = data.services || {}
  data.hostnames = data.hostnames || {}


  // Setup seaport
  ports.on('free', function(service) {
    logger.info({action: 'free', data: service})

    // Delete proxies when an service goes offline so we dont leak memory
    proxy.remove(service)
  })

  ports.on('assume', function(service) {
    service.sid = ++serviceCounter
    logger.info({action: 'assume', service: service})
  })
  ports.on('allocate', function(service) {
    service.sid = ++serviceCounter
    logger.info({action: 'allocate', service: service})
  })


  // Default target
  if (opts['default-target-port']) {
    defaultTarget = { port: opts['default-target-port']
                    , host: opts['default-target-host'] || '127.0.0.1'
                    }
  }


  function logRequest(req, result, data) {
    data = data || {}
    data.action = 'handle'
    data.result = result
    data.host = req.headers.host
    data.path = req.url
    if (uuidHeader) { data.uid = req.uid }

    logger.info(data)
  }

  // Handle HTTP Requests

  function handle(req, res, next) {

    if (uuidHeader) {
      req.uid = uuid()
      req.headers[uuidHeader] = req.uid
      res.setHeader(uuidHeader, req.uid)
    }


    var service = lookupHostname(req.headers.host)
    if (!service) {
      if (defaultTarget) {
        logRequest(req, 'proxy', {defaultTarget: true})
        proxy.proxyRequest(req, res, defaultTarget)
        return
      }

      logRequest(req, 'ignore')
      runMiddleware('default', req, res, next, function() {
        res.status = 404
        res.end('Seap server')
      })
      return
    }


    var services = ports.query(service)
    if (!services.length) {
      logRequest(req, 'unavailable', {service: service})

      runMiddleware('unavailable', req, res, next, function() {
        res.statusCode = 503
        res.end('Service Unavailable')
      })
      // TODO: Add a nice "we'll be back soon" page
      return
    }


    var cookies = new Cookies(req, res)

    service = null

    // Route a user to the same process in a session
    var sid = Number(cookies.get('__sid'))
    if (sid) {
      services.some(function(s) {
        if (s.sid === sid) {
          service = s
          return true
        }
      })
    }

    // If no routing cookie or old route does not work any more
    if (!service) {
      service = services[Math.floor(Math.random()*services.length)]

      cookies.set('__sid', service.sid)
    }

    logRequest(req, 'proxy', {service: service})

    proxy.proxyRequest(req, res, {
      host: service.host,
      port: service.port
    })
  }

  function lookupHostname(hostname) {
    hostname = hostname.split(':')[0]

    var service, version, i

    if (rootnameRegexp && rootnameRegexp.test(hostname)) {
      service = hostname.substr(0, hostname.length - opts.rootname.length - 1)
      i = service.lastIndexOf('.')
      if (~i) {
        version = service.substring(0, i)
        if (!semver.valid(version)) return
        service = service.substring(i+1)
      }
    }

    if (!service && data.hostnames[hostname]) {
      service = data.hostnames[hostname].split('@', 2)
      version = service[1]
      service = service[0]
    }

    if (!service) return

    if (version === 'stable' || version === 'latest') {
      if (!data.services[service]) return

      version = data.services[service][version]
      if (!version) return
    }

    return service + (version ? ('@' + version) : '')
  }




  ;['stable', 'latest'].forEach(function(type) {
    server[type] = function(service, version, cb) {
      if (arguments.length === 2) {
        cb = version
        version = null
      }

      // Get
      if (!version) {
        version = data.services[service] && data.services[service][type]
        cb(null, version)
        return
      }

      // Set

      if (!semver.valid(version)) return cb(new Error('Invalid version'))

      if (!data.services[service]) {
        data.services[service] = {}
      }

      data.services[service][type] = version

      saveData(cb)
    }
  })

  server.hosts = {
    list: function(service, cb) {
      if (arguments.length === 1) {
        cb = service
        service = ''
      }

      var name = range = ''

      if (service) {
        name = service.split('@')[0]
        range = service.split('@')[1]
      }

      var hostnames = Object.keys(data.hostnames)

      if (name) {
        hostnames = hostnames.filter(function(hostname) {
          var v = data.hostnames[hostname].split('@')
            , n = v[0]
          v = v[1]

          if (name != n) return
          if (range && v && !semver.satisfies(v, range)) return

          return true
        })
      }

      var res = {}
      hostnames.forEach(function(hostname) {
        res[hostname] = data.hostnames[hostname]
      })

      cb(null, res)
    },

    add: function(hostname, service, cb) {
      data.hostnames[hostname] = service
      saveData(cb)
    },

    del: function(hostname, cb) {
      delete data.hostnames[hostname]
      saveData(cb)
    }
  }

  // Save data to disk.
  function saveData(cb) {
    var d = JSON.stringify(data, null, '  ')
    fs.writeFile(datafile, d, cb)
  }


  server.listen = function(seaport_args, http_args) {
    seaport_args = Array.isArray(seaport_args) ? seaport_args : [seaport_args]
    ports.listen.apply(ports, seaport_args)

    if (opts.mdns) {
      var mdns, ad
      try {
        mdns = require('mdns')
      } catch(e) {
        console.error('You need to `npm install mdns` to use mdns')
        process.exit()
      }
      ad = mdns.createAdvertisement(mdns.tcp('seaport'), seaport_args[0], {
        name: typeof opts.mdns === 'string' ? opts.mdns : 'sheep'
      })
      ad.start()
      mdnsAds.push(ad)
    }


    var dnode = ports._servers[ports._servers.length-1]

    dnode.use(function(remote, conn) {
      this.stable = server.stable
      this.latest = server.latest
      this.hosts = server.hosts

      // upnode swallows errors
      // TODO: Do somthing better here
      conn.on('error', function(err) {
        console.error(err.stack)
      })
    })


    // Create an http server if the second argument is something.
    if (http_args) {

      if (typeof http_args === 'number') {
        http_args = [http_args]
      }

      var hs

      if (http_args.https) {
        hs = require('https').createServer(http_args.https)

      } else {
        hs = require('http').createServer()

      }

      if (Array.isArray(http_args)) {
        hs.listen.apply(hs, http_args)
      } else {
        hs.listen(http_args.port, http_args.host)
      }

      hs.on('request', handle)

      httpServers.push(hs)
    }

    return {
      dnode: dnode,
      http: hs
    }
  }

  server.close = function() {
    ports.close()
    httpServers.forEach(function(hs) {
      hs.close()
    })
    mdnsAds.forEach(function(ad) {
      ad.stop()
    })
  }

  server.middleware = function(opts) {
    return handle
  }

  server.use = function(name, handle) {
    if (arguments.length === 1) {
      handle = name
      name = ''
    }

    middlewares.push({
      handle: handle,
      name: name
    })
  }

  function runMiddleware(name, req, res, out, intr) {
    var i = 0

    function end(err) {
      if (typeof out === 'function') {
        out(err)
      } else if (err) {
        server.emit('error', err)
      } else {
        intr()
      }
    }

    if (middlewares.length) {
      next()
    } else {
      end()
    }

    function next(err) {
      if (err) return end(err)

      var layer = middlewares[i++]
      if (!layer) return end()

      if (layer.name && layer.name !== name) return next()

      try {
        layer.handle(req, res, next)
      } catch(e) {
        return end(e)
      }

    }
  }

  return server

}
