import click

from flask import Flask

from fioriapp.blueprints.home import home
from fioriapp.blueprints.orientdb import orientdb
from fioriapp.utils import get_datetime

def create_app():
    """
    Create a Flask application using the app factory pattern.

    :param settings_override: Override settings
    :return: Flask app
    """

    app = Flask(__name__)
    app.config.from_object('config.settings')
    app.config.from_pyfile('settings.py', silent=True)
    app.register_blueprint(home)
    app.register_blueprint(orientdb)
    click.echo('[%s_app] All blueprints registered' % (get_datetime()))

    return app




