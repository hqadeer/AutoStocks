// Dependencies
const backend = require('./controllers')
const db = require('./config/db')
const User = require('./models/User')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const flash = require('connect-flash')
const app = express()

// Configuration, some code borrowed from Passport docs
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'hobbs',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'pug')
app.set("views", path.join(__dirname, "views"))

// Passport configuration

passport.use('local-login', new LocalStrategy({
    passReqToCallback: true },
    function (req, username, password, passBack) {
        User.findUser(username, function (err, user) {
            if (err) {
                return passBack(err);
            } else if (!user) {
                return passBack(null, false, req.flash('message',
                                                       'Invalid username.'));
            } else if (!user.verify(password)) {
                return passBack(null, false, req.flash('message', 'Oops! That '+
                                                       'password is '+
                                                       'incorrect!'));
            } else {
                return passBack(null, user);
            }
        });
    }
));

passport.use('local-signup', new LocalStrategy(User.register));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});


// Miscellaneous variables
var thePrice;
var theSymbol;

function isAuth (req, res, call) {
    if (req.isAuthenticated()) {
        return call();
    }
    res.redirect('/login');
}


// Routes
app.get('/login', function (req, res) {
    console.log(req.flash('loginMessage'));
    res.render('login', { message: req.flash('loginMessage') });
});

app.post('/login',
    passport.authenticate('local-login', { successRedirect: '/',
                                           failureRedirect: '/login',
                                           failureFlash: true })
);

app.get('/signup', function (req, res) {
    res.render('signup', { message: req.flash('loginMessage') });
})

app.post('/signup',
    passport.authenticate('local-signup', { successRedirect: '/',
                                            failureRedirect: '/signup',
                                            failureFlash: true })
);

app.get('/logout', function (req, res){
    req.session.destroy(function (err) {
        res.redirect('/');
    });
});

app.post('/checkprice', isAuth, function (req, res) {
    console.log(req.body)
    theSymbol = req.body.symbol
    backend.getCurrentPrice(req.body.symbol, function (price, symbol) {
        thePrice = price;
        res.render('main', {cost: price});
    })
     // with price displayed
});

app.post('/buy', isAuth, function (req, res) {
    backend.buy(req.user.id, theSymbol, thePrice, req.body.number,
        function (err, msg) {
            if (err) {
                throw err;
            }
            res.render('main', {cost: thePrice, message: msg});
        }
    );
})

app.post('/sell', isAuth, function (req, res) {
    backend.sell(req.user.id, theSymbol, thePrice, req.body.number,
        function (err, msg) {
            if (err) {
                throw err;
            }
            res.render('main', {cost: thePrice, message: msg});
        }
    );
});

app.get('/', isAuth, function (req, res) {
    res.render('main.pug');
});

app.listen(4800, function () {
    db.init()
    console.log('listening on port 4800');
});
