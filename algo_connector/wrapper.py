import requests
import simplejson

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

    def get_price(self, symbol, mode='single'):
        url_base = "https://api.iextrading.com/1.0/"
        if mode == 'single':
            url = url_base + "stock/{}/quote".format(symbol)
            param = {'filter': 'latestPrice'}
            try:
                price = requests.get(url, params=param).json()
            except simplejson.decoder.JSONDecodeError:
                raise ValueError('Invalid symbol: "{}"'.format(symbol))
            return price['latestPrice']
        elif mode == 'batch':
            if isinstance(symbol, str):
                raise AttributeError('Batch mode accepts an iterable of '+
                                     'strings')
            try:
                iter(symbol)
            except TypeError:
                raise AttributeError('Batch mode acccepts an iterable of '+
                                     'strings')
            url = url_base + "stock/market/batch"
            param = {'filter': 'latestPrice', 'types': 'quote',
                     'symbols': symbol}
            price = requests.get(url, params=param).json()
            if len(price) < len(symbol):
                invalids = [s for s in symbol if s not in price]
                return ValueError('Invalid symbol(s): {}'.format(str(invalids)))
            return {s: v['quote']['latestPrice'] for s, v in price.items()}

    # To do: get_charts

    def get_holdings(self):
        '''Returns a list of dicts representing the table shown on the web
           app'''

        return self.session.post('http://localhost:4800/table').json()

    def buy(self, symbol, number):
        '''Buy (number) shares of (symbol). Throws InfoError if transaction
           fails. Returns new balance otherwise'''

        buy_params = {'number': number, 'price': self.get_price(symbol),
                      'symbol': symbol}
        buy = self.session.post('http://localhost:4800/buy',
                                data=buy_params).json()
        if buy['failed']:
            raise InfoError(buy['message'], buy['balance'])
        return buy['balance']

    def sell(self, symbol, number):
        sell_params = {'number': number, 'price': self.get_price(symbol),
                       'symbol': symbol}
        sell = self.session.post('http://localhost:4800/sell',
                                 data=sell_params).json()
        if sell['failed']:
            raise InfoError(sell['message'], sell['balance'])
        return sell['balance']

    def get_balance(self):
        try:
            price = self.buy('googl', 5000000)
        except AttributeError as e:
            return e.data
        else:
            self.sell('googl', 5000000)
            return price['balance']


if __name__ == "__main__":
    x = AutoStocks('bobby', '1234')
