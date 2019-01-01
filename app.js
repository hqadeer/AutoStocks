/* Dependencies */
const backend = require('./index')
const path = require('path')
const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))

app.set('view engine', 'pug')
app.set("views", path.join(__dirname, "views"))

app.get('/checkprice', function (req, res) {
    backend.getCurrentPrice(req.query.symbol, function (price) {
        res.render('main', {cost: price})
    })
     // with price displayed
})

app.get('/', function (req, res) {
    res.render('main.pug')
})

app.listen(4800, function () {
    console.log('example')
})

