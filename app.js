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
    backend.getCurrentPrice(req.body.symbol, function (price, symbol) {
        console.log(symbol)
        thePrice = price;
        res.render('main', {cost: price});
    })
     // with price displayed
})

app.post('/buyorsell', function (req, res) {
    alert('not done yet')
})

app.get('/', function (req, res) {
    res.render('main.pug');
})

app.listen(4800, function () {
    console.log('listening on port 4800');
})
