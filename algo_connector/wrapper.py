import requests
import simplejson
import datetime

class InfoError(Exception):

    def __init__(self, msg, data):
        Exception.__init__(self, msg)
        self.data = data

class AutoStocks:
    '''Primary class to communicate with the AutoStocks web app'''

    def __init__(self, username, password):
        self.credentials = {'username': username, 'password': password}
        self.session = requests.Session()
        login = self.session.post("http://localhost:4800/login",
                                  data=self.credentials)
        login.raise_for_status()
        error_strings = ['invalid username', 'username is taken',
                         'that password is incorrect']
        if any([str in login.text.lower() for str in error_strings]):
            raise ValueError('Invalid login credentials')

    @staticmethod
    def _format(lst):
        '''Internal method to take a list of strings and return a
           comma-separated string containing all of them'''

        if isinstance(lst, str):
            return lst
        query_string = lst[0]
        for string in lst[1:]:
            query_string += (',' + string)
        return query_string

    def get_price(self, symbol):
        '''Returns a stock's latest price using the IEX API.
           Symbol can either be a one-symbol string or a list of symbols
        '''

        url_base = "https://api.iextrading.com/1.0/stock/"
        if isinstance(symbol, str):
            url = url_base + "{}/quote".format(symbol)
            param = {'filter': 'latestPrice'}
            try:
                price = requests.get(url, params=param).json()
            except simplejson.decoder.JSONDecodeError:
                raise ValueError('Invalid symbol: "{}"'.format(symbol))
            return price['latestPrice']
        else:
            try:
                iter(symbol)
            except TypeError:
                raise AttributeError('Input must be a string or an '+
                                     'iterable of strings.')
            url = url_base + "market/batch"
            param = {'filter': 'latestPrice', 'types': 'quote',
                     'symbols': self._format(symbol)}
            price = requests.get(url, params=param).json()
            if len(price) < len(symbol):
                invalids = [s for s in symbol if s not in price]
                raise ValueError('Invalid symbol(s): {}'.format(str(invalids)))
            return {s: v['quote']['latestPrice'] for s, v in price.items()}

    def get_chart(self, symbols, mode='1m', filter=None):
        '''Returns historical stock data using IEX's API

           symbols -- either a one-symbol string or a list of symbols
           mode -- options are '5y', '2y', '1y', 'ytd', '6m',
                   '3m', '1m', '1d', 'dynamic', or a YYYYMMDD string.
           filter -- either a string or a list of strings. Check IEX API docs
                     for possible options.
        '''

        url_base = "https://api.iextrading.com/1.0/stock/"
        valid_modes = {'5y', '2y', '1y', 'ytd', '6m', '3m', '1m', '1d',
                       'dynamic'}
        year = datetime.datetime.now().year
        is_date = lambda date: (isinstance(date, str) and len(date) == 8 and
                                int(date[:4]) - year in [1, 0])
        if mode not in valid_modes and not is_date(mode):
            raise AttributeError('Invalid mode provided.')
        if filter and 'date' not in filter:
            print('Warning: "filter" argument missing "date" parameter.')
        filter = self._format(filter)
        if isinstance(symbols, str):
            url = url_base + "{0}/chart/{1}".format(symbols, mode)
            return requests.get(url, params={'filter': filter}).json()
        else:
            try:
                iter(symbols)
            except TypeError:
                raise AttributeError('Symbol argument must be a string or '+
                                     'an iterable of strings.')
            url = url_base + "market/batch"
            inputs = {
                'symbols': self._format(symbols),
                'types': 'chart',
                'range': mode,
                'filter': filter
            }
            chart_data = requests.get(url, params=inputs).json()
            if len(chart_data) < len(symbols):
                invalids = [s for s in symbols if s not in price]
                raise ValueError('Invalid symbol(s): {}'.format(str(invalids)))
            return {s: v['chart'] for s, v in chart_data.items()}

    def get_holdings(self):
        '''Returns a list of dicts representing the table shown on the web
           app'''

        return self.session.post('http://localhost:4800/table').json()

    def buy(self, symbol, number):
        '''Buy (number) shares of (symbol). Throws InfoError if transaction
           fails. Returns new balance otherwise
        '''

        buy_params = {'number': number, 'price': self.get_price(symbol),
                      'symbol': symbol}
        buy = self.session.post('http://localhost:4800/buy',
                                data=buy_params).json()
        if buy['failed']:
            raise InfoError(buy['message'], buy['balance'])
        return buy['balance']

    def sell(self, symbol, number):
        '''Buy (number) shares of (symbol). Throws InfoError if transaction
           fails. Returns new balance otherwise
        '''

        sell_params = {'number': number, 'price': self.get_price(symbol),
                       'symbol': symbol}
        sell = self.session.post('http://localhost:4800/sell',
                                 data=sell_params).json()
        if sell['failed']:
            raise InfoError(sell['message'], sell['balance'])
        return sell['balance']

    def get_balance(self):
        '''Return current account balance.'''

        try:
            price = self.buy('googl', 5000000)
        except AttributeError as e:
            return e.data
        else:
            self.sell('googl', 5000000)
            return price['balance']


if __name__ == "__main__":
    x = AutoStocks('bobby', '1234')
