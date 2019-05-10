import time, string
import click
from datetime import datetime
from dateutil.parser import parse


def get_datetime():
    """
    Utility function for returning a common standard datetime
    :return:
    """
    return datetime.fromtimestamp(time.time()).strftime('%Y-%m-%d %H:%M:%S')


def clean_concat(content):
    """
    Utility function for returning cleaned strings into a normalized format for keys
    :param content:
    :return:
    """
    try:
        content = content.lower().translate(str.maketrans('', '', string.punctuation)).replace(" ", "")
    except Exception as e:
        click.echo('%s %s' % (get_datetime(), str(e)))
        content = None

    return content


def clean(content):
    """
    Utility function for returning cleaned strings into a normalized format for keys
    :param content:
    :return:
    """
    try:
        content = str(content.replace("'", "").replace('"', ''))
    except Exception as e:
        click.echo('%s %s' % (get_datetime(), str(e)))
        content = None

    return content

def change_if_date(date_string, fuzzy=False):
    """
    Return a date if the string is possibly in a date format within the list of date_formats.

    :param date_string: str, string to check for date
    :param fuzzy: bool, ignore unknown tokens in string if True
    """
    date_formats = [
        '%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %Z', '%A, %D %B %Y %H:%M:%S %z', '%A, %D %B %Y %H:%M:%S %Z',
        '%A, %D %B %y %h:%m:%s %z', '%a, %d %b %y %h:%m:%s %z', '%a, %d %b %y %h:%m:%s %Z','%a, %D %b %Y %H:%M:%S %Z',
        '%m/%d/%y, %I:%M %p', '%M/%d/%y, %I:%M %p', '%M/%D/%y, %I:%M %p', '%M/%D/%Y, %I:%M %p',
        '%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y', '%Y-%M-%D', '%Y/%M/%D', '%D-%M-%Y', '%D/%M/%Y',
        '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S', '%d-%m-%Y %H:%M:%S', '%d/%m/%Y %H:%M:%S',
        '%Y-%m-%d %H:%M', '%Y/%m/%d %H:%M', '%d-%m-%Y %H:%M', '%d/%m/%Y %H:%M',
                    ]
    try:
        parse(date_string, fuzzy=fuzzy)
        try:
            for df in date_formats:
                try:
                    dt = datetime.strptime(date_string, df)
                    return dt
                except:
                    pass
        except Exception as e:
            click.echo('%s %s' % (get_datetime(), str(e)))
        return False

    except ValueError:
        return False
