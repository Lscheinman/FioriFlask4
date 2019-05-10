import pyorient
import json, random
import click
from fioriapp.utils import get_datetime, clean, clean_concat, change_if_date
import pandas as pd
import numpy as np
import os
import datetime, time


class OdbServer():

    def __init__(self):

        self.client = pyorient.OrientDB("localhost", 2424)
        self.user = 'root'
        self.pswd = 'admin'
        self.client.connect(self.user, self.pswd)
        self.databases = list(self.client.db_list().oRecordData['databases'].keys())
        self.db_index = []
        self.standard_classes = ['OFunction', 'OIdentity', 'ORestricted',
                                 'ORole', 'OSchedule', 'OSequence', 'OTriggered',
                                 'OUser', '_studio' ]
        self.db_cache = {}
        self.path = os.getcwd()
        self.data = os.path.join(self.path, "data")
        self.demo = os.path.join(self.data, "demo_network.json")
        self.upload = os.path.join(self.data, "upload")
        self.acceptable_files = ['csv', 'txt', 'xls', 'xlsx']
        self.files = []
        self.get_folders()
        self.index_limit = 50 # Limit setting for initializing the db_cache[db_name] : [index]
        self.demo_network = 'db.json'
        self.current_open = ''

        # DEMO SETUP
        self.Measure1 = {'mean': 40, 'stdev': 19.2}
        self.Measure2 = {'mean': 35, 'stdev': 15.26}
        self.Measure3 = {'mean': 40, 'stdev': 9.5}
        self.Measure4 = {'mean': 30, 'stdev': 7}
        self.small_demo_batch = 5

    def reset(self):

        for db in self.databases:
            self.client.db_drop(db, type="plocal")

        return


    def get_folders(self):
        try:
            for f in os.listdir(self.data):
                if os.path.isdir(os.path.join(self.data, f)):
                    for sub1 in os.listdir(os.path.join(self.data, f)):
                        if os.path.isdir(os.path.join(self.data, f, sub1)):
                            for sub2 in os.listdir(os.path.join(self.data, f, sub1)):
                                if os.path.isfile(os.path.join(self.data, f, sub1, sub2)):
                                    self.files.append(os.path.join(self.data, f, sub1, sub2))
                        elif os.path.isfile(os.path.join(self.data, f, sub1)):
                            self.files.append(os.path.join(self.data, f, sub1))
                elif os.path.isfile(os.path.join(self.data, f)):
                    self.files.append(os.path.join(self.data, f))
        except Exception as e:
            if 'FileNotFoundError' in str(e):
                pass
            else:
                click.echo('[%s_OdbServer_open_file] Failed to open. %s' % (get_datetime(), str(e)))


    def open_file(self, filename):
        #TODO method for each file type
        ftype = filename[filename.rfind('.'):]
        data = {'status': True, 'filename': filename, 'ftype': ftype}
        if ftype == '.csv':
            data['d'] = pd.read_csv(filename)
        elif ftype == '.xls' or type == '.xlsx':
            data['d'] = pd.read_excel(filename)
        elif ftype == '.json':
            try:
                with open(filename, 'r') as f:
                    data['d'] = json.load(f)
            except Exception as e:
                if 'JSONDecodeError: Expecting' in str(e):
                    click.echo('[%s_OdbServer_open_file] Failed to open %s\n%s\n\tOpening demo network' % (get_datetime(), filename, str(e)))
                    with open(self.demo, 'r') as f:
                        data['d'] = json.load(f)
                else:
                    click.echo('[%s_OdbServer_open_file] Failed to open %s\n%s' % (get_datetime(), filename, str(e)))

        elif ftype == '.txt':
            with open(filename) as f:
                for line in f:
                    (key, val) = line.split()
                    data[int(key)] = val
        else:
            data['status'] = False
            data['d'] = "File %s not in acceptable types" % ftype

        data['basename'] = os.path.basename(filename)
        data['file_size'] = os.stat(filename).st_size
        data['create_date'] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.stat(filename).st_atime))

        return data

    def list_files(self):
        """

        :return: response dictionary
        """
        i = 0
        response = {'status': True,
                    'files': self.files,
                    'message': '',
                    'file_obj': []}
        for f in self.files:
            response['message'] += '%s\t%s\n' % (i, f)
            i += 1

        return response

    def get_file_index(self, search_value):
        """
        To be used by views when looking for files by name
        :param search_value:
        :return: index if found, None if not
        """
        i = 0
        for f in self.files:
            if search_value in f:
                return i
            i += 1

    def get_db_stats(self):

        response = []
        for db in self.databases:
            click.echo('[%s_OdbServer_init] Opening %s for statistics' % (get_datetime(), db))
            try:
                if self.current_open != db:
                    self.client.db_open(db, self.user, self.pswd)
                    response.append({
                        'name': db,
                        'size': self.client.db_size(),
                        'records': self.client.db_count_records(),
                        'details': self.get_db_details(db),
                        'index': self.get_db_index(db, self.index_limit)
                    })
                    self.current_open = db

            except Exception as e:
                click.echo('[%s_OdbServer_init] Failed to open %s\n%s' % (get_datetime(), db, str(e)))

        self.db_index = response

        return response

    def create_db(self, db_name, db_type):
        """
        Assumes this is called only when a there is no existing DB so will drop one if found by same name
        :return:
        """
        if db_type == 'DB_TYPE_GRAPH':
            db_type = pyorient.DB_TYPE_GRAPH
        else:
            db_type = pyorient.DB_TYPE_DOCUMENT
        try:
            self.client.db_drop(db_name)
            click.echo('[%s_OdbServer_create_db] %s found so being dropped' % (get_datetime(), db_name))
        except Exception as e:
            if '.OStorageException' in str(e):
                click.echo('[%s_OdbServer_create_db] %s not found so being created' % (get_datetime(), db_name))
            else:
                click.echo('[%s_OdbServer_create_db] %s' % (get_datetime(), str(e)))

        self.client.db_create(db_name, db_type)
        if self.current_open != db_name:
            self.client.db_open(db_name, self.user, self.pswd)
            self.current_open = db_name

        self.client.batch('''
            create property V.con_id string;
            create index V_con_id on V (con_id) UNIQUE;
            create class Person extends V;
            create property Person.FirstName string;
            create property Person.LastName string;
            create property Person.OtherName string;
            create property Person.DateOfBirth datetime;
            create property Person.PlaceOfBirth string;
            create property Person.Gender string;
            create class Object extends V;
            create property Object.CreateDate datetime;
            create property Object.Category string;
            create property Object.Description string;
            create class Location extends V;
            create property Location.Latitude float;
            create property Location.Longitude float;
            create property Location.Category string;
            create property Location.Description string;
            create class Event extends V;
            create property Event.CreateDate datetime;
            create property Event.Description string;
            create sequence idseq type ordered;
        ''')
        self.databases.append(db_name)

        return ('[%s_OdbServer_create_db] %s created' % (get_datetime(), db_name))

    def check_open_db(self, db_name):
        """
        Utility to ensure the DB selected is the currently opened DB
        :param db_name:
        :return:
        """

        if db_name in self.databases:
            if self.current_open != db_name:
                self.client.db_open(db_name, self.user, self.pswd)
                self.current_open = db_name

    def get_event_driven_calc_view(self, db_name):
        """
        :param db_name:
        :return:
        """

        self.check_open_db((db_name))
        calc_view = []
        summary_view = {'index': [], 'M': 0, 'F': 0, 'U': 0}

        for r in self.client.command(
            '''match {class: Event, as: E}.out(){class: V, as: P} return 
            E.Type, E.CreateDate, E.Description, 
            P.FirstName, P.LastName, P.Gender, P.DateOfBirth, P.PlaceOfBirth, P.Type'''):
            age = "None"
            r = r.oRecordData
            for r_key in r:
                if type(r[r_key]) is datetime.datetime:
                    if r_key == 'P_DateOfBirth':
                        age = str(int((datetime.datetime.now() - r[r_key]).days/365))
                    r[r_key] = r[r_key].strftime("%Y-%m-%d %H:%M")

            R = {
                'Type': r['E_Type'],
                'Date': r['E_CreateDate'],
                'Description': r['E_Description'],
                'FirstName': r['P_FirstName'],
                'LastName': r['P_LastName'],
                'Gender': r['P_Gender'],
                'Age': age,
                'PlaceOfBirth': r['P_PlaceOfBirth'],
                'DateOfBirth': r['P_DateOfBirth'],
                'Name': "%s %s" % (r['P_FirstName'], r['P_LastName']),
                'RiskFam': abs(int(np.random.normal(loc=self.Measure1['mean'], scale=self.Measure1['stdev']))),
                'RiskInd': abs(int(np.random.normal(loc=self.Measure2['mean'], scale=self.Measure2['stdev']))),
                'Progress': abs(int(np.random.normal(loc=self.Measure3['mean'], scale=self.Measure3['stdev']))),
                'VisitCount': abs(int(np.random.normal(loc=self.Measure4['mean'], scale=self.Measure4['stdev']))),
            }
            calc_view.append(R)
            r_name = str(R['Name']).lower().replace(' ', '')
            # Update the summary view statistics
            if r_name not in summary_view['index']:
                summary_view['index'].append(r_name)
                summary_view[r_name] = 1
            else:
                summary_view[r_name]+=1
            if age not in summary_view['index']:
                summary_view['index'].append(age)
                summary_view[age] = 1
            else:
                summary_view[age]+=1
            if r['P_DateOfBirth'] not in summary_view['index']:
                summary_view['index'].append(r['P_DateOfBirth'])
                summary_view[r['P_DateOfBirth']] = 1
            else:
                summary_view[r['P_DateOfBirth']]+=1

            summary_view[r['P_Gender']]+=1

        return {'businessData': calc_view,
                'summaryView': summary_view}

    def get_db_details(self, db_name):
        if db_name in self.databases:
            self.check_open_db((db_name))
            schema = self.client.command('''select expand(classes) from metadata:schema ''')
            details = []
            for s in schema:
                s = s.oRecordData
                if s['name'] not in self.standard_classes:
                    try:
                        props = s['properties']
                        f_props = ""
                        prop_list = []
                        for p in props:
                            f_props = f_props + p['name'] + "\n"
                            prop_list.append(p['name'])
                        details.append(
                          {'name': s['name'],
                           'clusterIds': s['clusterIds'],
                           'properties': f_props,
                           'prop_dict': props,
                           'prop_list': prop_list
                           }
                        )
                    except:
                        pass

            return details

        else:
            return False

    def get_db_index(self, db_name, limit=None):
        """
        Get the common index key from any given db_name as long as it is in the server's cache
        If there is not an index for the DB in the db_cache, create one then append new records
        to it as long as they don't already exist
        Run the
        :param db_name:
        :param limit:
        :return: The list
        """
        if db_name in self.databases:
            self.check_open_db((db_name))
            click.echo('[%s_OdbServer_get_db_index] Getting %s index with limit value %s' % (get_datetime(), db_name, limit))
            if db_name not in self.db_cache.keys():
                self.db_cache[db_name] = []
            if isinstance(limit, int):
                try:
                    r = self.client.command('''select con_id from V limit %d''' % limit)
                # If there it fails it means this is a db_name with no con_id
                except Exception as e:
                    if str(e) == 'con_id':
                        self.client.batch('''
                            create property V.con_id string;
                            create index V_con_id on V (con_id) UNIQUE;
                            create sequence idseq type ordered;
                        ''')
            else:
                r = self.client.command('''select con_id from V''')
            for c in r:
                if 'con_id' in c.oRecordData.keys():
                    if c.oRecordData not in self.db_cache[db_name]:
                        self.db_cache[db_name].append(c.oRecordData['con_id'])
            click.echo('[%s_OdbServer_get_db_index] Complete %s index with %d records' %
                       (get_datetime(), db_name, len(self.db_cache[db_name])))

            return self.db_cache[db_name]

    def get_sample(self, db_name, db_classes):

        samples = []
        self.check_open_db((db_name))
        if len(db_classes) < 2:
            db_classes = ['V', 'E']
        for c in db_classes:
            r = 'select * from %s limit 25' % c
            try:
                for s in self.client.command(r):
                    sample = {'class': c, 'detail': ''}
                    for prop in s.oRecordData:
                        if prop not in ['in', 'out'] and prop[:3] != 'in_' and prop[:4] != 'out_':
                            sample['detail'] = sample['detail'] + '%s:\t %s\n' % (prop, s.oRecordData[prop])
                    samples.append(sample)
            except Exception as e:
                click.echo('[%s_OdbServer_get_sample] ERROR RUNNING SQL: %s\n***%s***' %
                           (get_datetime(), str(e), r))

        return samples

    def fill_demo_data_small(self):
        db_small_nets = {}
        for db in self.databases:
            graph = {'nodes': [],
                     'lines': [],
                     'groups': [],
                     'nodekeys': [],
                     'groupkeys': []}

            click.echo('[%s_OdbServer_init] Opening %s for small network' % (get_datetime(), db))
            self.check_open_db(db_name=db)
            if db not in graph['groupkeys']:
                graph['groupkeys'].append(db)
                graph['groups'].append({'key': db, 'title': db})
            # Get the latest events and then get the networks to each of those
            latestEvents = self.client.command('''
                select * from Event order by CreateDate desc LIMIT %d
                ''' % self.small_demo_batch)
            for e in latestEvents:
                node_title = db
                e = e.oRecordData
                le_con_id = e['con_id']
                attributes = []
                for k in e.keys():
                    if 'con_id' in k:
                        pass
                    else:
                        if type(e[k]) not in [pyorient.otypes.OrientBinaryObject]:
                            attributes.append({'label': k, 'value': e[k]})
                        if 'CreateDate' in k:
                            node_title = '%s %s' % (node_title, e[k])
                if le_con_id not in graph['nodekeys']:
                    graph['nodekeys'].append(le_con_id)
                    graph['nodes'].append(
                        self.format_node(key=le_con_id,
                                         node_title='%s Event' % db,
                                         group=db,
                                         icon="sap-icon://calendar",
                                         attributes=attributes,
                                         db_name=db)
                    )

                sql = '''match {class: Event, as: u, where:( con_id ='%s')}.both(){class: V, as: e} 
                        return e.FirstName, e.LastName, e.DateOfBirth, e.PlaceOfBirth, e.Gender,
                        e.Latitude, e.Longitude, e.City, e.Country, e.Population, e.title, e.Description, e.Category,
                        e.icon, e.con_id,
                        u.CreateDate, u.Description''' % le_con_id
                for r in self.client.command(sql):
                    FirstName = LastName = Category = Latitude = Longitude = City = Country = 'Unknown'

                    r = r.oRecordData
                    icon = random.choice(['sap-icon://calendar', 'sap-icon://account'])
                    if r['e_con_id'] not in graph['nodekeys']:
                        graph['nodekeys'].append(r['e_con_id'])
                        attributes = []

                        # First identify by icon type: person, event, location, object
                        #
                        for k in r.keys():
                            if 'con_id' in k:
                                pass
                            else:
                                if type(r[k]) not in [pyorient.otypes.OrientBinaryObject]:
                                    if r[k] != None:
                                        attributes.append({'label': k[2:], 'value': r[k]})
                                if k == 'e_FirstName':
                                    FirstName = r[k]
                                elif k == 'e_LastName':
                                    LastName = r[k]
                                elif k == 'e_Category':
                                    Category = r[k]
                                elif k == 'e_Latitude':
                                    Latitude = r[k]
                                elif k == 'e_Longitude':
                                    Longitude = r[k]
                                elif k == 'e_City':
                                    City = r[k]
                                elif k == 'e_Country':
                                    Country = r[k]

                            if 'icon' in k:
                                icon = r[k]
                        if '//person' in icon:
                            node_title = '%s %s' % (FirstName, LastName)
                        elif '//map' in icon:
                            if City == 'Unknown':
                                if Country == 'Unknown':
                                    if Latitude == 'Unknown':
                                        node_title = 'Location'
                                    else:
                                        node_title = '%s %s' % (Latitude, Longitude)
                                else:
                                    node_title = Country
                            else:
                                node_title = City
                                if Country != 'Unknown':
                                    node_title = node_title + ', ' + Country

                        elif '//accelerated' in icon:
                            node_title = '%s Event' % (Category)
                        else:
                            node_title = 'Unknown Object'
                        graph['nodes'].append(
                            self.format_node(key=r['e_con_id'],
                                             node_title=node_title,
                                             group=db,
                                             icon=icon,
                                             attributes=attributes,
                                             db_name=db)
                        )
                        graph['lines'].append({'from': le_con_id, 'to': r['e_con_id']})

            db_small_nets[db] = graph

        return db_small_nets

    def retrieve(self, **kwargs):
        """
        Get a node and its attributes based on a search term. Different from retrieve_node which assumes that it needs
        to be created if not found.
        :param kwargs: str(db_name), str(search_terms)
        :return:
        """
        results = []
        if 'db_name' in kwargs.keys():
            self.check_open_db((kwargs['db_name']))
            if 'class_filter' in kwargs.keys():
                V = kwargs['class_filter']
            else:
                V = 'V'
            if 'search_terms' in kwargs.keys():
                if len(kwargs['search_terms']) > 1:
                    search_terms = (kwargs['search_terms'].replace(',', ' ')).split(' ')
                    sql = 'select * from %s where ' % V
                    i = 1
                    for st in search_terms:
                        if i == len(search_terms):
                            sql = sql + "con_id containstext '%s' " % str(st).lower()
                        else:
                            sql = sql + "con_id containstext '%s' or " % str(st).lower()
                            i+=1
                    try:
                        r = self.client.command(sql)
                    except Exception as e:
                        if 'BlockingIOError: [WinError 10035]' in str(e):
                            click.echo('[%s_OdbServer_retrieve] ERROR: %s' % (get_datetime(), str(e)))
                            return 'Error in search'
                        else:
                            click.echo('[%s_OdbServer_retrieve] UNKNOWN ERROR: %s' % (get_datetime(), str(e)))
                    results = []
                    for i in r:
                        node = {'attributes': [], 'icon': "sap-icon://key-user-settings"}
                        for k in i.oRecordData.keys():
                            if k == 'con_id':
                                node['key'] = i.oRecordData[k]
                            elif k == 'class_type':
                                node['title'] = i.oRecordData[k]
                            elif k == 'icon':
                                node['icon'] = i.oRecordData[k]
                            else:
                                if type(i.oRecordData[k]) not in[pyorient.otypes.OrientBinaryObject]:
                                    node['attributes'].append({'label': k, 'value': i.oRecordData[k]})
                        if 'CreateDate' in i.oRecordData.keys():
                            node['title'] = i.oRecordData['CreateDate']
                        elif 'FirstName' in i.oRecordData.keys() and 'LastName' in i.oRecordData.keys():
                            node['title'] = "%s %s" % (i.oRecordData['FirstName'], i.oRecordData['LastName'])
                        else:
                            node['title'] = 'No title found'

                        results.append(self.format_node(key=node['key'],
                                                        db_name=kwargs['db_name'],
                                                        icon=node['icon'],
                                                        attributes=node['attributes'],
                                                        class_name=node['title'],
                                                        node_title=node['title']))
            else:
                results = 'No search terms'
        else:
            results = 'No DB named'

        return results

    def con_id(self, properties):
        """
        Create the unique key for an entity
        :param properties: list(properties{property: str, value: str)
        :return:
        """
        con_id = ''
        for p in properties:
            con_id = con_id + clean_concat(p['property']) + clean_concat(str(p['value']))

        return con_id

    def db_class_check(self, db_name, class_name):
        """
        Check the db_index if a db has a class. If it does, break out. If not, create the class with standard
        index of content identification and add the name to the in-memory index for subsequent checks
        :param db_name:
        :param class_name:
        :return:
        """
        i = 0
        for db in self.db_index:
            if db['name'] == db_name:
                for d in self.db_index[i]['details']:
                    if d['name'] == class_name:
                        return True

                self.db_index[i]['details'].append({'name': class_name})
                break
            else:
                i+=1
        if self.current_open != db_name:
            self.client.db_open(db_name, self.user, self.pswd)
            self.current_open = db_name
        try:
            self.client.batch('''
                create class %s extends V; 
                create property %s.con_id string;
                create index %s_con_id on %s (con_id) UNIQUE; 
                ''' % (class_name, class_name, class_name, class_name))
        except Exception as e:
            if 'already exists. Remove it before to retry' in str(e):
                click.echo('[%s_OdbServer_db_class_check] %s exists' % (get_datetime(), class_name))

    def db_cache_check(self, con_id, db_name):
        """
        Check to ensure a cache exists for the db and then if the con_id exists. If not create a cache with the con_id
        :param con_id:
        :param db_name:
        :return:
        """
        if db_name in self.db_cache.keys():
            if con_id in self.db_cache[db_name]:
                return False
            else:
                return True
        else:
            self.db_cache[db_name] = []
            return True

    def format_node(self, **kwargs):

        if 'icon' not in kwargs.keys():
            kwargs['icon'] = "sap-icon://add"
        if 'class_name' not in kwargs.keys():
            if 'class_type' not in kwargs.keys():
                kwargs['class_name'] = 'No class name'
            else:
                kwargs['class_name'] = kwargs['class_type']
        if 'node_title' in kwargs.keys():
            node_title = kwargs['node_title']
        else:
            node_title = 'No title'

        if 'status' not in kwargs.keys():
            kwargs['status'] = random.choice(['Information', 'Success', 'Error', 'Warning', 'None'])

        node_format = {
            "key": kwargs['key'],
            "title": node_title,
            "group": kwargs['db_name'],
            "status": kwargs['status'],
            "icon": kwargs['icon'],
            "attributes": kwargs['attributes']
        }

        return node_format

    def check_for_graph_consistency(self, graph):
        """
        Graph Failures will occur with missing nodes or groups within lines
        Run through the lines and get all the keys
        Check the node keys to ensure there aren't any missing
        If there is one missing, get the node from the DB
        :param graph:
        :return:
        """
        keys = []
        groups = []
        for l in graph['lines']:
            keys.append(l['from'])
            keys.append(l['to'])
        for g in graph['groups']:
            groups.append(g['key'])
        for n in graph['nodes']:
            if n['key'] not in keys:
                print(n['key'])
            if n['group'] not in groups:
                print(n['group'])

        return graph


    def get_node(self, **kwargs):
        """
        Get the full profile of a node through it's related lines/edges/links
        Receive the current UX graph, db_name, and con_id of the source node
        Get the source node's relations and iterate through the results to update the graph
        For each record, get the relation type, direction, and linked Node's attributes
        Store in a dictionary
        {'rel_no': {rel_type: str, from: con_id(a), to: con_id(b)}
        Once the dictionary is complete, check for each relation and each node to see if they exist in the current graph

        The rels need to be set up first and is based on the first returned record being the source node. All relations
        are contained in that result but only binary results of the node on the other end of the relationship. Therefore
        a second pass after filling the con_id of the source node and all relationships shells, cycle through the rest
        and fill in their details in the appropriate relationship shell. This is normally in sequential order but a key
        is used for extra quality assurance.
        :param kwargs:
        :return:
        """
        linkedNodes = []
        if 'cur_graph' not in kwargs.keys():
            return kwargs
        if 'db_name' in kwargs.keys():
            rels = {}
            if 'con_id' in kwargs.keys():
                if self.current_open != kwargs['db_name']:
                    self.client.db_open(kwargs['db_name'], self.user, self.pswd)
                    self.current_open = kwargs['db_name']
                con_id = kwargs['con_id']
                # TODO Match statement to return a list with first element source node, all elements after the relation and their properties
                r = self.client.command('''
                match {class: V, as: u, where: (con_id = '%s')}.%s() {class: V, as: e } return $elements
                ''' % (con_id, kwargs['trav_type']))

                # Iterate through the results in which Nodes from "Both" rel directions are collected
                for i in r:
                    icon = 'sap-icon://add'
                    node_title = 'Unknown'
                    i = i.oRecordData
                    # The record must have a con_id to be considered part of the graph
                    if 'con_id' in i.keys():
                        # If the source node con_id then set up the rels and then reset the count for
                        if i['con_id'] == con_id:
                            rel_count = 0
                            for k in i.keys():
                                if k[0:3] == 'in_':
                                    rels[rel_count] = {'from': None, 'to': i['con_id'], 'key': 'out_%s' % k[3:]}
                                    rel_count += 1
                                elif k[0:4] == 'out_':
                                    rels[rel_count] = {'from': i['con_id'], 'to': None, 'key': 'in_%s' % k[4:]}
                                    rel_count += 1
                            rel_count = 0

                        else:
                            if rels[rel_count]['key'] in i.keys():
                                # Can also check if either to or from are None and fill in
                                if rels[rel_count]['key'][:3] == 'in_':
                                    rels[rel_count]['to'] = i['con_id']
                                else:
                                    rels[rel_count]['from'] = i['con_id']
                                rel_count+=1
                                if rel_count == len(rels):
                                    break
                        # New Node not yet in the graph so need to add it
                        if i['con_id'] not in kwargs['cur_graph']['nodekeys']:
                            node_key = i['con_id']
                            kwargs['cur_graph']['nodekeys'].append(node_key)
                            attributes = []
                            class_name = ''
                            for k in i.keys():
                                if k not in ['con_id', rels[rel_count]['key']]:
                                    if 'class_' in str(k):
                                        class_name = i[k]
                                    if 'icon' in str(k):
                                        icon = i[k]
                                    else:
                                        if k[:3] != 'in_' and k[:4] != 'out_':
                                            attributes.append({'label': k, 'value': i[k]})
                            # Almost all have CreateDate so make it the first check
                            if 'CreateDate' in i.keys():
                                node_title = i['CreateDate']
                            if 'City' in i.keys():
                                node_title = i['City']
                            if 'FirstName' in i.keys():
                                if 'LastName' in i.keys():
                                    node_title = '%s %s' % (i['FirstName'], i['LastName'])
                                else:
                                    node_title = i['FirstName']
                            elif 'LastName' in i.keys():
                                node_title = i['LastName']

                            formatted_node = self.format_node(db_name=kwargs['db_name'],
                                                              icon=icon,
                                                              class_name=class_name,
                                                              attributes=attributes,
                                                              key=node_key,
                                                              node_title=node_title)
                            kwargs['cur_graph']['nodes'].append(formatted_node)
                            kwargs['cur_graph']['lines'].append({'from': i['con_id'], 'to': node_key})
                            # Node is added to graph and need to ensure Group is too and not duplicated
                            if kwargs['db_name'] not in kwargs['cur_graph']['groupkeys']:
                                kwargs['cur_graph']['groupkeys'].append(kwargs['db_name'])
                                kwargs['cur_graph']['groups'].append({'key': kwargs['db_name'],
                                                                      'title': kwargs['db_name']})
                # Run checks on completed rel list
                if len(r) > 0:
                    for rel in rels:
                        rel_found = False
                        for line in kwargs['cur_graph']['lines']:
                            if line['from'] == rels[rel]['from'] and line['to'] == rels[rel]['to']:
                                rel_found = True
                                break
                            elif line['to'] == rels[rel]['to'] and line['from'] == rels[rel]['from']:
                                rel_found = True
                                break
                            elif line['to'] == None or line['from'] == None:
                                rel_found = None
                                break
                        if rel_found == False and rels[rel]['from'] != None and rels[rel]['to'] != None:
                            kwargs['cur_graph']['lines'].append({'from': rels[rel]['from'], 'to': rels[rel]['to']})
        kwargs['rel_count'] = len(rels)
        kwargs['cur_graph'] = self.check_for_graph_consistency(kwargs['cur_graph'])
        return kwargs

    def get_rel_from_oRecord(self, i, con_id):

        for i_key in i.keys():
            if 'in_' in i_key:
                rel_type = i_key[i_key.find('_') + 1:]
                rel_full = i_key
                rel_card = 'to'
            elif 'out_' in i_key:
                rel_type = i_key[i_key.find('_') + 1:]
                rel_full = i_key
                rel_card = 'from'

        return {'rel_type': rel_type,
                rel_card: "%s" % con_id,
                'full': rel_full}

    def prepare_graph(self, o_graph):
        g = 0
        l = 0
        n = 0
        i = 0
        ia = 0
        newNode = True
        group = {'key': '', 'title': ''}
        line = {'from': '', 'to': ''}
        graph = {'nodes': [],
                 'lines': [],
                 'groups': [],
                 'nodekeys': [],
                 'groupkeys': []}
        response = {}
        for r in o_graph:
            if 'cur_graph[groups]' in str(r):
                if 'cur_graph[groups][%d][key]' % g == str(r):
                    group = {'key': o_graph[r], 'title': ''}
                    if group['key'] not in graph['groupkeys']:
                        graph['groupkeys'].append(group['key'])
                elif 'cur_graph[groups][%d][title]' % g == str(r):
                    group['title'] = o_graph[r]
                    graph['groups'].append(group)
                    g += 1
            elif 'cur_graph[lines][%d]' % l in str(r):
                if 'cur_graph[lines][%d][from]' % l == str(r):
                    line['from'] = o_graph[r]
                elif 'cur_graph[lines][%d][to]' % l == str(r):
                    line['to'] = o_graph[r]
                    graph['lines'].append(line)
                    line = {'from': '', 'to': ''}
                    l += 1
            elif 'cur_graph[nodes][%d][attributes][%d]' % (n, ia) in str(r):
                if newNode == True:
                    Node = {'attributes': []}
                    newNode = False
                    ia = 0
                if 'cur_graph[nodes][%d][attributes][%d][label]' % (n, ia) == str(r):
                    attribute = {'label': o_graph[r]}
                elif 'cur_graph[nodes][%d][attributes][%d][value]' % (n, ia) == str(r):
                    attribute['value'] = o_graph[r]
                    Node['attributes'].append(attribute)
                    ia += 1
            elif 'cur_graph[nodes][%d][group]' % n == str(r):
                Node['group'] = o_graph[r]
            elif 'cur_graph[nodes][%d][icon]' % n == str(r):
                Node['icon'] = o_graph[r]
            elif 'cur_graph[nodes][%d][key]' % n == str(r):
                Node['key'] = o_graph[r]
            elif 'cur_graph[nodes][%d][status]' % n == str(r):
                Node['status'] = o_graph[r]
            elif 'cur_graph[nodes][%d][title]' % n == str(r):
                Node['title'] = o_graph[r]
            elif 'cur_graph[nodes][%d][x]' % n == str(r):
                ia = 0
                newNode = True
                graph['nodes'].append(Node)
                graph['nodekeys'].append(Node['key'])
                n += 1
            elif 'cur_graph[nodes][%d][x]' % n == str(r):
                pass
            else:
                response[r] = o_graph[r]

        response['cur_graph'] = graph
        return response

    def create_node(self, **kwargs):
        """
        Check it there is a db_name and open the DB if it is
        Go through the properties and add a new piece to the sql statement for each
        If it's the last property in the list, don't put a comma

        :param kwargs: str(db_name), str(class_name), list(properties{property: str, value: str)
        :return:
        """
        # Check if there is a db in the kwargs
        if 'db_name' in kwargs.keys():
            if 'name' in kwargs.keys():
                kwargs['name'] = clean(kwargs['name'])
            if 'con_id' in kwargs.keys():
                con_id = kwargs['con_id']
            else:
                con_id = self.con_id(kwargs['properties'])
                con_id = clean_concat(kwargs['class_name']) + con_id

            if 'node_title' in kwargs.keys():
                kwargs['node_title'] = clean(kwargs['node_title'])

            # Check if the con_id exists in the chosen database's index
            if self.db_cache_check(con_id, kwargs['db_name']):
                NODE_ICON = None

                # Make sure the class_name exists and then open the DB for writing the new node
                self.db_class_check(kwargs['db_name'], kwargs['class_name'])
                if self.current_open != kwargs['db_name']:
                    self.client.db_open(kwargs['db_name'], self.user, self.pswd)
                    self.current_open = kwargs['db_name']

                # Start the sql and set the con_id to concatenated and cleaned properties
                # If it can be determined from the kwargs what the class type is, change the V class_name to a POLE
                if kwargs['class_name'] not in ['Person', 'Object', 'Location', 'Event']:
                    pPer = 0
                    pLoc = 0
                    for p in kwargs['properties']:
                        if str(p['property']).lower() in ['dateofbirth', 'placeofbirth', 'firstname', 'lastname', 'gender']:
                            pPer+=1
                        elif str(p['property']).lower() in ['latitude', 'longitude', 'city', 'country', 'population']:
                            pLoc+=1
                    if pPer > pLoc:
                        kwargs['class_name'] = 'Person'
                        NODE_ICON = 'sap-icon://person-placeholder'
                    elif pLoc > pPer:
                        kwargs['class_name'] = 'Location'
                        NODE_ICON = 'sap-icon://map'

                if kwargs['class_name'] == 'Person':
                    NODE_ICON = 'sap-icon://person-placeholder'
                if kwargs['class_name'] == 'Object':
                    NODE_ICON = 'sap-icon://document'
                if kwargs['class_name'] == 'Location':
                    NODE_ICON = 'sap-icon://map'
                if kwargs['class_name'] == 'Event':
                    NODE_ICON = 'sap-icon://calendar'

                sql = "create vertex %s set con_id = '%s' " % (
                    kwargs['class_name'], con_id)

                if 'node_title' in kwargs.keys():
                    sql = sql + ", title = '%s'" % kwargs['node_title']
                else:
                    kwargs['node_title'] = kwargs['class_name']

                # Save the properties to an array for the formatted node in the UX which will then be changed to a dict
                formatted_node = []
                if len(kwargs['properties']) > 0:
                    sql = sql + ', '
                    i = 1
                    for p in kwargs['properties']:
                        if str(p['property']).lower() == 'icon':
                            NODE_ICON = p['value']
                        # Save the formatted property for the UX
                        formatted_node.append({'label': p['property'], 'value': p['value']})
                        if i == len(kwargs['properties']):
                            if p['property'] != 'pid' and '_id' not in p['property'] and p['value'] != '':
                                if type(p['value']) is float or type(p['value']) is np.float64:
                                    sql = sql + "%s = %f " % (p['property'], p['value'])
                                elif type(p['value']) is int:
                                    sql = sql + "%s = %d " % (p['property'], p['value'])
                                elif 'Custom field (label, value)' in p['property']:
                                    prop_val = p['value'].split(',')
                                    if len(prop_val) == 2:
                                        sql = sql + "%s = '%s' " % (clean(prop_val[0]).replace(' ', ''), clean(prop_val[0]))
                                else:
                                    isdate = change_if_date(p['value'])
                                    if isdate:
                                        p['value'] = isdate.strftime('%Y-%m-%d %H:%M:%S')
                                    if p['property'].lower() == 'title':
                                        kwargs['node_title'] = p['value']
                                    sql = sql + "%s = '%s' " % (clean(p['property']).replace(' ', '_'), clean(p['value']))
                        else:
                            if p['property'] != 'pid' and '_id' not in p['property'] and p['value'] != '':
                                if type(p['value']) is float or type(p['value']) is np.float64:
                                    sql = sql + "%s = %f, " % (p['property'], p['value'])
                                elif type(p['value']) is int:
                                    sql = sql + "%s = %d, " % (p['property'], p['value'])
                                elif 'Custom field (label, value)' in p['property']:
                                    prop_val = p['value'].split(',')
                                    if len(prop_val) == 2:
                                        sql = sql + "%s = '%s', " % (clean(prop_val[0]).replace(' ', ''), clean(prop_val[0]))
                                else:
                                    isdate = change_if_date(p['value'])
                                    if isdate:
                                        p['value'] = isdate.strftime('%Y-%m-%d %H:%M:%S')
                                    if p['property'].lower() == 'title':
                                        kwargs['node_title'] = p['value']
                                    sql = sql + "%s = '%s', " % (clean(p['property']).replace(' ', '_'), clean(p['value']))
                        i+=1
                if not NODE_ICON:
                    NODE_ICON = "sap-icon://add"

                formatted_node = self.format_node(db_name=kwargs['db_name'],
                                                  node_title=kwargs['node_title'],
                                                  key=con_id,
                                                  attributes=formatted_node,
                                                  icon=NODE_ICON)

                if len(sql) - sql.rfind(',') < 3:
                    sql = sql[:sql.rfind(',')]
                try:
                    self.client.command(sql)
                except Exception as e:
                    if 'DuplicatedException' in str(e):
                        pass
                    elif '[Errno 22] Invalid argument' in str(e):
                        click.echo('[%s_OdbServer_create_node] UNSOLVED ERROR 22. Always occurs after backing out of ODB app, then restarting the app then reloading the browser. Basebook init...starts sim, runs: %s\n***%s***' %
                                   (get_datetime(), str(e), sql))
                        pass
                    else:
                        click.echo('[%s_OdbServer_create_node] UNKNOWN ERROR: %s\n***%s***' %
                                   (get_datetime(), str(e), sql))
            else:
                # It exists so return what was created. TODO: Return what exists
                icon = "sap-icon://add"
                for p in kwargs['properties']:
                    if 'icon' in p.keys():
                        icon = p['icon']
                formatted_node = []
                if len(kwargs['properties']) > 0:
                    for p in kwargs['properties']:
                        formatted_node.append({'label': p['property'], 'value': p['value']})

                formatted_node = self.format_node(db_name=kwargs['db_name'],
                                                  node_title=kwargs['node_title'],
                                                  key=con_id,
                                                  attributes=formatted_node,
                                                  icon=icon)
        else:
            formatted_node = 'No database name found'

        return formatted_node

    def retrieve_node(self, **kwargs):
        """
        Get a node but assume that if it isn't there it needs to be created
        :param kwargs:
        :return:
        """
        db_name = ''
        n_class = 'V'
        con_id = ''
        filters = []
        # Assign the keys to standard variables
        for k in kwargs:
            if k == 'db_name':
                db_name = kwargs[k]
            if k == '':
                n_class = kwargs[k]
            if k == 'con_id':
                con_id = kwargs[k]
            else:
                filters.append(kwargs[k])

        # Check the received variables
        if db_name != '':
            if self.current_open != db_name:
                self.client.db_open(db_name, self.user, self.pswd)
                self.current_open != db_name
            # Check if the node is in the index. If not, create it
            if con_id != '':
                sql = '''select * from %s where con_id = '%s' ''' % (n_class, con_id)
                r = self.client.command(sql)
                # If it returns nothing then need to create
                for v in r:
                    print(v.oRecordData)
                return r

            else:
                self.create_node(class_name='V')
                return False
        else:
            return False

    def create_edge(self, **kwargs):
        """
        If there is a rel_type use it, if not, default to E
        If there is no DB then return with a no DB message
        If the node keys as delivered from the UX are not in this DB then they are created based on the detailed
        attributes that are expected as such from the demo graph. These are based stored in the kwargs[node_atts] where
        node is either source or target.
                attributes: Array(2)
                    0: {label: "Release date", value: "May 2, 2008"}
                    1: {label: "Director", value: "Jon Favreau"}
                group: 1
                icon: "sap-icon://key-user-settings"
                key: 0
                status: "Error"
                title: "Iron Man"

        :param kwargs: db_name, source_node, source_atts['title'], target_node
        :return:
        """

        if 'rel_type' in kwargs.keys():
            rel_type = kwargs['rel_type']
        else:
            rel_type = 'E'

        if 'db_name' in kwargs.keys():
            if self.current_open != kwargs['db_name']:
                self.client.db_open(kwargs['db_name'], self.user, self.pswd)
                self.current_open = kwargs['db_name']
            if kwargs['db_name'] not in self.db_cache.keys():
                self.get_db_index(kwargs['db_name'])
            if kwargs['source_node'] not in self.db_cache[kwargs['db_name']]:
                properties = [{'property': 'icon', 'value': kwargs['source_atts']['icon']}]
                for p in kwargs['source_atts']['attributes']:
                    properties.append({'property': p['label'], 'value': p['value']})
                self.create_node(class_name="V", name=kwargs['source_atts']['title'],
                                 properties=properties, con_id=kwargs['source_node'],
                                 db_name=kwargs['db_name'])

            if kwargs['target_node'] not in self.db_cache[kwargs['db_name']]:
                properties = [{'property': 'icon', 'value': kwargs['target_atts']['icon']}]
                for p in kwargs['target_atts']['attributes']:
                    properties.append({'property': p['label'], 'value': p['value']})
                self.create_node(class_name="V", name=kwargs['target_atts']['title'],
                                 properties=properties, con_id=kwargs['target_node'],
                                 db_name=kwargs['db_name'])

            try:
                self.client.command(''' 
                create edge %s from (select from V where con_id = '%s') to (select from V where con_id = '%s') 
                ''' % (rel_type, kwargs['source_node'], kwargs['target_node']))
                return '%s link from %s and %s created' % (
                    rel_type, kwargs['source_atts']['title'], kwargs['target_atts']['title'])
            except Exception as e:
                if 'No edge has been created because no target vertices' in str(e):
                    properties = [{'property': 'icon', 'value': kwargs['source_atts']['icon']}]
                    for p in kwargs['source_atts']['attributes']:
                        properties.append({'property': p['label'], 'value': p['value']})
                    self.create_node(class_name="V", name=kwargs['source_atts']['title'],
                                     properties=properties, con_id=kwargs['source_node'],
                                     db_name=kwargs['db_name'])
                    properties = [{'property': 'icon', 'value': kwargs['target_atts']['icon']}]
                    for p in kwargs['target_atts']['attributes']:
                        properties.append({'property': p['label'], 'value': p['value']})
                    self.create_node(class_name="V", name=kwargs['target_atts']['title'],
                                     properties=properties, con_id=kwargs['target_node'],
                                     db_name=kwargs['db_name'])
                    self.client.command(''' 
                    create edge %s from (select from V where con_id = '%s') to (select from V where con_id = '%s') 
                    ''' % (rel_type, kwargs['source_node'], kwargs['target_node']))
                else:
                    click.echo("[%s_OdbServer_create_edge] UNKNOWN ERROR: %s" % (get_datetime(), str(e)))
        else:
            return 'Database required'

    def fill_demo_data(self):
        """
        Upload demo data files and turn them into a json model for populating in the application
        :return:
        """
        click.echo('[%s_OdbServer_fill_demo_data] Filling Demo Data' % (get_datetime()))
        demo_data = {
            "network": self.open_file(
                self.files[self.get_file_index(self.demo_network)])
        }
        click.echo('[%s_OdbServer_fill_demo_data] Complete with Demo Data' % (get_datetime()))
        return demo_data

    def get_model(self, model):
        click.echo('[%s_OdbServer_get_model] Getting %s' % (get_datetime(), model))
        return self.open_file(self.files[self.get_file_index(model)])

    def update_node(self, **kwargs):

        response = {'d':
                        {
                            'title': 'Node',
                            'attributes': [],
                            'key': kwargs['con_id']
                        }
        }
        if 'db_name' in kwargs.keys():
            if self.current_open != kwargs['db_name']:
                self.client.db_open(kwargs['db_name'], self.user, self.pswd)
                self.current_open = kwargs['db_name']
            kwargs['con_id'] = clean_concat(kwargs['con_id'])
            sql = "update V set "
            i = 1
            for p in kwargs['propvals']:
                if p['property'] == 'Title':
                    response['d']['title'] = p['value']
                elif p['property'] == 'Icon':
                    response['d']['icon'] = p['value']
                elif p['property'] == 'Group':
                    response['d']['group'] = p['value']
                else:
                    if p['property'] in ['DateOfBirth', 'CreateDate']:
                        c_date = change_if_date(p['value']).strftime('%Y-%m-%d %H:%M:%S')
                        if c_date:
                            p['value'] = c_date
                    response['d']['attributes'].append({'label': p['property'], 'value': p['value']})
                if i == len(kwargs['propvals']):
                    sql = sql + "%s = '%s' where con_id = '%s' " % (p['property'].replace(' ', ''),
                                                                    clean(p['value']), kwargs['con_id'])
                else:
                    sql = sql + "%s = '%s', " % (p['property'].replace(' ', ''),
                                                 clean(p['value']))

                    i+=1
            if self.client.command(sql)[0] == 0:
                sql = sql.replace("update", "create vertex").replace('where', ',')
                self.client.command(sql)
                response['message'] = '%s not found in % so created with updated information' % (
                    response['d']['title'], kwargs['db_name'])
            else:
                response['message'] = '%s updated' % response['d']['title']

        return response

    def delete_node(self, **kwargs):

        response = {'d':
                        {
                            'title': 'Node',
                            'attributes': [],
                            'key': kwargs['con_id']
                        }
        }

        return response

    def set_mapping(self):
        """
        Example of establishing a best practice model is formation of a family from data...aggregations from relations

        Maps = { col_name: {                DoB:                                                Rule create a person
                    prob: int,                  tags:['birth', birthday, dob, bday']
                    tags: [],
                    mapped:[],
                }
        Does Maps need its own class and methods

        Headers = cols from a dataframe or sheet

        Stage 1: Find best fitting columns to the map cols
        headers = df.headers()
        for h in headers:
            for col in Maps:
                for tag in Maps[col][tags]:
                    if tag in str(h):
                        Maps[col][prob]+=1
            max = 0
            for col in Maps:
                if Maps[col][prob] > max:
                    max = Maps[col][prob]
                    m_col = col
            Maps[m_col][mapped].append('df': sheet, 'col': h)

        Stage 2: Apply the map in future iterations
        And normalize to the common map
        :return:
        """



        return

    def set_demo_data(self):
        """
        Get different JSON and combine them into a common Canvas/ODB
        :return:
        """

        return

class SimServer():
    """
    Create a simulated population stored within a dictionary which can then be exported to a JSON for ingestion as a
    publishing service. Runs rounds which are events based on the initial population and runs based on parameter settings.
    """

    def __init__(self):
        self.datapath = os.path.join(os.path.join(os.getcwd(), 'data'))
        self.basebook = None
        self.ParentA_Choices = ["F", "M"]
        self.ParentA_Weights = [.9, .1]
        self.Parent_SameGender_Choices = [True, False]
        self.Parent_SameGender_Weights = [.05, .95]
        self.ParentA_Ages = {'mean': 40, 'stdev': 4.7}
        self.Parent_Age_Difference = {'mean': 3, 'stdev': 4}
        self.Parent_SameLastName_Choices = [True, False]
        self.Parent_SameLastName_Weights = [.8, .2]
        self.Parent_Child_Age_Difference = {'mean': 27, 'stdev': 3.3}
        self.ChildrenCount = {'mean': 2.5, 'stdev': 2.5}
        self.Child_Gender_Choices = ["F", "M", "U"]
        self.Child_Gender_Weights = [.49, .49, .2]
        self.Names = []
        self.LastNames = []
        self.FemaleNames = []
        self.MaleNames = []
        self.Locations = []
        self.AverageAction = {'mean': 3, 'stdev': 1}
        self.Actions_All = ['Crime', 'Education', 'Abuse', 'Health', 'Employment', 'SocialMedia']
        self.Actions_Minor = ['Education', 'Abuse', 'Health', 'SocialMedia']
        self.Actions_Baby = ['Abuse', 'Health']
        self.SimStartDate = datetime.datetime.today().strftime('%Y-%m-%d') + " 00:00:00"
        self.SimRoundLengthMax = 60  # in minutes
        self.ODB = OdbServer()
        self.ODB.get_db_stats()
        self.POLE = 'POLE_Fusion'
        self.reset_odb()
        # In memory DB used for creating simulation data in the format for network graph UX rendering
        self.DB = {'nodes': [],
                   'lines': [],
                   'groups': [],
                   'sims': [],
                   'node_index': [],
                   'group_index': []}
        click.echo('[%s_SimServer_init] Complete' % (get_datetime()))

    def basebook_setup(self):

        if not self.basebook:
            click.echo('[%s_SimServer_init] Initializing basebook' % (get_datetime()))
            self.basebook = pd.ExcelFile(os.path.join(self.datapath, 'Base_Book.xlsx'))
            self.Names = self.basebook .parse('Names')
            self.LastNames = list(self.basebook .parse('Names')[self.basebook .parse('Names')['Type'] == 'L']['Name'])
            self.FemaleNames = list(self.basebook .parse('Names')[self.basebook .parse('Names')['Type'] == 'F']['Name'])
            self.MaleNames = list(self.basebook .parse('Names')[self.basebook .parse('Names')['Type'] == 'M']['Name'])
            self.Locations = self.basebook .parse('Locations')
            click.echo('[%s_SimServer_init] Complete with basebook' % (get_datetime()))
        else:
            click.echo('[%s_SimServer_init] Basebook already initialized %s' % (get_datetime(), self.basebook))

    def check_odb(self):
        """
        For each action type there should be database
        :return:
        """
        click.echo('[%s_SimServer_check_odb] Checking ODB databases' % (get_datetime()))
        for act in self.Actions_All:
            if act not in self.ODB.databases:
                self.ODB.create_db(act, 'DB_TYPE_GRAPH')
        if 'POLE_Fusion' not in self.ODB.databases:
            self.ODB.create_db(self.POLE, 'DB_TYPE_GRAPH')
        click.echo('[%s_SimServer_check_odb] Complete' % (get_datetime()))

    def reset_odb(self):

        for act in self.Actions_All:
            try:
                self.ODB.client.db_drop(act)
            except Exception as e:
                click.echo('[%s_SimServer_reset_odb] ERROR DROPPING %s' %
                           (get_datetime(), str(e)))
        self.check_odb()

    def create_event(self, **kwargs):
        """
        Create an event for the ODB silo and simulation run which will produce a JSON
        Create an event for visualization
        Return the event for further use
        :param kwargs:
        :return:
        """
        # Set the standard event properties
        node = ({
            'properties': [{'property': 'icon', 'value': "sap-icon://accelerated"}]
        })
        # Set the properties which will be returned as 'attributes'
        for k in kwargs:
            if k != 'DateTime':
                node['properties'].append({'property': k, 'value': kwargs[k]})
            else:
                node['properties'].append({'property': 'CreateDate', 'value': kwargs[k]})
        if 'Category' in kwargs.keys():
            node_title = kwargs['Category']
        else:
            node_title = kwargs['Type']

        # Insert into the appropriate DB
        node = self.ODB.create_node(
            properties=node['properties'],
            class_name='Event',
            db_name=kwargs['Type'],
            name=kwargs['Type'],
            node_title=node_title
        )
        node['group'] = kwargs['Type']
        node['status'] = 'Success'
        if node['key'] not in self.DB['node_index']:
            self.DB['nodes'].append(node)
            self.DB['node_index'].append(node['key'])
        # Ensure Groups are aligned
        if "%s%s" % ('Event', kwargs['Type']) not in self.DB['group_index']:
            self.DB['group_index'].append("%s%s" % ('Event', kwargs['Type']))
            self.DB['groups'].append({'title': kwargs['Type'], 'key': kwargs['Type']})

        return node

    def create_location(self, **kwargs):
        """
                node_format = {
            "key": kwargs['key'],
            "title": kwargs['class_name'],
            "group": kwargs['db_name'],
            "status": kwargs['status'],
            "icon": kwargs['icon'],
            "attributes": kwargs['attributes']
        }
        :param kwargs:
        :return:
        """

        # Set the standard location properties
        node = ({
            'properties': [
                {'property': 'icon', 'value': "sap-icon://map"}
            ]
        })
        for k in kwargs:
            node['properties'].append({'property': k, 'value': kwargs[k]})
        node = self.ODB.create_node(
            properties=node['properties'],
            db_name=kwargs['Type'],
            class_name='Location',
            name='City',
            node_title=kwargs['City']
        )
        node['group'] = kwargs['Country']
        node['City'] = kwargs['City']
        node['status'] = 'Success'
        if node['key'] not in self.DB['node_index']:
            self.DB['nodes'].append(node)
            self.DB['node_index'].append(node['key'])
        if "%s%s" % ('Location', kwargs['Country']) not in self.DB['group_index']:
            self.DB['group_index'].append("%s%s" % ('Location', kwargs['Country']))
            self.DB['groups'].append({'title': kwargs['Country'], 'key': kwargs['Country']})

        return node

    def create_person(self, **kwargs):
        """
        Create a person as a node which can be transferred to any network diagram visualization as a JSON based on
        the SimServer DB. Create the key based on the person's attributes by running the concat_clean operation. Then
        create the group as a family last name. If the family or group record already exists then it will not create it.
        :param kwargs: DateOfBirth, PlaceOfBirth, LastName, FirstName, Gender expected or will fail
        :return: a full record of the person but with a key for creating relations down stream
        """
        # All attributes are saved as label value pairs for display on visualizations

        # Set the standard person properties
        simAction = int(np.random.normal(loc=self.AverageAction['mean'], scale=self.AverageAction['stdev']))
        node = ({
            'properties': [
                {'property': 'icon', 'value': "sap-icon://person-placeholder"},
                {'property': 'simaction', 'value': simAction},
                {'property': 'simclock', 'value': 0}
            ]
        })
        for k in kwargs:
            node['properties'].append({'property': k, 'value': kwargs[k]})
        name = "Profile"
        node = self.ODB.create_node(
            properties=node['properties'],
            db_name=kwargs['Type'],
            class_name='Person',
            name=name,
            node_title='%s %s' % (kwargs['FirstName'], kwargs['LastName'])
        )
        node['group'] = kwargs['LastName']
        node['DateOfBirth'] = kwargs['DateOfBirth']
        node['PlaceOfBirth'] = kwargs['PlaceOfBirth']
        node['LastName'] = kwargs['LastName']
        node['FirstName'] = kwargs['FirstName']
        node['SimAction'] = simAction
        node['SimClock'] = 0

        age = self.check_age(datetime.datetime.now(), kwargs)
        if age in ['Toddler', 'Baby']:
            node['status'] = 'CustomChildStatus'
        elif age in ['Teen']:
            node['status'] = 'CustomTeenStatus'
        elif age in ['Not born']:
            node['status'] = 'CustomNotBornStatus'
        else:
            node['status'] = random.choice(['Success', 'Error'])

        if node['key'] not in self.DB['node_index']:
            self.DB['nodes'].append(node)
            self.DB['node_index'].append(node['key'])
        if kwargs['LastName'] not in self.DB['group_index']:
            self.DB['group_index'].append(kwargs['LastName'])
            self.DB['groups'].append({'title': kwargs['LastName'], 'key': kwargs['LastName']})

        # Sims have an action and clock. Clock is iterated during the simulation as an agent based time. Action is how
        # active the sim is. Higher the number, more likely they are to act given random selector in simulator
        self.DB['sims'].append(node)
        return (node)

    def create_relation(self, source, target, rtype, db_name):
        source_atts = {}
        target_atts = {}
        self.DB['lines'].append({'from': source['key'], 'to': target['key'], 'type': rtype})
        for k in source['attributes']:
            source_atts[k['label']] = k['value']
        for k in target['attributes']:
            target_atts[k['label']] = k['value']
        self.ODB.create_edge(source_node=source['key'], source_atts=source,
                             target_node=target['key'], target_atts=target,
                             rel_type=rtype, db_name=db_name)

    def create_family(self, **kwargs):
        """
        A Family is a group of Persons consisting of 2 parents and at least one child. The status of the family is not set.
        It starts with the core_age of one parent with that parent's gender determined by a variable.
        The core_age should be in the form of days old not years so that a more varied age can be applied to relatives.
        The core_age of parent A is determined through a normal distribution of parent ages
        The core_age of parent B is determined through a n dist of parent age differences and the core_age of parent A
        TODO: Make sim dob time more random and not based on computer time
        :param core_age (int that will determine how many days old and then randomizes DateOfBirth based on today
        :return:
        """
        # Process all the options and set to random lists if none provided.
        # Options are there for loops that re-run the function
        if not self.basebook:
            self.basebook_setup()

        if 'core_age' in kwargs:
            core_age = kwargs['core_age'] * 365 + (random.randint(-180, 180))
        else:
            core_age = (int(np.random.normal(loc=self.ParentA_Ages['mean'], scale=self.ParentA_Ages['stdev'])) * 365
                        + random.randint(-180, 180))
        if 'LastName' in kwargs:
            LastName = kwargs['LastName']
        else:
            LastName = random.choice(self.LastNames)

        # Create the first parent
        GenderA = random.choices(self.ParentA_Choices, self.ParentA_Weights)[0]
        if GenderA == 'F':
            FirstName = random.choice(self.FemaleNames)
        else:
            FirstName = random.choice(self.MaleNames)
        # Create the place of birth
        POB_A = self.Locations.sample(1)
        POB_A = self.create_location(
            City=POB_A['city'][int(POB_A.index[0])],
            Country=POB_A['country'][int(POB_A.index[0])],
            Latitude=float(POB_A['lat'][int(POB_A.index[0])]),
            Longitude=float(POB_A['lng'][int(POB_A.index[0])]),
            Population=float(POB_A['pop'][int(POB_A.index[0])]),
            Type=self.POLE
        )
        # Create the person record and key
        parentA = self.create_person(
            DateOfBirth=(datetime.datetime.now() - datetime.timedelta(days=core_age)).strftime('%Y-%m-%d %H:%M:%S'),
            PlaceOfBirth=POB_A['City'],
            LastName=LastName,
            FirstName=FirstName,
            Gender=GenderA,
            Type=self.POLE,
            Category='SIM'
        )
        # Create the relation to place of birth
        self.create_relation(parentA, POB_A, 'BornIn', self.POLE)
        # Create the event for birth
        DOB_A = self.create_event(
            Type=self.POLE,
            Category='Birth',
            DateTime=parentA['DateOfBirth'],
            Description='%s %s born on %s in %s.' % (FirstName,
                                                     LastName,
                                                     parentA['DateOfBirth'],
                                                     POB_A['City']))
        self.create_relation(parentA, DOB_A, 'BornOn', self.POLE)
        self.create_relation(DOB_A, POB_A, 'OccurredAt', self.POLE)

        # Create the second parent based on the first parent and simulation settings
        b_core_age = ((core_age + int(np.random.normal(loc=self.Parent_Age_Difference['mean'],
                                                       scale=self.Parent_Age_Difference['stdev'])))
                      + (random.randint(-180, 180)))
        if random.choices(self.Parent_SameGender_Choices, self.Parent_SameGender_Weights)[0]:
            GenderB = GenderA
        else:
            if GenderA == 'F':
                GenderB = 'M'
            else:
                GenderB = 'F'

        if GenderB == 'F':
            FirstName = random.choice(self.FemaleNames)
        else:
            FirstName = random.choice(self.MaleNames)
        LastNameB = random.choice(self.LastNames)

        POB_B = self.Locations.sample(1)
        POB_B = self.create_location(
            City=POB_B['city'][int(POB_B.index[0])],
            Country=POB_B['country'][int(POB_B.index[0])],
            Latitude=POB_B['lat'][int(POB_B.index[0])],
            Longitude=POB_B['lng'][int(POB_B.index[0])],
            Population=POB_B['pop'][int(POB_B.index[0])],
            Type=self.POLE,
        )
        # Create the person record and key
        parentB = self.create_person(
            DateOfBirth=(datetime.datetime.now() - datetime.timedelta(days=b_core_age)).strftime('%Y-%m-%d %H:%M:%S'),
            PlaceOfBirth=POB_B['City'],
            LastName=LastNameB,
            FirstName=FirstName,
            Gender=GenderB,
            Type=self.POLE,
        )
        # Create the relation to place of birth
        self.create_relation(parentB, POB_B, 'BornIn', self.POLE)
        # Create the event for birth
        DOB_B = self.create_event(
            DateTime=parentB['DateOfBirth'],
            Type=self.POLE,
            Category='Birth',
            Description='%s %s born on %s in %s.' % (FirstName,
                                                     LastName,
                                                     parentB['DateOfBirth'],
                                                     POB_B['City']))
        self.create_relation(parentB, DOB_B, 'BornOn', self.POLE)
        self.create_relation(DOB_B, POB_B, 'OccurredAt', self.POLE)
        # TODO Create origin based location
        # TODO Create beahvior pattern variables for turn based simulation and agent based motivations

        # Create the relation between the parents
        self.create_relation(parentA, parentB, 'ChildrenWith', self.POLE)

        # Create the children starting with the oldest based on an age derived from random parent age and Sim settings
        core_age = (random.choice([core_age, b_core_age]) / 365 - int(
            np.random.normal(loc=self.Parent_Child_Age_Difference['mean'],
                             scale=self.Parent_Child_Age_Difference['stdev']))) * 365
        i = 0
        children = {}
        LastName = random.choice([LastName, LastNameB])
        childrencount = int(np.random.normal(loc=self.ChildrenCount['mean'], scale=self.ChildrenCount['stdev']))
        if childrencount < 2:
            childrencount = 2
        while i < childrencount:
            Gender = random.choices(self.Child_Gender_Choices, self.Child_Gender_Weights)[0]
            if Gender == 'M':
                FirstName = random.choice(self.MaleNames)
            elif Gender == 'F':
                FirstName = random.choice(self.FemaleNames)
            else:
                FirstName = random.choice(self.FemaleNames)

            POB = random.choice([POB_A, POB_B])
            child = self.create_person(
                DateOfBirth=(datetime.datetime.now() - datetime.timedelta(days=core_age)).strftime('%Y-%m-%d %H:%M:%S'),
                PlaceOfBirth=POB['City'],
                LastName=LastName,
                FirstName=FirstName,
                Gender=Gender,
                Type=self.POLE
            )
            # Create the relation to place of birth
            self.create_relation(child, POB, 'BornIn', self.POLE)
            # Create the event for birth
            DOB = self.create_event(
                Type=self.POLE,
                Category='Birth',
                DateTime=child['DateOfBirth'],
                Description='%s %s born on %s in %s.' % (FirstName,
                                                         LastName,
                                                         child['DateOfBirth'],
                                                         POB['City']))
            self.create_relation(child, DOB, 'BornOn', self.POLE)
            self.create_relation(DOB, POB, 'OccurredAt', self.POLE)
            children[child['key']] = child
            # Create the relation between the parents
            self.create_relation(parentA, child, 'ParentOf', self.POLE)
            self.create_relation(parentB, child, 'ParentOf', self.POLE)
            # Increment the age for next kid
            core_age = core_age - random.randint(300, 1500)
            i += 1
        # Create the sibling relationships
        for c in children:
            for cc in children:
                if cc != c:
                    self.create_relation(children[c], children[cc], 'SiblingOf', self.POLE)

    @staticmethod
    def check_age(sim_time, sim):
        # Check if minor
        date18 = datetime.datetime.strptime(sim['DateOfBirth'], '%Y-%m-%d %H:%M:%S') + datetime.timedelta(
            days=365 * 18)
        if sim_time < date18:
            # Check if toddler
            date13 = datetime.datetime.strptime(sim['DateOfBirth'], '%Y-%m-%d %H:%M:%S') + datetime.timedelta(
                days=365 * 13)
            if sim_time < date13:
                # Check if baby
                date2 = datetime.datetime.strptime(sim['DateOfBirth'], '%Y-%m-%d %H:%M:%S') + datetime.timedelta(
                    days=365 * 2)
                if sim_time < date2:
                    # Check if alive yet
                    date0 = datetime.datetime.strptime(sim['DateOfBirth'], '%Y-%m-%d %H:%M:%S')
                    if sim_time < date0:
                        return ("Not born")
                    else:
                        return ("Baby")
                else:
                    return ("Toddler")
            else:
                return ("Teen")
        else:
            return ("Adult")

    def choose_action(self, age):

        if age == 'Baby' or age == 'Toddler':
            return random.choice(self.Actions_Baby)
        elif age == 'Teen':
            return random.choice(self.Actions_Minor)
        else:
            return random.choice(self.Actions_All)

    def export_json(self):

        dbjson = os.path.join(self.datapath, 'db.json')
        with open(dbjson, 'w') as db:
            json.dump(self.DB, db)

    def get_json(self):
        dbjson = os.path.join(self.datapath, 'db.json')
        with open(dbjson, 'r') as db:
            self.DB = json.load(db)

    def run_simulation(self, rounds):

        if not self.basebook:
            self.basebook_setup()
        i = 0
        sim_time = datetime.datetime.strptime(self.SimStartDate, '%Y-%m-%d %H:%M:%S')
        while i < rounds:
            '''
            1. Choose sims based on an action number range/filter
            2. Based on the age create an action.
                If child create a school or abuse related event
                If parent create a police or employment related event
            3. Create a location based on Sim Locations
                Choose home as first and add random. 
                If len of locations is < 3 append, else, random create new based on others or select one
            4. Insert the relation of event to person and to locations into the db based on event type

            '''
            for sim in self.DB['sims']:
                if sim['SimClock'] > random.randint(1, 9):
                    age = self.check_age(sim_time, sim)
                    if age == 'Not born':
                        break
                    action = self.choose_action(age)
                    EVT = self.create_event(Type=action,
                                            DateTime=sim_time.strftime('%Y-%m-%d %H:%M:%S'),
                                            Description='%s %s, of %s age was involved with an event related to %s at %s'
                                                        % (sim['FirstName'], sim['LastName'],
                                                           age, action, sim_time.strftime('%Y-%m-%d %H:%M:%S')))
                    self.create_relation(EVT, sim, 'Involved', action)
                    # Reset the time to a step in the future based on random time between 1 and max round length
                    # Set to seconds to allow for more interactions in a round
                    sim_time = datetime.datetime.strptime(
                        (sim_time + datetime.timedelta(seconds=random.randint(1, self.SimRoundLengthMax))
                         ).strftime('%Y-%m-%d %H:%M:%S'), '%Y-%m-%d %H:%M:%S')
                    # Reset the Sim's clock it's original setting
                    sim['SimClock'] = sim['SimAction']
                else:
                    sim['SimClock'] += 1
            # Reset the time to a step in the future based on random time between 1 and max round length
            # Set to minutes to allow for a bigger time jump between each round treating the iteration of sims as "bullet time"
            sim_time = datetime.datetime.strptime(
                (sim_time + datetime.timedelta(hours=random.randint(1, self.SimRoundLengthMax))
                 ).strftime('%Y-%m-%d %H:%M:%S'), '%Y-%m-%d %H:%M:%S')
            i += 1

'''
odbserver = OdbServer()
odbserver.get_db_stats()
odbserver.fill_demo_data_small()
'''