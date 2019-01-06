// Dependencies
const backend = require('./controllers')
const User = require('./models/User')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const app = express()

// Configuration, some code borrowed from passport js documentation
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret: 'hobbs' }));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'pug')
app.set("views", path.join(__dirname, "views"))

passport.use(new LocalStrategy(
    function (username, password, passBack) {
        User.findUser(username, function (err, user) {
            if (err) {
                return done(err);
            } else if (!user) {
                return done(null, false, { message: 'Invalid username.' });
            } else if (!user.verify(password)) {
                return done(null, false, { message: 'Incorrect password.' });
            } else {
                theId = user.id;
                return done(null, user);
            }
        });
    }
));

// Miscellaneous variables
var thePrice;
var balance;
var theId;


// Routes
app.post('/login',
  passport.authenticate('local', { successRedirect: '/',
                                   failureRedirect: '/login',
                                   failureFlash: true })
);

app.post('/register', function (req, res) {
    console.log(req.body.username);
    console.log(req.body.password);
});

app.post('/checkprice', function (req, res) {
    theSymbol = req.body.symbol
    backend.getCurrentPrice(req.body.symbol, function (price, symbol) {
        thePrice = price;
        res.render('main', {cost: price});
    })
     // with price displayed
});

app.post('/buy', function (req, res) {
    console.log(theSymbol)
    console.log(thePrice)
    console.log(req.body.number)
    console.log('buy')
})

app.post('/sell', function (req, res) {
    console.log('sell');
});

app.get('/', function (req, res) {
    res.render('main.pug');
});

app.listen(4800, function () {
    backend.initDB();
    console.log('listening on port 4800');
});
