/* Dependencies */
const backend = require('./index')
const express = require('express')
const app = express()

app.set('view engine', 'ejs')

app.get('/', function (req, res) {
    res.send('hello')
})

app.listen(3000, function () {
    console.log('example')
})