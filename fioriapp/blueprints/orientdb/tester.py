import pyorient
class OdbServer():

    def __init__(self):

        self.client = pyorient.OrientDB("localhost", 2424)
        self.user = 'root'
        self.pswd = 'admin'

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
                r = self.client.command('''
                 match {class: V, as: u, where: (con_id = '%s')}.%s() {class: V, as: e } return $elements
                 ''' % (con_id, kwargs['trav_type']))

                # Iterate through the results in which Nodes from "Both" rel directions are collected
                for i in r:
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
                                rel_count += 1
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
                                    else:
                                        if k[:3] != 'in_' and k[:4] != 'out_':
                                            attributes.append({'label': k, 'value': i[k]})
                            formatted_node = self.format_node(db_name=kwargs['db_name'],
                                                              class_name=class_name,
                                                              attributes=attributes,
                                                              key=node_key)
                            kwargs['cur_graph']['nodes'].append(formatted_node)
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
        return kwargs