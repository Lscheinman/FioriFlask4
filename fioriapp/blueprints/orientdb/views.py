from flask import jsonify, Blueprint, request
from fioriapp.utils import get_datetime
from fioriapp.blueprints.orientdb.models import OdbServer, SimServer
from werkzeug.utils import secure_filename
from threading import Thread
import os, time, click, threading

# Start up the main model
orientdb = Blueprint('orientdb', __name__)
odbserver = OdbServer()
#odbserver.reset()
simserver = SimServer()
simserver.check_odb()
UPLOAD_FOLDER = odbserver.upload
ALLOWED_EXTENSIONS = odbserver.acceptable_files

stream = {'events':[]}

def load_views():
    views = {}
    for view in simserver.Actions_All:
        views[view] = odbserver.get_event_driven_calc_view(view)
        click.echo("[%s_load_views] %s" % (get_datetime(), view))

    return views


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def sim_thread():
    family_count = 1 # 3 seconds to make 2 families
    sim_run_count = 2

    click.echo("[%s_View_ThreadSim] Starting simulation with creating %d families" % (get_datetime(), family_count))
    i = 0
    while i < family_count:
        simserver.create_family()
        i += 1
    click.echo("[%s_View_ThreadSim] Starting %d simulation rounds" % (get_datetime(), sim_run_count))
    simserver.run_simulation(sim_run_count)
    click.echo("[%s_View_ThreadSim] Exporting snapshot JSON for starter set" % (get_datetime()))
    simserver.export_json()
    click.echo("[%s_View_ThreadSim] Complete with set up" % (get_datetime()))

def stream_data():

    i=0
    while stream:
        time.sleep(3)
        stream['events'].append({'time': get_datetime(), 'message': 'Test %d' % i})
        click.echo("[%s_View_ThreadStream] Running %d" % (get_datetime(), i))
        i+=1

@orientdb.route('/OrientDB/get_stream', methods=['POST'])
def get_stream():
    r = request.form.to_dict(flat=True)
    cur_len = len(stream['events'])
    cur_index = r['cur_index']

    return jsonify(
        {'new_index': cur_len,
         'old_index': cur_index,
         'payload': stream['events'][cur_index:cur_len - 1]
         }
    )

@orientdb.route('/OrientDB', methods=['GET'])
def home():

    sim = Thread(target=sim_thread, )
    stm = Thread(target=stream_data, )
    sim.start()
    click.echo("[%s_View_Home] Getting calc views" % (get_datetime()))
    views = load_views()
    click.echo("[%s_View_Home] Complete with calc views" % (get_datetime()))

    # App tile will always have an index applied to their model when 'GET"
    odata = {
        'status': 200,
        'message': '%s logged in' % get_datetime(),
        'd': {
            'index': odbserver.get_db_stats(),
            'demo_data': odbserver.fill_demo_data(),
            'clipboard': {
                'keys': [],
                'nodes': []
            },
            'dialogs': {
                'nodes': [],
                'lines': [],
                'groups': []
            },
            'files': [],
            'charts': {
                'ChartContainerData1.json': odbserver.get_model('ChartContainerData1.json'),
                'ChartContainerData2.json': odbserver.get_model('ChartContainerData2.json'),
                'ChartContainerData3.json': odbserver.get_model('ChartContainerData3.json')
            },
            'views': views,
            'network': odbserver.fill_demo_data_small()
        }
    }
    # Get a small net from each db
    current_selection = odata['d']['index'][0]
    current_selection['network'] = odata['d']['network'][current_selection['name']]
    odata['d']['current_selection'] = odata['d']['index'][0]
    click.echo("[%s_View_Home] Packaging model for client" % (get_datetime()))
    try:
        odata = jsonify(odata)
    except Exception as e:
        if "TypeError: '<' not supported between instances" in str(e):
            click.echo("[%s_View_Home] ERROR \n%s Showing oData" % (get_datetime(), odata))
        else:
            click.echo("[%s_View_Home] UNKNOWN ERROR" % (get_datetime()))
    click.echo("[%s_View_Home] Sending model to client" % (get_datetime()))
    return odata

@orientdb.route('/OrientDB/delete_db', methods=['POST'])
def delete_db():
    # TODO Error when attempting to drop db...test dropping in other conditions
    db_name = request.form.to_dict(flat=True)['db_name']
    for db in odbserver.databases:
        if db != db_name:
            odbserver.client.db_open(db, odbserver.user, odbserver.pswd)
            try:
                odbserver.databases.remove(db_name)
                odbserver.db_cache.pop(db_name)
                odbserver.client.db_drop(db_name)
            except:
                print('Error')
            break

    return jsonify(
        {'status': 200,
         'message': '%s deleted and %s opened' % (db_name, db), 'data': db,
         'd': {'results': odbserver.get_db_stats()}
        }
        )

@orientdb.route('/OrientDB/new_db', methods=['POST'])
def new_db():

    # Get the form values into a dictionary
    r = request.form.to_dict(flat=True)
    # Check if a name was received
    if len(str(r['db_name'])) > 0:
        # Check if the name is already taken
        if str(r['db_name']) in odbserver.databases:
            message = '%s already taken' % r['db_name']
        else:
            # All good so create the DB
            message = odbserver.create_db(r['db_name'], r['db_type'])
    else:
        message = 'No database name received'

    # Form the response
    odata = {
        'status': 200,
        'message': '%s %s' % (get_datetime(), message),
        'd': {
            'results': odbserver.get_db_stats(),
        }
    }

    return jsonify(odata)


@orientdb.route('/OrientDB/get_sample', methods=['POST'])
def get_sample():

    r = request.form.to_dict(flat=False)
    if 'db_classes[]' in r.keys():
        message = '%s %s' % (get_datetime(), 'Sample for %s ' % r['db_name'])
    else:
        message = '%s %s' % (get_datetime(), 'No classes found for %s ' % r['db_name'])
        r['db_classes[]'] = []

    # Form the response
    odata = {
        'status': 200,
        'message': message,
        'd': {
            'results': odbserver.get_sample(r['db_name'][0], r['db_classes[]']),
        }
    }
    odata['message'] = odata['message'] + 'with %d results' % len(odata['d']['results'])
    return jsonify(odata)


@orientdb.route('/OrientDB/retrieve', methods=['POST'])
def retrieve():

    r = request.form.to_dict(flat=True)
    message = 5
    odata = {
        'status': 200,
        'message': message,
        'd': {
            'results': odbserver.retrieve(
                db_name=r['db_name'],
                search_terms=r['search_terms'],
                class_filter=r['class_filter']
            )
        }
    }

    return jsonify(odata)

@orientdb.route('/OrientDB/search', methods=['POST'])
def search():

    r = request.form.to_dict(flat=True)
    odata = {
        'status': 200,
        'd': {
            'results': odbserver.retrieve(
                db_name=r['db_name'],
                search_terms=r['search_terms']
            )
        }

    }
    return jsonify(odata)


def get_atts_from_request(r, node_label):
    """

    :param r: Request dictionary from client POST
    :param node_label: Variable for situations such as multiple nodes within a dictionary.
            Expects 'node_propvals',
    :return:
    """
    icon = "sap-icon://calendar"
    title = 'Title'
    FirstName = LastName = ''
    i = 0
    propvals = []
    prop_val = {}
    for n in r:
        try:
            if '%s[%d][prop]' % (node_label, i) in n:
                prop_val = {'property': r['%s[%d][prop]' % (node_label, i)]}
            elif '%s[%d][value]' % (node_label, i) in n:
                prop_val['value'] = r['%s[%d][value]' % (node_label, i)]
                propvals.append(prop_val)
                i += 1
                if prop_val['label'] == 'icon':
                    icon = prop_val['value']
                if prop_val['label'] == 'title':
                    title = prop_val['value']
                if prop_val['label'] == 'FirstName':
                    FirstName = prop_val['value']
                if prop_val['label'] == 'LastName':
                    LastName = prop_val['value']
            if '%s[attributes][%d][property]' % (node_label, i) in n:
                prop_val = {'label': r['%s[attributes][%d][property]' % (node_label, i)]}
            elif '%s[attributes][%d][label]' % (node_label, i) in n:
                prop_val = {'label': r['%s[attributes][%d][label]' % (node_label, i)]}
            elif '%s[attributes][%d][value]' % (node_label, i) in n:
                prop_val['value'] = r['%s[attributes][%d][value]' % (node_label, i)]
                propvals.append(prop_val)
                i += 1
                if prop_val['label'] == 'icon':
                    icon = prop_val['value']
                if prop_val['label'] == 'title':
                    title = prop_val['value']
                if prop_val['label'] == 'FirstName':
                    FirstName = prop_val['value']
                if prop_val['label'] == 'LastName':
                    LastName = prop_val['value']
        except Exception as e:
            click.echo(
                "[%s_View_get_atts_from_request] UNKNOWN ERROR %s" % (get_datetime(), str(e)))
    if FirstName != '':
        title = FirstName
    if LastName != '':
        title = title + ' ' + LastName

    return propvals, icon, title


@orientdb.route('/OrientDB/create', methods=['POST'])
def create():
    """
    General Create service which handles nodes and edges received from the Post
    Expects either to create a node or an edge but in either case it needs to reformat the dictionary into a state
    that can be used to create a node given the information from the client. This is in case the target database for
    insertion doesn't have the nodes being used when creating relationships.
    :return:
    """
    standard_icon = "sap-icon://calendar"
    r = request.form.to_dict(flat=True)
    # Node Create
    if 'node_type' in r.keys():
        propvals, icon, title = get_atts_from_request(r, 'node_propvals')
        odata = {
            'status': 200,
            'd': {
                'message': 'Created %s ' % (r['node_type']),
                'results': odbserver.create_node(icon=icon,
                                                 class_name=r['node_type'],
                                                 db_name=r['db_name'],
                                                 properties=propvals)
            }
        }
        odata['d']['message'] = odata['d']['message'] + odata['d']['results']['title']
        return jsonify(odata)
    # Line Create
    elif 'rel_type' in r.keys():
        # Relationship takes the selected node as the Target
        if r['rel_direction'] == 'In':
            source_node = r['b_node']
            target_node = r['a_node']
            if 'a_node_detail' in str(r.keys()):
                target_atts, target_icon, target_title = get_atts_from_request(r, 'a_node_detail')
            else:
                target_atts = []
                target_icon = standard_icon
            if 'b_node_detail' in str(r.keys()):
                source_atts, source_icon, source_title = get_atts_from_request(r, 'b_node_detail')
            else:
                source_atts = []
                source_icon = standard_icon
        # Relationship takes the selected node as the Source
        else:
            source_node = r['a_node']
            target_node = r['b_node']
            if 'a_node_detail' in str(r.keys()):
                source_atts, source_icon, source_title = get_atts_from_request(r, 'a_node_detail')
            else:
                source_atts = []
                source_icon = standard_icon
            if 'b_node_detail' in str(r.keys()):
                target_atts, target_icon, target_title = get_atts_from_request(r, 'b_node_detail')
            else:
                target_atts = []
                target_icon = standard_icon

        p_source = {'attributes': source_atts, 'icon': source_icon, 'title': source_title}
        p_target = {'attributes': target_atts, 'icon': target_icon, 'title': target_title}

        msg = odbserver.create_edge(
            db_name=r['db_name'],
            source_node=source_node,
            target_node=target_node,
            rel_type=r['rel_type'],
            source_atts=p_source,
            target_atts=p_target)

        return jsonify(
            {'status': 200,
             'd': {'message': msg,
                   'results': {'from': source_node, 'to': target_node}
                   }
             }
        )

    else:
        return jsonify(
            {'status': 201,
             'd': {'message': 'Node type or Link type not in post'}
             }
        )

@orientdb.route('/OrientDB/upload', methods=['POST', 'GET'])
def upload():
    """
    Files are uploaded to process into the graph.
    :return:
    """
    if request.method == 'POST':
        response = {'status': 200}
        if 'file' not in request.files:
            response['message'] = 'No file found in request'
            return jsonify(response)
        file = request.files['file']
        if file.filename == '':
            response['message'] = 'No file found in request'
            return jsonify(response)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            response['message'] = '%s saved to server and ready for processing' % filename
            response['data'] = {
                'filename': filename,
                'file_size': os.stat(os.path.join(UPLOAD_FOLDER, filename)).st_size,
                'file_type': filename[filename.rfind('.')+1:],
                'create_date': time.strftime(
                    '%Y-%m-%d %H:%M:%S', time.localtime(os.stat(os.path.join(UPLOAD_FOLDER, filename)).st_atime)),
                'd': odbserver.open_file(os.path.join(UPLOAD_FOLDER, filename))['d']
            }

    return jsonify(response)


@orientdb.route('/OrientDB/update', methods=['POST', 'GET'])
def update():
    """
    Files are uploaded to process into the graph.
    :return
    """
    r = request.form.to_dict(flat=True)
    i = 0
    response = {'status': 200}
    propvals = []
    prop_val = {}
    for n in r:
        if 'node_form[%d][label]' % i == n:
            prop_val = {'property': r['node_form[%d][label]' % i]}
        elif 'node_form[%d][value]' % i == n:
            prop_val['value'] = r['node_form[%d][value]' % i]
            propvals.append(prop_val)
            i+=1
    response['results'] = odbserver.update_node(
        con_id=r['node'],
        db_name=r['db_name'],
        propvals=propvals
    )

    return jsonify(response)

@orientdb.route('/OrientDB/delete', methods=['POST', 'GET'])
def delete():
    """
    Files are uploaded to process into the graph.
    :return
    """
    r = request.form.to_dict(flat=True)
    response = {'status': 200}
    response['results'] = odbserver.delete_node(
        con_id=r['node'],
        db_name=r['db_name']
    )

    return jsonify(response)


@orientdb.route('/OrientDB/traverse', methods=['POST', 'GET'])
def traverse():
    """
    Files are uploaded to process into the graph.
    :return
    """
    r = request.form.to_dict(flat=True)
    prep_r = odbserver.prepare_graph(r)
    response = {
        'status': 200,
        'results': odbserver.get_node(db_name=r['db_name'],
                                      con_id=r['key'],
                                      cur_graph=prep_r['cur_graph'],
                                      trav_type=r['trav_type'])
    }
    if len(response['results']) == 0:
        response['message'] = 'No relations'
    else:
        response['message'] = 'Found %d relations' % response['results']['rel_count']

    return jsonify(response)

