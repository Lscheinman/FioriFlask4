from flask import render_template, Blueprint, jsonify, request
from fioriapp.utils import get_datetime
import time, click
import threading

home = Blueprint('home', __name__)
stream = {'events': []}

@home.route('/', methods=['GET', 'POST'])
def index():

    t = threading.Thread(target=stream_data, )
    t.start()

    return render_template("index.html")

@home.route('/get_init_data', methods=['GET', 'POST'])
def get_init_data():
    # Launchpad model

    oData = {
        "caseItems": [
            {
                "title": "Spoon family",
                "subtitle": "Assessment change",
                "measure": "2019-05-01 hlth",
                "status": "success",
                "statusSchema": 8
            },
            {
                "title": "Social media trend",
                "subtitle": "Misinformation MEME",
                "measure": "8.2M posts",
                "status": "exceeded",
                "statusSchema": 3
            },
            {
                "title": "Individual risk",
                "subtitle": "New case in Hereford",
                "measure": "2019-05-01 empl",
                "status": "warning",
                "statusSchema": 1
            }
        ],
        "recentItems": [
            {
                "title": "Onboarding",
                "subtitle": "Tracking",
                "icon": "sap-icon://clinical-tast-tracker",
                "color": "#0092D1"
            },
            {
                "title": "Team Calendar",
                "subtitle": "Social services, specialist teams",
                "icon": "sap-icon://appointment",
                "color": "#E6600D"
            },
            {
                "title": "Published Reports",
                "subtitle": "Subscription and enterprise knowledge",
                "icon": "sap-icon://business-objects-experience",
                "color": "#E09D00"
            }
        ],
        "usedItems": [
            {
                "title": "Email",
                "icon": "sap-icon://email",
                "color": "#0092D1"
            },
            {
                "title": "Messenger",
                "icon": "sap-icon://message-popup",
                "color": "#0092D1"
            },
            {
                "title": "Support",
                "icon": "sap-icon://travel-request",
                "color": "#0092D1"
            }
        ],
        "activityItems":
            [
                {
                    "Title": "Extraction review request | Education",
                    "Text": "Data gaps exist among maps between new charter schools and current model.",
                    "Icon": "sap-icon://appointment-2",
                    "Date": "Requested 3 days ago | Expected today at 16:00"
                },
                {
                    "Title": "Rule configuration request | Crime",
                    "Icon": "sap-icon://my-view",
                    "Text": "Five cases have been created in which the crime should not be considered a trigger",
                    "Date": "Requested yesterday | Expected tomorrow at 12:00"
                },
                {
                    "Title": "New source request | Social media'",
                    "Icon": "sap-icon://outgoing-call",
                    "Text": "Extra data from news needs to be integrated into a feed that we can related cases to",
                    "Date": "Requested yesterday | ETD TBD"
                }
            ],

        "mapItems":
            {
                "regionProperties":
                    [
                        {"code": "EU", "legend": "Europe", "color": "rgba(184,225,245,1.0)",
                         "tooltip": "Europe\r\n\r\nPopulation: 743 Mio"},
                        {"code": "NA", "legend": "North America", "color": "rgba(5,71,102,1.0)"},
                        {"code": "AS", "legend": "Asia", "color": "rgba(92,186,229,1.0)"}
                    ],

                "Spots":
                    [
                        {
                            "pos": "37.622882;55.755202;0",
                            "tooltip": "Moscow",
                            "type": "Inactive",
                            "text": "Inactive"
                        },
                        {
                            "pos": "77.1024902;28.7040592;0",
                            "tooltip": "Delhi",
                            "type": "Success",
                            "text": "Success"
                        },
                        {
                            "pos": "-74.013327;40.705395;0",
                            "tooltip": "New York",
                            "type": "Error",
                            "text": "Error"
                        },
                        {
                            "pos": "116.407072;39.906235;0",
                            "tooltip": "Beijing",
                            "type": "Warning",
                            "text": "Warning"
                        }
                    ]
            }
            }

    oData["message"] = "You have %d new alerts and %d processed requests underway in the timeline" % (len(oData['caseItems']), len(oData['activityItems']))

    return jsonify(oData)

def stream_data():

    i=0
    while stream:
        time.sleep(3)
        stream['events'].append({'time': get_datetime(), 'message': 'Test %d' % i})
        click.echo("[%s_View_ThreadStream] Running %d" % (get_datetime(), i))
        i+=1

@home.route('/get_stream', methods=['POST'])
def get_stream():
    r = request.form.to_dict(flat=True)
    cur_len = int(len(stream['events']))
    cur_index = int(r['cur_index'])
    payload = stream['events'][cur_index:cur_len - 1]
    click.echo("[%s_View_getStream] Running %d" % (get_datetime(), len(stream['events'])))

    #TODO update graph with new version
    #TODO Determine routing with multiple views and setting up the ODB as a stream and PUSHing data to graph

    return jsonify(
        {'new_index': cur_len,
         'old_index': cur_index,
         'payload': payload,
         'message': 'Found %d new events' % len(payload)
         }
    )
