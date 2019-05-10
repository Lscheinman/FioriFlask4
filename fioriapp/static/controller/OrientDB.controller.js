sap.ui.define([
		'jquery.sap.global',
		'sap/ui/core/mvc/Controller',
		'sap/ui/model/json/JSONModel',
		'sap/m/MessagePopover',
		'sap/m/MessagePopoverItem',
		'sap/ui/core/routing/History',
		'sap/m/Dialog',
		'sap/m/MessageToast',
	    "sap/m/Button",
	    "sap/m/ButtonType",
	    "sap/suite/ui/commons/networkgraph/Node",
	    "sap/suite/ui/commons/networkgraph/Line",
	    "sap/suite/ui/commons/networkgraph/Group",
	    "sap/suite/ui/commons/networkgraph/ActionButton",
	    "sap/m/StandardListItem",
	    "sap/ui/core/Item",
	    "sap/m/VBox",
	    'sap/viz/ui5/data/FlattenedDataset',
        'sap/viz/ui5/format/ChartFormatter',
        'sap/viz/ui5/api/env/Format',
        'sap/m/DateTimePicker',
        'sap/viz/ui5/controls/common/feeds/AnalysisObject',
        'sap/viz/ui5/controls/VizFrame',
        'sap/m/Table',
        'sap/suite/ui/commons/ChartContainerContent',
        'sap/viz/ui5/controls/common/feeds/FeedItem',
        'sap/m/Label',
		'sap/m/ColumnListItem',
		'sap/m/library',
		'sap/m/Column'
	], function(jQuery, Controller, JSONModel, MessagePopover, MessagePopoverItem, History, Dialog, MessageToast,
	            Button, ButtonType, Node, Line, Group, ActionButton, StandardListItem, Item, VBox, FlattenedDataset,
	            ChartFormatter, Format, DateTimePicker, AnalysisObject, VizFrame, Table, ChartContainerContent,
	            FeedItem, Label, ColumnListItem, MobileLibrary, Column,) {
	"use strict";
	/*
	Receive the model from the python view:
	        'd': {
            'index': odbserver.get_db_stats(
                    {
                        'name': db,
                        'size': self.client.db_size(),
                        'records': self.client.db_count_records(),
                        'details': self.get_db_details(db),
                        'index': self.get_db_index(db, self.index_limit)
                    }...
            ),
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
            'current_selection': index[0]
	*/

	var iNodeKey = 0;

	var PageController = Controller.extend("sap.ui.demo.basicTemplate.controller.OrientDB", {

	onInit: function () {
	    sap.ui.core.BusyIndicator.show(0);
		var oModel = new JSONModel();
		var oMessageProcessor = new sap.ui.core.message.ControlMessageProcessor();
		var oMessageManager = sap.ui.getCore().getMessageManager();
        // Initialize Chart
		this._constants = this.onInitSetChart();
		this._state = this.onInitSetChartState();
        var oCountry2VizFrame = this._constants.vizFrames.country2;
        var oAnalysisObject = new AnalysisObject(oCountry2VizFrame.analysisObjectProps);
        var aValues = oCountry2VizFrame.feedItems[1].values;
        if (aValues.length === 0) {
            aValues.push(oAnalysisObject);
        }

        this._initializeAnalytics();
        this._showAnalytics();
        // End Chart ops

		window.dbList = this.byId("dbList");
		var oModel = new JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.index);
		this.update_dbList(oModel);
		window._stream_index = 0;

		window.oClipboard = this.byId("dbClipboard");

        //Sample Tab table set to the current selection's index
        sap.ui.getCore().setModel(new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.index), "CurrentSample");
        this.update_db_sample();
		window.db_sample = this.byId("db_sample");

        // Initialize the graph
        // Set the graph memory
        sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel({
            'graphs': [
                new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network)
            ],
            }), "GraphIndex");

		window.oGraph = this.byId("graph");
        window.oGraph._fZoomLevel = 0.75;
        window.oGraphCurIndex = 0;
        // Set the Toolbar
        var oToolbar = window.oGraph.getToolbar();
         /*
         * Tool Bar buttons for the Graph
         */
        oToolbar.insertContent(new Button("refreshButton", {
				type: ButtonType.Transparent,
				icon: "sap-icon://refresh",
				press: this.refreshGraph.bind(window.oGraph)
			}), 0);

        oToolbar.insertContent(new Button("goBackGraphButton", {
				type: ButtonType.Transparent,
				icon: "sap-icon://media-rewind",
				press: this.goBackGraph.bind(window.oGraph)
			}), 1);

        oToolbar.insertContent(new Button("goForwardGraphButton", {
				type: ButtonType.Transparent,
				icon: "sap-icon://media-forward",
				press: this.goForwardGraph.bind(window.oGraph)
			}), 2);

		oToolbar.insertContent(new Button("addButton", {
				type: ButtonType.Transparent,
				icon: "sap-icon://add",
				press: this.addNode.bind(window.oGraph)
			}), 3);

		oToolbar.insertContent(new Button("addLine", {
				type: ButtonType.Transparent,
				icon: "sap-icon://chain-link",
				press: this.addLine.bind(window.oGraph)
			}), 4);

		oToolbar.insertContent(new sap.m.Select("graphConfiguration", {
            tooltip: 'Graph configuration',
            items: [
                new sap.ui.core.Item(
                        {text: "None", key: "None"}),
                new sap.ui.core.Item(
                        {text: "Force directed", key: "ForceDirected"}),
                new sap.ui.core.Item(
                        {text: "Process", key: "Process"})
                ],
                change: function(oEvent){
                    //Clear all customizing fields
                    var selected_key = oEvent.oSource.mProperties.selectedKey;
                    if(selected_key == 'Process'){
                        MessageToast.show("Choose a file first");
                         window.oGraph.setLayoutAlgorithm(sap.suite.ui.commons.networkgraph.layout.LayeredLayout);
                    }else if (selected_key == 'ForceDirected'){
                        MessageToast.show("Go Force");
                        window.oGraph.setLayoutAlgorithm(sap.suite.ui.commons.networkgraph.layout.ForceDirectedLayout);
                    }else{
                        MessageToast.show("Go Force");
                    }
                }
			}), 5);

        this.updateGraph(new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network));
        // End Graph set up

        // Initialize the File Manager Integrated Menu
        this.oAvailableFields = this.byId("idAvailableFields");
        // Initialize the File Manager Upload Menu
        this.oUploadTable = this.byId("idUploadFiles");

		this.db_schema_details = this.byId("db_schema_details");
		this.update_db_schema_details();

        this.update_db_summary();

		oMessageManager.registerMessageProcessor(oMessageProcessor);
		oMessageManager.addMessages(
				new sap.ui.core.message.Message({
					message: "Something wrong happened",
					type: sap.ui.core.MessageType.Error,
					processor: oMessageProcessor
				})
		);

        //this.mapId = this.getView().byId("map_canvas").sId;
        //this.makeMap();
		sap.ui.core.BusyIndicator.hide(0);
	},

        getStream: function() {

            jQuery.ajax({
                url : "/OrientDB/get_stream",
                type : "POST",
                dataType : "json",
                async : true,
                success : function(response, jqXHR, textStatus){

                    var oModel = new JSONModel(response);
                    sap.ui.getCore().setModel(oModel, 'LaunchpadStats');
                    window._card1.setModel(oModel);
                    window._card2.setModel(oModel);
                    window._card3.setModel(oModel);
                    window._timeline.setModel(oModel);
                    sap.ui.core.BusyIndicator.hide(0);
                    sap.m.MessageToast.show(response.message);

                },
                error: function(response){
                    console.log(response);
                    sap.ui.core.BusyIndicator.hide(0);
                }
            });

		},

	onInitSetChart: function(){

	    var _constants = {
			sampleName: "sap.suite.ui.commons.sample.ChartContainerDimensionsMultiCharts",
			chartContainerId: "chartContainer",
			table: {
				icon: "sap-icon://table-view",
				title: "Table",
				itemBindingPath: "/businessData",
				columnLabelTexts: ["Sales Month", "Marital Status", "Customer Gender", "Sales Quarter", "Cost", "Unit Price", "Gross Profit", "Sales Revenue"],
				templateCellLabelTexts: ["{Sales_Month}", "{Marital Status}", "{Customer Gender}", "{Sales_Quarter}", "{Cost}", "{Unit Price}", "{Gross Profit}", "{Sales Revenue}"]
			},
			table2: {
				icon: "sap-icon://table-view",
				title: "Table",
				itemBindingPath: "/businessData",
				columnLabelTexts: ["Type", "Date", "First Name", "Last Name", "Gender", "POB", "DOB"],
				templateCellLabelTexts: ["{Type}", "{Date}", "{FirstName}", "{LastName}", "{Gender}", "{PlaceOfBirth}", "{DateOfBirth}"]

			},
			vizFrames: {
				config: {
					height: "700px",
					width: "100%",
					uiConfig: {
						applicationSet: "fiori"
					}
				},
				product: {
					icon: "sap-icon://bubble-chart",
					title: "Bubble Chart",
					dataPath: "ChartContainerData1.json",
					dataset: {
						dimensions: [{
							name: "Sales_Quarter",
							value: "{Sales_Quarter}"
						}, {
							name: "Customer Gender",
							value: "{Customer Gender}"
						}, {
							name: "Sales_Month",
							value: "{Sales_Month}"
						}, {
							name: "Marital Status",
							value: "{Marital Status}"
						}],
						measures: [{
							name: "Cost",
							value: "{Cost}"
						}, {
							name: "Unit Price",
							value: "{Unit Price}"
						}, {
							name: "Gross Profit",
							value: "{Gross Profit}"
						}, {
							name: "Sales Revenue2",
							value: "{Sales Revenue}"
						}],
						data: {
							path: "/businessData"
						}
					},
					feedItems: [{
						uid: "primaryValues",
						type: "Measure",
						values: ["Cost"]
					}, {
						uid: "secondaryValues",
						type: "Measure",
						values: ["Unit Price"]
					}, {
						uid: "bubbleWidth",
						type: "Measure",
						values: ["Gross Profit"]
					}, {
						uid: "bubbleHeight",
						type: "Measure",
						values: ["Sales Revenue"]
					}, {
						uid: "regionColor",
						type: "Dimension",
						values: ["Sales_Month", "Sales_Quarter", "Customer Gender"]
					}, {
						uid: "regionShape",
						type: "Dimension",
						values: ["Marital Status"]
					}],
					vizType: "bubble"
				},
				country1: {
					icon: "sap-icon://horizontal-stacked-chart",
					title: "Stacked Bar Chart",
					dataPath: "ChartContainerData2.json",
					dataset: {
						dimensions: [{
							name: "Country",
							value: "{Country}"
						}],
						measures: [{
							name: "Profit",
							value: "{Profit}"
						}, {
							name: "Target",
							value: "{Target}"
						}],
						data: {
							path: "/"
						}
					},
					feedItems: [{
						uid: "primaryValues",
						type: "Measure",
						values: ["Profit"]
					}, {
						uid: "axisLabels",
						type: "Dimension",
						values: ["Country"]
					}, {
						uid: "targetValues",
						type: "Measure",
						values: ["Target"]
					}],
					vizType: "stacked_bar"
				},
				country2: {
					icon: "sap-icon://vertical-bar-chart",
					title: "Bar Chart",
					dataPath: "ChartContainerData3.json",
					dataset: {
						dimensions: [{
							name: "Country",
							value: "{Country}"
						}],
						measures: [{
							name: "Profit",
							value: "{profit}"
						}],
						data: {
							path: "/businessData"
						}
					},
					feedItems: [{
						uid: "primaryValues",
						type: "Measure",
						values: ["Profit"]
					}, {
						uid: "axisLabels",
						type: "Dimension",
						values: []
					}],
					analysisObjectProps: {
						uid: "Country",
						type: "Dimension",
						name: "Country"
					},
					vizType: "column"
				},
                analytics1: {
					icon: "sap-icon://horizontal-stacked-chart",
					title: "Analysis",
					dataPath: "Abuse",
					dataset: {
						dimensions: [{
							name: "Name",
							value: "{Name}"
						}],
						measures: [{
							name: "Family Risk",
							value: "{RiskFam}"
						}, {
							name: "Individual Risk",
							value: "{RiskInd}"
						}],
						data: {
							path: "/businessData"
						}
					},
					feedItems: [{
						uid: "primaryValues",
						type: "Measure",
						values: ["Individual Risk", "Family Risk"]
					}, {
						uid: "axisLabels",
						type: "Dimension",
						values: ["Name"]
					}, {
						uid: "targetValues",
						type: "Measure",
						values: ["Family Risk"]
					}],
					vizType: "stacked_bar"
				},
                analytics2: {
					icon: "sap-icon://bubble-chart",
					title: "Bubble Chart",
					dataPath: "Abuse",
					dataset: {
						dimensions: [{
							name: "Name",
							value: "{Name}"
						}, {
							name: "Gender",
							value: "{Gender}"
						}, {
							name: "POB",
							value: "{PlaceOfBirth}"
						}, {
							name: "DOB",
							value: "{DateOfBirth}"
						}],
						measures: [{
							name: "Individual Risk",
							value: "{RiskInd}"
						}, {
							name: "Family Risk",
							value: "{RiskFam}"
						}, {
							name: "Status",
							value: "{Progress}"

						},{
							name: "Visits",
							value: "{VisitCount}"
						}],
						data: {
							path: "/businessData"
						}
					},
					feedItems: [{
						uid: "primaryValues",
						type: "Measure",
						values: ["Individual Risk"]
					}, {
						uid: "secondaryValues",
						type: "Measure",
						values: ["Family Risk"]
					}, {
						uid: "bubbleWidth",
						type: "Measure",
						values: ["Status"]
					}, {
						uid: "bubbleHeight",
						type: "Measure",
						values: ["Visits"]
					}, {
						uid: "regionColor",
						type: "Dimension",
						values: ["Gender"]
					}],
					vizType: "bubble"
				},
			}
		}

		return _constants;

	},

	onInitSetChartState: function() {
		var _state = {
			vizFrames: {
				product: null,
				country1: null,
				country2: null,
				analytics1: null,
				analytics2: null
			},
			table: null,
			table2: null
		}
		return _state;

	},

	onNavBack: function() {

        var sPreviousHash = History.getInstance().getPreviousHash();

        if (sPreviousHash !== undefined) {
            history.go(-1);
        } else {
            this.getRouter().navTo("home", {}, true);
        }

    },

    handleSelectionChange: function(oEvent) {
        var oItem = oEvent.getParameter("selectedItem");
        //Ran twice because for some reason only the second time it shows...refresh?
        this._showAnalytics(oItem.getText());
        this._showAnalytics(oItem.getText());
    },

    _initializeSalesByProduct: function() {
    // create table here set to true
        this._state.vizFrames.product = this._createVizFrame(this._constants.vizFrames.product, true);
    },

    _initializeSalesByCountry: function() {
        this._state.vizFrames.country1 = this._createVizFrame(this._constants.vizFrames.country1, false);
        this._state.vizFrames.country2 = this._createVizFrame(this._constants.vizFrames.country2, false);
    },

    _initializeAnalytics: function() {
        //USe the view as the variable which will then change the data source from Abuse to whatever is passed...then maybe need to call this each time instead of
        //
        this._state.vizFrames.analytics1 = this._createVizFrame(this._constants.vizFrames.analytics1, true, "Abuse");
        this._state.vizFrames.analytics2 = this._createVizFrame(this._constants.vizFrames.analytics2, false, "Abuse");

    },

    _createVizFrame: function(vizFrameConfig, createTable, view='defaultValue') {
        var oVizFrame = new VizFrame(this._constants.vizFrames.config);
        //Set this up to be the path to sap.core.ui.model...

        if(vizFrameConfig.dataPath.includes(".json")){
            var oDataPath = sap.ui.getCore().getModel("OrientDBModel").oData.charts[vizFrameConfig.dataPath].d;
        } else {
            if(view === 'defaultValue'){
                var oDataPath = sap.ui.getCore().getModel("OrientDBModel").oData.views[vizFrameConfig.dataPath];
            } else {
                vizFrameConfig.dataPath = view;
                var oDataPath = sap.ui.getCore().getModel("OrientDBModel").oData.views[vizFrameConfig.dataPath];
            }

        }
        var oModel = new JSONModel(oDataPath);
        var oDataSet = new FlattenedDataset(vizFrameConfig.dataset);
        //TODO why is the chart data updated after
        oVizFrame.setDataset(oDataSet);
        oVizFrame.setModel(oModel);
        this._addFeedItems(oVizFrame, vizFrameConfig.feedItems);
        oVizFrame.setVizType(vizFrameConfig.vizType);

        if (createTable) {
            this._createTable(oModel, vizFrameConfig.dataPath);
        }

        return oVizFrame;
    },
    /**
     * Creates the table used by "sales by product view".
     *
     * @private
     * @param {sap.ui.model.json.JSONModel} vizFrameModel Model used by the Viz Frame
     */
    _createTable: function(vizFrameModel, dataPath) {

        if(dataPath.includes(".json")){
            var oTableConfig = this._constants.table;
        }else{
            var oTableConfig = this._constants.table2;
        }

        var oTable = new Table({
            columns: this._createTableColumns(oTableConfig.columnLabelTexts)
        });
        var oTableTemplate = new ColumnListItem({
            type: MobileLibrary.ListType.Active,
            cells: this._createLabels(oTableConfig.templateCellLabelTexts)
        });

        oTable.bindItems(oTableConfig.itemBindingPath, oTableTemplate, null, null);
        oTable.setModel(vizFrameModel);

        this._state.table = oTable;
    },

    _showSalesByProduct: function() {
        var oProductVizFrame = this._constants.vizFrames.product;
        var oTable = this._constants.table;

        var oContent1 = this._createChartContainerContent(oProductVizFrame.icon, oProductVizFrame.title, this._state.vizFrames.product);
        var oContent2 = this._createChartContainerContent(oTable.icon, oTable.title, this._state.table);

        this._updateChartContainerContent(oContent1, oContent2);
    },

    _showSalesByCountry: function() {
        var oCountry1VizFrame = this._constants.vizFrames.country1;
        var oCountry2VizFrame = this._constants.vizFrames.country2;

        var oContent1 = this._createChartContainerContent(oCountry1VizFrame.icon, oCountry1VizFrame.title, this._state.vizFrames.country1);
        var oContent2 = this._createChartContainerContent(oCountry2VizFrame.icon, oCountry2VizFrame.title, this._state.vizFrames.country2);

        this._updateChartContainerContent(oContent1, oContent2);
    },

    _showAnalytics: function(view='defaultValue') {
        var oVizFrame1 = this._constants.vizFrames.analytics1;
        var oVizFrame2 = this._constants.vizFrames.analytics2;
        var oTable = this._constants.table2;

        if(view === 'defaultValue'){
        }else {
            oVizFrame1 = this._state.vizFrames.analytics1 = this._createVizFrame(this._constants.vizFrames.analytics1, true, view);
            oVizFrame2 = this._state.vizFrames.analytics2 = this._createVizFrame(this._constants.vizFrames.analytics2, true, view);
        }

        var oContent1 = this._createChartContainerContent(oTable.icon, oTable.title, this._state.table);
        var oContent2 = this._createChartContainerContent(this._constants.vizFrames.analytics1.icon, view, this._state.vizFrames.analytics1);
        var oContent3 = this._createChartContainerContent(this._constants.vizFrames.analytics2.icon, view, this._state.vizFrames.analytics2);
        this._updateChartContainerContent(oContent1, oContent2, oContent3);

    },

    /**
     * Creates chart container content with the given icon, title, and Viz Frame.
     *
     * @private
     * @param {string} icon Icon path
     * @param {string} title Icon title
     * @param {sap.viz.ui5.controls.VizFrame} vizFrame Viz Frame
     * @returns {sap.suite.ui.commons.ChartContainerContent} Chart container content
     */
    _createChartContainerContent: function(icon, title, vizFrame) {
        var oContent = new ChartContainerContent({
            icon: icon,
            title: title
        });

        oContent.setContent(vizFrame);

        return oContent;
    },
    /**
     * Calls the methods to clear and re-set chart container's content.
     *
     * @private
     * @param {sap.viz.ui5.controls.VizFrame} content1 First Viz Frame
     * @param {sap.viz.ui5.controls.VizFrame} content2 Second Viz Frame
     */
    _updateChartContainerContent: function(content1, content2, content3='defaultValue') {
        var oChartContainer = this.getView().byId(this._constants.chartContainerId);
        oChartContainer.removeAllContent();
        oChartContainer.addContent(content1);
        oChartContainer.addContent(content2);
        if(content3 === 'defaultValue'){
            console.log("None");
        } else {
            oChartContainer.addContent(content3);
        }
        oChartContainer.updateChartContainer();
    },
    /**
     * Adds the passed feed items to the passed Viz Frame.
     *
     * @private
     * @param {sap.viz.ui5.controls.VizFrame} vizFrame Viz Frame to add feed items to
     * @param {Object[]} feedItems Feed items to add
     */
    _addFeedItems: function(vizFrame, feedItems) {
        for (var i = 0; i < feedItems.length; i++) {
            vizFrame.addFeed(new FeedItem(feedItems[i]));
        }
    },
    /**
     * Creates table columns with labels as headers.
     *
     * @private
     * @param {string[]} labels Column labels
     * @returns {sap.m.Column[]} Array of columns
     */
    _createTableColumns: function(labels) {
        var aLabels = this._createLabels(labels);

        return this._createControls(Column, "header", aLabels);
    },
    /**
     * Creates label control array with the specified texts.
     *
     * @private
     * @param {string[]} labelTexts text array
     * @returns {sap.m.Column[]} Array of columns
     */
    _createLabels: function(labelTexts) {
        return this._createControls(Label, "text", labelTexts);
    },
    /**
     * Creates an array of controls with the specified control type, property name and value.
     *
     * @private
     * @param {sap.ui.core.Control} Control Control type to create
     * @param {string} prop Property name
     * @param {Array} propValues Value of the control's property
     * @returns {sap.ui.core.Control[]} array of the new controls
     */
    _createControls: function(Control, prop, propValues) {
        var aControls = [];
        var oProps = {};

        for (var i = 0; i < propValues.length; i++) {
            oProps[prop] = propValues[i];
            aControls.push(new Control(oProps));
        }

        return aControls;
    },

    onDatasetSelected : function(oEvent){
        var datasetRadio = oEvent.getSource();
        if(this.oVizFrame && datasetRadio.getSelected()){
            var bindValue = datasetRadio.getBindingContext().getObject();
            var dataset = {
                data: {
                    path: "/milk"
                }
            };
            var dim = this.settingsModel.dimensions[bindValue.name];
            dataset.dimensions = dim;
            dataset.measures = this.settingsModel.measures;
            var oDataset = new FlattenedDataset(dataset);
            this.oVizFrame.setDataset(oDataset);
            var dataModel = new JSONModel(this.dataPath + bindValue.value);
            this.oVizFrame.setModel(dataModel);

            var feedCategoryAxis = this.getView().byId('categoryAxisFeed');
            this.oVizFrame.removeFeed(feedCategoryAxis);
            var feed = [];
            for (var i = 0; i < dim.length; i++) {
                feed.push(dim[i].name);
            }
            feedCategoryAxis.setValues(feed);
            this.oVizFrame.addFeed(feedCategoryAxis);
        }
    },

    handleUploadPress: function(oEvent) {
        var oFileUploader = this.byId("fileUploader");
        if (!oFileUploader.getValue()) {
            MessageToast.show("Choose a file first");
            return;
        }
        oFileUploader.upload();
    },

    handleUploadComplete: function(oEvent) {
        var sResponse = oEvent.getParameter("response");
        var jResponse = sResponse.replace('<pre style="word-wrap: break-word; white-space: pre-wrap;">', '').replace('</pre>', '');
        jResponse = JSON.parse(jResponse);
        if (jResponse) {
            var sMsg = "";
            if (jResponse.status == 200) {
                this.oUploadTable.setModel(new sap.ui.model.json.JSONModel(jResponse.data));
                oEvent.getSource().setValue("");
                sMsg = 'Upload complete'
            } else {
                sMsg = "Upload error";
            }
            MessageToast.show(sMsg);
        }
    },

    addClipboardToCanvas: function() {
        var message = "Added";
        var selectedKeys = [];
        var selectedNodes = [];
        var selectedGroups = [];
        var allNodeKeys = [];
        var allGroupKeys = [];
        for (var d of window.oGraph.getNodes()){
            allNodeKeys.push(d.mProperties.key);
            }
        for (var d of window.oGraph.getGroups()){
            allGroupKeys.push(d.mProperties.key);
            }
        // Go through the selected items and push the selected keys to temp storage and remove from list
        for(let k of window.oClipboard.getSelectedItems()){
            selectedKeys.push(k.mProperties.key);
            window.oClipboard.removeItem(k);
            }
        console.log('There are ' + sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.nodes.length)
        for(let node of sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.nodes){
            console.log('Is ' + node.key + ' selected?');
            if(selectedKeys.includes(node.key)){
                console.log('YES ' + node.key + ' selected');
                // Go through the selected items and push the selected node to temp storage and remove from model
                // Check to make sure it's not in the current model
                if(allNodeKeys.includes(node.key)){
                    console.log('IN KEYS: ' + node.key);
                } else {
                    selectedNodes.push(node);
                    console.log('ADDING: ' + node.key);
                    allNodeKeys.push(node.key);
                    if(selectedNodes.length == selectedKeys.length){
                        message = message + node.title
                        break;
                    } else if (selectedKeys.length - selectedNodes.length === 1) {
                        message = message + node.title + " and "
                    } else {
                        message = message + node.title + ", "
                    }
                }
                if(allGroupKeys.includes(node.group)){
                    console.log("GROUP already " + node.group);
                } else {
                    console.log("GROUP ADDED " + node.group);
                    selectedGroups.push({'key': node.group, 'title': node.group});
                    allGroupKeys.push(node.group);
                }
            }
            //TODO Error on inserting db_list item
            else{
                console.log('NO ' + node.key + ' not selected');
            }
        }
        // Remove the selected items as selected
        // Pop the selected items now that the processing is finished
        for(let node of sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.nodes){
            if(selectedKeys.includes(node.key)){
                sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.nodes.pop(node);
            }
        }
        window.oClipboard.clearSelection();
        // Add the node to the graph
        for(let group of selectedGroups){
            var newGroup = new Group(group);
            window.oGraph.addGroup(newGroup);
            sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups.push(group);
        }

        for(let node of selectedNodes){
            // Insert the node with the group set
            var newNode = new Node(node);
            // Define the action buttons (ADD LINK, Edit, Traverse)
            var newActLink = new ActionButton ({
                icon: "sap-icon://broken-link",
                title: "Add link",
                position: "Left",
                press: function (oEvent) {

                    var aNodeKey = oEvent.getSource().oParent.getKey();
                    var aNodeTitle = oEvent.getSource().oParent.getTitle();
                    var bNodes = new JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes);
                    var linkDialog = new sap.m.Dialog("new_link_dialog", {
                        title: 'New Link for ' + this.getParent().mProperties.title,
                        draggable: true,
                        content:
                            new sap.ui.layout.form.SimpleForm({
                                content:
                                    [
                                        new sap.m.Label({
                                            text:"Available nodes"
                                            }),
                                        new sap.m.Select({
                                            id: "bNodeKey_from_node",
                                            items: {
                                                path: "/",
                                                sorter: {
                                                    path: "{title}"
                                                    },
                                                template: new Item({
                                                    text: "{title}",
                                                    key: "{key}"
                                                    })
                                                }
                                            }),
                                        new sap.m.Label({
                                            text:"Relationship type"
                                            }),
                                        new sap.m.Input({
                                            id: "RelType_from_node"
                                            }),
                                        new sap.m.Switch({
                                            id: "NodeRelDirection_from_node",
                                            customTextOn: "Out",
                                            customTextOff: "In"
                                        })

                                    ]
                            }),
                        beginButton: new sap.m.Button({
                            text: 'Add',
                            type: 'Accept',
                            press: function (oEvent) {
                                sap.ui.core.BusyIndicator.show(0);
                                sap.ui.getCore().byId("new_link_dialog").close();

                                if(sap.ui.getCore().byId("NodeRelDirection_from_node").mProperties.state === true){
                                    var relDirection = 'Out';
                                }else{
                                    var relDirection = 'In';
                                }

                                var oData = ({
                                            'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                            'a_node': aNodeKey,
                                            'b_node': sap.ui.getCore().byId("bNodeKey_from_node").mProperties.selectedKey,
                                            'rel_type': sap.ui.getCore().byId("RelType_from_node").mProperties.value
                                            });
                                if(sap.ui.getCore().byId("NodeRelDirection_from_node").mProperties.state == false){
                                    oData.rel_direction = 'In';
                                } else {
                                    oData.rel_direction = 'Out'
                                }
                                var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                for(var i=0; i < allNodes.length; i++){
                                    if('key' in allNodes[i]){
                                        if(allNodes[i].key == oData['a_node']){
                                            oData['a_node_detail'] = allNodes[i];
                                        }else if(allNodes[i].key == oData['b_node']){
                                            oData['b_node_detail'] = allNodes[i];
                                        }
                                    }
                                }
                                jQuery.ajax({
                                    url : "/OrientDB/create",
                                    type : "POST",
                                    dataType : "json",
                                    async : true,
                                    data : oData,
                                    success : function(response, jqXHR, textStatus){
                                        sap.ui.core.BusyIndicator.hide(0);
                                        var newLine = new Line(response.d.results);
                                        sap.ui.getCore().byId("new_link_dialog").getParent().getParent().addLine(newLine);

                                        //Update the model
                                        sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines.push(response.d.results);
                                        MessageToast.show(response.d.message);
                                        sap.ui.getCore().byId("new_link_dialog").destroy();
                                    },
                                    error: function(response){
                                        console.log(response);
                                        sap.ui.core.BusyIndicator.hide(0);
                                        sap.ui.getCore().byId("new_link_dialog").destroy();
                                    }
                                });
                            }
                        }),
                        endButton: new sap.m.Button({
                            text: 'Cancel',
                            type: 'Reject',
                            press: function () {
                                sap.ui.getCore().byId("new_link_dialog").close();
                                sap.ui.getCore().byId("new_link_dialog").destroy();
                            }
                        })
                    });
                    this.getParent().addDependent(linkDialog);
                    linkDialog.setModel(bNodes);
                    linkDialog.open();
                },
            });
            // Define the action buttons (ADD LINK, Edit, Traverse)
            var newActEdit = new ActionButton ({
                icon: "sap-icon://edit",
                title: "Edit",
                position: "Left",
                press: function (oEvent) {
                    var NodeKey = oEvent.getSource().oParent.getKey();
                    var NodeTitle = oEvent.getSource().oParent.getTitle();
                    var selectedNode = new JSONModel({'key': NodeKey, 'title': NodeTitle});
                    sap.ui.getCore().setModel(selectedNode, "selectedNode");
                    var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                    var Fields = [];
                    for(var i=0; i < allNodes.length; i++){
                        if(allNodes[i].key == NodeKey){
                            if(allNodes[i].hasOwnProperty('title')){
                                Fields.push(new sap.m.Label({text: 'Title'}));
                                Fields.push(new sap.m.Input({placeholder: allNodes[i].title}));
                            }
                            if(allNodes[i].hasOwnProperty('attributes')){
                                for(var j=0; j < allNodes[i].attributes.length; j++){
                                    Fields.push(new sap.m.Label({text: allNodes[i].attributes[j].label}));
                                    Fields.push(new sap.m.Input({placeholder: allNodes[i].attributes[j].value}));
                                }
                            }
                            if(allNodes[i].hasOwnProperty('icon')){
                                Fields.push(new sap.m.Label({text: 'Icon'}));
                                Fields.push(new sap.m.Input({placeholder: allNodes[i].icon}));
                            }
                            if(allNodes[i].hasOwnProperty('status')){
                                Fields.push(new sap.m.Label({text: 'Status'}));
                                Fields.push(new sap.m.Input({placeholder: allNodes[i].status}));
                            }
                            if(allNodes[i].hasOwnProperty('group')){
                                Fields.push(new sap.m.Label({text: 'Group'}));
                                Fields.push(new sap.m.Input({placeholder: allNodes[i].group}));
                            }
                        }
                    }
                    //get all the variables and create input for each

                    var editDialog = new sap.m.Dialog("new_edit_dialog", {
                        title: 'Edit ' + this.oParent.oParent.getFocus().item.mProperties.title,
                        draggable: true,
                        content:
                            new sap.ui.layout.form.SimpleForm({
                                content: [Fields]
                            }, "EditForm"),
                        buttons: [
                            new sap.m.Button({
                                text: 'Update',
                                type: 'Emphasized',
                                press: function () {
                                    sap.ui.core.BusyIndicator.show(0);
                                    // Store a prepared list of all the attributes and placeholders or updated values
                                    var listF = [];
                                    var F = sap.ui.getCore().byId("new_edit_dialog").mAggregations.content[0]._aElements;
                                    for(var i=0; i<F.length; i++){
                                        if(F[i].sId.includes('input')){
                                            // Determine if there is a value which means it has an update, otherwise
                                            if(F[i].mProperties.hasOwnProperty('value')){
                                                att['value'] = F[i].mProperties.value;
                                            //...use placeholder as the value to set. Keep both in the case the entity is new to the DB
                                            } else {
                                                att['value'] = F[i].mProperties.placeholder;
                                            }
                                            listF.push(att);
                                        }
                                        if(F[i].sId.includes('label')){
                                            var att = {'label': F[i].mProperties.text};
                                        }
                                    }
                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                    var oData = ({
                                                'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                                'node': sap.ui.getCore().getModel('selectedNode').oData.key,
                                                'node_form': listF
                                                });

                                    jQuery.ajax({
                                        url : "/OrientDB/update",
                                        type : "POST",
                                        dataType : "json",
                                        async : true,
                                        data : oData,
                                        success : function(response, jqXHR, textStatus){
                                            sap.ui.core.BusyIndicator.hide(0);
                                            var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                            for(var i=0; i< allNodes.length; i++){
                                                if(allNodes[i].key == sap.ui.getCore().getModel('selectedNode').oData.key){
                                                    sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes[i] = response.results.d;
                                                    var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                                    var oGraph = sap.ui.getCore().byId("new_edit_dialog").getParent().byId("graph");
                                                    oGraph.setModel(oModel);
                                                }
                                            }
                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                        },
                                        error: function(response){
                                            console.log(response);
                                            sap.ui.core.BusyIndicator.hide(0);
                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                        }
                                    });
                                }
                            }),
                            new sap.m.Button({
                                text: 'Delete',
                                type: 'Reject',
                                press: function () {
                                    sap.ui.core.BusyIndicator.show(0);
                                    // Store a prepared list of all the attributes and placeholders or updated values
                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                    var oData = ({
                                                'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                                'node': sap.ui.getCore().getModel('selectedNode').oData.key
                                                });

                                    jQuery.ajax({
                                        url : "/OrientDB/delete",
                                        type : "POST",
                                        dataType : "json",
                                        async : true,
                                        data : oData,
                                        success : function(response, jqXHR, textStatus){
                                            sap.ui.core.BusyIndicator.hide(0);
                                            var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                            var allLines = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines;
                                            var allGroups = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups;
                                            var newNodes = [];
                                            var newLines = [];
                                            for(var i=0; i< allNodes.length; i++){
                                                if(allNodes[i].key != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                    newNodes.push(allNodes[i]);
                                                }
                                            }
                                            for(var i=0; i< allLines.length; i++){
                                                if(allLines[i].to != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                    if(allLines[i].from != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                        newLines.push(allLines[i]);
                                                    }
                                                }
                                            }
                                            var d = {
                                                'lines': newLines,
                                                'nodes': newNodes,
                                                'groups': allGroups
                                            }
                                            sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network = d;
                                            var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                            var oGraph = sap.ui.getCore().byId("new_edit_dialog").getParent().byId("graph");
                                            oGraph.setModel(oModel);
                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                        },
                                        error: function(response){
                                            console.log(response);
                                            sap.ui.core.BusyIndicator.hide(0);
                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                        }
                                    });
                                }
                            }),
                            new sap.m.Button({
                                text: 'Remove',
                                type: 'Accept',
                                press: function () {
                                    sap.ui.core.BusyIndicator.show(0);
                                    // Store a prepared list of all the attributes and placeholders or updated values
                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                    var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                    var allLines = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines;
                                    var allGroups = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups;
                                    //Reset the graph
                                    this.oParent.oParent.destroyGroups();
                                    this.oParent.oParent.destroyNodes();
                                    this.oParent.oParent.destroyLines();

                                    var allGroupsKeys = [];
                                    for(var i=0; i<sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups.length; i++){
                                        allGroupsKeys.push(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups[i].key);
                                    }
                                    var newNodes = [];
                                    var newLines = [];
                                    var newGroupKeys = [];
                                    var newGroups = [];
                                    for(var i=0; i< allNodes.length; i++){
                                        if(allNodes[i].key != sap.ui.getCore().getModel('selectedNode').oData.key){
                                            newNodes.push(allNodes[i]);
                                            this.oParent.oParent.addNode(new Node(allNodes[i]));
                                            if(newGroupKeys.indexOf(allNodes[i].group) == -1){
                                                newGroupKeys.push(allNodes[i].group);
                                                for(var j=0; j<allGroups.length; j++){
                                                    if(allGroups[j].key == allNodes[i].group){
                                                        newGroups.push(allGroups[j]);
                                                        this.oParent.oParent.addGroup(new Group(allGroups[j]));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    for(var i=0; i< allLines.length; i++){
                                        if(allLines[i].to != sap.ui.getCore().getModel('selectedNode').oData.key){
                                            if(allLines[i].from != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                newLines.push(allLines[i]);
                                                this.oParent.oParent.addLine(new Line(allLines[i]));
                                            }
                                        }
                                    }
                                    var d = {
                                        'lines': newLines,
                                        'nodes': newNodes,
                                        'groups': newGroups
                                    }
                                    sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network = d;
                                    var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                    sap.ui.getCore().byId("new_edit_dialog").getParent().setModel(oModel);
                                    sap.ui.core.BusyIndicator.hide(0);
                                    sap.ui.getCore().byId("new_edit_dialog").destroy();
                                }
                            }),
                            new sap.m.Button({
                                text: 'Cancel',
                                type: 'Transparent',
                                press: function () {
                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                    sap.ui.getCore().byId("new_edit_dialog").destroy();
                                }
                            }),
                        ]
                    });
                    this.oParent.oParent.addDependent(editDialog);
                    editDialog.open();
                }
            });
            var newActTraverse = new ActionButton ({
                icon: "sap-icon://overview-chart",
                title: "Traverse",
                position: "Left",
                press: function (oEvent) {

                    var NodeKey = oEvent.getSource().oParent.getKey();
                    var oData = {
                        'key': NodeKey,
                        'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                        'cur_graph': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network
                        };

                    var selectedNode = new JSONModel({'key': NodeKey, 'title': NodeTitle});
                    sap.ui.getCore().setModel(selectedNode, "selectedNode");

                    jQuery.ajax({
                        url : "/OrientDB/traverse",
                        type : "POST",
                        dataType : "json",
                        async : true,
                        data : oData,
                        success : function(response){
                            var oData = new JSONModel({
                                'nodes': response.results.cur_graph.nodes,
                                'lines':  response.results.cur_graph.lines,
                                'groups':  response.results.cur_graph.groups
                                })
                            window.oGraph.setModel(oData);
                            MessageToast.show(response.message);
                        }
                    });
                }
            });
            // Add the buttons to the Node
            newNode.addActionButton(newActLink);
            newNode.addActionButton(newActEdit);
            newNode.addActionButton(newActTraverse);
            window.oGraph.addNode(newNode);
            //Update the model
            sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes.push(node);

        }
        //sap.ui.getCore().getModel('OrientDBModel').refresh();
        var oModel = new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network);
        this.updateGraph(oModel);
        window.oGraph;
        MessageToast.show(message);
    },

    getCalcView_NodeRels: function () {
        /*Create a calc view that has a node key and count of rels
        Table       Row A     Row B
        */

        var rel_view = {};
        var rels = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines;
        for(var i=0; i< rels.length; i++){
            if(rel_view.hasOwnProperty(rels[i].from)){
                rel_view[rels[i].from]++;
            }else{
                rel_view[rels[i].from] = 1;
            }
            if(rel_view.hasOwnProperty(rels[i].to)){
                rel_view[rels[i].to]++;
            }else{
                rel_view[rels[i].to] = 1;
            }
        }
        sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel(rel_view), "CalcView_NodeRels");
        //this.byId("smartChartGeneral").setModel(sap.ui.getCore().getModel("CalcView_NodeRels"));
    },

    getCalcView_NodeAtts: function () {
        /*
        Table       Row A           Row B
        {att_n: [{node_key: key, att_val}]
        For each node, if the node has attributes, check if the att_view has the attribute.label and if it does, add
        the node value, its key, and label as a record. If not create the array that will have those values.
        */
        var nodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
        var all_atts = [];
        var att_view = {};
        var d = [];

        for(var i=0; i < nodes.length; i++){
            if(nodes[i].hasOwnProperty('attributes')){
                for(var j=0; j < nodes[i].attributes.length; j++){
                    if(att_view.hasOwnProperty(nodes[i].attributes[j].label)){
                        att_view[nodes[i].attributes[j].label].push({
                            'node_key': nodes[i].key,
                            'node_label': nodes[i].title,
                            'att_val': nodes[i].attributes[j].value
                            });
                    }else{
                        att_view[nodes[i].attributes[j].label] = [{
                            'node_key': nodes[i].key,
                            'node_label': nodes[i].title,
                            'att_val': nodes[i].attributes[j].value
                            }];
                        all_atts.push()
                    }
                }
            }
        }
        sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel(att_view), "CalcView_NodeAtts");
        //this.byId("idVizFrame").setModel(new sap.ui.model.json.JSONModel(att_view));
        this.byId("idVizFrame").setModel(new sap.ui.model.json.JSONModel(att_view.Cost), "Cost");

    },

    _setChartData : function(){
        Format.numericFormatter(ChartFormatter.getInstance());
            var formatPattern = ChartFormatter.DefaultPattern;
            var oVizFrame = this.oVizFrame = this.getView().byId("idVizFrame");
            oVizFrame.setVizProperties({
                    plotArea: {
                        dataLabel: {
                            formatString:formatPattern.SHORTFLOAT_MFD2,
                            visible: false
                        }
                    },
                    title: {
                        visible: false,
                        text: 'Company'
                    }
            });

            var data = [{
            "Month": "Jan 2017",
            "SalQty": 3750,
            "ForQty": 0,
            "SalVal": 25250,
            "ForVal": 0
        },{
            "Month": "Feb 2017",
            "SalQty": 3500,
            "ForQty": 0,
            "SalVal": 24500,
            "ForVal": 0
        },{
            "Month": "Mar 2017",
            "SalQty": 3500,
            "ForQty": 0,
            "SalVal": 24500,
            "ForVal": 0
        }];
        var oJson = new sap.ui.model.json.JSONModel({"Chart" : data});
        oVizFrame.setModel(oJson, "ChartMdl");
    },

    // Update chart data
    updateChart : function(oEvent) {
            var data = [{
            "Month": "Jan 2017",
            "SalQty": 3750,
            "ForQty": 0,
            "SalVal": 25250,
            "ForVal": 0
            },{
            "Month": "Feb 2017",
            "SalQty": 3500,
            "ForQty": 0,
            "SalVal": 24500,
            "ForVal": 0
        },{
            "Month": "Mar 2017",
            "SalQty": 3500,
            "ForQty": 0,
            "SalVal": 24500,
            "ForVal": 0
        }];
            var oJson = new sap.ui.model.json.JSONModel({"Chart" : data});
        oVizFrame.setModel(oJson, "ChartMdl");
    },

    refreshGraph: function () {

          var oData = {'cur_index': window._stream_index}

                jQuery.ajax({
                    url : "/get_stream",
                    type : "POST",
                    dataType : "json",
                    data: oData,
                    async : true,
                    success : function(response, jqXHR, textStatus){

                        var oModel = new JSONModel(response);
                        sap.m.MessageToast.show(response.message);
                        window._stream_index = response.new_index;

                    },
                    error: function(response){
                        console.log(response);
                        sap.ui.core.BusyIndicator.hide(0);
                    }
                });

			this.invalidate();
		},

    updateGraph: function(graphData){
        window.oGraph.destroyAllElements();
        window.oGraph.setModel(graphData);
        sap.ui.getCore().getModel('GraphIndex').oData.graphs.push(graphData);
        window.oGraphCurIndex = sap.ui.getCore().getModel('GraphIndex').oData.graphs.length-1;
	},

	goBackGraph: function(){

	    if(window.oGraphCurIndex == 1){
	        sap.m.MessageToast.show("At the beginning of the graph index");
	    } else {
            var graphData = new JSONModel(sap.ui.getCore().getModel('GraphIndex').oData.graphs[window.oGraphCurIndex-1].oData)
            window.oGraph.destroyAllElements();
            window.oGraph.setModel(graphData);
            window.oGraphCurIndex--;
            sap.m.MessageToast.show("Moved back to index " + window.oGraphCurIndex);
	    }
	},

	goForwardGraph: function(){
        if(window.oGraphCurIndex == sap.ui.getCore().getModel('GraphIndex').oData.graphs.length -1){
	        sap.m.MessageToast.show("At the end of the graph with index "  + window.oGraphCurIndex);
	    } else {
            var graphData = new JSONModel(sap.ui.getCore().getModel('GraphIndex').oData.graphs[window.oGraphCurIndex+1].oData)
            window.oGraph.destroyAllElements();
            window.oGraph.setModel(graphData);
            window.oGraphCurIndex++;
            sap.m.MessageToast.show("Moved forward to index " + window.oGraphCurIndex);
	    }
	},

    update_db_summary: function(){
        this.byId("dbSummary_name").setText(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name);
        this.byId("dbSummary_size").setText(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.size);
        this.byId("dbSummary_records").setText(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.records);
    },

    update_dbList: function (oModel) {
        window.dbList.setModel(oModel);
    },

    update_db_schema_details: function () {
        var oModel = new JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.index);
    	this.getView().setModel(oModel);
    	this.getView().getModel().refresh();
    },

    update_db_sample: function (){
        var oModel = new JSONModel(sap.ui.getCore().getModel('CurrentSample').oData.index);
    	this.getView().setModel(oModel);
    	this.getView().getModel().refresh();
    },

	onPress: function (oEvent) {

		sap.m.MessageToast.show("Pressed custom button " + oEvent.getSource().getId());
	},

	onPressNewNode: function (oEvent){

	    sap.m.MessageToast.show("Pressed custom button " + oEvent.getSource().getId());

	},
	editNode: function (oEvent) {

	    var NodeKey = oEvent.getSource().oParent.getKey();
        var NodeTitle = oEvent.getSource().oParent.getTitle();
        var selectedNode = new JSONModel({'key': NodeKey, 'title': NodeTitle});
        sap.ui.getCore().setModel(selectedNode, "selectedNode");
        var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
        var Fields = [];
        for(var i=0; i < allNodes.length; i++){
            if(allNodes[i].key == NodeKey){
                if(allNodes[i].hasOwnProperty('title')){
                    Fields.push(new sap.m.Label({text: 'Title'}));
                    Fields.push(new sap.m.Input({placeholder: allNodes[i].title}));
                }
                if(allNodes[i].hasOwnProperty('attributes')){
                    for(var j=0; j < allNodes[i].attributes.length; j++){
                        Fields.push(new sap.m.Label({text: allNodes[i].attributes[j].label}));
                        Fields.push(new sap.m.Input({placeholder: allNodes[i].attributes[j].value}));
                    }
                }
                if(allNodes[i].hasOwnProperty('icon')){
                    Fields.push(new sap.m.Label({text: 'Icon'}));
                    Fields.push(new sap.m.Input({placeholder: allNodes[i].icon}));
                }
                if(allNodes[i].hasOwnProperty('status')){
                    Fields.push(new sap.m.Label({text: 'Status'}));
                    Fields.push(new sap.m.Input({placeholder: allNodes[i].status}));
                }
                if(allNodes[i].hasOwnProperty('group')){
                    Fields.push(new sap.m.Label({text: 'Group'}));
                    Fields.push(new sap.m.Input({placeholder: allNodes[i].group}));
                }
            }
        }
        //get all the variables and create input for each

	    var editDialog = new sap.m.Dialog("new_edit_dialog", {
            title: 'Edit ' + window.oGraph.getFocus().item.mProperties.title,
            draggable: true,
            content:
                new sap.ui.layout.form.SimpleForm({
                    content: [Fields]
                }, "EditForm"),
            buttons: [
                new sap.m.Button({
                    text: 'Update',
                    type: 'Emphasized',
                    press: function () {
                        sap.ui.core.BusyIndicator.show(0);
                        // Store a prepared list of all the attributes and placeholders or updated values
                        var listF = [];
                        var F = sap.ui.getCore().byId("new_edit_dialog").mAggregations.content[0]._aElements;
                        for(var i=0; i<F.length; i++){
                            if(F[i].sId.includes('input')){
                                // Determine if there is a value which means it has an update, otherwise
                                if(F[i].mProperties.hasOwnProperty('value')){
                                    att['value'] = F[i].mProperties.value;
                                //...use placeholder as the value to set. Keep both in the case the entity is new to the DB
                                } else {
                                    att['value'] = F[i].mProperties.placeholder;
                                }
                                listF.push(att);
                            }
                            if(F[i].sId.includes('label')){
                                var att = {'label': F[i].mProperties.text};
                            }
                        }
                        sap.ui.getCore().byId("new_edit_dialog").close();
                        var oData = ({
                                    'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                    'node': sap.ui.getCore().getModel('selectedNode').oData.key,
                                    'node_form': listF
                                    });

                        jQuery.ajax({
                            url : "/OrientDB/update",
                            type : "POST",
                            dataType : "json",
                            async : true,
                            data : oData,
                            success : function(response, jqXHR, textStatus){
                                sap.ui.core.BusyIndicator.hide(0);
                                var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                for(var i=0; i< allNodes.length; i++){
                                    if(allNodes[i].key == sap.ui.getCore().getModel('selectedNode').oData.key){
                                        sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes[i] = response.results.d;
                                        var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                        var oGraph = sap.ui.getCore().byId("new_edit_dialog").getParent().byId("graph");
                                        oGraph.setModel(oModel);
                                    }
                                }
                                sap.ui.getCore().byId("new_edit_dialog").destroy();
                            },
                            error: function(response){
                                console.log(response);
                                sap.ui.core.BusyIndicator.hide(0);
                                sap.ui.getCore().byId("new_edit_dialog").destroy();
                            }
                        });
                    }
                }),
                new sap.m.Button({
                    text: 'Delete',
                    type: 'Reject',
                    press: function () {
                        sap.ui.core.BusyIndicator.show(0);
                        // Store a prepared list of all the attributes and placeholders or updated values
                        sap.ui.getCore().byId("new_edit_dialog").close();
                        var oData = ({
                                    'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                    'node': sap.ui.getCore().getModel('selectedNode').oData.key
                                    });

                        jQuery.ajax({
                            url : "/OrientDB/delete",
                            type : "POST",
                            dataType : "json",
                            async : true,
                            data : oData,
                            success : function(response, jqXHR, textStatus){
                                sap.ui.core.BusyIndicator.hide(0);
                                var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                var allLines = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines;
                                var allGroups = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups;
                                var allGroupsKeys = [];
                                for(var i=0; i<sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups.length; i++){
                                    allGroupsKeys.push(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups[i].key);
                                }
                                var newNodes = [];
                                var newLines = [];
                                var newGroupKeys = [];
                                var newGroups = [];
                                for(var i=0; i< allNodes.length; i++){
                                    if(allNodes[i].key != sap.ui.getCore().getModel('selectedNode').oData.key){
                                        newNodes.push(allNodes[i]);
                                        if(newGroupKeys.indexOf(allNodes[i].group) == -1){
                                            newGroupKeys.push(allNodes[i].group);
                                            for(var j=0; j<allGroups.length; j++){
                                                if(allGroups[j].key == allNodes[i].group){
                                                    newGroups.push(allGroups[j]);
                                                }
                                            }
                                        }
                                    }
                                }
                                for(var i=0; i< allLines.length; i++){
                                    if(allLines[i].to != sap.ui.getCore().getModel('selectedNode').oData.key){
                                        if(allLines[i].from != sap.ui.getCore().getModel('selectedNode').oData.key){
                                            newLines.push(allLines[i]);
                                        }
                                    }
                                }
                                var d = {
                                    'lines': newLines,
                                    'nodes': newNodes,
                                    'groups': newGroups
                                }
                                sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network = d;
                                var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                var oGraph = sap.ui.getCore().byId("new_edit_dialog").getParent().byId("graph");
                                oGraph.setModel(oModel);
                                sap.ui.getCore().byId("new_edit_dialog").destroy();
                            },
                            error: function(response){
                                console.log(response);
                                sap.ui.core.BusyIndicator.hide(0);
                                sap.ui.getCore().byId("new_edit_dialog").destroy();
                            }
                        });
                    }
                }),
                new sap.m.Button({
                    text: 'Remove',
                    type: 'Accept',
                    press: function () {
                        sap.ui.core.BusyIndicator.show(0);
                        // Store a prepared list of all the attributes and placeholders or updated values
                        sap.ui.getCore().byId("new_edit_dialog").close();
                        var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                        var allLines = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines;
                        var allGroups = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups;
                        var newNodes = [];
                        var newLines = [];
                        for(var i=0; i< allNodes.length; i++){
                            if(allNodes[i].key != sap.ui.getCore().getModel('selectedNode').oData.key){
                                newNodes.push(allNodes[i]);
                            }
                        }
                        for(var i=0; i< allLines.length; i++){
                            if(allLines[i].to != sap.ui.getCore().getModel('selectedNode').oData.key){
                                if(allLines[i].from != sap.ui.getCore().getModel('selectedNode').oData.key){
                                    newLines.push(allLines[i]);
                                }
                            }
                        }
                        var d = {
                            'lines': newLines,
                            'nodes': newNodes,
                            'groups': allGroups
                        }
                        sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network = d;
                        var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                        var oGraph = sap.ui.getCore().byId("new_edit_dialog").getParent().byId("graph");
                        oGraph.setModel(oModel);
                        sap.ui.core.BusyIndicator.hide(0);
                        sap.ui.getCore().byId("new_edit_dialog").destroy();
                    }
                }),
                new sap.m.Button({
                    text: 'Cancel',
                    type: 'Transparent',
                    press: function () {
                        sap.ui.getCore().byId("new_edit_dialog").close();
                        sap.ui.getCore().byId("new_edit_dialog").destroy();
                    }
                }),
            ]
        });
        this.getView('OrientDB').addDependent(editDialog);
        editDialog.open();
	},


    addLineFromNode: function (oEvent) {

        var aNodeKey = oEvent.getSource().oParent.getKey();
        var aNodeTitle = oEvent.getSource().oParent.getTitle();
        var bNodes = new JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes);
        var aNode = window.oGraph.getFocus().item.mProperties.key;
        var linkDialog = new sap.m.Dialog("new_link_dialog", {
            title: 'New Link for ' + window.oGraph.getFocus().item.mProperties.title,
            draggable: true,
            content:
                new sap.ui.layout.form.SimpleForm({
                    content:
                        [
                            new sap.m.Label({
                                text:"Available nodes"
                                }),
                            new sap.m.Select({
                                id: "bNodeKey_from_node",
                                items: {
                                    path: "/",
                                    sorter: {
                                        path: "{title}"
                                        },
                                    template: new Item({
                                        text: "{title}",
                                        key: "{key}"
                                        })
                                    }
                                }),
                            new sap.m.Label({
                                text:"Relationship type"
                                }),
                            new sap.m.Input({
                                id: "RelType_from_node"
                                }),
                            new sap.m.Switch({
                                id: "NodeRelDirection_from_node",
                                customTextOn: "Out",
                                customTextOff: "In"
                            })

                        ]
                }),
            beginButton: new sap.m.Button({
                text: 'Add',
                type: 'Accept',
                press: function (oEvent) {
                    sap.ui.core.BusyIndicator.show(0);
                    sap.ui.getCore().byId("new_link_dialog").close();

                    if(sap.ui.getCore().byId("NodeRelDirection_from_node").mProperties.state === true){
                        var relDirection = 'Out';
                    }else{
                        var relDirection = 'In';
                    }

                    var oData = ({
                                'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                'a_node': aNode,
                                'b_node': sap.ui.getCore().byId("bNodeKey_from_node").mProperties.selectedKey,
                                'rel_type': sap.ui.getCore().byId("RelType_from_node").mProperties.value
                                });
                    if(sap.ui.getCore().byId("NodeRelDirection_from_node").mProperties.state == false){
                        oData.rel_direction = 'In';
                    } else {
                        oData.rel_direction = 'Out'
                    }
                    var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes
                    for(var i=0; i < allNodes.length; i++){
                        if('key' in allNodes[i]){
                            if(allNodes[i].key == oData['a_node']){
                                oData['a_node_detail'] = allNodes[i];
                            }else if(allNodes[i].key == oData['b_node']){
                                oData['b_node_detail'] = allNodes[i];
                            }
                        }
                    }
                    jQuery.ajax({
                        url : "/OrientDB/create",
                        type : "POST",
                        dataType : "json",
                        async : true,
                        data : oData,
                        success : function(response, jqXHR, textStatus){
                            sap.ui.core.BusyIndicator.hide(0);
                            var newLine = new Line(response.d.results);
                            sap.ui.getCore().byId("new_link_dialog").getParent().byId("graph").addLine(newLine);

                            //Update the model
                            sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines.push(response.d.results);
                            var oModelGraph = new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network);
                            sap.ui.getCore().getModel('GraphIndex').oData.graphs.push(oModelGraph);
                            window.oGraphCurIndex = sap.ui.getCore().getModel('GraphIndex').oData.graphs.length-1;
                            MessageToast.show(response.d.message);
                            sap.ui.getCore().byId("new_link_dialog").destroy();
                        },
                        error: function(response){
                            console.log(response);
                            sap.ui.core.BusyIndicator.hide(0);
                            sap.ui.getCore().byId("new_link_dialog").destroy();
                        }
                    });
                }
            }),
            endButton: new sap.m.Button({
                text: 'Cancel',
                type: 'Reject',
                press: function () {
                    sap.ui.getCore().byId("new_link_dialog").close();
                    sap.ui.getCore().byId("new_link_dialog").destroy();
                }
            })
        });
        this.getView('OrientDB').addDependent(linkDialog);
        linkDialog.setModel(bNodes);
        linkDialog.open();

    },

    onSearch: function (oEvent){

        var oThis = this;

		var oData = ({
			'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
			'search_terms': oEvent.mParameters.query
			});
		sap.ui.core.BusyIndicator.show(0);
		oEvent.mParameters.query = '';
        jQuery.ajax({
            url : "/OrientDB/search",
            type : "POST",
            dataType : "json",
            async : true,
            data : oData,
            success : function(response, textStatus, jqXHR){
                // Set up the group
                sap.ui.core.BusyIndicator.hide(0);
                for(var i=0; i < response.d.results.length; i++){
                    if(sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.keys.includes(response.d.results[i].key)){
                        console.log(response.d.results[i]);
                    }else{
                        sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.nodes.push(response.d.results[i]);
                        sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.keys.push(response.d.results[i].key);
                    }
                }
                var oModel = new JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.clipboard.nodes);
                window.oClipboard.destroyItems();
                window.oClipboard.setModel(oModel);
                MessageToast.show("Search complete with " + response.d.results.length + " results available in the clipboard");

            },
            error: function(response){
                console.log(response);
                sap.ui.core.BusyIndicator.hide(0);
            }
        });

    },

    addNode: function () {

        var p_count = 0;
        this.pressDialog = new Dialog("new_node",{
            title: 'New Node',
            draggable: true,
            resizable: true,
            content:
                new sap.ui.layout.form.SimpleForm("AddNodeForm", {
                    content:
                        [
                        new sap.m.Label({
                            text:"Node class"
                            }),
                        new sap.m.Select({
                            id: "node_type",
                            change: function(oEvent){
                                //Clear all customizing fields
                                var fields = this.getParent().getFields();
                                for(var i=0; i<fields.length; i++){
                                    if(fields[i].sId != 'node_type'){
                                        if(fields[i].sId.includes('button') === false){
                                            sap.ui.getCore().byId(fields[i].sId).destroy();
                                        }
                                    }
                                }
                                var selected_key = oEvent.oSource.mProperties.selectedKey;
                                if(selected_key == 'Person'){
                                    this.getParent().addField(new sap.m.Input("prop_Gender", { placeholder: "Gender"}));
                                    this.getParent().addField(new sap.m.Input("prop_FName",{ placeholder: "FirstName"}));
                                    this.getParent().addField(new DateTimePicker("prop_Dob"),{ valueFormat: "yyyy-MM-dd HH:mm:ss"});
                                    p_count++;
                                }else if (selected_key == 'Object'){
                                    this.getParent().addField(new sap.m.Input("prop_Type",{ placeholder: "Category"}));
                                    p_count++;
                                }else if (selected_key ==='Location'){
                                    this.getParent().addField(new sap.m.Input("prop_Lat",{ placeholder: "Latitude"}));
                                    this.getParent().addField(new sap.m.Input("prop_Lon",{ placeholder: "Longitude"}));
                                    p_count++;
                                }else if (selected_key == 'Event'){
                                    this.getParent().addField(new DateTimePicker("prop_Doe"),{ valueFormat: "yyyy-MM-dd HH:mm:ss"});
                                    p_count++;
                                }else{
                                    this.getParent();
                                }
                            },
                            items: [
                                new sap.ui.core.Item(
                                        {text: "None", key: "None"}),
                                new sap.ui.core.Item(
                                        {text: "Person", key: "Person"}),
                                new sap.ui.core.Item(
                                        {text: "Object", key: "Object"}),
                                new sap.ui.core.Item(
                                        {text: "Location", key: "Location"}),
                                new sap.ui.core.Item(
                                        {text: "Event", key: "Event"})
                                ]
                            }),
                        new sap.m.Button({
                            icon : "sap-icon://add",
                            text : " Add property",
                            press : function() {
                                  this.getParent().addField(new sap.m.Input("prop_" + p_count,{ placeholder: "Property name"}));
                                  this.getParent().addField(new sap.m.Input("value_" + p_count,{ placeholder: "Value"}));
                                  p_count++;
                            }
                        })
                        ]
                }),
            beginButton: new sap.m.Button({
                text: 'Create',
                type: 'Accept',
                press: function (oEvent) {
                    sap.ui.core.BusyIndicator.show(0);
                    sap.ui.getCore().byId("new_node").close();

                    var oData = ({
                                'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                'node_type': 0,
                                'node_name': 0,
                                'node_propvals': []});
                    var inputs = this.getParent().mAggregations.content[0]._aElements;
                    for(var p of inputs){
                        if(p.sId.slice(0,5) === 'prop_'){
                            if(p.sId === 'prop_Dob'){
                                oData.node_propvals.push({'prop': 'DateOfBirth', 'value': p.mProperties.value});
                            } else if (p.sId === 'prop_Doe') {
                                oData.node_propvals.push({'prop': 'CreateDate', 'value': p.mProperties.value});
                            } else if (p.sId === 'prop_Geneder') {
                                oData.node_propvals.push({'prop': 'Gender', 'value': p.mProperties.value});
                            } else if (p.sId === 'prop_FName') {
                                oData.node_propvals.push({'prop': 'FirstName', 'value': p.mProperties.value});
                                var FirstName = p.mProperties.value;
                            } else if (p.sId === 'prop_Lat') {
                                oData.node_propvals.push({'prop': 'Latitude', 'value': p.mProperties.value});
                            } else if (p.sId === 'prop_Lon') {
                                oData.node_propvals.push({'prop': 'Longitude', 'value': p.mProperties.value});
                            } else if (p.sId === 'prop_Type') {
                                oData.node_propvals.push({'prop': 'Category', 'value': p.mProperties.value});
                            } else if (p.sId === 'prop_Lat') {
                                oData.node_propvals.push({'prop': 'Latitude', 'value': p.mProperties.value});
                            } else {
                                if (p.mProperties.placeholder === 'Property name'){
                                    var prop = {'prop': p.mProperties.value};
                                }
                            }
                        } else if(p.mProperties.text === 'Node class'){
                            var prop = {'prop': 'class_name'};
                        } else if(p.sId === 'node_type'){
                            prop.value = p.mProperties.selectedKey;
                            oData.node_propvals.push(prop);
                            oData.node_type = p.mProperties.selectedKey;
                        } else if (p.sId.slice(0,6) === 'value_') {
                            prop.value = p.mProperties.value;
                            oData.node_propvals.push(prop);
                            if (prop.prop.includes('LastName')){
                                oData.node_propvals.push({'prop': 'title', 'value': FirstName + ' ' + p.mProperties.value});
                            }
                        }
                    }

                    jQuery.ajax({
                        url : "/OrientDB/create",
                        type : "POST",
                        dataType : "json",
                        async : true,
                        data : oData,
                        success : function(response){
                            // Set up the group
                            sap.ui.core.BusyIndicator.hide(0);
                            // Quality check on Nodes
                            var nid = response.d.results.key;
                            var nodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                            for(var i=0; i<nodes.length; i++){
                                if(nodes[i].key == nid){
                                    MessageToast.show("Already exists");
                                    sap.ui.getCore().byId("new_node").destroy();
                                    return;
                                }
                            }
                            // Quality check on Groups
                            var g = response.d.results.group;
                            var allGroupKeys = [];
                            var groups = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups;
                            for(var i=0; i<groups.length; i++){
                                allGroupKeys.push(groups[i].key);
                            }
                            if(allGroupKeys.includes(g)){
                                console.log('Already in groups');
                            }else{
                                var newGroup = new Group({'key': g, 'title': g});
                                sap.ui.getCore().byId('new_node').getParent().addGroup(newGroup);
                                sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups.push({"key": response.d.results.group,"title": response.d.results.group});
                            }
                            // Insert the node with the group set
                            var newNode = new Node(response.d.results);
                            // Define the action buttons (ADD LINK, Edit, Traverse)
                            var newActLink = new ActionButton ({
                                icon: "sap-icon://broken-link",
                                title: "Add link",
                                position: "Left",
                                press: function (oEvent) {

                                    var aNodeKey = oEvent.getSource().oParent.getKey();
                                    var aNodeTitle = oEvent.getSource().oParent.getTitle();
                                    var bNodes = new JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes);
                                    var linkDialog = new sap.m.Dialog("new_link_dialog", {
                                        title: 'New Link for ' + this.getParent().mProperties.title,
                                        draggable: true,
                                        content:
                                            new sap.ui.layout.form.SimpleForm({
                                                content:
                                                    [
                                                        new sap.m.Label({
                                                            text:"Available nodes"
                                                            }),
                                                        new sap.m.Select({
                                                            id: "bNodeKey_from_node",
                                                            items: {
                                                                path: "/",
                                                                sorter: {
                                                                    path: "{title}"
                                                                    },
                                                                template: new Item({
                                                                    text: "{title}",
                                                                    key: "{key}"
                                                                    })
                                                                }
                                                            }),
                                                        new sap.m.Label({
                                                            text:"Relationship type"
                                                            }),
                                                        new sap.m.Input({
                                                            id: "RelType_from_node"
                                                            }),
                                                        new sap.m.Switch({
                                                            id: "NodeRelDirection_from_node",
                                                            customTextOn: "Out",
                                                            customTextOff: "In"
                                                        })

                                                    ]
                                            }),
                                        beginButton: new sap.m.Button({
                                            text: 'Add',
                                            type: 'Accept',
                                            press: function (oEvent) {
                                                sap.ui.core.BusyIndicator.show(0);
                                                sap.ui.getCore().byId("new_link_dialog").close();

                                                if(sap.ui.getCore().byId("NodeRelDirection_from_node").mProperties.state === true){
                                                    var relDirection = 'Out';
                                                }else{
                                                    var relDirection = 'In';
                                                }

                                                var oData = ({
                                                            'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                                            'a_node': aNodeKey,
                                                            'b_node': sap.ui.getCore().byId("bNodeKey_from_node").mProperties.selectedKey,
                                                            'rel_type': sap.ui.getCore().byId("RelType_from_node").mProperties.value
                                                            });
                                                if(sap.ui.getCore().byId("NodeRelDirection_from_node").mProperties.state == false){
                                                    oData.rel_direction = 'In';
                                                } else {
                                                    oData.rel_direction = 'Out'
                                                }
                                                var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes
                                                for(var i=0; i < allNodes.length; i++){
                                                    if('key' in allNodes[i]){
                                                        if(allNodes[i].key == oData['a_node']){
                                                            oData['a_node_detail'] = allNodes[i];
                                                        }else if(allNodes[i].key == oData['b_node']){
                                                            oData['b_node_detail'] = allNodes[i];
                                                        }
                                                    }
                                                }
                                                jQuery.ajax({
                                                    url : "/OrientDB/create",
                                                    type : "POST",
                                                    dataType : "json",
                                                    async : true,
                                                    data : oData,
                                                    success : function(response, jqXHR, textStatus){
                                                        sap.ui.core.BusyIndicator.hide(0);
                                                        var newLine = new Line(response.d.results);
                                                        sap.ui.getCore().byId("new_link_dialog").getParent().getParent().addLine(newLine);

                                                        //Update the model
                                                        sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines.push(response.d.results);
                                                        MessageToast.show(response.d.message);
                                                        sap.ui.getCore().byId("new_link_dialog").destroy();
                                                    },
                                                    error: function(response){
                                                        console.log(response);
                                                        sap.ui.core.BusyIndicator.hide(0);
                                                        sap.ui.getCore().byId("new_link_dialog").destroy();
                                                    }
                                                });
                                            }
                                        }),
                                        endButton: new sap.m.Button({
                                            text: 'Cancel',
                                            type: 'Reject',
                                            press: function () {
                                                sap.ui.getCore().byId("new_link_dialog").close();
                                                sap.ui.getCore().byId("new_link_dialog").destroy();
                                            }
                                        })
                                    });
                                    this.getParent().addDependent(linkDialog);
                                    linkDialog.setModel(bNodes);
                                    linkDialog.open();
                                },
                            });
                            // Define the action buttons (ADD LINK, Edit, Traverse)
                            var newActEdit = new ActionButton ({
                                icon: "sap-icon://edit",
                                title: "Edit",
                                position: "Left",
                                press: function (oEvent) {
                                    var NodeKey = oEvent.getSource().oParent.getKey();
                                    var NodeTitle = oEvent.getSource().oParent.getTitle();
                                    var selectedNode = new JSONModel({'key': NodeKey, 'title': NodeTitle});
                                    sap.ui.getCore().setModel(selectedNode, "selectedNode");
                                    var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                    var Fields = [];
                                    for(var i=0; i < allNodes.length; i++){
                                        if(allNodes[i].key == NodeKey){
                                            if(allNodes[i].hasOwnProperty('title')){
                                                Fields.push(new sap.m.Label({text: 'Title'}));
                                                Fields.push(new sap.m.Input({placeholder: allNodes[i].title}));
                                            }
                                            if(allNodes[i].hasOwnProperty('attributes')){
                                                for(var j=0; j < allNodes[i].attributes.length; j++){
                                                    Fields.push(new sap.m.Label({text: allNodes[i].attributes[j].label}));
                                                    Fields.push(new sap.m.Input({placeholder: allNodes[i].attributes[j].value}));
                                                }
                                            }
                                            if(allNodes[i].hasOwnProperty('icon')){
                                                Fields.push(new sap.m.Label({text: 'Icon'}));
                                                Fields.push(new sap.m.Input({placeholder: allNodes[i].icon}));
                                            }
                                            if(allNodes[i].hasOwnProperty('status')){
                                                Fields.push(new sap.m.Label({text: 'Status'}));
                                                Fields.push(new sap.m.Input({placeholder: allNodes[i].status}));
                                            }
                                            if(allNodes[i].hasOwnProperty('group')){
                                                Fields.push(new sap.m.Label({text: 'Group'}));
                                                Fields.push(new sap.m.Input({placeholder: allNodes[i].group}));
                                            }
                                        }
                                    }
                                    //get all the variables and create input for each

                                    var editDialog = new sap.m.Dialog("new_edit_dialog", {
                                        title: 'Edit ' + this.oParent.oParent.getFocus().item.mProperties.title,
                                        draggable: true,
                                        content:
                                            new sap.ui.layout.form.SimpleForm({
                                                content: [Fields]
                                            }, "EditForm"),
                                        buttons: [
                                            new sap.m.Button({
                                                text: 'Update',
                                                type: 'Emphasized',
                                                press: function () {
                                                    sap.ui.core.BusyIndicator.show(0);
                                                    // Store a prepared list of all the attributes and placeholders or updated values
                                                    var listF = [];
                                                    var F = sap.ui.getCore().byId("new_edit_dialog").mAggregations.content[0]._aElements;
                                                    for(var i=0; i<F.length; i++){
                                                        if(F[i].sId.includes('input')){
                                                            // Determine if there is a value which means it has an update, otherwise
                                                            if(F[i].mProperties.hasOwnProperty('value')){
                                                                att['value'] = F[i].mProperties.value;
                                                            //...use placeholder as the value to set. Keep both in the case the entity is new to the DB
                                                            } else {
                                                                att['value'] = F[i].mProperties.placeholder;
                                                            }
                                                            listF.push(att);
                                                        }
                                                        if(F[i].sId.includes('label')){
                                                            var att = {'label': F[i].mProperties.text};
                                                        }
                                                    }
                                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                                    var oData = ({
                                                                'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                                                'node': sap.ui.getCore().getModel('selectedNode').oData.key,
                                                                'node_form': listF
                                                                });

                                                    jQuery.ajax({
                                                        url : "/OrientDB/update",
                                                        type : "POST",
                                                        dataType : "json",
                                                        async : true,
                                                        data : oData,
                                                        success : function(response, jqXHR, textStatus){
                                                            sap.ui.core.BusyIndicator.hide(0);
                                                            var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                                            for(var i=0; i< allNodes.length; i++){
                                                                if(allNodes[i].key == sap.ui.getCore().getModel('selectedNode').oData.key){
                                                                    sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes[i] = response.results.d;
                                                                    var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                                                    var oGraph = sap.ui.getCore().byId("new_edit_dialog").getParent().byId("graph");
                                                                    oGraph.setModel(oModel);
                                                                }
                                                            }
                                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                                        },
                                                        error: function(response){
                                                            console.log(response);
                                                            sap.ui.core.BusyIndicator.hide(0);
                                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                                        }
                                                    });
                                                }
                                            }),
                                            new sap.m.Button({
                                                text: 'Delete',
                                                type: 'Reject',
                                                press: function () {
                                                    sap.ui.core.BusyIndicator.show(0);
                                                    // Store a prepared list of all the attributes and placeholders or updated values
                                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                                    var oData = ({
                                                                'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                                                'node': sap.ui.getCore().getModel('selectedNode').oData.key
                                                                });

                                                    jQuery.ajax({
                                                        url : "/OrientDB/delete",
                                                        type : "POST",
                                                        dataType : "json",
                                                        async : true,
                                                        data : oData,
                                                        success : function(response, jqXHR, textStatus){
                                                            sap.ui.core.BusyIndicator.hide(0);
                                                            var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                                            var allLines = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines;
                                                            var allGroups = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups;
                                                            var newNodes = [];
                                                            var newLines = [];
                                                            for(var i=0; i< allNodes.length; i++){
                                                                if(allNodes[i].key != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                                    newNodes.push(allNodes[i]);
                                                                }
                                                            }
                                                            for(var i=0; i< allLines.length; i++){
                                                                if(allLines[i].to != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                                    if(allLines[i].from != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                                        newLines.push(allLines[i]);
                                                                    }
                                                                }
                                                            }
                                                            var d = {
                                                                'lines': newLines,
                                                                'nodes': newNodes,
                                                                'groups': allGroups
                                                            }
                                                            sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network = d;
                                                            var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                                            var oGraph = sap.ui.getCore().byId("new_edit_dialog").getParent().byId("graph");
                                                            oGraph.setModel(oModel);
                                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                                        },
                                                        error: function(response){
                                                            console.log(response);
                                                            sap.ui.core.BusyIndicator.hide(0);
                                                            sap.ui.getCore().byId("new_edit_dialog").destroy();
                                                        }
                                                    });
                                                }
                                            }),
                                            new sap.m.Button({
                                                text: 'Remove',
                                                type: 'Accept',
                                                press: function () {
                                                    sap.ui.core.BusyIndicator.show(0);
                                                    // Store a prepared list of all the attributes and placeholders or updated values
                                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                                    var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes;
                                                    var allLines = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines;
                                                    var allGroups = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups;
                                                    //Reset the graph
                                                    this.oParent.oParent.destroyGroups();
                                                    this.oParent.oParent.destroyNodes();
                                                    this.oParent.oParent.destroyLines();

                                                    var allGroupsKeys = [];
                                                    for(var i=0; i<sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups.length; i++){
                                                        allGroupsKeys.push(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.groups[i].key);
                                                    }
                                                    var newNodes = [];
                                                    var newLines = [];
                                                    var newGroupKeys = [];
                                                    var newGroups = [];
                                                    for(var i=0; i< allNodes.length; i++){
                                                        if(allNodes[i].key != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                            newNodes.push(allNodes[i]);
                                                            this.oParent.oParent.addNode(new Node(allNodes[i]));
                                                            if(newGroupKeys.indexOf(allNodes[i].group) == -1){
                                                                newGroupKeys.push(allNodes[i].group);
                                                                for(var j=0; j<allGroups.length; j++){
                                                                    if(allGroups[j].key == allNodes[i].group){
                                                                        newGroups.push(allGroups[j]);
                                                                        this.oParent.oParent.addGroup(new Group(allGroups[j]));
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                    for(var i=0; i< allLines.length; i++){
                                                        if(allLines[i].to != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                            if(allLines[i].from != sap.ui.getCore().getModel('selectedNode').oData.key){
                                                                newLines.push(allLines[i]);
                                                                this.oParent.oParent.addLine(new Line(allLines[i]));
                                                            }
                                                        }
                                                    }
                                                    var d = {
                                                        'lines': newLines,
                                                        'nodes': newNodes,
                                                        'groups': newGroups
                                                    }
                                                    sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network = d;
                                                    var oModel = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network);
                                                    sap.ui.getCore().byId("new_edit_dialog").getParent().setModel(oModel);
                                                    sap.ui.core.BusyIndicator.hide(0);
                                                    sap.ui.getCore().byId("new_edit_dialog").destroy();
                                                }
                                            }),
                                            new sap.m.Button({
                                                text: 'Cancel',
                                                type: 'Transparent',
                                                press: function () {
                                                    sap.ui.getCore().byId("new_edit_dialog").close();
                                                    sap.ui.getCore().byId("new_edit_dialog").destroy();
                                                }
                                            }),
                                        ]
                                    });
                                    this.oParent.oParent.addDependent(editDialog);
                                    editDialog.open();
                                }
                            });
                            var newActTraverse = new ActionButton ({
                                icon: "sap-icon://overview-chart",
                                title: "Traverse",
                                position: "Left",
                                press: function (oEvent) {

                                    var NodeKey = oEvent.getSource().oParent.getKey();
                                    var oData = {
                                        'key': NodeKey,
                                        'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                        'cur_graph': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network
                                        };

                                    var selectedNode = new JSONModel({'key': NodeKey, 'title': NodeTitle});
                                    sap.ui.getCore().setModel(selectedNode, "selectedNode");

                                    jQuery.ajax({
                                        url : "/OrientDB/traverse",
                                        type : "POST",
                                        dataType : "json",
                                        async : true,
                                        data : oData,
                                        success : function(response){
                                            var oData = new JSONModel({
                                                'nodes': response.results.cur_graph.nodes,
                                                'lines':  response.results.cur_graph.lines,
                                                'groups':  response.results.cur_graph.groups
                                                })
                                            window.oGraph.setModel(oData);
                                            MessageToast.show(response.message);
                                        }
                                    });
                                }
                            });
                            // Add the buttons to the Node
                            newNode.addActionButton(newActLink);
                            newNode.addActionButton(newActEdit);
                            newNode.addActionButton(newActTraverse);
                            sap.ui.getCore().byId('new_node').getParent().addNode(newNode);
                            //Update the model
                            sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes.push(response.d.results);
                            sap.ui.getCore().getModel('OrientDBModel').refresh();
                            MessageToast.show(response.d.message);
                            sap.ui.getCore().byId("new_node").destroy();
                            //Update the index TODO Reuse
                            var oModelGraph = new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network);
                            sap.ui.getCore().getModel('GraphIndex').oData.graphs.push(oModelGraph);
                            window.oGraphCurIndex = sap.ui.getCore().getModel('GraphIndex').oData.graphs.length-1;

                        },
                        error: function(response){
                            console.log(response);
                            sap.ui.core.BusyIndicator.hide(0);
                            sap.ui.getCore().byId("new_node").destroy();
                        }
                    });
                }
            }),
            endButton: new sap.m.Button({
                text: 'Cancel',
                type: 'Reject',
                press: function () {
                    sap.ui.getCore().byId("new_node").close();
                    sap.ui.getCore().byId("new_node").destroy();
                }
            })
        });
        //Enables access to graph as getParent().addNode()
        this.addDependent(this.pressDialog);
        this.pressDialog.open();
    },

    getTraversalFromNode: function (oEvent) {
        var oThis = this;
        var NodeKey = oEvent.getSource().oParent.getKey();
        var NodeTitle = oEvent.getSource().oParent.getTitle();
        var selectedNode = new JSONModel({'key': NodeKey, 'title': NodeTitle});
        sap.ui.getCore().setModel(selectedNode, "selectedNode");

        this.TraverseDialog = new Dialog("NodeTraverseDialog", {
            title: "Traversal Options",
            draggable: true,
            resizable: true,
            content:
                new sap.ui.layout.form.SimpleForm({
                    content:
                        [
                            new sap.m.SegmentedButton("TraverseType", {
                                items: [
                                    new sap.m.SegmentedButtonItem({'text': 'In', 'key': 'in'}),
                                    new sap.m.SegmentedButtonItem({'text': 'Out', 'key': 'out'}),
                                    new sap.m.SegmentedButtonItem({'text': 'Both', 'key': 'both'}),
                                    ],
                                selectedKey: 'Both'
                                })
                        ]
                    }),
            beginButton: new sap.m.Button({
                text: 'Start',
                type: 'Accept',
                press: function () {

                    var oData = {
                        'key': sap.ui.getCore().getModel("selectedNode").oData.key,
                        'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                        'cur_graph': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network,
                        'trav_type': sap.ui.getCore().byId("TraverseType").getSelectedKey()
                        };
                    jQuery.ajax({
                        url : "/OrientDB/traverse",
                        type : "POST",
                        dataType : "json",
                        async : true,
                        data : oData,
                        success : function(response, jqXHR){
                        var graphData = new JSONModel({
                            'nodes': response.results.cur_graph.nodes,
                            'lines':  response.results.cur_graph.lines,
                            'groups':  response.results.cur_graph.groups
                            })
                            //comeback
                        //var oModelGraph = new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network);
                        window.oGraph.destroyAllElements();
                        window.oGraph.setModel(graphData);
                        sap.ui.getCore().getModel('GraphIndex').oData.graphs.push(graphData);
                        window.oGraphCurIndex = sap.ui.getCore().getModel('GraphIndex').oData.graphs.length-1;
                        MessageToast.show(response.message);
                        }
                    });

                    sap.ui.getCore().byId("NodeTraverseDialog").close();
                    sap.ui.getCore().byId("NodeTraverseDialog").destroy();
                }
            }),
            endButton: new sap.m.Button({
                text: 'Cancel',
                type: 'Reject',
                press: function () {
                    sap.ui.getCore().byId("NodeTraverseDialog").close();
                    sap.ui.getCore().byId("NodeTraverseDialog").destroy();
                }
            })
        });
        this.TraverseDialog.open();

    },

    addLine: function () {

	    var oThis = this;
	    var AllNodes = new JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes);

        this.AddLineDialog = new Dialog("new_link_from_toolbar",{
            title: 'New Link',
            draggable: true,
            resizable: true,
            content:
                new sap.ui.layout.form.SimpleForm({
                    content:
                        [
                            new sap.m.Label({
                                text:"Source node"
                                }),
                            new sap.m.Select({
                                id: "aNodeKey_from_toolbar",
                                items: {
                                    path: "/",
                                    sorter: {
                                        path: "{title}"
                                        },
                                    template: new Item({
                                        text: "{title}",
                                        key: "{key}"
                                        })
                                    }
                                }),
                            new sap.m.Label({
                                text:"Target node"
                                }),
                            new sap.m.Select({
                                id: "bNodeKey_from_toolbar",
                                items: {
                                    path: "/",
                                    sorter: {
                                        path: "{title}"
                                        },
                                    template: new Item({
                                        text: "{title}",
                                        key: "{key}"
                                        })
                                    }
                                }),
                            new sap.m.Label({
                                text:"Relationship type"
                                }),
                            new sap.m.Input({
                                id: "RelTypeFromToolbar"
                                })
                        ],

                }),
            beginButton: new sap.m.Button({
                text: 'Create',
                type: 'Accept',
                press: function (oEvent) {
                    sap.ui.core.BusyIndicator.show(0);
                    sap.ui.getCore().byId("new_link_from_toolbar").close();

                    var oData = ({
                                'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
                                'a_node': sap.ui.getCore().byId("aNodeKey_from_toolbar").mProperties.selectedKey,
                                'b_node': sap.ui.getCore().byId("bNodeKey_from_toolbar").mProperties.selectedKey,
                                'rel_type': sap.ui.getCore().byId("RelTypeFromToolbar").mProperties.selectedKey,
                                'rel_direction': 'Out'
                                });

                    var allNodes = sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.nodes
                    for(var i=0; i < allNodes.length; i++){
                        if('key' in allNodes[i]){
                            if(allNodes[i].key == oData['a_node']){
                                oData['a_node_detail'] = allNodes[i];
                            }else if(allNodes[i].key == oData['b_node']){
                                oData['b_node_detail'] = allNodes[i];
                            }
                        }
                    }
                    jQuery.ajax({
                        url : "/OrientDB/create",
                        type : "POST",
                        dataType : "json",
                        async : true,
                        data : oData,
                        success : function(response){
                            // Set up the group
                            sap.ui.core.BusyIndicator.hide(0);
                            // Insert the node with the group set
                            var newLine = new Line(response.d.results);
                            sap.ui.getCore().byId('new_link_from_toolbar').getParent().addLine(newLine);

                            //Update the model
                            sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.network.lines.push(response.d);
                            //TODO reuse
                            var oModelGraph = new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network);
                            sap.ui.getCore().getModel('GraphIndex').oData.graphs.push(oModelGraph);
                            window.oGraphCurIndex = sap.ui.getCore().getModel('GraphIndex').oData.graphs.length-1;
                            MessageToast.show(response.d.message);
                            sap.ui.getCore().byId("new_link_from_toolbar").destroy();
                        },
                        error: function(response){
                            console.log(response);
                            sap.ui.core.BusyIndicator.hide(0);
                            sap.ui.getCore().byId("new_link_from_toolbar").destroy();
                        }
                    });
                }
            }),
            endButton: new sap.m.Button({
                text: 'Cancel',
                type: 'Reject',
                press: function () {
                    sap.ui.getCore().byId("new_link_from_toolbar").close();
                    sap.ui.getCore().byId("new_link_from_toolbar").destroy();
                }
            })
        });
        this.addDependent(this.AddLineDialog);
        this.AddLineDialog.setModel(AllNodes);
        this.AddLineDialog.open();
    },

    onDeleteDBPress: function () {
        var oThis = this;
        var db_name = sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.name;

        var pressDialog = new Dialog("delete_database",{
            title: 'Delete database',
            content: new sap.m.Text({ text: "Are you sure you want to delete " + db_name + " ?" }),
            beginButton: new sap.m.Button({
                text: 'Delete',
                type: 'Accept',
                press: function () {

                    var oData = {'db_name': db_name};

                    jQuery.ajax({
                        url : "/OrientDB/delete_db",
                        type : "POST",
                        dataType : "json",
                        async : true,
                        data : oData,
                        success : function(response){
                            sap.ui.core.BusyIndicator.hide(0);
                            MessageToast.show(response.message);
                            var oModel = new sap.ui.model.json.JSONModel(response.d.results);
                            sap.ui.getCore().setModel(oModel, 'OrientDBModel');
                            oThis.update_dbList();
                        },
                        error: function(response){
                            console.log(response);
                            sap.ui.core.BusyIndicator.hide(0);
                        }
                    });
                    sap.ui.getCore().byId("delete_database").close();
                    sap.ui.core.BusyIndicator.show(0);
                    sap.ui.getCore().byId("delete_database").destroy();
                }
            }),
            endButton: new sap.m.Button({
                text: 'Cancel',
                type: 'Reject',
                press: function () {
                    sap.ui.getCore().byId("delete_database").close();
                    sap.ui.getCore().byId("delete_database").destroy();
                }
            })
        });

            //to get access to the global model
        this.getView().addDependent(pressDialog);
        pressDialog.open();
    },

	onNewDBPress: function () {

	    var oThis = this;

        if (!this.pressDialog) {
            this.pressDialog = new Dialog("new_database",{
                title: 'New Database',
                contentWidth:'1em',
                content:
                    new sap.ui.layout.form.SimpleForm({
                        content:
                        [
                            new sap.m.Label({
                                text:"Name"
                                }),
                            new sap.m.Input({
                                id: "db_name"
                                }),
                            new sap.m.Label({
                                text:"Type"
                                }),
                            new sap.m.Select({
                                id: "db_type",
                                items: [
                                    new sap.ui.core.Item({text: "Graph", key: "DB_TYPE_GRAPH"}),
                                    new sap.ui.core.Item({text: "Document", key: "DB_TYPE_DOCUMENT"})
                                    ]
                                }),
                            new sap.m.Label({
                                text:"Location"
                                }),
                            new sap.m.Select({
                                id: "db_mem_type",
                                items: [
                                    new sap.ui.core.Item({text: "Local storage", key: "STORAGE_TYPE_PLOCAL"}),
                                    new sap.ui.core.Item({text: "In Memory", key: "STORAGE_TYPE_MEMORY"})
                                    ]
                                }),
                            new sap.m.Button({
                                 text : "Add Class",
                                 press : function() {
                                      this.getParent().addField(new sap.m.Text({ text: "Class Name" }));
                                      this.getParent().addField(new sap.m.Input());
                                      this.getParent().addField(new sap.m.Input());
                                      this.getParent().addField(new sap.m.Select({}));
                                 }
                            }),
                        ]
                }),
				beginButton: new sap.m.Button({
					text: 'Create',
					type: 'Accept',
					press: function () {
					    oThis.createODB();
						sap.ui.getCore().byId("new_database").close();
						sap.ui.core.BusyIndicator.show(0);
					}
				}),
				endButton: new sap.m.Button({
					text: 'Cancel',
					type: 'Reject',
					press: function () {
						sap.ui.getCore().byId("new_database").close();
					}
				})
            });

            //to get access to the global model
            this.getView().addDependent(this.pressDialog);
        }

        this.pressDialog.open();
    },

	createODB: function (oEvent){

	    var oThis = this;
	    var oData = {
	        'db_name': sap.ui.getCore().byId("db_name").getValue(),
	        'db_type': sap.ui.getCore().byId("db_type").getSelectedItem().getKey(),
	        'db_memory_type': sap.ui.getCore().byId("db_mem_type").getSelectedItem().getKey()
	    };

	    jQuery.ajax({
            url : "/OrientDB/new_db",
            type : "POST",
            dataType : "json",
            async : true,
            data : oData,
            success : function(response){
                sap.ui.core.BusyIndicator.hide(0);
                MessageToast.show(response.message);
                var oModel = new sap.ui.model.json.JSONModel(response.d.results);
				oThis.update_dbList(oModel);
            },
            error: function(response){
                console.log(response);
                sap.ui.core.BusyIndicator.hide(0);
            }
        });

	},

	onCRUDCreateSelectChange: function (oEvent){
	    // Load the properties into the input fields for a new instance of a class/record of a node/edge
	    var oThis = this;
	    var selected_key = oEvent.getSource().mProperties.selectedKey;
	    var prop_list = [];

	    if(oEvent.getSource().sId.indexOf('create') > 0){
	        var formContainer = "CRUD.create.classes.properties"
	    }

	    for (var i = 0; i < sap.ui.getCore().getModel("CRUDoptions").oData.length; i++){
            if (sap.ui.getCore().getModel("CRUDoptions").oData[i].class === selected_key){
                //Clear the inputs
                var oFormContainer = oThis.getView().byId(formContainer);
	            oFormContainer.destroyFormElements();

                for (var j = 0; j < sap.ui.getCore().getModel("CRUDoptions").oData[i].properties.length; j++){
                    var form_input = new sap.ui.layout.form.FormElement();
                    form_input.setLabel(sap.ui.getCore().getModel("CRUDoptions").oData[i].properties[j])
                    form_input.addField(new sap.m.Input());
                    oFormContainer.addFormElement(form_input);
                }
                var form_input = new sap.ui.layout.form.FormElement();
                form_input.setLabel("Custom field (label, value)")
                form_input.addField(new sap.m.Input());
                oFormContainer.addFormElement(form_input);
            }
        }
	},

    onCRUDRetrievePress: function (oEvent){

        var oThis = this;
        var oData = ({
            'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
            'search_terms': this.byId("CRUD.retrieve.search_terms").getValue(),
            'class_filter': this.byId("CRUD.retrieve.classes").getSelectedItem().mProperties.key,
        });

        jQuery.ajax({
            url : "/OrientDB/retrieve",
            type : "POST",
            dataType : "json",
            async : true,
            data : oData,
            success : function(response){
                sap.ui.core.BusyIndicator.hide(0);
                MessageToast.show(response.message);
                var oModel = new sap.ui.model.json.JSONModel(response.d.results);
				sap.ui.getCore().setModel(oModel, 'OrientDBModel');
            },
            error: function(response){
                console.log(response);
                sap.ui.core.BusyIndicator.hide(0);
            }
        });

    },

	onCRUDCreatePress: function (){

        var formContainers = this.byId("CRUD.create").mAggregations.formContainers;
        var oData = ({
            'db_name': sap.ui.getCore().getModel('OrientDBModel').oData.current_selection.name,
            'class_name': this.byId("CRUD.create.classes").getSelectedItem().mProperties.key,
            'inputs': []
            });

        for (var i = 0; i < formContainers.length; i++){
            for (var j = 0; j < formContainers[i].mAggregations.formElements.length; j++){
                oData.inputs.push({
                    'property': formContainers[i].mAggregations.formElements[j].mAggregations.label,
                    'value': formContainers[i].mAggregations.formElements[j].mAggregations.fields[0].mProperties.value
                })
            }
        }

        jQuery.ajax({
            url : "/OrientDB/create",
            type : "POST",
            dataType : "json",
            async : true,
            data : oData,
            success : function(response){
                sap.ui.core.BusyIndicator.hide(0);
                MessageToast.show(response.message);
                var oModel = new sap.ui.model.json.JSONModel(response.d.results);
				sap.ui.getCore().setModel(oModel, 'OrientDBModel');
				oThis.update_dbList();
            },
            error: function(response){
                console.log(response);
                sap.ui.core.BusyIndicator.hide(0);
            }
        });
	},


	onListItemPress: function (oEvent){
	    var oThis = this;
	    var db_name = oEvent.oSource.mProperties.selectedKey;
	    var cur_model = new sap.ui.model.json.JSONModel(sap.ui.getCore().getModel('OrientDBModel').oData);
        //Match the selected db_name to the index name and reset the cur_model current_selection to the db_name details
	    for (var i = 0; i < cur_model.oData.index.length; i++){
            if (cur_model.oData.index[i].name === db_name){
                cur_model.oData.current_selection = cur_model.oData.index[i];
                sap.ui.getCore().setModel(cur_model, "OrientDBModel");
                this.update_db_summary();
                this.update_db_schema_details();
                sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network = sap.ui.getCore().getModel("OrientDBModel").oData.network[db_name];
                var nModel = new JSONModel(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.network)
                this.updateGraph(nModel);

                var CRUDoptions = [];
                for (var j = 0; j < sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.details.length; j++){
                    var p_list = sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.details[j].prop_list;
                    var c_name = sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.details[j].name;
                    CRUDoptions.push({'class': c_name, 'properties': p_list});
                }
                var oModel = new sap.ui.model.json.JSONModel(CRUDoptions);
                sap.ui.getCore().setModel(oModel, 'CRUDoptions');
                //oThis.getView().byId("CRUD.create.classes").setModel(oModel);
                //oThis.getView().byId("CRUD.retrieve.classes").setModel(oModel);
                this.onPressGetSample();
                break;
            }
        }
    },

    onPressGetSample: function (){
    	var oThis = this;
	    var oData = {
	        'db_name': sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.name
	    };
	    oData.db_classes = [];
	    for (var i = 0; i < sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.details.length; i++){
            oData.db_classes.push(sap.ui.getCore().getModel("OrientDBModel").oData.current_selection.details[i].name);
        }

	    jQuery.ajax({
            url : "/OrientDB/get_sample",
            type : "POST",
            dataType : "json",
            async : true,
            data : oData,
            success : function(response){
                sap.ui.core.BusyIndicator.hide(0);
                MessageToast.show(response.message);
                var oModel = new sap.ui.model.json.JSONModel(response.d.results);
                oThis.getView().byId("db_sample").setModel(oModel);
                oThis.getView().getModel().refresh();
            },
            error: function(response){
                console.log(response);
                sap.ui.core.BusyIndicator.hide(0);
            }
        });

	},

	onSemanticButtonPress: function (oEvent) {

		var sAction = oEvent.getSource().getMetadata().getName();
		sAction = sAction.replace(oEvent.getSource().getMetadata().getLibraryName() + ".", "");

		sap.m.MessageToast.show("Pressed: " + sAction);
	},
	onSemanticSelectChange: function (oEvent, oData) {
		var sAction = oEvent.getSource().getMetadata().getName();
		sAction = sAction.replace(oEvent.getSource().getMetadata().getLibraryName() + ".", "");

		var sStatusText = sAction + " by " + oEvent.getSource().getSelectedItem().getText();
		sap.m.MessageToast.show("Selected: " + sStatusText);
	},
	onPositionChange: function (oEvent) {
		sap.m.MessageToast.show("Positioned changed to " + oEvent.getParameter("newPosition"));
	},
	onMessagesButtonPress: function(oEvent) {

		var oMessagesButton = oEvent.getSource();
		if (!this._messagePopover) {
			this._messagePopover = new MessagePopover({
				items: {
					path: "message>/",
					template: new MessagePopoverItem({
						description: "{message>description}",
						type: "{message>type}",
						title: "{message>message}"
					})
				}
			});
			oMessagesButton.addDependent(this._messagePopover);
		}
		this._messagePopover.toggle(oMessagesButton);
	},
	onMultiSelectPress: function(oEvent) {
		if (oEvent.getSource().getPressed()) {
			sap.m.MessageToast.show("MultiSelect Pressed");
		} else {
			sap.m.MessageToast.show("MultiSelect Unpressed");
		}
	},

	makeMap: function(){
      this.oPage = this.byId("OrientMap");
      var oVBI = new sap.ui.vbm.GeoMap();

      var conf = {
            "MapProvider":[
              {
              	"Id" : "OSM",
                "name" : "Open Street Map",
                "tileX" : "256",
                "tileY" : "256",
                "minLOD" : "1",
                "maxLOD" : "19",
                "copyright" : "OpenStreetMap",
                "Source" : [{
                	"id" : "a",
                  "url" : "https://a.tile.openstreetmap.org/{LOD}/{X}/{Y}.png"
                }]
              }
            ],
            "MapLayerStacks":
            [
              {
              	"name" : "Default",
                "MapLayer": [
                	{
                  	"name": "Default",
                		"refMapProvider": "Open Street Map",
                		"opacity": "1.0",
                		"colBkgnd": "RGB(255,255,255)"
                  }
                ]
              }
            ]
			};
      oVBI.setMapConfiguration(conf);

      this.oPage.addContent(oVBI);


	}

});


	return PageController;

});