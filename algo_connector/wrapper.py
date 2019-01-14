import requests
import simplejson

class HttpError(Exception):
    pass

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
            raise AuthError('Invalid login credentials')
        self.cache = []

    def get_price(self, symbol, mode='current'):
        if mode == 'current':
            print('here')
            url = "https://api.iextrading.com/1.0/stock/{}/quote".format(symbol)
            param = {'filter': 'latestPrice'}
            try:
                price = requests.get(url, params=param).json()
            except simplejson.decoder.JSONDecodeError:
                raise ValueError('Invalid symbol: "{}"'.format(symbol))
            return price['latestPrice']


    def buy(self, symbol, number):
        buy_params = {'number': number, 'price': self.get_price(symbol),
                      'symbol': symbol}
        buy = self.session.post('http://localhost:4800/buy',
                                data=buy_params).json()
        print(buy)


if __name__ == "__main__":
    x = AutoStocks('bobby', '1234')
