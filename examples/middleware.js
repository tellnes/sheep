
var sheep = require('..')({
  rootname: 'example.com',
  uuid: 'X-UID'
})

var app = require('connect')()

app.use(sheep.middleware())

app.use(function(req, res) {
  res.statusCode = 404
  res.end('No souch service')
})

sheep.use('unavailable', function(req, res, next) {
  console.log('unavailable')
  next()
})
sheep.use('default', function(req, res, next) {
  console.log('default')
  next()
})
sheep.use(function(req, res, next) {
  console.log('forwarding to connect')
  next()
})

app.listen(8080) // Bind HTTP server to 8080
sheep.listen(7000) // Bind seaport server to port 7000
