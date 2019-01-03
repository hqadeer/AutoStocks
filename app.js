/* Dependencies */
const backend = require('./index')
const path = require('path')
const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))

app.set('view engine', 'pug')
app.set("views", path.join(__dirname, "views"))

app.post('/checkprice', function (req, res) {
    backend.getCurrentPrice(req.body.symbol, function (price) {
        res.render('main', {cost: price, data: {x: [1, 2, 3], y: [1, 2, 3]}})
    })
     // with price displayed
})

app.post('/checkandload', function (req, res) {
    console.log('here')
    backend.twoPlots(req.body.symbol, function (price, x1, y1, x2, y2) {
        res.render('main', {cost: price, xIntra: x1, yIntra: y1,
                            xDaily: x2, yDaily: y2})
    })
})

app.get('/', function (req, res) {
    res.render('main.pug');
})

app.listen(4800, function () {
    console.log('listening on port 4800');
})
