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
app.use(express.static('views'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'hobbs',
    resave: false,
    saveUninitialized: true
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'pug')
app.set("views", path.join(__dirname, "views"))

// Passport configuration for logins and signups
passport.use('local-login', new LocalStrategy(
    { passReqToCallback: true },
    function (req, username, password, passBack) {
        User.findUser(username, function (err, user) {
            if (err) {
                return passBack(err);
            } else if (!user) {
                return passBack(null, false, req.flash('authMessage',
                                                       'Invalid username.'));
            } else if (!user.verify(password)) {
                return passBack(null, false, req.flash('authMessage',
                                                       'Oops! That '+
                                                       'password is '+
                                                       'incorrect!'));
            } else {
                return passBack(null, user);
            }
        });
    }
));

passport.use('local-signup', new LocalStrategy(
    { passReqToCallback: true },
    function (req, username, password, done) {
        User.register(username, password, function (err, user) {
            if (err) {
                return done(err);
            } else if (!user) {
                return done(null, false, req.flash('authMessage',
                                                   'Username is taken.')
                );
            } else {
                return done(null, user);
            }
        })
    }
));

// Passport serialization and deserialization
passport.serializeUser(function(user, done) {
    done(null, { id: user.id });
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});


// Check if user is logged in
function isAuth (req, res, call) {
    if (req.isAuthenticated()) {
        return call();
    }
    res.redirect('/login');
}


// Routes
app.get('/login', function (req, res) {
    res.render('login', { message: req.flash('authMessage') });
});

app.post('/login',
    passport.authenticate('local-login', { successRedirect: '/',
                                           failureRedirect: '/login',
                                           failureFlash: true })
);

app.get('/signup', function (req, res) {
    res.render('signup', { message: req.flash('authMessage') });
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

app.post('/buy', isAuth, function (req, res, next) {
    console.log('buy');
    let price = parseFloat(req.body.price, 10);
    let number = parseFloat(req.body.number, 10);
    backend.buy(req.user.id, req.body.symbol, price, number,
        function (err, msg, balance, failed) {
            if (err) {
                next(err);
            }
            res.json({ message: msg, balance: balance, failed: failed });
        }
    );
});

app.post('/sell', isAuth, function (req, res, next) {
    console.log('sell');
    let price = parseFloat(req.body.price, 10);
    let number = parseFloat(req.body.number, 10);
    backend.sell(req.user.id, req.body.symbol, price, number,
        function (err, msg, balance, failed) {
            if (err) {
                next(err);
            }
            res.json({ message: msg, balance: balance, failed: failed });
        }
    );
});

app.post('/table', isAuth, function (req, res, next) {
    console.log('table');
    backend.genTable(req.user.id, function (err, results) {
        if (err) {
            next(err);
        }
        res.json(results);
    });
});

app.get('/', isAuth, function (req, res, next) {
    console.log('home');
    db.getConn(function (err, conn) {
        if (err) {
            next(err);
        }
        conn.query(
            'SELECT balance FROM users WHERE ID=?', [req.user.id],
            function (err, results, fields) {
                conn.release();
                if (err) {
                    next(err);
                }
                res.render('main.pug',
                           { balance: results[0].balance.toFixed(2) });
            }
        );
    });
});

// Initialize app
app.listen(4800, function () {
    db.init();
    backend.updatePrices();
    console.log('listening on port 4800');
});
