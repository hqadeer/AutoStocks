/* Dependencies */
const backend = require('./index')
const path = require('path')
const express = require('express')
const app = express()

var thePrice;
var balance;

const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))

app.set('view engine', 'pug')
app.set("views", path.join(__dirname, "views"))

app.post('/checkprice', function (req, res) {
    theSymbol = req.body.symbol
    backend.getCurrentPrice(req.body.symbol, function (price, symbol) {
        thePrice = price;
        res.render('main', {cost: price});
    })
     // with price displayed
})

app.post('/buy', function (req, res) {
    console.log(theSymbol)
    console.log(thePrice)
    console.log(req.body.number)
    console.log('buy')
})

app.post('/sell', function (req, res) {
    console.log('sell');
})

app.get('/', function (req, res) {
    res.render('main.pug');
})

app.listen(4800, function () {
    backend.initDB();
    console.log('listening on port 4800');
})
